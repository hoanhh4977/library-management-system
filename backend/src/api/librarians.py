import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.db import get_session
from src.core.deps import require_role
from src.models.profile import Profile
from src.schemas.profile import LibrarianOut, LibrarianUpdate

router = APIRouter(prefix="/api/librarians", tags=["librarians"])


@router.get("", response_model=list[LibrarianOut])
async def list_librarians(
    _: Profile = Depends(require_role("admin")),
    session: AsyncSession = Depends(get_session),
) -> list[Profile]:
    stmt = select(Profile).where(Profile.role == "librarian").order_by(Profile.full_name)
    return (await session.execute(stmt)).scalars().all()


@router.patch("/{librarian_id}", response_model=LibrarianOut)
async def update_librarian(
    librarian_id: uuid.UUID,
    payload: LibrarianUpdate,
    _: Profile = Depends(require_role("admin")),
    session: AsyncSession = Depends(get_session),
) -> Profile:
    librarian = await session.get(Profile, librarian_id)
    if librarian is None or librarian.role != "librarian":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy Nhân viên thủ thư")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(librarian, field, value)
    await session.commit()
    return librarian
