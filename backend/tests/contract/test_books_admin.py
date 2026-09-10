async def test_admin_creates_book(make_profile, client_as):
    admin = await make_profile("admin")
    async with client_as(admin) as client:
        response = await client.post(
            "/api/books",
            json={
                "title": "Tuổi Trẻ Đáng Giá Bao Nhiêu",
                "author": "Rosie Nguyễn",
                "publisher": "NXB Hội Nhà Văn",
                "category": "Kỹ năng sống",
                "quantity": 4,
            },
        )
    assert response.status_code == 200, response.text
    assert response.json()["quantity"] == 4


async def test_librarian_cannot_create_book(make_profile, client_as):
    librarian = await make_profile("librarian")
    async with client_as(librarian) as client:
        response = await client.post(
            "/api/books",
            json={"title": "X", "author": "Y", "publisher": "Z", "category": "W", "quantity": 1},
        )
    assert response.status_code == 403


async def test_negative_quantity_rejected(make_profile, client_as):
    admin = await make_profile("admin")
    async with client_as(admin) as client:
        response = await client.post(
            "/api/books",
            json={"title": "X", "author": "Y", "publisher": "Z", "category": "W", "quantity": -1},
        )
    assert response.status_code == 422


async def test_admin_updates_book_quantity(session, make_profile, client_as):
    admin = await make_profile("admin")
    async with client_as(admin) as client:
        create = await client.post(
            "/api/books",
            json={"title": "X", "author": "Y", "publisher": "Z", "category": "W", "quantity": 1},
        )
        book_id = create.json()["id"]
        update = await client.patch(f"/api/books/{book_id}", json={"quantity": 9})
    assert update.status_code == 200
    assert update.json()["quantity"] == 9
