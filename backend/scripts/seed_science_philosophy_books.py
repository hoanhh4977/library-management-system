"""Adds real science/technology and philosophy titles to the catalog — the existing
seed data (seed_dev_data.py + whatever was in Supabase before) skews heavily toward
manga/comics, so the Books page looks one-note. Metadata (author, publisher, cover
image) is fetched live from the Open Library search API (openlibrary.org) — a free,
public book database — rather than fabricated or scraped from an unrelated site.

Run once, from backend/: `conda run -n library-management python scripts/seed_science_philosophy_books.py`
Safe to re-run: skips any title that already exists (matched by title).
"""

import asyncio
import random
import sys
import uuid
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.core.db import SessionLocal, engine
from src.models.book import Book
from src.models.category import BookCategory, Category
from sqlalchemy import select

# (search query for Open Library, Vietnamese display title, category)
BOOKS = [
    ("A Brief History of Time Stephen Hawking", "Lược Sử Thời Gian", "Khoa học"),
    ("Cosmos Carl Sagan", "Vũ Trụ - Cosmos", "Khoa học"),
    ("The Selfish Gene Richard Dawkins", "Gen Vị Kỷ", "Khoa học"),
    ("Silent Spring Rachel Carson", "Mùa Xuân Vắng Lặng", "Khoa học"),
    ("The Origin of Species Charles Darwin", "Nguồn Gốc Muôn Loài", "Khoa học"),
    ("Clean Code Robert Martin", "Clean Code - Mã Sạch", "Công nghệ"),
    ("The Innovators Walter Isaacson", "Những Người Tiên Phong", "Công nghệ"),
    ("Meditations Marcus Aurelius", "Suy Tưởng", "Triết học"),
    ("Thus Spoke Zarathustra Nietzsche", "Zarathustra Đã Nói Như Thế", "Triết học"),
    ("The Republic Plato", "Nền Cộng Hòa", "Triết học"),
    ("Discourse on Method Descartes", "Phương Pháp Luận", "Triết học"),
    ("Justice What's the Right Thing to Do Michael Sandel", "Phải Trái Đúng Sai", "Triết học"),
]


def pick_publisher(publishers: list[str] | None) -> str:
    if not publishers:
        return "NXB Trẻ"
    for p in publishers:
        if "nxb" in p.lower() or "tri thức" in p.lower():
            return p
    return publishers[0][:100]


async def fetch_metadata(client: httpx.AsyncClient, query: str) -> dict | None:
    resp = await client.get(
        "https://openlibrary.org/search.json",
        params={"q": query, "limit": 1, "fields": "title,author_name,publisher,cover_i"},
    )
    resp.raise_for_status()
    docs = resp.json().get("docs", [])
    return docs[0] if docs else None


async def main() -> None:
    async with SessionLocal() as session, httpx.AsyncClient(timeout=20) as client:
        added = 0
        for query, vn_title, category in BOOKS:
            existing = (
                await session.execute(select(Book).where(Book.title == vn_title))
            ).scalar_one_or_none()
            if existing:
                print(f"skip (already exists): {vn_title}")
                continue

            doc = await fetch_metadata(client, query)
            if not doc:
                print(f"no Open Library match, skipping: {query}")
                continue

            cover_i = doc.get("cover_i")
            if not cover_i:
                print(f"no cover image available, skipping: {vn_title}")
                continue
            cover_url = f"https://covers.openlibrary.org/b/id/{cover_i}-L.jpg"

            author = doc.get("author_name", ["Không rõ"])[0]
            publisher = pick_publisher(doc.get("publisher"))

            book = Book(
                id=uuid.uuid4(),
                code=f"S{uuid.uuid4().hex[:6].upper()}",
                title=vn_title,
                author=author,
                publisher=publisher,
                quantity=random.Random(vn_title).randint(2, 5),
                cover_image_url=cover_url,
            )
            session.add(book)
            await session.flush()
            category_row = (
                await session.execute(select(Category).where(Category.name == category))
            ).scalar_one_or_none()
            if category_row is None:
                category_row = Category(id=uuid.uuid4(), name=category)
                session.add(category_row)
                await session.flush()
            session.add(BookCategory(book_id=book.id, category_id=category_row.id))
            added += 1
            print(f"added: {vn_title} — {author} ({category})")

        await session.commit()
        await engine.dispose()
        print(f"\nDone. Added {added} new titles.")


if __name__ == "__main__":
    asyncio.run(main())
