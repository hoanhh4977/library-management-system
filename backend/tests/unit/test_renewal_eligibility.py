import uuid
from datetime import date, timedelta

import pytest

from src.models.loan import Loan
from src.services.loan_service import LoanOperationError, RENEWAL_EXTENSION_DAYS, renew_loan


async def _seed_loan(session, reader, librarian, *, due_date: date, renewed: bool = False) -> Loan:
    loan = Loan(
        id=uuid.uuid4(), code=f"PM{uuid.uuid4().hex[:8].upper()}", reader_id=reader.id,
        librarian_id=librarian.id, loan_date=date.today() - timedelta(days=1), due_date=due_date, renewed=renewed,
    )
    session.add(loan)
    await session.commit()
    return loan


async def test_renew_succeeds_when_within_due_date_and_never_renewed(session, make_profile):
    reader = await make_profile("reader")
    librarian = await make_profile("librarian")
    loan = await _seed_loan(session, reader, librarian, due_date=date.today() + timedelta(days=2))

    updated = await renew_loan(session, loan.id)

    assert updated.renewed is True
    assert updated.due_date == date.today() + timedelta(days=2 + RENEWAL_EXTENSION_DAYS)


async def test_renew_fails_when_already_renewed(session, make_profile):
    reader = await make_profile("reader")
    librarian = await make_profile("librarian")
    loan = await _seed_loan(session, reader, librarian, due_date=date.today() + timedelta(days=2), renewed=True)

    with pytest.raises(LoanOperationError):
        await renew_loan(session, loan.id)


async def test_renew_fails_when_overdue(session, make_profile):
    reader = await make_profile("reader")
    librarian = await make_profile("librarian")
    loan = await _seed_loan(session, reader, librarian, due_date=date.today() - timedelta(days=1))

    with pytest.raises(LoanOperationError):
        await renew_loan(session, loan.id)
