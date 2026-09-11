"""Fills in `cover_image_url` for any existing book that has none, using the Open
Library search API (real, public book data — not a fabricated URL). Only updates a
row when a real cover is actually found; leaves it untouched otherwise so a later
run can retry it. Run once, from backend/:
`conda run -n library-management python scripts/backfill_missing_covers.py`
"""

import asyncio
import sys
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.core.db import SessionLocal, engine
from src.models.book import Book
from sqlalchemy import select


async def fetch_cover_id(client: httpx.AsyncClient, title: str, author: str) -> int | None:
    resp = await client.get(
        "https://openlibrary.org/search.json",
        params={"q": f"{title} {author}", "limit": 1, "fields": "cover_i"},
    )
    resp.raise_for_status()
    docs = resp.json().get("docs", [])
    return docs[0].get("cover_i") if docs else None


async def main() -> None:
    async with SessionLocal() as session, httpx.AsyncClient(timeout=20) as client:
        books = (
            await session.execute(select(Book).where(Book.cover_image_url.is_(None)))
        ).scalars().all()
        if not books:
            print("No books missing a cover image.")
            await engine.dispose()
            return

        updated = 0
        for book in books:
            cover_i = await fetch_cover_id(client, book.title, book.author)
            if cover_i:
                book.cover_image_url = f"https://covers.openlibrary.org/b/id/{cover_i}-L.jpg"
                updated += 1
                print(f"cover found: {book.title} — {book.author}")
            else:
                print(f"no cover found, left as-is: {book.title} — {book.author}")

        await session.commit()
        await engine.dispose()
        print(f"\nDone. Updated {updated}/{len(books)} books.")


if __name__ == "__main__":
    asyncio.run(main())
