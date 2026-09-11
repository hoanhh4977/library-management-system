"""Seeds "today" activity for the Librarian desk pages (Quầy giao dịch, Yêu cầu từ độc
giả) — prior seed scripts spread loans/requests across the last ~14 days, so "hôm nay"
stat tiles (borrowed today / returned today) had almost nothing to show (1 loan, 0
returns) even though the system overall had real history. Checks book/reader out
today, returns a couple of existing borrowing lines today, and adds a couple more
pending borrow requests so the review queue isn't just 1-2 rows.

Run once, from backend/: `conda run -n library-management python scripts/seed_librarian_desk_demo.py`
Safe to re-run: skips if today already has enough loan + return + pending-request activity.
"""

import asyncio
import random
import sys
import uuid
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import func, select

from src.core.db import SessionLocal, engine
from src.models.book import Book
from src.models.loan import Loan
from src.models.loan_detail import LoanDetail
from src.models.loan_request import LoanRequest, LoanRequestItem
from src.models.profile import Profile

MIN_BORROWED_TODAY = 3
MIN_RETURNED_TODAY = 2
MIN_PENDING_REQUESTS = 4


async def main() -> None:
    today = date.today()
    async with SessionLocal() as session:
        borrowed_today = (
            await session.execute(select(func.count()).select_from(Loan).where(Loan.loan_date == today))
        ).scalar() or 0
        returned_today = (
            await session.execute(
                select(func.count()).select_from(LoanDetail).where(LoanDetail.actual_return_date == today)
            )
        ).scalar() or 0
        pending_requests = (
            await session.execute(select(func.count()).select_from(LoanRequest).where(LoanRequest.status == "pending"))
        ).scalar() or 0

        if borrowed_today >= MIN_BORROWED_TODAY and returned_today >= MIN_RETURNED_TODAY and pending_requests >= MIN_PENDING_REQUESTS:
            print("Librarian-desk demo data already seeded — nothing to do.")
            await engine.dispose()
            return

        librarian = (await session.execute(select(Profile).where(Profile.role == "librarian"))).scalars().first()
        readers = (await session.execute(select(Profile).where(Profile.role == "reader"))).scalars().all()
        if not librarian or not readers:
            raise RuntimeError("Need a librarian and readers — run seed_dev_data.py first.")

        rng = random.Random(29)
        now = datetime.now(timezone.utc)

        # --- Check out a few books "today" ---
        if borrowed_today < MIN_BORROWED_TODAY:
            need = MIN_BORROWED_TODAY - borrowed_today
            books_in_stock = (await session.execute(select(Book).where(Book.quantity > 0))).scalars().all()
            for _ in range(need):
                if not books_in_stock:
                    break
                reader = rng.choice(readers)
                book = rng.choice(books_in_stock)
                loan = Loan(
                    id=uuid.uuid4(),
                    code=f"PM{uuid.uuid4().hex[:8].upper()}",
                    reader_id=reader.id,
                    librarian_id=librarian.id,
                    loan_date=today,
                    due_date=today + timedelta(days=14),
                )
                session.add(loan)
                await session.flush()
                book.quantity -= 1
                session.add(LoanDetail(loan_id=loan.id, book_id=book.id, quantity=1, status="borrowing"))
                print(f"loan created today: {book.title} — {reader.full_name}")

        # --- Return a couple of already-borrowing lines "today" ---
        if returned_today < MIN_RETURNED_TODAY:
            need = MIN_RETURNED_TODAY - returned_today
            borrowing_rows = (
                await session.execute(
                    select(LoanDetail, Loan)
                    .join(Loan, Loan.id == LoanDetail.loan_id)
                    .where(LoanDetail.status == "borrowing", Loan.due_date >= today)
                    .limit(need * 3)
                )
            ).all()
            rng.shuffle(borrowing_rows)
            for detail, loan in borrowing_rows[:need]:
                detail.status = "returned"
                detail.actual_return_date = today
                book = await session.get(Book, detail.book_id)
                if book:
                    book.quantity += detail.quantity
                print(f"returned today: loan {loan.code} book {detail.book_id}")

        # --- A couple more pending borrow requests, so the review queue has more than 2 ---
        if pending_requests < MIN_PENDING_REQUESTS:
            need = MIN_PENDING_REQUESTS - pending_requests
            books_available = (await session.execute(select(Book).where(Book.quantity > 0))).scalars().all()
            for i in range(need):
                if not books_available:
                    break
                reader = rng.choice(readers)
                book = rng.choice(books_available)
                requested_at = now - timedelta(hours=rng.uniform(1, 20))
                request = LoanRequest(
                    id=uuid.uuid4(),
                    reader_id=reader.id,
                    kind="borrow",
                    status="pending",
                    requested_at=requested_at,
                )
                session.add(request)
                await session.flush()
                session.add(LoanRequestItem(request_id=request.id, book_id=book.id, quantity=1))
                print(f"pending loan request added: {reader.full_name} — {book.title}")

        await session.commit()
        await engine.dispose()
        print("\nDone.")


if __name__ == "__main__":
    asyncio.run(main())
