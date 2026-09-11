import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.loan import Loan
from src.models.loan_request import LoanRequest, LoanRequestItem
from src.services.loan_service import (
    ALLOWED_LOAN_PERIOD_DAYS,
    ALLOWED_RENEWAL_DAYS,
    LOAN_PERIOD_DAYS,
    RENEWAL_EXTENSION_DAYS,
    LoanOperationError,
    LoanRejected,
    create_loan,
    renew_loan,
)


class LoanRequestError(Exception):
    """Raised for any 404/409-worthy loan-request business rule violation."""


async def create_borrow_request(
    session: AsyncSession,
    *,
    reader_id: uuid.UUID,
    items: list[tuple[uuid.UUID, int]],
    loan_period_days: int = LOAN_PERIOD_DAYS,
) -> LoanRequest:
    if not items:
        raise LoanRequestError("Cần chọn ít nhất một cuốn sách")
    if loan_period_days not in ALLOWED_LOAN_PERIOD_DAYS:
        raise LoanRequestError("Thời hạn mượn không hợp lệ")

    request = LoanRequest(
        id=uuid.uuid4(),
        reader_id=reader_id,
        kind="borrow",
        loan_period_days=loan_period_days,
        status="pending",
    )
    session.add(request)
    await session.flush()
    for book_id, quantity in items:
        session.add(LoanRequestItem(request_id=request.id, book_id=book_id, quantity=quantity))
    await session.commit()
    return request


async def create_renew_request(
    session: AsyncSession, *, reader_id: uuid.UUID, loan_id: uuid.UUID, extension_days: int
) -> LoanRequest:
    if extension_days not in ALLOWED_RENEWAL_DAYS:
        raise LoanRequestError("Số ngày gia hạn không hợp lệ")

    loan = await session.get(Loan, loan_id)
    if loan is None or loan.reader_id != reader_id:
        raise LookupError("Không tìm thấy phiếu mượn của bạn")

    existing = (
        await session.execute(
            select(LoanRequest).where(
                LoanRequest.loan_id == loan_id,
                LoanRequest.kind == "renew",
                LoanRequest.status == "pending",
            )
        )
    ).scalar_one_or_none()
    if existing is not None:
        raise LoanRequestError("Đã có yêu cầu gia hạn đang chờ duyệt cho phiếu mượn này")

    request = LoanRequest(
        id=uuid.uuid4(),
        reader_id=reader_id,
        kind="renew",
        loan_id=loan_id,
        extension_days=extension_days,
        status="pending",
    )
    session.add(request)
    await session.commit()
    return request


async def approve_request(
    session: AsyncSession, *, request: LoanRequest, reviewer_id: uuid.UUID, card_status: str | None
):
    """Executes the request via the SAME service functions a Librarian's direct action
    would use (create_loan / renew_loan) — every FR-012..FR-018 rule still applies, only
    the trigger differs. Raises LoanRejected/LoanOperationError (left un-caught, kept
    pending) if the underlying operation is rejected, mirroring card unlock-requests where
    a failed approval doesn't silently become a rejection."""
    if request.kind == "borrow":
        items_rows = (
            await session.execute(select(LoanRequestItem).where(LoanRequestItem.request_id == request.id))
        ).scalars().all()
        loan, results = await create_loan(
            session,
            reader_id=request.reader_id,
            librarian_id=reviewer_id,
            card_status=card_status or "locked",
            items=[(i.book_id, i.quantity) for i in items_rows],
            loan_period_days=request.loan_period_days or LOAN_PERIOD_DAYS,
        )
        request.status = "approved"
        request.reviewed_by = reviewer_id
        request.reviewed_at = datetime.now(timezone.utc)
        if loan is not None:
            # Lets staff jump from the resolved request straight to the Loan it created
            # (see LoanDetailModal) — previously only kind='renew' requests carried a
            # loan_id, so an approved borrow request had no way to reference its Loan.
            request.loan_id = loan.id
        await session.commit()
        return loan, results

    loan = await renew_loan(session, request.loan_id, request.extension_days or RENEWAL_EXTENSION_DAYS)
    request.status = "approved"
    request.reviewed_by = reviewer_id
    request.reviewed_at = datetime.now(timezone.utc)
    await session.commit()
    return loan, None


async def reject_request(session: AsyncSession, *, request: LoanRequest, reviewer_id: uuid.UUID) -> LoanRequest:
    request.status = "rejected"
    request.reviewed_by = reviewer_id
    request.reviewed_at = datetime.now(timezone.utc)
    await session.commit()
    return request


__all__ = [
    "LoanRequestError",
    "LoanOperationError",
    "LoanRejected",
    "create_borrow_request",
    "create_renew_request",
    "approve_request",
    "reject_request",
]
