import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from src.models.book import Book
from src.models.library_card import LibraryCard


async def _seed_book(session: AsyncSession, quantity: int = 2) -> Book:
    book = Book(
        id=uuid.uuid4(),
        code=f"S{uuid.uuid4().hex[:6].upper()}",
        title="Sapiens: Lược Sử Loài Người",
        author="Yuval Noah Harari",
        publisher="NXB Thế Giới",
        category="Lịch sử",
        quantity=quantity,
    )
    session.add(book)
    await session.commit()
    return book


async def _issue_card(session: AsyncSession, reader, librarian, status: str = "active") -> LibraryCard:
    card = LibraryCard(
        id=uuid.uuid4(),
        code=f"TV{uuid.uuid4().hex[:6].upper()}",
        reader_id=reader.id,
        issued_by=librarian.id,
        status=status,
    )
    session.add(card)
    await session.commit()
    return card


async def test_create_loan_happy_path(session, make_profile, client_as):
    reader = await make_profile("reader")
    librarian = await make_profile("librarian")
    await _issue_card(session, reader, librarian)
    book = await _seed_book(session, quantity=2)

    async with client_as(librarian) as client:
        response = await client.post(
            "/api/loans",
            json={"reader_id": str(reader.id), "items": [{"book_id": str(book.id), "quantity": 1}]},
        )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["loan"] is not None
    assert body["items"] == [{"book_id": str(book.id), "ok": True, "detail": None}]
    assert body["loan"]["details"][0]["status"] == "borrowing"


async def test_create_loan_rejects_wrong_role(session, make_profile, client_as):
    reader = await make_profile("reader")
    async with client_as(reader) as client:
        response = await client.post("/api/loans", json={"reader_id": str(reader.id), "items": []})
    assert response.status_code == 403


async def test_create_loan_rejects_locked_card(session, make_profile, client_as):
    reader = await make_profile("reader")
    librarian = await make_profile("librarian")
    await _issue_card(session, reader, librarian, status="locked")
    book = await _seed_book(session)

    async with client_as(librarian) as client:
        response = await client.post(
            "/api/loans",
            json={"reader_id": str(reader.id), "items": [{"book_id": str(book.id), "quantity": 1}]},
        )
    assert response.status_code == 409
    assert "khóa" in response.json()["detail"]


async def test_create_loan_partial_failure_on_insufficient_stock(session, make_profile, client_as):
    reader = await make_profile("reader")
    librarian = await make_profile("librarian")
    await _issue_card(session, reader, librarian)
    plenty = await _seed_book(session, quantity=5)
    scarce = await _seed_book(session, quantity=0)

    async with client_as(librarian) as client:
        response = await client.post(
            "/api/loans",
            json={
                "reader_id": str(reader.id),
                "items": [
                    {"book_id": str(plenty.id), "quantity": 1},
                    {"book_id": str(scarce.id), "quantity": 1},
                ],
            },
        )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["loan"] is not None
    results = {item["book_id"]: item["ok"] for item in body["items"]}
    assert results[str(plenty.id)] is True
    assert results[str(scarce.id)] is False
