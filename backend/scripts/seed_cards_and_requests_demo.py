"""Seeds realistic history for card-unlock requests and loan requests — both were
almost empty (1 unlock request ever, 0 resolved loan requests), so pages built on
top of them (Yêu cầu mở khóa thẻ, any resolved-request history/trend) had nothing
real to show. Locks a few existing readers' cards (simulating the overdue-violation
auto-lock) and creates a spread of pending/approved/rejected requests over the last
~10 days for both request types.

Run once, from backend/: `conda run -n library-management python scripts/seed_cards_and_requests_demo.py`
Safe to re-run: skips if any `PM-REQDEMO`-coded artifact already exists (checked via
a marker unlock request id prefix isn't possible since ids are UUIDs, so this keys
off request COUNT instead — see the guard below).
"""

import asyncio
import random
import sys
import uuid
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.core.config import get_settings
from src.core.db import SessionLocal, engine
from src.models.book import Book
from src.models.card_unlock_request import CardUnlockRequest
from src.models.library_card import LibraryCard
from src.models.loan_request import LoanRequest, LoanRequestItem
from src.models.profile import Profile
from sqlalchemy import func, select

SEED_PASSWORD = "TestPass123!"
NEW_READERS = [
    {"full_name": "Trịnh Gia Bảo", "email": "reader6@lms-seed.test", "dob": date(1997, 2, 14), "phone": "0900000006"},
    {"full_name": "Lâm Thanh Hằng", "email": "reader7@lms-seed.test", "dob": date(2003, 11, 8), "phone": "0900000007"},
    {"full_name": "Đỗ Việt Long", "email": "reader8@lms-seed.test", "dob": date(1999, 6, 30), "phone": "0900000008"},
]


async def create_auth_user(client: httpx.AsyncClient, email: str) -> str:
    resp = await client.post(
        "/auth/v1/admin/users",
        json={"email": email, "password": SEED_PASSWORD, "email_confirm": True},
    )
    if resp.status_code == 200:
        return resp.json()["id"]
    if resp.status_code == 422 or "already been registered" in resp.text:
        # Supabase's admin list-users endpoint ignores the `email` query param and
        # just returns every user, so the match must happen client-side — taking
        # users[0] unconditionally previously returned a DIFFERENT random existing
        # user's id whenever this fallback path ran (see the 2026-09-11 incident:
        # every "already registered" reader silently got reader8's auth id).
        list_resp = await client.get("/auth/v1/admin/users")
        list_resp.raise_for_status()
        users = list_resp.json().get("users", [])
        match = next((u for u in users if u["email"] == email), None)
        if match:
            return match["id"]
    resp.raise_for_status()
    raise RuntimeError(f"Unexpected response creating {email}: {resp.text}")


