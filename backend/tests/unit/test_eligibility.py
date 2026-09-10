import uuid
from datetime import date, timedelta

from src.models.book import Book
from src.models.loan import Loan
from src.models.loan_detail import LoanDetail
from src.services.eligibility import reader_has_violation


async def _book(session, **overrides) -> Book:
    defaults = dict(
        id=uuid.uuid4(), code=f"S{uuid.uuid4().hex[:6].upper()}", title="X", author="Y",
        publisher="Z", category="W", quantity=1,
    )
    defaults.update(overrides)
    book = Book(**defaults)
    session.add(book)
    await session.commit()
    return book


async def _loan_with_detail(session, reader, librarian, book, *, due_date: date, status: str):
    loan = Loan(
        id=uuid.uuid4(), code=f"PM{uuid.uuid4().hex[:8].upper()}", reader_id=reader.id,
        librarian_id=librarian.id, loan_date=due_date - timedelta(days=1), due_date=due_date,
    )
    session.add(loan)
    await session.flush()
    session.add(LoanDetail(loan_id=loan.id, book_id=book.id, quantity=1, status=status))
    await session.commit()
    return loan


async def test_violation_detected_across_multiple_separate_loans(session, make_profile):
    """Edge case from spec.md: overdue lines from DIFFERENT Phiếu mượn must all count,
    not just the most recent one."""
    reader = await make_profile("reader")
    librarian = await make_profile("librarian")

    book_a = await _book(session)
    book_b = await _book(session)

    # First loan: already returned, no violation on its own.
    await _loan_with_detail(session, reader, librarian, book_a, due_date=date.today() - timedelta(days=30), status="returned")
    assert await reader_has_violation(session, reader.id) is False

    # A second, unrelated loan (a different Phiếu mượn) is overdue.
    await _loan_with_detail(session, reader, librarian, book_b, due_date=date.today() - timedelta(days=2), status="borrowing")
    assert await reader_has_violation(session, reader.id) is True


async def test_partial_return_leaves_violation_if_one_line_still_overdue(session, make_profile):
    """Edge case from spec.md: returning some books on time in a Phiếu mượn must not mask
    a still-overdue line in the SAME Phiếu mượn."""
    reader = await make_profile("reader")
    librarian = await make_profile("librarian")
    book_returned = await _book(session)
    book_still_out = await _book(session)

    loan = Loan(
        id=uuid.uuid4(), code="PM700099", reader_id=reader.id, librarian_id=librarian.id,
        loan_date=date.today() - timedelta(days=20), due_date=date.today() - timedelta(days=5),
    )
    session.add(loan)
    await session.flush()
    session.add(
        LoanDetail(
            loan_id=loan.id, book_id=book_returned.id, quantity=1, status="returned",
            actual_return_date=date.today() - timedelta(days=6),
        )
    )
    session.add(LoanDetail(loan_id=loan.id, book_id=book_still_out.id, quantity=1, status="borrowing"))
    await session.commit()

    assert await reader_has_violation(session, reader.id) is True
