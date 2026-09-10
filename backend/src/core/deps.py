from collections.abc import AsyncGenerator, Callable
from uuid import UUID

from fastapi import Depends, HTTPException, Header, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.db import get_session
from src.core.security import decode_supabase_jwt
from src.models.profile import Profile


async def get_bearer_token(authorization: str | None = Header(default=None)) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Thiếu token đăng nhập")
    return authorization.split(" ", 1)[1]


async def get_auth_claims(token: str = Depends(get_bearer_token)) -> dict:
    """Verified Supabase JWT claims, with NO requirement that a `profiles` row exists yet.

    Only for the narrow window between Supabase signUp+OTP-verify and our own
    POST /api/auth/complete-registration — every other endpoint must use
    get_current_profile instead, which enforces that the profile actually exists.
    """
    return decode_supabase_jwt(token)


async def get_current_profile(
    request: Request,
    token: str = Depends(get_bearer_token),
    session: AsyncSession = Depends(get_session),
) -> Profile:
    payload = decode_supabase_jwt(token)
    auth_user_id = payload.get("sub")
    if not auth_user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token không hợp lệ")

    profile = await session.get(Profile, UUID(auth_user_id))
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Tài khoản chưa hoàn tất đăng ký hồ sơ",
        )
    request.state.role = profile.role  # picked up by RequestLoggingMiddleware
    return profile


def require_role(*roles: str) -> Callable[[Profile], AsyncGenerator[Profile, None]]:
    async def _check(profile: Profile = Depends(get_current_profile)) -> Profile:
        if profile.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Bạn không có quyền thực hiện hành động này",
            )
        return profile

    return _check


__all__ = ["get_auth_claims", "get_current_profile", "require_role"]
