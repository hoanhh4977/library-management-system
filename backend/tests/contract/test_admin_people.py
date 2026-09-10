async def test_list_readers_requires_staff_role(make_profile, client_as):
    reader = await make_profile("reader")
    async with client_as(reader) as client:
        response = await client.get("/api/readers")
    assert response.status_code == 403


async def test_admin_updates_reader(make_profile, client_as):
    reader = await make_profile("reader", phone="0900000000")
    admin = await make_profile("admin")
    async with client_as(admin) as client:
        response = await client.patch(f"/api/readers/{reader.id}", json={"phone": "0911111111"})
    assert response.status_code == 200
    assert response.json()["phone"] == "0911111111"


async def test_admin_lists_and_updates_librarian(make_profile, client_as):
    librarian = await make_profile("librarian")
    admin = await make_profile("admin")
    async with client_as(admin) as client:
        list_response = await client.get("/api/librarians")
        assert list_response.status_code == 200
        assert any(item["id"] == str(librarian.id) for item in list_response.json())

        update_response = await client.patch(f"/api/librarians/{librarian.id}", json={"full_name": "Tên mới"})
    assert update_response.status_code == 200
    assert update_response.json()["full_name"] == "Tên mới"


async def test_librarian_cannot_update_other_librarian(make_profile, client_as):
    librarian_a = await make_profile("librarian")
    librarian_b = await make_profile("librarian")
    async with client_as(librarian_a) as client:
        response = await client.patch(f"/api/librarians/{librarian_b.id}", json={"full_name": "X"})
    assert response.status_code == 403
