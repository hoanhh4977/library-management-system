import uuid
from datetime import date

from src.models.book import Book
from src.models.loan import Loan
from src.models.loan_detail import LoanDetail


async def _seed_loan(session, reader, librarian, book):
    loan = Loan(
        id=uuid.uuid4(), code=f"PM{uuid.uuid4().hex[:8].upper()}", reader_id=reader.id,
        librarian_id=librarian.id, loan_date=date.today(), due_date=date.today(),
    )
    session.add(loan)
    session.add(LoanDetail(loan_id=loan.id, book_id=book.id, quantity=1, status="returned"))
    await session.commit()
    return loan


async def test_reader_sees_own_history(session, make_profile, client_as):
    reader = await make_profile("reader")
    librarian = await make_profile("librarian")
    book = Book(
        id=uuid.uuid4(), code="S700001", title="Sapiens", author="Yuval Noah Harari",
        publisher="NXB Thế Giới", category="Lịch sử", quantity=2,
    )
    session.add(book)
    await session.commit()
    await _seed_loan(session, reader, librarian, book)

    async with client_as(reader) as client:
        response = await client.get(f"/api/readers/{reader.id}/loans")

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["details"][0]["book_title"] == "Sapiens"


async def test_reader_cannot_see_other_readers_history(make_profile, client_as):
    reader_a = await make_profile("reader")
    reader_b = await make_profile("reader")

    async with client_as(reader_a) as client:
        response = await client.get(f"/api/readers/{reader_b.id}/loans")

    assert response.status_code == 403


async def test_librarian_can_see_any_reader_history(session, make_profile, client_as):
    reader = await make_profile("reader")
    librarian = await make_profile("librarian")
    other_librarian = await make_profile("librarian")
    book = Book(
        id=uuid.uuid4(), code="S700002", title="Nhà Giả Kim", author="Paulo Coelho",
        publisher="NXB Hội Nhà Văn", category="Văn học", quantity=2,
    )
    session.add(book)
    await session.commit()
    await _seed_loan(session, reader, librarian, book)

    async with client_as(other_librarian) as client:
        response = await client.get(f"/api/readers/{reader.id}/loans")

    assert response.status_code == 200
    assert len(response.json()) == 1
