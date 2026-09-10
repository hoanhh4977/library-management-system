import uuid
from datetime import date

from src.models.book import Book
from src.models.loan import Loan
from src.models.loan_detail import LoanDetail


async def test_confirm_compensation_records_audit_trail(session, make_profile, client_as):
    reader = await make_profile("reader")
    librarian = await make_profile("librarian")
    book = Book(
        id=uuid.uuid4(), code="S800002", title="Đắc Nhân Tâm", author="Dale Carnegie",
        publisher="NXB Tổng hợp TP.HCM", category="Kỹ năng sống", quantity=2,
    )
    session.add(book)
    loan = Loan(
        id=uuid.uuid4(), code="PM800002", reader_id=reader.id, librarian_id=librarian.id,
        loan_date=date.today(), due_date=date.today(),
    )
    session.add(loan)
    session.add(LoanDetail(loan_id=loan.id, book_id=book.id, quantity=1, status="pending_compensation"))
    await session.commit()

    async with client_as(librarian) as client:
        response = await client.post(f"/api/loans/{loan.id}/items/{book.id}/confirm-compensation")

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["status"] == "compensated"
    # FR-021 audit trail: who confirmed and when must be persisted.
    assert body["compensation_confirmed_by"] == str(librarian.id)
    assert body["compensation_confirmed_at"] is not None


async def test_confirm_compensation_conflict_when_not_pending(session, make_profile, client_as):
    reader = await make_profile("reader")
    librarian = await make_profile("librarian")
    book = Book(
        id=uuid.uuid4(), code="S800003", title="Nhà Giả Kim", author="Paulo Coelho",
        publisher="NXB Hội Nhà Văn", category="Văn học", quantity=2,
    )
    session.add(book)
    loan = Loan(
        id=uuid.uuid4(), code="PM800003", reader_id=reader.id, librarian_id=librarian.id,
        loan_date=date.today(), due_date=date.today(),
    )
    session.add(loan)
    session.add(LoanDetail(loan_id=loan.id, book_id=book.id, quantity=1, status="borrowing"))
    await session.commit()

    async with client_as(librarian) as client:
        response = await client.post(f"/api/loans/{loan.id}/items/{book.id}/confirm-compensation")

    assert response.status_code == 409
