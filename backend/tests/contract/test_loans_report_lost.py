import uuid
from datetime import date

from src.models.book import Book
from src.models.loan import Loan
from src.models.loan_detail import LoanDetail


async def test_report_lost_marks_pending_compensation(session, make_profile, client_as):
    reader = await make_profile("reader")
    librarian = await make_profile("librarian")
    book = Book(
        id=uuid.uuid4(), code="S800001", title="Sapiens", author="Yuval Noah Harari",
        publisher="NXB Thế Giới", category="Lịch sử", quantity=2,
    )
    session.add(book)
    loan = Loan(
        id=uuid.uuid4(), code="PM800001", reader_id=reader.id, librarian_id=librarian.id,
        loan_date=date.today(), due_date=date.today(),
    )
    session.add(loan)
    session.add(LoanDetail(loan_id=loan.id, book_id=book.id, quantity=1, status="borrowing"))
    await session.commit()

    async with client_as(librarian) as client:
        response = await client.post(f"/api/loans/{loan.id}/items/{book.id}/report-lost")

    assert response.status_code == 200
    assert response.json()["status"] == "pending_compensation"
