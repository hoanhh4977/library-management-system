import uuid
from datetime import date, datetime, timezone

from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.card_unlock_request import CardUnlockRequest
from src.models.library_card import LibraryCard
from src.models.loan import Loan
from src.models.loan_detail import LoanDetail
from src.models.profile import Profile
from src.services.eligibility import reader_has_violation
from src.services.supabase_admin import delete_auth_user


class CardServiceError(Exception):
    """Raised for any 409-worthy card/unlock-request business rule violation."""


async def issue_card(session: AsyncSession, *, reader_id: uuid.UUID, librarian_id: uuid.UUID) -> LibraryCard:
    """Nhân viên thủ thư xác minh danh tính + cấp Thẻ thư viện (FR-007/FR-008)."""
    reader = await session.get(Profile, reader_id)
    if reader is None or reader.role != "reader":
        raise LookupError("Không tìm thấy tài khoản Độc giả — độc giả cần tự đăng ký trước")

    existing = (
        await session.execute(select(LibraryCard).where(LibraryCard.reader_id == reader_id))
    ).scalar_one_or_none()
    if existing is not None:
        raise CardServiceError("Độc giả đã có Thẻ thư viện — mỗi Độc giả chỉ được cấp 1 thẻ")

    card = LibraryCard(
        id=uuid.uuid4(),
        code=f"TV{uuid.uuid4().hex[:6].upper()}",
        reader_id=reader_id,
        issued_by=librarian_id,
        status="active",
    )
    session.add(card)
    await session.commit()
    return card


async def sync_card_lock_status(session: AsyncSession, reader_id: uuid.UUID) -> None:
    """Re-derive Trạng thái Thẻ thư viện from the reader's current violations (FR-009).

    Called after any transaction that can change violation status (return, report-lost,
    confirm-compensation — see research.md §4). Only ever *locks*; unlocking is exclusively
    through the Librarian-request / Admin-approve flow (FR-010/FR-011), never automatic.
    """
    card = (
        await session.execute(select(LibraryCard).where(LibraryCard.reader_id == reader_id))
    ).scalar_one_or_none()
    if card is None or card.status == "locked":
        return
    if await reader_has_violation(session, reader_id):
        card.status = "locked"
        await session.commit()


async def request_unlock(session: AsyncSession, *, card_id: uuid.UUID, requested_by: uuid.UUID) -> CardUnlockRequest:
    card = await session.get(LibraryCard, card_id)
    if card is None:
        raise LookupError("Không tìm thấy Thẻ thư viện")

    if await reader_has_violation(session, card.reader_id):
        raise CardServiceError(
            "Độc giả vẫn còn sách quá hạn hoặc sách mất chưa đền bù — chưa đủ điều kiện mở khóa thẻ"
        )

    pending = (
        await session.execute(
            select(CardUnlockRequest).where(
                CardUnlockRequest.card_id == card_id, CardUnlockRequest.status == "pending"
            )
        )
    ).scalar_one_or_none()
    if pending is not None:
        raise CardServiceError("Đã có một yêu cầu mở khóa đang chờ xử lý cho thẻ này")

    request = CardUnlockRequest(id=uuid.uuid4(), card_id=card_id, requested_by=requested_by, status="pending")
    session.add(request)
    await session.commit()
    return request


async def review_unlock(
    session: AsyncSession, *, request_id: uuid.UUID, decision: str, reviewed_by: uuid.UUID
) -> CardUnlockRequest:
    request = await session.get(CardUnlockRequest, request_id)
    if request is None:
        raise LookupError("Không tìm thấy yêu cầu mở khóa")
    if request.status != "pending":
        raise CardServiceError("Yêu cầu này đã được xử lý")

    request.status = decision
    request.reviewed_by = reviewed_by
    request.reviewed_at = datetime.now(timezone.utc)

    if decision == "approved":
        card = await session.get(LibraryCard, request.card_id)
        card.status = "active"

    await session.commit()
    return request


async def delete_reader(session: AsyncSession, *, reader_id: uuid.UUID) -> None:
    """Admin removes a Độc giả account entirely (library card + profile + Supabase
    Auth user). A locked card means an unresolved violation (overdue book / pending
    compensation) still outstanding — deleting the account would erase the record of
    what they still owe the library, so that's rejected explicitly up front rather
    than left to the database to catch. Beyond that, the same FK-driven guard as
    delete_librarian applies: any reader with real loan/request history still has
    rows pointing at them, and Postgres rejects the delete rather than silently
    cascading away that history.
    """
    reader = await session.get(Profile, reader_id)
    if reader is None or reader.role != "reader":
        raise LookupError("Không tìm thấy Độc giả")

    card = (
        await session.execute(select(LibraryCard).where(LibraryCard.reader_id == reader_id))
    ).scalar_one_or_none()
    if card is not None and card.status == "locked":
        raise CardServiceError("Không thể xoá — thẻ thư viện đang bị khóa, cần xử lý vi phạm trước")

    try:
        if card is not None:
            await session.delete(card)
            await session.flush()
        await session.delete(reader)
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise CardServiceError(
            "Không thể xoá — độc giả này đã có lịch sử giao dịch trong hệ thống"
        ) from exc

    await delete_auth_user(reader_id)


async def lock_overdue_cards(session: AsyncSession) -> int:
    """Proactively locks any still-"active" card whose reader now has a violation
    (overdue book, or a book reported lost still pending compensation).

    sync_card_lock_status only runs reactively, right after a return/report-lost
    transaction for ONE reader — it never catches a loan crossing into "overdue"
    purely from a day passing with nobody touching it. Meant to run on a schedule
    (see core/scheduler.py) rather than per-request. One bulk UPDATE instead of a
    per-reader loop + individual commits — cheap even with a large reader base, and
    avoids ever locking an already-locked card twice.
    """
    violating_reader_ids = (
        select(Loan.reader_id)
        .join(LoanDetail, LoanDetail.loan_id == Loan.id)
        .where(LoanDetail.status == "borrowing", Loan.due_date < date.today())
        .union(
            select(Loan.reader_id)
            .join(LoanDetail, LoanDetail.loan_id == Loan.id)
            .where(LoanDetail.status == "pending_compensation")
        )
    )
    result = await session.execute(
        update(LibraryCard)
        .where(LibraryCard.status == "active", LibraryCard.reader_id.in_(select(violating_reader_ids.subquery())))
        .values(status="locked")
    )
    await session.commit()
    return result.rowcount or 0
