import uuid

from src.models.book import Book


async def _seed(session, **overrides):
    defaults = dict(
        id=uuid.uuid4(), code=f"S{uuid.uuid4().hex[:6].upper()}", title="Sách mẫu",
        author="Tác giả mẫu", publisher="NXB mẫu", category="Thể loại mẫu", quantity=3,
    )
    defaults.update(overrides)
    book = Book(**defaults)
    session.add(book)
    await session.commit()
    return book


async def test_search_by_author_substring(session, make_profile, client_as):
    await _seed(session, title="Sapiens", author="Yuval Noah Harari")
    await _seed(session, title="Nhà Giả Kim", author="Paulo Coelho")
    reader = await make_profile("reader")

    async with client_as(reader) as client:
        response = await client.get("/api/books", params={"q": "Harari", "field": "author"})

    assert response.status_code == 200
    titles = [b["title"] for b in response.json()]
    assert titles == ["Sapiens"]


async def test_search_no_match_returns_empty_list(session, make_profile, client_as):
    await _seed(session, title="Đắc Nhân Tâm")
    reader = await make_profile("reader")

    async with client_as(reader) as client:
        response = await client.get("/api/books", params={"q": "không tồn tại"})

    assert response.status_code == 200
    assert response.json() == []
