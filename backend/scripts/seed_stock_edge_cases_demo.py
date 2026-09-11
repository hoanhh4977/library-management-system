"""Seeds "hết hàng" (out-of-stock) and more "quá hạn" (overdue) books — the catalog had
zero out-of-stock titles and only 2 overdue loan lines, so the Books/Search pages'
"Hết hàng" and "Sách quá hạn" filters/tiles had nothing real to show beyond a
trivial case. Loans out every remaining copy of a couple of low-stock titles (real
quantity decrement, not a fabricated zero) and adds a few more overdue loans across
different books/readers with varying days-late.

Run once, from backend/: `conda run -n library-management python scripts/seed_stock_edge_cases_demo.py`
Safe to re-run: skips if the catalog already has >=2 out-of-stock titles and
>=5 overdue loan lines.
"""

import asyncio
import random
import sys
import uuid
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import func, select

from src.core.db import SessionLocal, engine
from src.models.book import Book
from src.models.loan import Loan
from src.models.loan_detail import LoanDetail
from src.models.profile import Profile

MIN_OUT_OF_STOCK = 2
MIN_OVERDUE = 5


async def main() -> None:
    today = date.today()
    async with SessionLocal() as session:
        out_of_stock = (
            await session.execute(select(func.count()).select_from(Book).where(Book.quantity == 0))
        ).scalar() or 0
        overdue = (
            await session.execute(
                select(func.count())
                .select_from(LoanDetail)
                .join(Loan, Loan.id == LoanDetail.loan_id)
                .where(LoanDetail.status == "borrowing", Loan.due_date < today)
            )
        ).scalar() or 0

        if out_of_stock >= MIN_OUT_OF_STOCK and overdue >= MIN_OVERDUE:
            print("Stock edge-case demo data already seeded — nothing to do.")
            await engine.dispose()
            return

        librarian = (await session.execute(select(Profile).where(Profile.role == "librarian"))).scalars().first()
        readers = (await session.execute(select(Profile).where(Profile.role == "reader"))).scalars().all()
        if not librarian or not readers:
            raise RuntimeError("Need a librarian and readers — run seed_dev_data.py first.")

        rng = random.Random(41)

        # --- Loan out every remaining copy of a couple of low-stock titles, so they
        # genuinely read as "Hết hàng" (not a fabricated zero disconnected from loans). ---
        if out_of_stock < MIN_OUT_OF_STOCK:
            need = MIN_OUT_OF_STOCK - out_of_stock
            candidates = (
                await session.execute(
                    select(Book).where(Book.quantity > 0, Book.quantity <= 2).order_by(Book.quantity).limit(need)
                )
            ).scalars().all()
            for book in candidates:
                while book.quantity > 0:
                    reader = rng.choice(readers)
                    loan = Loan(
                        id=uuid.uuid4(),
                        code=f"PM{uuid.uuid4().hex[:8].upper()}",
                        reader_id=reader.id,
                        librarian_id=librarian.id,
                        loan_date=today - timedelta(days=rng.randint(0, 3)),
                        due_date=today + timedelta(days=rng.randint(7, 14)),
                    )
                    session.add(loan)
                    await session.flush()
                    session.add(LoanDetail(loan_id=loan.id, book_id=book.id, quantity=1, status="borrowing"))
                    book.quantity -= 1
                print(f"out of stock now: {book.title}")

        # --- A few more overdue loans, spread across different books/readers/severities ---
        if overdue < MIN_OVERDUE:
            need = MIN_OVERDUE - overdue
            books_in_stock = (await session.execute(select(Book).where(Book.quantity > 0))).scalars().all()
            severities = [2, 6, 9, 15, 21]
            for i in range(need):
                if not books_in_stock:
                    break
                book = rng.choice(books_in_stock)
                reader = rng.choice(readers)
                days_late = severities[i % len(severities)]
                loan = Loan(
                    id=uuid.uuid4(),
                    code=f"PM{uuid.uuid4().hex[:8].upper()}",
                    reader_id=reader.id,
                    librarian_id=librarian.id,
                    loan_date=today - timedelta(days=days_late + 14),
                    due_date=today - timedelta(days=days_late),
                )
                session.add(loan)
                await session.flush()
                session.add(LoanDetail(loan_id=loan.id, book_id=book.id, quantity=1, status="borrowing"))
                book.quantity -= 1
                print(f"overdue now ({days_late}d): {book.title} — {reader.full_name}")

        await session.commit()
        await engine.dispose()
        print("\nDone.")


if __name__ == "__main__":
    asyncio.run(main())
