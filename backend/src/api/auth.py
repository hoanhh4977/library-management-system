import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.db import get_session
from src.core.deps import get_auth_claims
from src.models.profile import Profile
from src.schemas.profile import CompleteRegistrationRequest, ReaderOut

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/complete-registration", response_model=ReaderOut)
async def complete_registration(
    payload: CompleteRegistrationRequest,
    claims: dict = Depends(get_auth_claims),
    session: AsyncSession = Depends(get_session),
) -> ReaderOut:
    """Create the `profiles` row for a Reader right after Supabase signUp + OTP
    verification succeeds (FR-004/FR-005). auth_user_id/email come from the
    verified JWT (`claims`), never from the request body."""
    auth_user_id = uuid.UUID(claims["sub"])
    email = claims.get("email")
    if not email:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Token không có thông tin Email")
    if not claims.get("email_confirmed_at") and not claims.get("email_verified"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Email chưa được xác thực")

    existing = await session.get(Profile, auth_user_id)
    if existing is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Tài khoản đã hoàn tất đăng ký")

    email_taken = (await session.execute(select(Profile).where(Profile.email == email))).scalar_one_or_none()
    if email_taken is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Email đã được dùng để đăng ký tài khoản khác")

    profile = Profile(
        id=auth_user_id,
        role="reader",
        code=f"DG{uuid.uuid4().hex[:6].upper()}",
        full_name=payload.full_name,
        date_of_birth=payload.date_of_birth,
        phone=payload.phone,
        email=email,
        email_verified_at=datetime.now(timezone.utc),
    )
    session.add(profile)
    await session.commit()

    return ReaderOut(
        id=profile.id,
        code=profile.code,
        full_name=profile.full_name,
        date_of_birth=profile.date_of_birth,
        phone=profile.phone,
        email=profile.email,
        library_card=None,
    )
