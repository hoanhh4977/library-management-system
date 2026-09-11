import uuid
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.db import get_session
from src.core.deps import require_role
from src.models.card_unlock_request import CardUnlockRequest
from src.models.library_card import LibraryCard
from src.models.profile import Profile
from src.schemas.card import UnlockRequestOut
from src.services.card_service import CardServiceError, request_unlock, review_unlock

router = APIRouter(prefix="/api/cards", tags=["cards"])


@router.get("/unlock-requests", response_model=list[UnlockRequestOut])
async def list_unlock_requests(
    status_filter: Literal["pending", "approved", "rejected", ""] | None = "pending",
    _: Profile = Depends(require_role("admin")),
    session: AsyncSession = Depends(get_session),
) -> list[UnlockRequestOut]:
    reader_profile = Profile.__table__.alias("reader_profile")
    requester_profile = Profile.__table__.alias("requester_profile")

    stmt = (
        select(
            CardUnlockRequest,
            LibraryCard.code.label("card_code"),
            LibraryCard.reader_id,
            reader_profile.c.full_name.label("reader_name"),
            requester_profile.c.full_name.label("requested_by_name"),
        )
        .join(LibraryCard, LibraryCard.id == CardUnlockRequest.card_id)
        .join(reader_profile, reader_profile.c.id == LibraryCard.reader_id)
        .join(requester_profile, requester_profile.c.id == CardUnlockRequest.requested_by)
        .order_by(CardUnlockRequest.requested_at.desc())
    )
    if status_filter:
        stmt = stmt.where(CardUnlockRequest.status == status_filter)

    rows = (await session.execute(stmt)).all()
    return [
        UnlockRequestOut(
            id=req.id,
            card_id=req.card_id,
            card_code=card_code,
            reader_id=reader_id,
            reader_name=reader_name,
            requested_by=req.requested_by,
            requested_by_name=requested_by_name,
            requested_at=req.requested_at,
            status=req.status,
            reviewed_at=req.reviewed_at,
        )
        for req, card_code, reader_id, reader_name, requested_by_name in rows
    ]


@router.post("/{card_id}/unlock-requests")
async def create_unlock_request(
    card_id: uuid.UUID,
    librarian: Profile = Depends(require_role("librarian")),
    session: AsyncSession = Depends(get_session),
):
    try:
        req = await request_unlock(session, card_id=card_id, requested_by=librarian.id)
    except LookupError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    except CardServiceError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc
    return {"id": req.id, "status": req.status}


@router.post("/{card_id}/unlock-requests/{request_id}/approve")
async def approve_unlock_request(
    card_id: uuid.UUID,
    request_id: uuid.UUID,
    admin: Profile = Depends(require_role("admin")),
    session: AsyncSession = Depends(get_session),
):
    try:
        req = await review_unlock(session, request_id=request_id, decision="approved", reviewed_by=admin.id)
    except LookupError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    except CardServiceError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc
    return {"id": req.id, "status": req.status, "reviewed_by": req.reviewed_by, "reviewed_at": req.reviewed_at}


@router.post("/{card_id}/unlock-requests/{request_id}/reject")
async def reject_unlock_request(
    card_id: uuid.UUID,
    request_id: uuid.UUID,
    admin: Profile = Depends(require_role("admin")),
    session: AsyncSession = Depends(get_session),
):
    try:
        req = await review_unlock(session, request_id=request_id, decision="rejected", reviewed_by=admin.id)
    except LookupError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    except CardServiceError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc
    return {"id": req.id, "status": req.status, "reviewed_by": req.reviewed_by, "reviewed_at": req.reviewed_at}
