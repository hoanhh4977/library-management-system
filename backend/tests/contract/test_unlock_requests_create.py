import uuid
from datetime import date, timedelta

from src.models.book import Book
from src.models.library_card import LibraryCard
from src.models.loan import Loan
from src.models.loan_detail import LoanDetail


async def test_create_unlock_request_happy_path(session, make_profile, client_as):
    reader = await make_profile("reader")
    librarian = await make_profile("librarian")
    card = LibraryCard(id=uuid.uuid4(), code="TV800020", reader_id=reader.id, issued_by=librarian.id, status="locked")
    session.add(card)
    await session.commit()

    async with client_as(librarian) as client:
        response = await client.post(f"/api/cards/{card.id}/unlock-requests")

    assert response.status_code == 200
    assert response.json()["status"] == "pending"


async def test_create_unlock_request_rejected_while_still_in_violation(session, make_profile, client_as):
    reader = await make_profile("reader")
    librarian = await make_profile("librarian")
    card = LibraryCard(id=uuid.uuid4(), code="TV800021", reader_id=reader.id, issued_by=librarian.id, status="locked")
    session.add(card)
    book = Book(
        id=uuid.uuid4(), code="S800020", title="Sapiens", author="Yuval Noah Harari",
        publisher="NXB Thế Giới", category="Lịch sử", quantity=1,
    )
    session.add(book)
    loan = Loan(
        id=uuid.uuid4(), code="PM800020", reader_id=reader.id, librarian_id=librarian.id,
        loan_date=date.today() - timedelta(days=20), due_date=date.today() - timedelta(days=5),
    )
    session.add(loan)
    session.add(LoanDetail(loan_id=loan.id, book_id=book.id, quantity=1, status="borrowing"))
    await session.commit()

    async with client_as(librarian) as client:
        response = await client.post(f"/api/cards/{card.id}/unlock-requests")

    assert response.status_code == 409
