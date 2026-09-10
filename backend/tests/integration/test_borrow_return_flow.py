import uuid

from src.models.book import Book
from src.models.library_card import LibraryCard


async def test_borrow_then_partial_return_flow(session, make_profile, client_as):
    """Covers spec.md User Story 1 acceptance scenarios 1, 3, 4, 5: lend two titles in one
    loan (one has enough stock, one doesn't), then return the successfully-lent book."""
    reader = await make_profile("reader")
    librarian = await make_profile("librarian")
    session.add(
        LibraryCard(
            id=uuid.uuid4(), code="TV900001", reader_id=reader.id, issued_by=librarian.id, status="active"
        )
    )

    available = Book(
        id=uuid.uuid4(), code="S900001", title="Sapiens", author="Yuval Noah Harari",
        publisher="NXB Thế Giới", category="Lịch sử", quantity=1,
    )
    out_of_stock = Book(
        id=uuid.uuid4(), code="S900002", title="Nhà Giả Kim", author="Paulo Coelho",
        publisher="NXB Hội Nhà Văn", category="Văn học", quantity=0,
    )
    session.add_all([available, out_of_stock])
    await session.commit()

    async with client_as(librarian) as client:
        create_response = await client.post(
            "/api/loans",
            json={
                "reader_id": str(reader.id),
                "items": [
                    {"book_id": str(available.id), "quantity": 1},
                    {"book_id": str(out_of_stock.id), "quantity": 1},
                ],
            },
        )
        assert create_response.status_code == 200, create_response.text
        body = create_response.json()
        loan_id = body["loan"]["id"]
        results = {item["book_id"]: item["ok"] for item in body["items"]}
        assert results[str(available.id)] is True
        assert results[str(out_of_stock.id)] is False
        # Only the accepted item made it into the loan.
        assert [d["book_id"] for d in body["loan"]["details"]] == [str(available.id)]

        await session.refresh(available)
        assert available.quantity == 0  # borrowed the only copy

        return_response = await client.post(f"/api/loans/{loan_id}/items/{available.id}/return")
        assert return_response.status_code == 200, return_response.text
        assert return_response.json()["on_time"] is True

    await session.refresh(available)
    assert available.quantity == 1  # back in stock


async def test_locked_card_blocks_borrowing_end_to_end(session, make_profile, client_as):
    reader = await make_profile("reader")
    librarian = await make_profile("librarian")
    session.add(
        LibraryCard(
            id=uuid.uuid4(), code="TV900002", reader_id=reader.id, issued_by=librarian.id, status="locked"
        )
    )
    book = Book(
        id=uuid.uuid4(), code="S900003", title="Đắc Nhân Tâm", author="Dale Carnegie",
        publisher="NXB Tổng hợp TP.HCM", category="Kỹ năng sống", quantity=3,
    )
    session.add(book)
    await session.commit()

    async with client_as(librarian) as client:
        response = await client.post(
            "/api/loans",
            json={"reader_id": str(reader.id), "items": [{"book_id": str(book.id), "quantity": 1}]},
        )

    assert response.status_code == 409
    await session.refresh(book)
    assert book.quantity == 3  # untouched
