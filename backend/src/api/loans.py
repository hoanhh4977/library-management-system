import uuid
from datetime import date

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
from src.schemas.loan import (
    ConfirmCompensationResponse,
    LoanDetailOut,
    LoanItemResult,
    LoanOut,
    NewLoanRequest,
    NewLoanResponse,
    RenewResponse,
    ReportLostResponse,
    ReturnItemResponse,
)
from src.services.loan_service import (
    LoanOperationError,
    LoanRejected,
    confirm_compensation,
    create_loan,
    renew_loan,
    report_lost,
    return_item,
)

router = APIRouter(prefix="/api/loans", tags=["loans"])


async def _load_loan_out(session: AsyncSession, loan_id: uuid.UUID) -> LoanOut | None:
    loan = await session.get(Loan, loan_id)
    if loan is None:
        return None
    rows = (
        await session.execute(
            select(LoanDetail, Book.title, Book.cover_image_url)
            .join(Book, Book.id == LoanDetail.book_id)
            .where(LoanDetail.loan_id == loan_id)
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
    return LoanOut(
        id=loan.id,
        code=loan.code,
        reader_id=loan.reader_id,
        librarian_id=loan.librarian_id,
        loan_date=loan.loan_date,
        due_date=loan.due_date,
        renewed=loan.renewed,
        details=details,
    )


@router.post("", response_model=NewLoanResponse)
async def create_loan_endpoint(
    payload: NewLoanRequest,
    librarian: Profile = Depends(require_role("librarian")),
    session: AsyncSession = Depends(get_session),
) -> NewLoanResponse:
    card = (
        await session.execute(select(LibraryCard).where(LibraryCard.reader_id == payload.reader_id))
    ).scalar_one_or_none()
    if card is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Độc giả chưa có Thẻ thư viện")

    try:
        loan, results = await create_loan(
            session,
            reader_id=payload.reader_id,
            librarian_id=librarian.id,
            card_status=card.status,
            items=[(i.book_id, i.quantity) for i in payload.items],
        )
    except LoanRejected as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc

    item_results = [LoanItemResult(book_id=b, ok=ok, detail=detail) for b, ok, detail in results]
    loan_out = await _load_loan_out(session, loan.id) if loan else None
    return NewLoanResponse(loan=loan_out, items=item_results)


@router.get("/{loan_id}", response_model=LoanOut)
async def get_loan(
    loan_id: uuid.UUID,
    profile: Profile = Depends(get_current_profile),
    session: AsyncSession = Depends(get_session),
) -> LoanOut:
    loan_out = await _load_loan_out(session, loan_id)
    if loan_out is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy phiếu mượn")
    if profile.role == "reader" and loan_out.reader_id != profile.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Bạn không có quyền xem phiếu mượn này")
    return loan_out


@router.post("/{loan_id}/items/{book_id}/return", response_model=ReturnItemResponse)
async def return_item_endpoint(
    loan_id: uuid.UUID,
    book_id: uuid.UUID,
    _: Profile = Depends(require_role("librarian")),
    session: AsyncSession = Depends(get_session),
) -> ReturnItemResponse:
    try:
        returned_date, on_time = await return_item(session, loan_id, book_id)
    except LookupError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    return ReturnItemResponse(
        book_id=book_id, status="returned", actual_return_date=date.fromisoformat(returned_date), on_time=on_time
    )


@router.post("/{loan_id}/renew", response_model=RenewResponse)
async def renew_loan_endpoint(
    loan_id: uuid.UUID,
    _: Profile = Depends(require_role("librarian")),
    session: AsyncSession = Depends(get_session),
) -> RenewResponse:
    try:
        loan = await renew_loan(session, loan_id)
    except LookupError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    except LoanOperationError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc
    return RenewResponse(due_date=loan.due_date, renewed=loan.renewed)


@router.post("/{loan_id}/items/{book_id}/report-lost", response_model=ReportLostResponse)
async def report_lost_endpoint(
    loan_id: uuid.UUID,
    book_id: uuid.UUID,
    _: Profile = Depends(require_role("librarian")),
    session: AsyncSession = Depends(get_session),
) -> ReportLostResponse:
    try:
        detail = await report_lost(session, loan_id, book_id)
    except LoanOperationError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc
    return ReportLostResponse(book_id=book_id, status=detail.status)


@router.post("/{loan_id}/items/{book_id}/confirm-compensation", response_model=ConfirmCompensationResponse)
async def confirm_compensation_endpoint(
    loan_id: uuid.UUID,
    book_id: uuid.UUID,
    staff: Profile = Depends(require_role("librarian", "admin")),
    session: AsyncSession = Depends(get_session),
) -> ConfirmCompensationResponse:
    try:
        detail = await confirm_compensation(session, loan_id, book_id, confirmed_by=staff.id)
    except LoanOperationError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc
    return ConfirmCompensationResponse(
        book_id=book_id,
        status=detail.status,
        compensation_confirmed_by=detail.compensation_confirmed_by,
        compensation_confirmed_at=detail.compensation_confirmed_at,
    )
