import uuid


async def test_register_then_issue_card_flow(session, make_profile, client_as, client_with_claims):
    """Covers spec.md User Story 2: self-registration (OTP-verified, simulated here via
    client_with_claims) creates a profile with no card yet; a Librarian then issues one."""
    auth_user_id = uuid.uuid4()
    email = f"{uuid.uuid4().hex}@example.com"

    async with client_with_claims(sub=str(auth_user_id), email=email) as client:
        response = await client.post(
            "/api/auth/complete-registration",
            json={"full_name": "Nguyễn Thị Minh Anh", "date_of_birth": "1998-05-12", "phone": "0912345678"},
        )
    assert response.status_code == 200, response.text
    reader_id = response.json()["id"]
    assert response.json()["library_card"] is None

    librarian = await make_profile("librarian")
    async with client_as(librarian) as client:
        get_response = await client.get(f"/api/readers/{reader_id}")
        assert get_response.json()["library_card"] is None

        issue_response = await client.post(f"/api/readers/{reader_id}/card")
        assert issue_response.status_code == 200

        get_after = await client.get(f"/api/readers/{reader_id}")
        assert get_after.json()["library_card"]["status"] == "active"


async def test_duplicate_email_registration_is_rejected(client_with_claims):
    email = f"{uuid.uuid4().hex}@example.com"

    async with client_with_claims(sub=str(uuid.uuid4()), email=email) as client:
        first = await client.post(
            "/api/auth/complete-registration",
            json={"full_name": "Người A", "date_of_birth": "1990-01-01", "phone": "0900000000"},
        )
    assert first.status_code == 200

    async with client_with_claims(sub=str(uuid.uuid4()), email=email) as client:
        second = await client.post(
            "/api/auth/complete-registration",
            json={"full_name": "Người B", "date_of_birth": "1991-01-01", "phone": "0900000001"},
        )
    assert second.status_code == 409
