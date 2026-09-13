import uuid

import httpx

from src.core.config import get_settings


async def delete_auth_user(user_id: uuid.UUID) -> None:
    """Removes the Supabase Auth user backing a deleted `profiles` row — mirrors
    the Admin API call staff_service.create_librarian already makes to create one.
    Called only after the `profiles` row itself is deleted, so a failure here just
    leaves an orphaned, profile-less auth user (same class of edge case creation
    already accepts) rather than ever leaving a `profiles` row without its auth user.
    """
    settings = get_settings()
    async with httpx.AsyncClient(
        base_url=settings.supabase_url,
        headers={"apikey": settings.supabase_secret_key, "Authorization": f"Bearer {settings.supabase_secret_key}"},
        timeout=30,
    ) as client:
        resp = await client.delete(f"/auth/v1/admin/users/{user_id}")
        if resp.status_code not in (200, 204, 404):
            resp.raise_for_status()
