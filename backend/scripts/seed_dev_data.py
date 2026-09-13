"""One-off dev-data seeding script for a fresh/blank Supabase project.

Creates 3 Supabase Auth users (admin/librarian/reader, pre-confirmed via the
Admin API — no OTP needed), their `profiles` rows, a handful of books, and a
library card + one active loan for the reader, so the app has something to
show on first run.

Run once, from backend/: `conda run -n library-management python scripts/seed_dev_data.py`
Safe to re-run: skips anything already present (matched by email/code).
"""

import asyncio
import sys
import uuid
from datetime import date, timedelta
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.core.config import get_settings
from src.core.db import SessionLocal, engine
from src.models.book import Book
from src.models.category import BookCategory, Category
from src.models.library_card import LibraryCard
from src.models.loan import Loan
from src.models.loan_detail import LoanDetail
from src.models.profile import Profile
from sqlalchemy import select

SEED_PASSWORD = "TestPass123!"

USERS = [
    {"role": "admin", "email": "admin@lms-seed.test", "full_name": "Lê Thu Hà", "dob": date(1985, 3, 12)},
    {"role": "librarian", "email": "librarian@lms-seed.test", "full_name": "Trần Văn Bình", "dob": date(1992, 7, 20)},
    {"role": "reader", "email": "reader@lms-seed.test", "full_name": "Nguyễn Thị Minh Anh", "dob": date(1999, 1, 5)},
]

BOOKS = [
    dict(title="Sapiens: Lược Sử Loài Người", author="Yuval Noah Harari", publisher="NXB Thế Giới", category="Lịch sử", quantity=5),
    dict(title="Đắc Nhân Tâm", author="Dale Carnegie", publisher="NXB Tổng hợp TP.HCM", category="Kỹ năng sống", quantity=3),
    dict(title="Nhà Giả Kim", author="Paulo Coelho", publisher="NXB Hội Nhà Văn", category="Văn học", quantity=4),
    dict(title="Tuổi Trẻ Đáng Giá Bao Nhiêu", author="Rosie Nguyễn", publisher="NXB Hội Nhà Văn", category="Kỹ năng sống", quantity=2),
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
    settings = get_settings()
    secret_key = settings.supabase_secret_key
    if not secret_key:
        raise RuntimeError("SUPABASE_SECRET_KEY not set in .env")

    async with httpx.AsyncClient(
        base_url=settings.supabase_url,
        headers={"apikey": secret_key, "Authorization": f"Bearer {secret_key}"},
        timeout=30,
    ) as client:
        auth_ids: dict[str, str] = {}
        for u in USERS:
            auth_ids[u["role"]] = await create_auth_user(client, u["email"])
            print(f"auth user ready: {u['role']} -> {u['email']}")

    async with SessionLocal() as session:
        profile_ids: dict[str, uuid.UUID] = {}
        for u in USERS:
            existing = (await session.execute(select(Profile).where(Profile.email == u["email"]))).scalar_one_or_none()
            if existing:
                profile_ids[u["role"]] = existing.id
                continue
            pid = uuid.UUID(auth_ids[u["role"]])
            code_prefix = {"admin": "QT", "librarian": "NV", "reader": "DG"}[u["role"]]
            session.add(
                Profile(
                    id=pid,
                    role=u["role"],
                    code=f"{code_prefix}{uuid.uuid4().hex[:5].upper()}",
                    full_name=u["full_name"],
                    date_of_birth=u["dob"],
                    phone="0900000000" if u["role"] == "reader" else None,
                    email=u["email"],
                )
            )
            profile_ids[u["role"]] = pid
            print(f"profile created: {u['role']}")
        await session.commit()

        seeded_books: list[Book] = []
        for b in BOOKS:
            existing = (await session.execute(select(Book).where(Book.title == b["title"]))).scalar_one_or_none()
            if existing:
                seeded_books.append(existing)
                continue
            category_name = b["category"]
            book_fields = {k: v for k, v in b.items() if k != "category"}
            book = Book(id=uuid.uuid4(), code=f"S{uuid.uuid4().hex[:6].upper()}", **book_fields)
            session.add(book)
            await session.flush()
            category = (
                await session.execute(select(Category).where(Category.name == category_name))
            ).scalar_one_or_none()
            if category is None:
                category = Category(id=uuid.uuid4(), name=category_name)
                session.add(category)
                await session.flush()
            session.add(BookCategory(book_id=book.id, category_id=category.id))
            seeded_books.append(book)
        await session.commit()
        print(f"books ready: {len(seeded_books)}")

        reader_id = profile_ids["reader"]
        librarian_id = profile_ids["librarian"]

        card = (await session.execute(select(LibraryCard).where(LibraryCard.reader_id == reader_id))).scalar_one_or_none()
        if card is None:
            card = LibraryCard(
                id=uuid.uuid4(), code=f"TV{uuid.uuid4().hex[:6].upper()}",
                reader_id=reader_id, issued_by=librarian_id, status="active",
            )
            session.add(card)
            await session.commit()
            print("library card issued for reader")
        else:
            print("library card already exists")

        existing_loan = (await session.execute(select(Loan).where(Loan.reader_id == reader_id))).scalar_one_or_none()
        if existing_loan is None and seeded_books:
            loan_book = seeded_books[0]
            loan = Loan(
                id=uuid.uuid4(), code=f"PM{uuid.uuid4().hex[:8].upper()}",
                reader_id=reader_id, librarian_id=librarian_id,
                loan_date=date.today(), due_date=date.today() + timedelta(days=14),
            )
            session.add(loan)
            await session.flush()
            loan_book.quantity -= 1
            session.add(LoanDetail(loan_id=loan.id, book_id=loan_book.id, quantity=1, status="borrowing"))
            await session.commit()
            print(f"sample loan created for '{loan_book.title}'")
        else:
            print("reader already has a loan on file — skipped sample loan")

    await engine.dispose()
    print("\nDone. Seed accounts (password for all: ", SEED_PASSWORD, "):")
    for u in USERS:
        print(f"  {u['role']:<10} {u['email']}")


if __name__ == "__main__":
    asyncio.run(main())
