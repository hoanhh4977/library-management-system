"""Seeds unlock/loan-request activity resolved TODAY, plus a couple of genuinely
pending unlock requests — after the "Đang chờ duyệt" trend-metric fix, testing
revealed the demo data had exactly one request resolved today and zero pending
unlock requests, making the "Đã duyệt/Đã từ chối hôm nay" and "Đang chờ duyệt"
tiles boring to look at (always 0 or 1). Locks a couple more active readers'
cards and creates a spread of unlock + loan requests resolved today (mixed
approve/reject) plus a couple left genuinely pending.

Run once, from backend/: `conda run -n library-management python scripts/seed_requests_today_demo.py`
Safe to re-run: skips if today already has enough resolved-today + pending activity.
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
from src.models.card_unlock_request import CardUnlockRequest
from src.models.library_card import LibraryCard
from src.models.loan_request import LoanRequest, LoanRequestItem
from src.models.profile import Profile

MIN_UNLOCK_RESOLVED_TODAY = 2
MIN_UNLOCK_PENDING = 2
MIN_LOAN_RESOLVED_TODAY = 2


async def main() -> None:
    today = date.today()
    now = datetime.now(timezone.utc)

    async with SessionLocal() as session:
        unlock_resolved_today = (
            await session.execute(
                select(func.count())
                .select_from(CardUnlockRequest)
                .where(CardUnlockRequest.status != "pending", func.date(CardUnlockRequest.reviewed_at) == today)
            )
        ).scalar() or 0
        unlock_pending = (
            await session.execute(select(func.count()).select_from(CardUnlockRequest).where(CardUnlockRequest.status == "pending"))
        ).scalar() or 0
        loan_resolved_today = (
            await session.execute(
                select(func.count())
                .select_from(LoanRequest)
                .where(LoanRequest.status != "pending", func.date(LoanRequest.reviewed_at) == today)
            )
        ).scalar() or 0

        if (
            unlock_resolved_today >= MIN_UNLOCK_RESOLVED_TODAY
            and unlock_pending >= MIN_UNLOCK_PENDING
            and loan_resolved_today >= MIN_LOAN_RESOLVED_TODAY
        ):
            print("Today's-activity demo data already seeded — nothing to do.")
            await engine.dispose()
            return

        admin = (await session.execute(select(Profile).where(Profile.role == "admin"))).scalars().first()
        librarian = (await session.execute(select(Profile).where(Profile.role == "librarian"))).scalars().first()
        active_cards = (
            await session.execute(
                select(LibraryCard, Profile)
                .join(Profile, Profile.id == LibraryCard.reader_id)
                .where(LibraryCard.status == "active")
            )
        ).all()
        readers = (await session.execute(select(Profile).where(Profile.role == "reader"))).scalars().all()
        books = (await session.execute(select(Book).where(Book.quantity > 0))).scalars().all()
        if not admin or not librarian or not active_cards or not readers:
            raise RuntimeError("Need admin/librarian/active cards/readers — run earlier seed scripts first.")

        rng = random.Random(59)
        rng.shuffle(active_cards)

        # --- Lock a few more active readers' cards, resolve some today, leave some pending ---
        need_resolved = max(0, MIN_UNLOCK_RESOLVED_TODAY - unlock_resolved_today)
        need_pending = max(0, MIN_UNLOCK_PENDING - unlock_pending)
        plan: list[str] = ["approved"] * ((need_resolved + 1) // 2) + ["rejected"] * (need_resolved // 2)
        plan += ["pending"] * need_pending

        for outcome, (card, reader) in zip(plan, active_cards):
            card.status = "locked" if outcome != "approved" else "active"
            requested_at = now - timedelta(hours=rng.uniform(2, 30))
            reviewed_at = now - timedelta(minutes=rng.uniform(5, 300)) if outcome != "pending" else None
            session.add(
                CardUnlockRequest(
                    id=uuid.uuid4(),
                    card_id=card.id,
                    requested_by=librarian.id,
                    requested_at=requested_at,
                    status=outcome,
                    reviewed_by=admin.id if reviewed_at else None,
                    reviewed_at=reviewed_at,
                )
            )
            print(f"unlock request ({outcome}): {reader.full_name}")

        # --- Resolve a couple more loan requests today ---
        need_loan_resolved = max(0, MIN_LOAN_RESOLVED_TODAY - loan_resolved_today)
        loan_outcomes = ["approved", "rejected"]
        for i in range(need_loan_resolved):
            if not books:
                break
            reader = rng.choice(readers)
            book = rng.choice(books)
            outcome = loan_outcomes[i % len(loan_outcomes)]
            requested_at = now - timedelta(hours=rng.uniform(3, 20))
            reviewed_at = now - timedelta(minutes=rng.uniform(10, 200))
            request = LoanRequest(
                id=uuid.uuid4(),
                reader_id=reader.id,
                kind="borrow",
                status=outcome,
                requested_at=requested_at,
                reviewed_by=librarian.id,
                reviewed_at=reviewed_at,
            )
            session.add(request)
            await session.flush()
            session.add(LoanRequestItem(request_id=request.id, book_id=book.id, quantity=1))
            print(f"loan request ({outcome}, today): {reader.full_name} — {book.title}")

        await session.commit()
        await engine.dispose()
        print("\nDone.")


if __name__ == "__main__":
    asyncio.run(main())
