"""Spreads `created_at` across the last ~20 days for books that currently all share
the exact same timestamp (the instant migration 0004_book_created_at ran) — without
this, "Tổng đầu sách" would have a single-spike, not-useful trend series. The 12
science/philosophy titles added late in this session get a "recent" date (last 4
days); everything else (the original manga/classics catalog) gets spread further
back, approximating "when the catalog was actually built up".

Run once, from backend/: `conda run -n library-management python scripts/backfill_book_created_at.py`
Safe to re-run: only touches rows whose created_at is still within 1 minute of "now"
(i.e. never manually backfilled or genuinely just-created).
"""

import asyncio
import random
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.core.db import SessionLocal, engine
from src.models.book import Book
from sqlalchemy import select

RECENT_TITLES = {
    "Lược Sử Thời Gian",
    "Vũ Trụ - Cosmos",
    "Gen Vị Kỷ",
    "Mùa Xuân Vắng Lặng",
    "Nguồn Gốc Muôn Loài",
    "Clean Code - Mã Sạch",
    "Những Người Tiên Phong",
    "Suy Tưởng",
    "Zarathustra Đã Nói Như Thế",
    "Nền Cộng Hòa",
    "Phương Pháp Luận",
    "Phải Trái Đúng Sai",
}


async def main() -> None:
    async with SessionLocal() as session:
        now = datetime.now(timezone.utc)
        recent_cutoff = now - timedelta(minutes=1)
        books = (await session.execute(select(Book).where(Book.created_at >= recent_cutoff))).scalars().all()
        if not books:
            print("No books need backfilling (all already have a real created_at).")
            await engine.dispose()
            return

        rng = random.Random(7)
        updated = 0
        for book in books:
            if book.title in RECENT_TITLES:
                offset_days = rng.uniform(0, 4)
            else:
                offset_days = rng.uniform(4, 21)
            book.created_at = now - timedelta(days=offset_days, hours=rng.uniform(0, 23))
            updated += 1

        await session.commit()
        await engine.dispose()
        print(f"Backfilled created_at for {updated} books.")


if __name__ == "__main__":
    asyncio.run(main())
