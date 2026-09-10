import uuid
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.db import get_session
from src.core.deps import get_current_profile, require_role
from src.models.book import Book
from src.models.library_card import LibraryCard
from src.models.loan import Loan
from src.models.loan_request import LoanRequest, LoanRequestItem
from src.models.profile import Profile
from src.schemas.loan import LoanItemResult
from src.schemas.loan_request import (
    ApproveBorrowResponse,
    ApproveRenewResponse,
    CreateBorrowRequest,
    CreateRenewRequest,
    LoanRequestOut,
    RequestItemOut,
)
from src.services.loan_request_service import (
    LoanOperationError,
    LoanRejected,
    LoanRequestError,
    approve_request,
    create_borrow_request,
    create_renew_request,
    reject_request,
)

router = APIRouter(prefix="/api/loan-requests", tags=["loan-requests"])


async def _to_out(session: AsyncSession, request: LoanRequest) -> LoanRequestOut:
    reader = await session.get(Profile, request.reader_id)
    loan_code = None
    if request.loan_id:
        loan = await session.get(Loan, request.loan_id)
        loan_code = loan.code if loan else None

    items: list[RequestItemOut] = []
    if request.kind == "borrow":
        rows = (
            await session.execute(
                select(LoanRequestItem, Book.title, Book.cover_image_url)
                .join(Book, Book.id == LoanRequestItem.book_id)
                .where(LoanRequestItem.request_id == request.id)
            )
        ).all()
        items = [
            RequestItemOut(book_id=i.book_id, book_title=title, book_cover_image_url=cover_image_url, quantity=i.quantity)
            for i, title, cover_image_url in rows
        ]

    return LoanRequestOut(
        id=request.id,
        kind=request.kind,
        status=request.status,
        reader_id=request.reader_id,
        reader_name=reader.full_name if reader else "",
        loan_id=request.loan_id,
        loan_code=loan_code,
        items=items,
        requested_at=request.requested_at,
        reviewed_by=request.reviewed_by,
        reviewed_at=request.reviewed_at,
    )


@router.post("/borrow", response_model=LoanRequestOut)
async def request_borrow(
    payload: CreateBorrowRequest,
    reader: Profile = Depends(require_role("reader")),
    session: AsyncSession = Depends(get_session),
) -> LoanRequestOut:
    try:
        request = await create_borrow_request(
            session, reader_id=reader.id, items=[(i.book_id, i.quantity) for i in payload.items]
        )
    except LoanRequestError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc
    return await _to_out(session, request)


@router.post("/renew", response_model=LoanRequestOut)
async def request_renew(
    payload: CreateRenewRequest,
    reader: Profile = Depends(require_role("reader")),
    session: AsyncSession = Depends(get_session),
) -> LoanRequestOut:
    try:
        request = await create_renew_request(session, reader_id=reader.id, loan_id=payload.loan_id)
    except LookupError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    except LoanRequestError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc
    return await _to_out(session, request)


@router.get("/mine", response_model=list[LoanRequestOut])
async def list_my_requests(
    reader: Profile = Depends(require_role("reader")),
    session: AsyncSession = Depends(get_session),
) -> list[LoanRequestOut]:
    requests = (
        (
            await session.execute(
                select(LoanRequest).where(LoanRequest.reader_id == reader.id).order_by(LoanRequest.requested_at.desc())
            )
        )
        .scalars()
        .all()
    )
    return [await _to_out(session, r) for r in requests]


@router.get("", response_model=list[LoanRequestOut])
async def list_requests_for_review(
    status_filter: Literal["pending", "approved", "rejected"] | None = "pending",
    _: Profile = Depends(require_role("librarian", "admin")),
    session: AsyncSession = Depends(get_session),
) -> list[LoanRequestOut]:
    stmt = select(LoanRequest).order_by(LoanRequest.requested_at.desc())
    if status_filter:
        stmt = stmt.where(LoanRequest.status == status_filter)
    requests = (await session.execute(stmt)).scalars().all()
    return [await _to_out(session, r) for r in requests]


async def _get_request_or_404(session: AsyncSession, request_id: uuid.UUID) -> LoanRequest:
    request = await session.get(LoanRequest, request_id)
    if request is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy yêu cầu")
    if request.status != "pending":
        raise HTTPException(status.HTTP_409_CONFLICT, "Yêu cầu này đã được xử lý")
    return request


@router.post("/{request_id}/approve")
async def approve(
    request_id: uuid.UUID,
    staff: Profile = Depends(require_role("librarian", "admin")),
    session: AsyncSession = Depends(get_session),
):
    request = await _get_request_or_404(session, request_id)

    card_status = None
    if request.kind == "borrow":
        card = (
            await session.execute(select(LibraryCard).where(LibraryCard.reader_id == request.reader_id))
        ).scalar_one_or_none()
        if card is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Độc giả chưa có Thẻ thư viện")
        card_status = card.status

    try:
        loan, results = await approve_request(session, request=request, reviewer_id=staff.id, card_status=card_status)
    except LoanRejected as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc
    except LoanOperationError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc

    if request.kind == "borrow":
        from src.api.loans import _load_loan_out  # local import avoids a circular top-level import

        loan_out = await _load_loan_out(session, loan.id) if loan else None
        item_results = [LoanItemResult(book_id=b, ok=ok, detail=detail) for b, ok, detail in (results or [])]
        return ApproveBorrowResponse(loan=loan_out, items=item_results)

    return ApproveRenewResponse(due_date=loan.due_date.isoformat(), renewed=loan.renewed)


@router.post("/{request_id}/reject", response_model=LoanRequestOut)
async def reject(
    request_id: uuid.UUID,
    staff: Profile = Depends(require_role("librarian", "admin")),
    session: AsyncSession = Depends(get_session),
) -> LoanRequestOut:
    request = await _get_request_or_404(session, request_id)
    request = await reject_request(session, request=request, reviewer_id=staff.id)
    return await _to_out(session, request)
