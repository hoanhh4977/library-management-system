import uuid
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.db import get_session
from src.core.deps import get_current_profile, require_role
from src.models.book import Book
from src.models.category import BookCategory, Category
from src.schemas.book import BookCreate, BookOut, BookUpdate

router = APIRouter(prefix="/api/books", tags=["books"])

SearchField = Literal["title", "author", "category"]


async def _categories_by_book(session: AsyncSession, book_ids: list[uuid.UUID]) -> dict[uuid.UUID, list[str]]:
    """Batched (one query for N books) lookup of category names — avoids an N+1
    when rendering a whole search-result page of books."""
    if not book_ids:
        return {}
    rows = (
        await session.execute(
            select(BookCategory.book_id, Category.name)
            .join(Category, Category.id == BookCategory.category_id)
            .where(BookCategory.book_id.in_(book_ids))
            .order_by(Category.name)
        )
    ).all()
    result: dict[uuid.UUID, list[str]] = {book_id: [] for book_id in book_ids}
    for book_id, name in rows:
        result[book_id].append(name)
    return result


def _to_book_out(book: Book, categories: list[str]) -> BookOut:
    return BookOut(
        id=book.id,
        code=book.code,
        title=book.title,
        author=book.author,
        publisher=book.publisher,
        categories=categories,
        quantity=book.quantity,
        cover_image_url=book.cover_image_url,
    )


async def _get_or_create_categories(session: AsyncSession, names: list[str]) -> list[Category]:
    """Find-or-create by name (case-sensitive, matching FR-003's exact-value search
    convention elsewhere) — so "Lịch sử" typed on two different books' forms always
    resolves to the same Category row instead of quietly duplicating it."""
    unique_names = list(dict.fromkeys(n.strip() for n in names if n.strip()))
    if not unique_names:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cần chọn ít nhất một thể loại")

    existing = (await session.execute(select(Category).where(Category.name.in_(unique_names)))).scalars().all()
    existing_by_name = {c.name: c for c in existing}

    categories: list[Category] = []
    for name in unique_names:
        category = existing_by_name.get(name)
        if category is None:
            category = Category(id=uuid.uuid4(), name=name)
            session.add(category)
            existing_by_name[name] = category
        categories.append(category)
    return categories


@router.get("", response_model=list[BookOut])
async def search_books(
    q: str = "",
    field: SearchField | None = None,
    _: object = Depends(get_current_profile),
    session: AsyncSession = Depends(get_session),
) -> list[BookOut]:
    """Tra cứu Sách theo Tên sách/Tác giả/Thể loại (FR-003)."""
    stmt = select(Book).order_by(Book.title)
    if q:
        pattern = f"%{q}%"
        category_match = (
            select(BookCategory.book_id)
            .join(Category, Category.id == BookCategory.category_id)
            .where(Category.name.ilike(pattern))
        )
        if field == "title":
            stmt = stmt.where(Book.title.ilike(pattern))
        elif field == "author":
            stmt = stmt.where(Book.author.ilike(pattern))
        elif field == "category":
            stmt = stmt.where(Book.id.in_(category_match))
        else:
            stmt = stmt.where(Book.title.ilike(pattern) | Book.author.ilike(pattern) | Book.id.in_(category_match))

    books = (await session.execute(stmt)).scalars().all()
    categories_by_book = await _categories_by_book(session, [b.id for b in books])
    return [_to_book_out(book, categories_by_book.get(book.id, [])) for book in books]


@router.post("", response_model=BookOut)
async def create_book(
    payload: BookCreate,
    _: object = Depends(require_role("librarian", "admin")),
    session: AsyncSession = Depends(get_session),
) -> BookOut:
    categories = await _get_or_create_categories(session, payload.categories)

    book = Book(
        id=uuid.uuid4(),
        code=f"S{uuid.uuid4().hex[:6].upper()}",
        title=payload.title,
        author=payload.author,
        publisher=payload.publisher,
        quantity=payload.quantity,
        cover_image_url=payload.cover_image_url,
    )
    session.add(book)
    await session.flush()  # book.id must exist before the book_categories rows reference it
    for category in categories:
        session.add(BookCategory(book_id=book.id, category_id=category.id))
    await session.commit()

    return _to_book_out(book, [c.name for c in categories])


@router.patch("/{book_id}", response_model=BookOut)
async def update_book(
    book_id: uuid.UUID,
    payload: BookUpdate,
    _: object = Depends(require_role("librarian", "admin")),
    session: AsyncSession = Depends(get_session),
) -> BookOut:
    book = await session.get(Book, book_id)
    if book is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy Mã sách")

    for field, value in payload.model_dump(exclude_unset=True, exclude={"categories"}).items():
        setattr(book, field, value)

    if payload.categories is not None:
        # Replace wholesale rather than diffing — simpler, and the set is small
        # enough (a handful of thể loại per book) that this is never a real cost.
        categories = await _get_or_create_categories(session, payload.categories)
        await session.execute(delete(BookCategory).where(BookCategory.book_id == book.id))
        await session.flush()
        for category in categories:
            session.add(BookCategory(book_id=book.id, category_id=category.id))

    await session.commit()

    categories_by_book = await _categories_by_book(session, [book.id])
    return _to_book_out(book, categories_by_book.get(book.id, []))
