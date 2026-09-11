import secrets
import uuid
from datetime import date

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import get_settings
from src.models.profile import Profile


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
