import uuid
from datetime import date, timedelta

from src.models.book import Book
from src.models.library_card import LibraryCard
from src.models.loan import Loan
from src.models.loan_detail import LoanDetail


async def test_return_item_on_time(session, make_profile, client_as):
    reader = await make_profile("reader")
    librarian = await make_profile("librarian")
    book = Book(
        id=uuid.uuid4(), code="S000001", title="Nhà Giả Kim", author="Paulo Coelho",
        publisher="NXB Hội Nhà Văn", category="Văn học", quantity=4,
    )
    session.add(book)
    loan = Loan(
        id=uuid.uuid4(), code="PM000001", reader_id=reader.id, librarian_id=librarian.id,
        loan_date=date.today() - timedelta(days=3), due_date=date.today() + timedelta(days=11),
    )
    session.add(loan)
    session.add(LoanDetail(loan_id=loan.id, book_id=book.id, quantity=1, status="borrowing"))
    await session.commit()

    async with client_as(librarian) as client:
        response = await client.post(f"/api/loans/{loan.id}/items/{book.id}/return")

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["status"] == "returned"
    assert body["on_time"] is True

    await session.refresh(book)
    assert book.quantity == 5


async def test_return_item_late(session, make_profile, client_as):
    reader = await make_profile("reader")
    librarian = await make_profile("librarian")
    book = Book(
        id=uuid.uuid4(), code="S000002", title="Đắc Nhân Tâm", author="Dale Carnegie",
        publisher="NXB Tổng hợp TP.HCM", category="Kỹ năng sống", quantity=1,
    )
    session.add(book)
    loan = Loan(
        id=uuid.uuid4(), code="PM000002", reader_id=reader.id, librarian_id=librarian.id,
        loan_date=date.today() - timedelta(days=20), due_date=date.today() - timedelta(days=5),
    )
    session.add(loan)
    session.add(LoanDetail(loan_id=loan.id, book_id=book.id, quantity=1, status="borrowing"))
    await session.commit()

    async with client_as(librarian) as client:
        response = await client.post(f"/api/loans/{loan.id}/items/{book.id}/return")

    assert response.status_code == 200
    assert response.json()["on_time"] is False


async def test_return_item_already_returned_is_404(session, make_profile, client_as):
    reader = await make_profile("reader")
    librarian = await make_profile("librarian")
    book = Book(
        id=uuid.uuid4(), code="S000003", title="Tuổi Trẻ Đáng Giá Bao Nhiêu", author="Rosie Nguyễn",
        publisher="NXB Hội Nhà Văn", category="Kỹ năng sống", quantity=2,
    )
    session.add(book)
    loan = Loan(
        id=uuid.uuid4(), code="PM000003", reader_id=reader.id, librarian_id=librarian.id,
        loan_date=date.today(), due_date=date.today() + timedelta(days=14),
    )
    session.add(loan)
    session.add(
        LoanDetail(
            loan_id=loan.id, book_id=book.id, quantity=1, status="returned", actual_return_date=date.today()
        )
    )
    await session.commit()

    async with client_as(librarian) as client:
        response = await client.post(f"/api/loans/{loan.id}/items/{book.id}/return")

    assert response.status_code == 404
