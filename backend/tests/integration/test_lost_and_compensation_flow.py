import uuid
from datetime import date

from src.models.book import Book
from src.models.library_card import LibraryCard
from src.models.loan import Loan
from src.models.loan_detail import LoanDetail


async def test_lost_blocks_borrowing_until_compensated_and_unlocked(session, make_profile, client_as):
    """US6 + US7 together: report-lost auto-locks the card (FR-009) and blocks new loans
    (FR-020); confirm-compensation clears the *violation* (FR-021) but — per FR-010/FR-011,
    unlocking is exclusively via Librarian-request + Admin-approve — the card itself stays
    locked until that flow completes, at which point borrowing is allowed again."""
    reader = await make_profile("reader")
    librarian = await make_profile("librarian")
    admin = await make_profile("admin")
    card = LibraryCard(id=uuid.uuid4(), code="TV800001", reader_id=reader.id, issued_by=librarian.id, status="active")
    session.add(card)
    await session.flush()

    lost_book = Book(
        id=uuid.uuid4(), code="S800004", title="Sapiens", author="Yuval Noah Harari",
        publisher="NXB Thế Giới", category="Lịch sử", quantity=1,
    )
    other_book = Book(
        id=uuid.uuid4(), code="S800005", title="Nhà Giả Kim", author="Paulo Coelho",
        publisher="NXB Hội Nhà Văn", category="Văn học", quantity=5,
    )
    session.add_all([lost_book, other_book])
    await session.flush()

    loan = Loan(
        id=uuid.uuid4(), code="PM800004", reader_id=reader.id, librarian_id=librarian.id,
        loan_date=date.today(), due_date=date.today(),
    )
    session.add(loan)
    await session.flush()
    session.add(LoanDetail(loan_id=loan.id, book_id=lost_book.id, quantity=1, status="borrowing"))
    await session.commit()

    async with client_as(librarian) as client:
        lost_response = await client.post(f"/api/loans/{loan.id}/items/{lost_book.id}/report-lost")
        assert lost_response.status_code == 200
        await session.refresh(card)
        assert card.status == "locked"

        blocked_response = await client.post(
            "/api/loans",
            json={"reader_id": str(reader.id), "items": [{"book_id": str(other_book.id), "quantity": 1}]},
        )
        assert blocked_response.status_code == 409

        confirm_response = await client.post(f"/api/loans/{loan.id}/items/{lost_book.id}/confirm-compensation")
        assert confirm_response.status_code == 200

        # Violation is cleared, but the card itself is still locked — still blocked.
        still_blocked_response = await client.post(
            "/api/loans",
            json={"reader_id": str(reader.id), "items": [{"book_id": str(other_book.id), "quantity": 1}]},
        )
        assert still_blocked_response.status_code == 409

        unlock_request = await client.post(f"/api/cards/{card.id}/unlock-requests")
        assert unlock_request.status_code == 200
        request_id = unlock_request.json()["id"]

    async with client_as(admin) as client:
        approve_response = await client.post(f"/api/cards/{card.id}/unlock-requests/{request_id}/approve")
        assert approve_response.status_code == 200

    async with client_as(librarian) as client:
        allowed_response = await client.post(
            "/api/loans",
            json={"reader_id": str(reader.id), "items": [{"book_id": str(other_book.id), "quantity": 1}]},
        )
        assert allowed_response.status_code == 200
        assert allowed_response.json()["loan"] is not None
