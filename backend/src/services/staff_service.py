import secrets
import uuid
from datetime import date

import httpx
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import get_settings
from src.models.profile import Profile
from src.services.supabase_admin import delete_auth_user


class StaffServiceError(Exception):
    """Raised for any 409-worthy staff-provisioning conflict (e.g. email already used)."""


async def create_librarian(
    session: AsyncSession, *, full_name: str, email: str, date_of_birth: date
) -> tuple[Profile, str]:
    """Admin-provisioned Nhân viên thủ thư account — mirrors the same Supabase Admin
    API call scripts/seed_dev_data.py already uses to create seed accounts, just at
    request-time instead of offline. Returns a one-time temporary password the admin
    hands to the new hire; they're expected to change it via "Quên mật khẩu" on first
    login (no invite-email flow yet, so this is the simplest path that reuses existing,
    already-working auth screens).
    """
    existing = (await session.execute(select(Profile).where(Profile.email == email))).scalar_one_or_none()
    if existing is not None:
        raise StaffServiceError("Email này đã được sử dụng")

    settings = get_settings()
    temporary_password = secrets.token_urlsafe(12)

    async with httpx.AsyncClient(
        base_url=settings.supabase_url,
        headers={"apikey": settings.supabase_secret_key, "Authorization": f"Bearer {settings.supabase_secret_key}"},
        timeout=30,
    ) as client:
        resp = await client.post(
            "/auth/v1/admin/users",
            json={"email": email, "password": temporary_password, "email_confirm": True},
        )
        if resp.status_code == 422 or "already been registered" in resp.text:
            raise StaffServiceError("Email này đã được sử dụng")
        resp.raise_for_status()
        auth_user_id = uuid.UUID(resp.json()["id"])

    librarian = Profile(
        id=auth_user_id,
        role="librarian",
        code=f"NV{uuid.uuid4().hex[:5].upper()}",
        full_name=full_name,
        date_of_birth=date_of_birth,
        email=email,
    )
    session.add(librarian)
    await session.commit()
    return librarian, temporary_password


async def delete_librarian(session: AsyncSession, *, librarian_id: uuid.UUID) -> None:
    """Admin removes a Nhân viên thủ thư account entirely (profile + Supabase Auth
    user). No locked-card concept applies to staff (that's a reader-only notion), so
    the only real guard is the database's own foreign keys: a librarian who has ever
    processed a loan/unlock-request/compensation still has rows pointing at them, and
    Postgres rejects the delete outright — surfaced here as a clear 409 rather than a
    raw IntegrityError, instead of silently cascading away real transaction history.
    """
    librarian = await session.get(Profile, librarian_id)
    if librarian is None or librarian.role != "librarian":
        raise LookupError("Không tìm thấy Nhân viên thủ thư")

    try:
        await session.delete(librarian)
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise StaffServiceError(
            "Không thể xoá — nhân viên này đã có lịch sử giao dịch trong hệ thống"
        ) from exc

    await delete_auth_user(librarian_id)
