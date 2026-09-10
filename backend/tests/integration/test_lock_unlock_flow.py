import uuid
from datetime import date, timedelta

from src.models.book import Book
from src.models.library_card import LibraryCard
from src.models.loan import Loan
from src.models.loan_detail import LoanDetail


async def test_full_overdue_lock_unlock_cycle(session, make_profile, client_as):
    """US7: overdue -> auto-lock (via return_item's sync call) -> unlock request rejected
    while still overdue -> return the overdue book -> request -> admin approves -> active."""
    reader = await make_profile("reader")
    librarian = await make_profile("librarian")
    admin = await make_profile("admin")
    card = LibraryCard(id=uuid.uuid4(), code="TV800040", reader_id=reader.id, issued_by=librarian.id, status="active")
    session.add(card)
    await session.flush()

    overdue_book = Book(
        id=uuid.uuid4(), code="S800040", title="Sapiens", author="Yuval Noah Harari",
        publisher="NXB Thế Giới", category="Lịch sử", quantity=0,
    )
    on_time_book = Book(
        id=uuid.uuid4(), code="S800041", title="Nhà Giả Kim", author="Paulo Coelho",
        publisher="NXB Hội Nhà Văn", category="Văn học", quantity=0,
    )
    session.add_all([overdue_book, on_time_book])
    await session.flush()

    overdue_loan = Loan(
        id=uuid.uuid4(), code="PM800040", reader_id=reader.id, librarian_id=librarian.id,
        loan_date=date.today() - timedelta(days=20), due_date=date.today() - timedelta(days=5),
    )
    on_time_loan = Loan(
        id=uuid.uuid4(), code="PM800041", reader_id=reader.id, librarian_id=librarian.id,
        loan_date=date.today() - timedelta(days=2), due_date=date.today() + timedelta(days=12),
    )
    session.add_all([overdue_loan, on_time_loan])
    await session.flush()
    session.add(LoanDetail(loan_id=overdue_loan.id, book_id=overdue_book.id, quantity=1, status="borrowing"))
    session.add(LoanDetail(loan_id=on_time_loan.id, book_id=on_time_book.id, quantity=1, status="borrowing"))
    await session.commit()

    async with client_as(librarian) as client:
        # The reader already has an outstanding overdue loan at this point, so returning
        # the *unrelated* on-time book still triggers a lock — reader_has_violation checks
        # every loan for the reader, not just the one just touched.
        await client.post(f"/api/loans/{on_time_loan.id}/items/{on_time_book.id}/return")
        await session.refresh(card)
        assert card.status == "locked"

        # Returning the overdue book too clears the last violation (still locked either way).
        await client.post(f"/api/loans/{overdue_loan.id}/items/{overdue_book.id}/return")
        await session.refresh(card)
        assert card.status == "locked"

        # Card is now clear of violations (both lines returned) -> request should succeed.
        request_response = await client.post(f"/api/cards/{card.id}/unlock-requests")
        assert request_response.status_code == 200
        request_id = request_response.json()["id"]

    async with client_as(admin) as client:
        approve_response = await client.post(f"/api/cards/{card.id}/unlock-requests/{request_id}/approve")
        assert approve_response.status_code == 200

    await session.refresh(card)
    assert card.status == "active"
