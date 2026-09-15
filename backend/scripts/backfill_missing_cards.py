"""One-off backfill: issue a Thẻ thư viện to every existing Reader who doesn't have
one yet — covers accounts registered before auto_issue_card existed (self-registration
now issues a card immediately; this catches everyone who registered earlier).

Uses the same auto_issue_card() service as self-registration, so cards created here
are indistinguishable from ones issued at signup (active, issued_by=NULL).

Run once, from backend/: `conda run -n library-management python scripts/backfill_missing_cards.py`
Safe to re-run: only touches readers with no existing library_cards row.
"""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select

from src.core.db import SessionLocal, engine
from src.models.library_card import LibraryCard
from src.models.profile import Profile
from src.services.card_service import auto_issue_card


async def main() -> None:
    async with SessionLocal() as session:
        readers = (await session.execute(select(Profile).where(Profile.role == "reader"))).scalars().all()
        existing_reader_ids = {
            card.reader_id for card in (await session.execute(select(LibraryCard))).scalars().all()
        }
        missing = [r for r in readers if r.id not in existing_reader_ids]

        print(f"{len(readers)} độc giả, {len(missing)} chưa có thẻ.")
        for reader in missing:
            card = await auto_issue_card(session, reader_id=reader.id)
            print(f"  + {reader.code} {reader.full_name!r} -> {card.code}")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
