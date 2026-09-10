import uuid
from datetime import date, timedelta

from src.models.book import Book
from src.models.library_card import LibraryCard
from src.models.loan import Loan
from src.models.loan_detail import LoanDetail
from src.services.card_service import sync_card_lock_status


async def test_sync_locks_card_when_overdue(session, make_profile):
    reader = await make_profile("reader")
    librarian = await make_profile("librarian")
    card = LibraryCard(id=uuid.uuid4(), code="TV800010", reader_id=reader.id, issued_by=librarian.id, status="active")
    session.add(card)
    book = Book(
        id=uuid.uuid4(), code="S800010", title="Sapiens", author="Yuval Noah Harari",
        publisher="NXB Thế Giới", category="Lịch sử", quantity=1,
    )
    session.add(book)
    loan = Loan(
        id=uuid.uuid4(), code="PM800010", reader_id=reader.id, librarian_id=librarian.id,
        loan_date=date.today() - timedelta(days=20), due_date=date.today() - timedelta(days=5),
    )
    session.add(loan)
    session.add(LoanDetail(loan_id=loan.id, book_id=book.id, quantity=1, status="borrowing"))
    await session.commit()

    await sync_card_lock_status(session, reader.id)

    await session.refresh(card)
    assert card.status == "locked"


async def test_sync_leaves_card_active_when_no_violation(session, make_profile):
    reader = await make_profile("reader")
    librarian = await make_profile("librarian")
    card = LibraryCard(id=uuid.uuid4(), code="TV800011", reader_id=reader.id, issued_by=librarian.id, status="active")
    session.add(card)
    await session.commit()

    await sync_card_lock_status(session, reader.id)

    await session.refresh(card)
    assert card.status == "active"


async def test_sync_never_auto_unlocks(session, make_profile):
    """Once locked, sync_card_lock_status must never flip it back to active on its own —
    unlocking only happens via the Librarian-request / Admin-approve flow (FR-010/FR-011)."""
    reader = await make_profile("reader")
    librarian = await make_profile("librarian")
    card = LibraryCard(id=uuid.uuid4(), code="TV800012", reader_id=reader.id, issued_by=librarian.id, status="locked")
    session.add(card)
    await session.commit()

    await sync_card_lock_status(session, reader.id)

    await session.refresh(card)
    assert card.status == "locked"
