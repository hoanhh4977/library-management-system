import uuid

from src.models.card_unlock_request import CardUnlockRequest
from src.models.library_card import LibraryCard


async def test_admin_lists_pending_unlock_requests(session, make_profile, client_as):
    reader = await make_profile("reader")
    librarian = await make_profile("librarian")
    admin = await make_profile("admin")
    card = LibraryCard(id=uuid.uuid4(), code="TV900050", reader_id=reader.id, issued_by=librarian.id, status="locked")
    session.add(card)
    await session.flush()
    session.add(CardUnlockRequest(id=uuid.uuid4(), card_id=card.id, requested_by=librarian.id, status="pending"))
    await session.commit()

    async with client_as(admin) as client:
        response = await client.get("/api/cards/unlock-requests")

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["reader_name"] == reader.full_name
    assert body[0]["card_code"] == "TV900050"
