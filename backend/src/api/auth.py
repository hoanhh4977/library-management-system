import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.db import get_session
from src.core.deps import get_auth_claims
from src.models.profile import Profile
from src.schemas.profile import CardOut, CompleteRegistrationRequest, EmailExistsResponse, ReaderOut
from src.services.card_service import auto_issue_card

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.get("/email-exists", response_model=EmailExistsResponse)
async def email_exists(email: str, session: AsyncSession = Depends(get_session)) -> EmailExistsResponse:
    """Public, unauthenticated lookup used by ForgotPasswordPage to show "email chưa
    đăng ký" instead of Supabase's deliberately-ambiguous reset response. Explicit
    trade-off the project owner asked for: this endpoint is a user-enumeration oracle
    by design (anyone can probe which emails have accounts) — accepted in exchange for
    clearer forgot-password UX."""
    existing = (await session.execute(select(Profile).where(Profile.email == email))).scalar_one_or_none()
    return EmailExistsResponse(exists=existing is not None)


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
    # Supabase's JWT never carries `email_confirmed_at`/a top-level `email_verified`
    # claim — that flag only ever shows up nested at `user_metadata.email_verified`
    # (confirmed by decoding a real token). The two top-level `.get()`s above always
    # evaluated to None, so this check was unconditionally rejecting every real
    # signup regardless of confirmation status — just never caught before because
    # every account used for testing so far was created directly via the Admin API
    # (seed script / add-librarian), which never calls this endpoint at all.
    if not claims.get("user_metadata", {}).get("email_verified"):
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

    # FR-007/FR-008 used to require a Librarian to verify identity in person before
    # issuing a card; self-registration now replaces that step, so the card is issued
    # immediately — see auto_issue_card's docstring for how it differs from issue_card.
    card = await auto_issue_card(session, reader_id=profile.id)

    return ReaderOut(
        id=profile.id,
        code=profile.code,
        full_name=profile.full_name,
        date_of_birth=profile.date_of_birth,
        phone=profile.phone,
        email=profile.email,
        library_card=CardOut(id=card.id, code=card.code, status=card.status, issued_at=card.issued_at),
        created_at=profile.created_at,
    )
