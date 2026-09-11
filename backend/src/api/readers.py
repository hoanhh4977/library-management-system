import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.db import get_session
from src.core.deps import get_current_profile, require_role
from src.models.book import Book
from src.models.library_card import LibraryCard
from src.models.loan import Loan
from src.models.loan_detail import LoanDetail
from src.models.profile import Profile
from src.schemas.loan import LoanDetailOut, LoanOut
from src.schemas.profile import CardOut, ReaderOut, ReaderUpdate
from src.services.card_service import CardServiceError, issue_card

router = APIRouter(prefix="/api/readers", tags=["readers"])


async def _to_reader_out(session: AsyncSession, reader: Profile) -> ReaderOut:
    card = (
        await session.execute(select(LibraryCard).where(LibraryCard.reader_id == reader.id))
    ).scalar_one_or_none()
    return ReaderOut(
        id=reader.id,
        code=reader.code,
        full_name=reader.full_name,
        date_of_birth=reader.date_of_birth,
        phone=reader.phone,
        email=reader.email,
        library_card=CardOut(id=card.id, code=card.code, status=card.status, issued_at=card.issued_at)
        if card
        else None,
        created_at=reader.created_at,
    )


@router.get("", response_model=list[ReaderOut])
async def list_readers(
    q: str = "",
    staff: Profile = Depends(require_role("librarian", "admin")),
    session: AsyncSession = Depends(get_session),
) -> list[ReaderOut]:
    """FR-025 (Admin quản lý danh sách đầy đủ) and the Librarian's reader lookup used to
    find who to issue a card / lend to — same endpoint, `q` narrows by code/name/email.

    Fetches every reader's card in one batched query (keyed by reader_id) rather than
    looping `_to_reader_out` per row — that used to issue one round trip per reader,
    which is slow against the remote (Tokyo) Supabase pooler once the list has more
    than a couple of rows.
    """
    stmt = select(Profile).where(Profile.role == "reader").order_by(Profile.full_name)
    if q:
        pattern = f"%{q}%"
        stmt = stmt.where(
            Profile.full_name.ilike(pattern) | Profile.code.ilike(pattern) | Profile.email.ilike(pattern)
        )
    readers = (await session.execute(stmt)).scalars().all()
    if not readers:
        return []

    cards_by_reader = {
        card.reader_id: card
        for card in (
            await session.execute(
                select(LibraryCard).where(LibraryCard.reader_id.in_([r.id for r in readers]))
            )
        )
        .scalars()
        .all()
    }
    return [
        ReaderOut(
            id=reader.id,
            code=reader.code,
            full_name=reader.full_name,
            date_of_birth=reader.date_of_birth,
            phone=reader.phone,
            email=reader.email,
            library_card=(
                CardOut(id=card.id, code=card.code, status=card.status, issued_at=card.issued_at)
                if (card := cards_by_reader.get(reader.id))
                else None
            ),
            created_at=reader.created_at,
        )
        for reader in readers
    ]


@router.get("/{reader_id}", response_model=ReaderOut)
async def get_reader(
    reader_id: uuid.UUID,
    staff: Profile = Depends(require_role("librarian", "admin")),
    session: AsyncSession = Depends(get_session),
) -> ReaderOut:
    reader = await session.get(Profile, reader_id)
    if reader is None or reader.role != "reader":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy Độc giả")
    return await _to_reader_out(session, reader)


@router.patch("/{reader_id}", response_model=ReaderOut)
async def update_reader(
    reader_id: uuid.UUID,
    payload: ReaderUpdate,
    _: Profile = Depends(require_role("librarian", "admin")),
    session: AsyncSession = Depends(get_session),
) -> ReaderOut:
    reader = await session.get(Profile, reader_id)
    if reader is None or reader.role != "reader":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy Độc giả")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(reader, field, value)
    await session.commit()
    return await _to_reader_out(session, reader)


@router.post("/{reader_id}/card", response_model=CardOut)
async def issue_card_endpoint(
    reader_id: uuid.UUID,
    librarian: Profile = Depends(require_role("librarian")),
    session: AsyncSession = Depends(get_session),
) -> CardOut:
    try:
        card = await issue_card(session, reader_id=reader_id, librarian_id=librarian.id)
    except LookupError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    except CardServiceError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc
    return CardOut(id=card.id, code=card.code, status=card.status, issued_at=card.issued_at)


@router.get("/{reader_id}/loans", response_model=list[LoanOut])
async def get_reader_loan_history(
    reader_id: uuid.UUID,
    profile: Profile = Depends(get_current_profile),
    session: AsyncSession = Depends(get_session),
) -> list[LoanOut]:
    """FR-022 (Độc giả xem lịch sử của chính mình) / FR-023 (Thủ thư tra cứu bất kỳ) /
    FR-028 (Độc giả không xem được dữ liệu người khác)."""
    if profile.role == "reader" and profile.id != reader_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Bạn chỉ được xem lịch sử mượn của chính mình")

    loans = (
        (await session.execute(select(Loan).where(Loan.reader_id == reader_id).order_by(Loan.loan_date.desc())))
        .scalars()
        .all()
    )

    result: list[LoanOut] = []
    for loan in loans:
        rows = (
            await session.execute(
                select(LoanDetail, Book.title, Book.cover_image_url)
                .join(Book, Book.id == LoanDetail.book_id)
                .where(LoanDetail.loan_id == loan.id)
            )
        ).all()
        details = [
            LoanDetailOut(
                book_id=d.book_id,
                book_title=title,
                book_cover_image_url=cover_image_url,
                quantity=d.quantity,
                actual_return_date=d.actual_return_date,
                status=d.status,
            )
            for d, title, cover_image_url in rows
        ]
        result.append(
            LoanOut(
                id=loan.id,
                code=loan.code,
                reader_id=loan.reader_id,
                librarian_id=loan.librarian_id,
                loan_date=loan.loan_date,
                due_date=loan.due_date,
                renewed=loan.renewed,
                details=details,
            )
        )
    return result
