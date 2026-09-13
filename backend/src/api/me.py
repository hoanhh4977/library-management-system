import uuid
from datetime import date

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.db import get_session
from src.core.deps import get_current_profile
from src.models.library_card import LibraryCard
from src.models.profile import Profile

router = APIRouter(tags=["me"])


class CardSummary(BaseModel):
    status: str
    code: str
    issued_at: date


class MeResponse(BaseModel):
    id: uuid.UUID
    role: str
    code: str
    full_name: str
    email: str
    phone: str | None
    date_of_birth: date
    library_card: CardSummary | None


@router.get("/api/me", response_model=MeResponse)
async def read_me(
    profile: Profile = Depends(get_current_profile),
    session: AsyncSession = Depends(get_session),
) -> MeResponse:
    card = None
    if profile.role == "reader":
        result = await session.execute(select(LibraryCard).where(LibraryCard.reader_id == profile.id))
        row = result.scalar_one_or_none()
        if row is not None:
            card = CardSummary(status=row.status, code=row.code, issued_at=row.issued_at)

    return MeResponse(
        id=profile.id,
        role=profile.role,
        code=profile.code,
        full_name=profile.full_name,
        email=profile.email,
        phone=profile.phone,
        date_of_birth=profile.date_of_birth,
        library_card=card,
    )