async def main() -> None:
    async with SessionLocal() as session:
        existing_unlock_count = (
            await session.execute(select(func.count()).select_from(CardUnlockRequest))
        ).scalar()
        if existing_unlock_count and existing_unlock_count > 2:
            print("Unlock-request history already seeded — nothing to do.")
            await engine.dispose()
            return

        admin = (await session.execute(select(Profile).where(Profile.role == "admin"))).scalars().first()
        librarian = (await session.execute(select(Profile).where(Profile.role == "librarian"))).scalars().first()
        books = (await session.execute(select(Book).where(Book.quantity > 0))).scalars().all()
        if not admin or not librarian or not books:
            raise RuntimeError("Need an admin, a librarian, and books in stock — run earlier seed scripts first.")

        rng = random.Random(13)
        now = datetime.now(timezone.utc)
        settings = get_settings()

        # --- A few more readers, so the People page isn't just 5 rows ---
        async with httpx.AsyncClient(
            base_url=settings.supabase_url,
            headers={"apikey": settings.supabase_secret_key, "Authorization": f"Bearer {settings.supabase_secret_key}"},
            timeout=30,
        ) as client:
            for r in NEW_READERS:
                existing = (
                    await session.execute(select(Profile).where(Profile.email == r["email"]))
                ).scalar_one_or_none()
                if existing:
                    continue
                auth_id = uuid.UUID(await create_auth_user(client, r["email"]))
                created_at = now - timedelta(days=rng.uniform(1, 18), hours=rng.uniform(0, 23))
                session.add(
                    Profile(
                        id=auth_id,
                        role="reader",
                        code=f"DG{uuid.uuid4().hex[:5].upper()}",
                        full_name=r["full_name"],
                        date_of_birth=r["dob"],
                        phone=r["phone"],
                        email=r["email"],
                        created_at=created_at,
                    )
                )
                print(f"reader created: {r['full_name']}")
        await session.commit()

        readers = (await session.execute(select(Profile).where(Profile.role == "reader"))).scalars().all()
        for reader in readers:
            card = (
                await session.execute(select(LibraryCard).where(LibraryCard.reader_id == reader.id))
            ).scalar_one_or_none()
            if card is None:
                session.add(
                    LibraryCard(
                        id=uuid.uuid4(),
                        code=f"TV{uuid.uuid4().hex[:6].upper()}",
                        reader_id=reader.id,
                        issued_by=librarian.id,
                        status="active",
                        issued_at=(now - timedelta(days=rng.uniform(0, 15))).date(),
                    )
                )
        await session.commit()

        # --- Lock 3 readers' cards + a mixed-status unlock-request history ---
        lock_targets = readers[:3]
        outcomes = [
            ("approved", 9, 8),   # requested 9 days ago, resolved 8 days ago — card now active again
            ("rejected", 5, 4),   # requested 5 days ago, resolved 4 days ago — card stays locked
            ("pending", 1, None), # requested yesterday, still waiting
        ]

        for reader, (status, requested_days_ago, resolved_days_ago) in zip(lock_targets, outcomes):
            card = (
                await session.execute(select(LibraryCard).where(LibraryCard.reader_id == reader.id))
            ).scalar_one_or_none()
            if card is None:
                continue
            card.status = "locked" if status != "approved" else "active"

            requested_at = now - timedelta(days=requested_days_ago, hours=rng.uniform(0, 12))
            reviewed_at = (
                now - timedelta(days=resolved_days_ago, hours=rng.uniform(0, 12))
                if resolved_days_ago is not None
                else None
            )
            session.add(
                CardUnlockRequest(
                    id=uuid.uuid4(),
                    card_id=card.id,
                    requested_by=librarian.id,
                    requested_at=requested_at,
                    status=status,
                    reviewed_by=admin.id if reviewed_at else None,
                    reviewed_at=reviewed_at,
                )
            )
            print(f"unlock request ({status}): {reader.full_name}")

        # --- Resolved loan requests (approved/rejected), so request volume has real
        # history beyond just the 2 still-pending ones ---
        loan_request_plan = [
            ("approved", 7),
            ("approved", 6),
            ("rejected", 4),
            ("approved", 3),
            ("rejected", 2),
        ]
        for status, days_ago in loan_request_plan:
            reader = rng.choice(readers)
            book = rng.choice(books)
            requested_at = now - timedelta(days=days_ago, hours=rng.uniform(0, 12))
            reviewed_at = requested_at + timedelta(hours=rng.uniform(1, 20))
            request = LoanRequest(
                id=uuid.uuid4(),
                reader_id=reader.id,
                kind="borrow",
                status=status,
                requested_at=requested_at,
                reviewed_by=librarian.id,
                reviewed_at=reviewed_at,
            )
            session.add(request)
            await session.flush()
            session.add(LoanRequestItem(request_id=request.id, book_id=book.id, quantity=1))
            print(f"loan request ({status}): {reader.full_name} — {book.title}")

        await session.commit()
        await engine.dispose()
        print("\nDone.")


if __name__ == "__main__":
    asyncio.run(main())
