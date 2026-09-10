import uuid
from datetime import date, timedelta

from src.models.book import Book
from src.models.library_card import LibraryCard
from src.models.loan import Loan
from src.models.loan_detail import LoanDetail


async def test_reader_requests_borrow_librarian_approves(session, make_profile, client_as):
    reader = await make_profile("reader")
    librarian = await make_profile("librarian")
    session.add(
        LibraryCard(id=uuid.uuid4(), code="TV950001", reader_id=reader.id, issued_by=librarian.id, status="active")
    )
    book = Book(
        id=uuid.uuid4(), code="S950001", title="Sapiens", author="Yuval Noah Harari",
        publisher="NXB Thế Giới", category="Lịch sử", quantity=2,
    )
    session.add(book)
    await session.commit()

    async with client_as(reader) as client:
        create_response = await client.post(
            "/api/loan-requests/borrow", json={"items": [{"book_id": str(book.id), "quantity": 1}]}
        )
        assert create_response.status_code == 200, create_response.text
        request_id = create_response.json()["id"]
        assert create_response.json()["status"] == "pending"

        mine = await client.get("/api/loan-requests/mine")
        assert len(mine.json()) == 1

    async with client_as(librarian) as client:
        pending = await client.get("/api/loan-requests")
        assert len(pending.json()) == 1

        approve_response = await client.post(f"/api/loan-requests/{request_id}/approve")
        assert approve_response.status_code == 200, approve_response.text
        body = approve_response.json()
        assert body["loan"] is not None
        assert body["items"][0]["ok"] is True

    await session.refresh(book)
    assert book.quantity == 1


async def test_reader_requests_borrow_librarian_rejects(session, make_profile, client_as):
    reader = await make_profile("reader")
    librarian = await make_profile("librarian")
    session.add(
        LibraryCard(id=uuid.uuid4(), code="TV950002", reader_id=reader.id, issued_by=librarian.id, status="active")
    )
    book = Book(
        id=uuid.uuid4(), code="S950002", title="Nhà Giả Kim", author="Paulo Coelho",
        publisher="NXB Hội Nhà Văn", category="Văn học", quantity=1,
    )
    session.add(book)
    await session.commit()

    async with client_as(reader) as client:
        create_response = await client.post(
            "/api/loan-requests/borrow", json={"items": [{"book_id": str(book.id), "quantity": 1}]}
        )
        request_id = create_response.json()["id"]

    async with client_as(librarian) as client:
        reject_response = await client.post(f"/api/loan-requests/{request_id}/reject")
        assert reject_response.status_code == 200
        assert reject_response.json()["status"] == "rejected"

    await session.refresh(book)
    assert book.quantity == 1  # untouched — never approved


async def test_reader_requests_renew_librarian_approves(session, make_profile, client_as):
    reader = await make_profile("reader")
    librarian = await make_profile("librarian")
    loan = Loan(
        id=uuid.uuid4(), code="PM950001", reader_id=reader.id, librarian_id=librarian.id,
        loan_date=date.today(), due_date=date.today() + timedelta(days=2),
    )
    session.add(loan)
    await session.commit()

    async with client_as(reader) as client:
        create_response = await client.post("/api/loan-requests/renew", json={"loan_id": str(loan.id)})
        assert create_response.status_code == 200, create_response.text
        request_id = create_response.json()["id"]

        # A second renew request for the same loan while one is pending is rejected.
        dup_response = await client.post("/api/loan-requests/renew", json={"loan_id": str(loan.id)})
        assert dup_response.status_code == 409

    async with client_as(librarian) as client:
        approve_response = await client.post(f"/api/loan-requests/{request_id}/approve")
        assert approve_response.status_code == 200

    await session.refresh(loan)
    assert loan.renewed is True
    assert loan.due_date == date.today() + timedelta(days=9)


async def test_reader_cannot_request_renew_for_another_readers_loan(session, make_profile, client_as):
    owner = await make_profile("reader")
    other_reader = await make_profile("reader")
    librarian = await make_profile("librarian")
    loan = Loan(
        id=uuid.uuid4(), code="PM950002", reader_id=owner.id, librarian_id=librarian.id,
        loan_date=date.today(), due_date=date.today() + timedelta(days=2),
    )
    session.add(loan)
    await session.commit()

    async with client_as(other_reader) as client:
        response = await client.post("/api/loan-requests/renew", json={"loan_id": str(loan.id)})

    assert response.status_code == 404


async def test_approve_borrow_request_fails_when_card_locked(session, make_profile, client_as):
    reader = await make_profile("reader")
    librarian = await make_profile("librarian")
    session.add(
        LibraryCard(id=uuid.uuid4(), code="TV950003", reader_id=reader.id, issued_by=librarian.id, status="locked")
    )
    book = Book(
        id=uuid.uuid4(), code="S950003", title="Tuổi Trẻ Đáng Giá Bao Nhiêu", author="Rosie Nguyễn",
        publisher="NXB Hội Nhà Văn", category="Kỹ năng sống", quantity=2,
    )
    session.add(book)
    await session.commit()

    async with client_as(reader) as client:
        create_response = await client.post(
            "/api/loan-requests/borrow", json={"items": [{"book_id": str(book.id), "quantity": 1}]}
        )
        request_id = create_response.json()["id"]

    async with client_as(librarian) as client:
        approve_response = await client.post(f"/api/loan-requests/{request_id}/approve")

    assert approve_response.status_code == 409
    # Left pending (not silently rejected) so the librarian can retry once eligible.
    async with client_as(librarian) as client:
        still_pending = await client.get("/api/loan-requests")
        assert any(r["id"] == request_id for r in still_pending.json())
