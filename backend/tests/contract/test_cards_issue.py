import uuid


async def test_issue_card_happy_path(make_profile, client_as):
    reader = await make_profile("reader")
    librarian = await make_profile("librarian")

    async with client_as(librarian) as client:
        response = await client.post(f"/api/readers/{reader.id}/card")

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["status"] == "active"


async def test_issue_card_rejects_second_card(make_profile, client_as):
    reader = await make_profile("reader")
    librarian = await make_profile("librarian")

    async with client_as(librarian) as client:
        first = await client.post(f"/api/readers/{reader.id}/card")
        assert first.status_code == 200
        second = await client.post(f"/api/readers/{reader.id}/card")

    assert second.status_code == 409


async def test_issue_card_unknown_reader_is_404(make_profile, client_as):
    librarian = await make_profile("librarian")
    async with client_as(librarian) as client:
        response = await client.post(f"/api/readers/{uuid.uuid4()}/card")
    assert response.status_code == 404
