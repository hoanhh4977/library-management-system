"""Adds a couple of genuinely OVERDUE loan lines (loan_date far enough in the past that
due_date has already passed) — `seed_demo_activity.py` only spreads loans over the last
13 days, so due_date (+14) never lands in the past and the admin "Overdue" widget has
nothing real to show. Run once, from backend/, after seed_demo_activity.py:
`conda run -n library-management python scripts/seed_overdue_demo.py`

Safe to re-run: skips if any `code LIKE 'PM-OVERDUE%'` loan already exists.
"""

import asyncio
import sys
import uuid
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.core.db import SessionLocal, engine
from src.models.book import Book
from src.models.loan import Loan
from src.models.loan_detail import LoanDetail
from src.models.profile import Profile
from sqlalchemy import select

MARKER = "PM-OVERDUE"


async def main() -> None:
    async with SessionLocal() as session:
        already_seeded = (
            await session.execute(select(Loan.id).where(Loan.code.like(f"{MARKER}%")).limit(1))
        ).first()
        if already_seeded:
            print("Overdue demo data already seeded — nothing to do.")
            await engine.dispose()
            return

        librarian = (
            await session.execute(select(Profile).where(Profile.role == "librarian"))
        ).scalars().first()
        readers = (
            await session.execute(select(Profile).where(Profile.role == "reader"))
        ).scalars().all()
        books = (await session.execute(select(Book).where(Book.quantity > 0))).scalars().all()
        if not librarian or not readers or not books:
            raise RuntimeError("Missing librarian/readers/books — run seed_dev_data.py + seed_demo_activity.py first.")

        today = date.today()
        # 3 days overdue and 9 days overdue — realistic staggered lateness.
        overdue_offsets = [(3, readers[0], books[0]), (9, readers[-1], books[1])]

        for i, (days_late, reader, book) in enumerate(overdue_offsets, start=1):
            if book.quantity <= 0:
                continue
            due_date = today - timedelta(days=days_late)
            loan_date = due_date - timedelta(days=14)
            loan = Loan(
                id=uuid.uuid4(),
                code=f"{MARKER}{i:02d}",
                reader_id=reader.id,
                librarian_id=librarian.id,
                loan_date=loan_date,
                due_date=due_date,
            )
            session.add(loan)
            await session.flush()
            book.quantity -= 1
            session.add(LoanDetail(loan_id=loan.id, book_id=book.id, quantity=1, status="borrowing"))
            print(f"overdue loan created: {book.title} — {days_late} ngày quá hạn ({reader.full_name})")

        await session.commit()
        await engine.dispose()
        print("\nDone.")


if __name__ == "__main__":
    asyncio.run(main())
