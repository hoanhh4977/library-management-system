import uuid
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.book import Book
from src.models.loan import Loan
from src.models.loan_detail import LoanDetail
from src.services.card_service import sync_card_lock_status
from src.services.eligibility import reader_has_violation

LOAN_PERIOD_DAYS = 14  # FR-013 default — used when no explicit choice is given
ALLOWED_LOAN_PERIOD_DAYS = (7, 14, 21, 30)  # options exposed when creating a loan/borrow request
RENEWAL_EXTENSION_DAYS = 7  # FR-018 default — used when no explicit choice is given
ALLOWED_RENEWAL_DAYS = (1, 3, 5, 7)  # options exposed to the reader when requesting a renewal


class LoanRejected(Exception):
    """Raised when an entire loan request must be rejected (card locked / reader in violation)."""


class LoanOperationError(Exception):
    """Raised for any other 404/409-worthy loan/renewal/lost/compensation error."""


async def create_loan(
    session: AsyncSession,
    *,
    reader_id: uuid.UUID,
    librarian_id: uuid.UUID,
    card_status: str,
    items: list[tuple[uuid.UUID, int]],
    loan_period_days: int = LOAN_PERIOD_DAYS,
) -> tuple[Loan | None, list[tuple[uuid.UUID, bool, str | None]]]:
    """Create a Loan + LoanDetails for `items` (book_id, quantity).

    FR-012: the whole request is rejected up front if the card isn't active or the
    reader has an existing violation (overdue / pending compensation).
    FR-015: within an otherwise-eligible request, each item is accepted or rejected
    independently based on its own stock — one out-of-stock title never blocks the rest.
    Returns (loan_or_None, per_item_results) where each result is (book_id, ok, detail).
    """
    if loan_period_days not in ALLOWED_LOAN_PERIOD_DAYS:
        raise LoanOperationError("Thời hạn mượn không hợp lệ")
    if card_status != "active":
        raise LoanRejected("Thẻ bị khóa")
    if await reader_has_violation(session, reader_id):
        raise LoanRejected("Độc giả có sách quá hạn hoặc chưa đền bù")

    results: list[tuple[uuid.UUID, bool, str | None]] = []
    accepted: list[tuple[Book, int]] = []

    for book_id, quantity in items:
        book = await session.get(Book, book_id)
        if book is None:
            results.append((book_id, False, "Không tìm thấy sách"))
            continue
        if book.quantity < quantity:
            results.append((book_id, False, "Sách không đủ số lượng trong kho"))
            continue
        accepted.append((book, quantity))
        results.append((book_id, True, None))

    if not accepted:
        return None, results

    loan = Loan(
        id=uuid.uuid4(),
        code=f"PM{uuid.uuid4().hex[:8].upper()}",
        reader_id=reader_id,
        librarian_id=librarian_id,
        loan_date=date.today(),
        due_date=date.today() + timedelta(days=loan_period_days),
        renewed=False,
    )
    session.add(loan)

    for book, quantity in accepted:
        book.quantity -= quantity
        session.add(LoanDetail(loan_id=loan.id, book_id=book.id, quantity=quantity, status="borrowing"))

    await session.commit()
    return loan, results


async def return_item(session: AsyncSession, loan_id: uuid.UUID, book_id: uuid.UUID) -> tuple[str, bool]:
    """Record a return for one book line in a loan (FR-016/FR-017).

    Returns (actual_return_date_iso, on_time). Raises LookupError if the line
    doesn't exist or isn't currently borrowing.
    """
    detail = await session.get(LoanDetail, (loan_id, book_id))
    if detail is None or detail.status != "borrowing":
        raise LookupError("Không tìm thấy sách đang mượn tương ứng trong phiếu mượn này")

    loan = await session.get(Loan, loan_id)
    book = await session.get(Book, book_id)

    today = date.today()
    detail.actual_return_date = today
    detail.status = "returned"
    book.quantity += detail.quantity

    on_time = today <= loan.due_date
    await session.commit()
    await sync_card_lock_status(session, loan.reader_id)
    return today.isoformat(), on_time


async def renew_loan(session: AsyncSession, loan_id: uuid.UUID, extension_days: int = RENEWAL_EXTENSION_DAYS) -> Loan:
    """Gia hạn Phiếu mượn (FR-018): only once ever, but — per explicit product
    decision — allowed even once the loan is already overdue, so a librarian can
    clear an overdue item directly at the counter without routing the reader through
    a card-unlock request first. `extension_days` lets the reader/librarian pick how
    far to push due_date out (see ALLOWED_RENEWAL_DAYS).
    """
    if extension_days not in ALLOWED_RENEWAL_DAYS:
        raise LoanOperationError("Số ngày gia hạn không hợp lệ")

    loan = await session.get(Loan, loan_id)
    if loan is None:
        raise LookupError("Không tìm thấy phiếu mượn")
    if loan.renewed:
        raise LoanOperationError("Gia hạn thất bại — phiếu đã được gia hạn trước đó")

    # Guards a race between a reader's renewal request and a librarian returning the
    # book directly at the counter in the meantime — approving a stale request must
    # fail loudly instead of silently pushing due_date on a loan with nothing left
    # to renew.
    still_borrowing = (
        await session.execute(
            select(LoanDetail.book_id).where(LoanDetail.loan_id == loan_id, LoanDetail.status == "borrowing").limit(1)
        )
    ).first()
    if still_borrowing is None:
        raise LoanOperationError("Phiếu mượn đã được trả hết — không thể gia hạn")

    # Extend from whichever is later — the existing due_date, or today if the loan is
    # already overdue — so renewing an overdue loan actually clears the overdue state
    # instead of landing the new due_date still in the past (or barely past today).
    base_date = max(loan.due_date, date.today())
    loan.due_date = base_date + timedelta(days=extension_days)
    loan.renewed = True
    await session.commit()
    return loan


async def report_lost(session: AsyncSession, loan_id: uuid.UUID, book_id: uuid.UUID) -> LoanDetail:
    """Báo mất sách (FR-019): the line moves to pending_compensation and — via
    sync_card_lock_status — the reader's card locks immediately (FR-020/FR-009)."""
    detail = await session.get(LoanDetail, (loan_id, book_id))
    if detail is None or detail.status != "borrowing":
        raise LoanOperationError("Không tìm thấy sách đang mượn tương ứng để báo mất")

    detail.status = "pending_compensation"
    loan = await session.get(Loan, loan_id)
    await session.commit()
    await sync_card_lock_status(session, loan.reader_id)
    return detail


async def confirm_compensation(
    session: AsyncSession, loan_id: uuid.UUID, book_id: uuid.UUID, confirmed_by: uuid.UUID
) -> LoanDetail:
    """Xác nhận đền bù (FR-021): records who/when (audit trail) and restores borrowing
    eligibility if the reader has no other violation left."""
    detail = await session.get(LoanDetail, (loan_id, book_id))
    if detail is None or detail.status != "pending_compensation":
        raise LoanOperationError("Không tìm thấy sách đang chờ đền bù tương ứng")

    detail.status = "compensated"
    detail.compensation_confirmed_by = confirmed_by
    detail.compensation_confirmed_at = datetime.now(timezone.utc)
    loan = await session.get(Loan, loan_id)
    await session.commit()
    # Note: card only re-locks on new violations (sync never auto-unlocks) — restoring
    # "active" after compensation goes through the same Librarian-request/Admin-approve
    # flow as any other unlock (FR-010/FR-011), not automatically here.
    return detail
