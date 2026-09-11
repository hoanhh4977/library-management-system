"""Wipes all business data (books, cards, loans, requests) and non-core profiles,
then replays the full existing seed-script pipeline in dependency order on a clean
slate. Run after the demo data accumulated too many ad-hoc patches from repeated
manual seeding across a long session (e.g. a reader ending up with two unlock
requests because separate scripts both picked her at random).

Keeps the 3 core login accounts (admin@lms-seed.test, librarian@lms-seed.test,
reader@lms-seed.test) — their Supabase Auth users and `profiles` rows are left
alone, only their cards/loans are cleared along with everyone else's, so a fresh
run of seed_dev_data.py can re-issue a clean card + sample loan for the reader.

Run once, from backend/: `conda run -n library-management python scripts/reset_and_reseed.py`
This is destructive — deletes real rows from the remote Supabase DB. Confirms
before running unless --yes is passed.
"""

import asyncio
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import delete, select

from src.core.db import SessionLocal, engine
from src.models.card_unlock_request import CardUnlockRequest
from src.models.library_card import LibraryCard
from src.models.loan import Loan
from src.models.loan_detail import LoanDetail
from src.models.loan_request import LoanRequest, LoanRequestItem
from src.models.book import Book
from src.models.profile import Profile

CORE_EMAILS = {"admin@lms-seed.test", "librarian@lms-seed.test", "reader@lms-seed.test"}

# Re-run in this exact order: each script assumes the previous ones already ran
# (e.g. seed_overdue_demo.py needs seed_demo_activity.py's extra readers).
PIPELINE = [
    "seed_dev_data.py",
    "seed_demo_activity.py",
    "seed_overdue_demo.py",
    "seed_science_philosophy_books.py",
    "backfill_missing_covers.py",
    "backfill_book_created_at.py",
    "seed_fahasa_books.py",
    "seed_cards_and_requests_demo.py",
    "seed_librarian_desk_demo.py",
    "seed_stock_edge_cases_demo.py",
    "seed_requests_today_demo.py",
]


async def wipe() -> None:
    async with SessionLocal() as session:
        core_ids = (
            await session.execute(select(Profile.id).where(Profile.email.in_(CORE_EMAILS)))
        ).scalars().all()

        await session.execute(delete(LoanDetail))
        await session.execute(delete(LoanRequestItem))
        await session.execute(delete(CardUnlockRequest))
        await session.execute(delete(LoanRequest))
        await session.execute(delete(Loan))
        await session.execute(delete(LibraryCard))
        await session.execute(delete(Book))
        await session.execute(delete(Profile).where(Profile.id.notin_(core_ids)))
        await session.commit()
    await engine.dispose()
    print(f"Wiped business data. Kept {len(core_ids)} core profile(s).")


def replay_pipeline() -> None:
    scripts_dir = Path(__file__).resolve().parent
    for script in PIPELINE:
        print(f"\n=== {script} ===")
        result = subprocess.run(
            [sys.executable, str(scripts_dir / script)],
            cwd=str(scripts_dir.parent),
        )
        if result.returncode != 0:
            raise RuntimeError(f"{script} failed with exit code {result.returncode}")


def main() -> None:
    if "--yes" not in sys.argv:
        confirm = input(
            "This will DELETE all books/cards/loans/requests and any profile that isn't "
            "one of the 3 core seed accounts, then re-seed from scratch. Type 'yes' to continue: "
        )
        if confirm.strip().lower() != "yes":
            print("Aborted.")
            return

    asyncio.run(wipe())
    replay_pipeline()
    print("\nDone. Database reset and reseeded cleanly.")


if __name__ == "__main__":
    main()
