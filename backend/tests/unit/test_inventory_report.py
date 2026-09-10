import uuid
from datetime import date

from src.models.book import Book
from src.models.loan import Loan
from src.models.loan_detail import LoanDetail
from src.services.report_service import inventory_report


async def test_inventory_report_totals(session, make_profile):
    reader = await make_profile("reader")
    librarian = await make_profile("librarian")

    book_a = Book(
        id=uuid.uuid4(), code="S900010", title="Sapiens", author="Yuval Noah Harari",
        publisher="NXB Thế Giới", category="Lịch sử", quantity=3,
    )
    book_b = Book(
        id=uuid.uuid4(), code="S900011", title="Nhà Giả Kim", author="Paulo Coelho",
        publisher="NXB Hội Nhà Văn", category="Văn học", quantity=5,
    )
    session.add_all([book_a, book_b])

    loan = Loan(
        id=uuid.uuid4(), code="PM900010", reader_id=reader.id, librarian_id=librarian.id,
        loan_date=date.today(), due_date=date.today(),
    )
    session.add(loan)
    # book_a: 3 remaining + 2 currently borrowed -> total 5
    session.add(LoanDetail(loan_id=loan.id, book_id=book_a.id, quantity=2, status="borrowing"))
    # book_b: fully returned -> doesn't count toward "borrowing"
    session.add(LoanDetail(loan_id=loan.id, book_id=book_b.id, quantity=1, status="returned"))
    await session.commit()

    report = await inventory_report(session)

    by_id = {row.book_id: row for row in report.books}
    assert by_id[book_a.id].remaining == 3
    assert by_id[book_a.id].borrowing == 2
    assert by_id[book_a.id].total == 5
    assert by_id[book_b.id].borrowing == 0
    assert by_id[book_b.id].total == 5

    assert report.total_titles == 2
    assert report.total_borrowing == 2
    assert report.total_copies == 10
