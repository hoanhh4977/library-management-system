import uuid

from src.models.card_unlock_request import CardUnlockRequest
from src.models.library_card import LibraryCard


async def _seed_request(session, reader, librarian, status="pending"):
    card = LibraryCard(id=uuid.uuid4(), code="TV800030", reader_id=reader.id, issued_by=librarian.id, status="locked")
    session.add(card)
    await session.flush()
    req = CardUnlockRequest(id=uuid.uuid4(), card_id=card.id, requested_by=librarian.id, status=status)
    session.add(req)
    await session.commit()
    return card, req


async def test_approve_unlock_request_records_audit_trail(session, make_profile, client_as):
    reader = await make_profile("reader")
    librarian = await make_profile("librarian")
    admin = await make_profile("admin")
    card, req = await _seed_request(session, reader, librarian)

    async with client_as(admin) as client:
        response = await client.post(f"/api/cards/{card.id}/unlock-requests/{req.id}/approve")

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["status"] == "approved"
    assert body["reviewed_by"] == str(admin.id)
    assert body["reviewed_at"] is not None

    await session.refresh(card)
    assert card.status == "active"


async def test_librarian_cannot_approve(session, make_profile, client_as):
    reader = await make_profile("reader")
    librarian = await make_profile("librarian")
    card, req = await _seed_request(session, reader, librarian)

    async with client_as(librarian) as client:
        response = await client.post(f"/api/cards/{card.id}/unlock-requests/{req.id}/approve")

    assert response.status_code == 403


async def test_reject_unlock_request(session, make_profile, client_as):
    reader = await make_profile("reader")
    librarian = await make_profile("librarian")
    admin = await make_profile("admin")
    card, req = await _seed_request(session, reader, librarian)

    async with client_as(admin) as client:
        response = await client.post(f"/api/cards/{card.id}/unlock-requests/{req.id}/reject")

    assert response.status_code == 200
    assert response.json()["status"] == "rejected"
    await session.refresh(card)
    assert card.status == "locked"
