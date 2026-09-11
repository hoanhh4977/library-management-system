import uuid
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.db import get_session
from src.core.deps import get_current_profile, require_role
from src.models.book import Book
from src.schemas.book import BookCreate, BookOut, BookUpdate

router = APIRouter(prefix="/api/books", tags=["books"])

SearchField = Literal["title", "author", "category"]


@router.get("", response_model=list[BookOut])
async def search_books(
    q: str = "",
    field: SearchField | None = None,
    _: object = Depends(get_current_profile),
    session: AsyncSession = Depends(get_session),
) -> list[Book]:
    """Tra cứu Sách theo Tên sách/Tác giả/Thể loại (FR-003)."""
    stmt = select(Book).order_by(Book.title)
    if q:
        pattern = f"%{q}%"
        if field == "title":
            stmt = stmt.where(Book.title.ilike(pattern))
        elif field == "author":
            stmt = stmt.where(Book.author.ilike(pattern))
        elif field == "category":
            stmt = stmt.where(Book.category.ilike(pattern))
        else:
            stmt = stmt.where(
                Book.title.ilike(pattern) | Book.author.ilike(pattern) | Book.category.ilike(pattern)
            )
    return (await session.execute(stmt)).scalars().all()


@router.post("", response_model=BookOut)
async def create_book(
    payload: BookCreate,
    _: object = Depends(require_role("librarian", "admin")),
    session: AsyncSession = Depends(get_session),
) -> Book:
    book = Book(id=uuid.uuid4(), code=f"S{uuid.uuid4().hex[:6].upper()}", **payload.model_dump())
    session.add(book)
    await session.commit()
    return book


@router.patch("/{book_id}", response_model=BookOut)
async def update_book(
    book_id: uuid.UUID,
    payload: BookUpdate,
    _: object = Depends(require_role("librarian", "admin")),
    session: AsyncSession = Depends(get_session),
) -> Book:
    book = await session.get(Book, book_id)
    if book is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy Mã sách")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(book, field, value)
    await session.commit()
    return book
