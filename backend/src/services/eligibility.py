import uuid
from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.loan import Loan
from src.models.loan_detail import LoanDetail


async def reader_has_violation(session: AsyncSession, reader_id: uuid.UUID) -> bool:
    """A reader is "in violation" (blocks new borrowing, keeps the card locked — FR-006/FR-009/
    FR-012/FR-020) when they have at least one loan_detail that is either:
      - status='borrowing' AND its loan's due_date is in the past, OR
      - status='pending_compensation'

    Computed on-the-fly per research.md §4 — no cached/derived "is_overdue" column.
    """
    overdue_stmt = (
        select(LoanDetail.loan_id)
        .join(Loan, Loan.id == LoanDetail.loan_id)
        .where(
            Loan.reader_id == reader_id,
            LoanDetail.status == "borrowing",
            Loan.due_date < date.today(),
        )
        .limit(1)
    )
    pending_stmt = (
        select(LoanDetail.loan_id)
        .join(Loan, Loan.id == LoanDetail.loan_id)
        .where(Loan.reader_id == reader_id, LoanDetail.status == "pending_compensation")
        .limit(1)
    )

    overdue = (await session.execute(overdue_stmt)).first()
    if overdue is not None:
        return True

    pending = (await session.execute(pending_stmt)).first()
    return pending is not None
