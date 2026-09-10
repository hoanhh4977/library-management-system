async def test_inventory_report_requires_admin(make_profile, client_as):
    librarian = await make_profile("librarian")
    async with client_as(librarian) as client:
        response = await client.get("/api/reports/inventory")
    assert response.status_code == 403


async def test_inventory_report_ok_for_admin(make_profile, client_as):
    admin = await make_profile("admin")
    async with client_as(admin) as client:
        response = await client.get("/api/reports/inventory")
    assert response.status_code == 200
    body = response.json()
    assert "total_titles" in body and "books" in body
