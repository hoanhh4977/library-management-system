"""One-off seeding script that adds realistic borrowing HISTORY spread over the last
14 days — several readers, a mix of returned/still-borrowing/overdue loans — so the
admin dashboard's data-driven widgets (trend chart, category donut, top borrowed,
top authors, stock overview) have real numbers instead of "no data yet" empty states.

`seed_dev_data.py` only creates one reader with one loan (just enough to prove the
happy path works); this script is the follow-up that makes the dashboard look like
a library that's actually been used for two weeks.

Run once, from backend/: `conda run -n library-management python scripts/seed_demo_activity.py`
Safe to re-run: skips everything if any `code LIKE 'PM-DEMO%'` loan already exists.
"""

import asyncio
import random
import sys
import uuid
from datetime import date, timedelta
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.core.config import get_settings
from src.core.db import SessionLocal, engine
from src.models.book import Book
from src.models.library_card import LibraryCard
from src.models.loan import Loan
from src.models.loan_detail import LoanDetail
from src.models.profile import Profile
from sqlalchemy import select

DEMO_MARKER = "PM-DEMO"

READERS = [
    {"full_name": "Phạm Quốc Anh", "email": "reader2@lms-seed.test", "dob": date(1998, 4, 11), "phone": "0900000002"},
    {"full_name": "Vũ Thị Ngọc", "email": "reader3@lms-seed.test", "dob": date(2001, 9, 23), "phone": "0900000003"},
    {"full_name": "Đặng Minh Quân", "email": "reader4@lms-seed.test", "dob": date(1995, 12, 2), "phone": "0900000004"},
    {"full_name": "Hoàng Bảo Trâm", "email": "reader5@lms-seed.test", "dob": date(2000, 6, 30), "phone": "0900000005"},
]

SEED_PASSWORD = "TestPass123!"


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
    settings = get_settings()
    secret_key = settings.supabase_secret_key
    if not secret_key:
        raise RuntimeError("SUPABASE_SECRET_KEY not set in .env")

    async with SessionLocal() as session:
        already_seeded = (
            await session.execute(select(Loan.id).where(Loan.code.like(f"{DEMO_MARKER}%")).limit(1))
        ).first()
        if already_seeded:
            print("Demo activity already seeded — nothing to do.")
            await engine.dispose()
            return

        librarian = (
            await session.execute(select(Profile).where(Profile.role == "librarian"))
        ).scalars().first()
        if librarian is None:
            raise RuntimeError("No librarian profile found — run seed_dev_data.py first.")

        async with httpx.AsyncClient(
            base_url=settings.supabase_url,
            headers={"apikey": secret_key, "Authorization": f"Bearer {secret_key}"},
            timeout=30,
        ) as client:
            reader_ids: list[uuid.UUID] = []
            for r in READERS:
                existing = (
                    await session.execute(select(Profile).where(Profile.email == r["email"]))
                ).scalar_one_or_none()
                if existing:
                    reader_ids.append(existing.id)
                    continue
                auth_id = uuid.UUID(await create_auth_user(client, r["email"]))
                session.add(
                    Profile(
                        id=auth_id,
                        role="reader",
                        code=f"DG{uuid.uuid4().hex[:5].upper()}",
                        full_name=r["full_name"],
                        date_of_birth=r["dob"],
                        phone=r["phone"],
                        email=r["email"],
                    )
                )
                reader_ids.append(auth_id)
                print(f"reader created: {r['full_name']}")
            await session.commit()

        for reader_id in reader_ids:
            card = (
                await session.execute(select(LibraryCard).where(LibraryCard.reader_id == reader_id))
            ).scalar_one_or_none()
            if card is None:
                session.add(
                    LibraryCard(
                        id=uuid.uuid4(),
                        code=f"TV{uuid.uuid4().hex[:6].upper()}",
                        reader_id=reader_id,
                        issued_by=librarian.id,
                        status="active",
                    )
                )
        await session.commit()

        books = (await session.execute(select(Book))).scalars().all()
        if not books:
            raise RuntimeError("No books found — run seed_dev_data.py first.")

        today = date.today()
        rng = random.Random(42)
        loans_created = 0

        # ~18 loan lines spread across the last 13 days: most already returned
        # (a few days after borrowing), a handful still out, one overdue.
        for day_offset in range(13, -1, -1):
            loan_date = today - timedelta(days=day_offset)
            lines_today = rng.choice([0, 1, 1, 2]) if day_offset > 0 else 1
            for _ in range(lines_today):
                book = rng.choice(books)
                if book.quantity <= 0:
                    continue
                reader_id = rng.choice(reader_ids)

                loans_created += 1
                loan = Loan(
                    id=uuid.uuid4(),
                    code=f"{DEMO_MARKER}{loans_created:04d}",
                    reader_id=reader_id,
                    librarian_id=librarian.id,
                    loan_date=loan_date,
                    due_date=loan_date + timedelta(days=14),
                )
                session.add(loan)
                await session.flush()

                book.quantity -= 1

                # Decide the line's fate: returned a few days later, still out, or
                # (for older loans only) overdue — never invent a return date in the future.
                days_out = (today - loan_date).days
                outcome = rng.random()
                if days_out >= 3 and outcome < 0.6:
                    return_offset = rng.randint(1, min(days_out, 6))
                    actual_return_date = loan_date + timedelta(days=return_offset)
                    status = "returned"
                    book.quantity += 1  # copy is back on the shelf
                else:
                    actual_return_date = None
                    status = "borrowing"

                session.add(
                    LoanDetail(
                        loan_id=loan.id,
                        book_id=book.id,
                        quantity=1,
                        actual_return_date=actual_return_date,
                        status=status,
                    )
                )

        await session.commit()
        await engine.dispose()
        print(f"\nDone. Seeded {len(reader_ids)} extra readers and {loans_created} demo loan lines.")


if __name__ == "__main__":
    asyncio.run(main())
