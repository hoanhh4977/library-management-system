import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.db import get_session
from src.core.deps import require_role
from src.models.profile import Profile
from src.schemas.profile import (
    LibrarianCreate,
    LibrarianCreateResponse,
    LibrarianOut,
    LibrarianUpdate,
)
from src.services.staff_service import StaffServiceError, create_librarian, delete_librarian

router = APIRouter(prefix="/api/librarians", tags=["librarians"])


@router.get("", response_model=list[LibrarianOut])
async def list_librarians(
    _: Profile = Depends(require_role("admin")),
    session: AsyncSession = Depends(get_session),
) -> list[Profile]:
    stmt = select(Profile).where(Profile.role == "librarian").order_by(Profile.full_name)
    return (await session.execute(stmt)).scalars().all()


@router.post("", response_model=LibrarianCreateResponse)
async def create_librarian_endpoint(
    payload: LibrarianCreate,
    _: Profile = Depends(require_role("admin")),
    session: AsyncSession = Depends(get_session),
) -> LibrarianCreateResponse:
    try:
        librarian, temporary_password = await create_librarian(
            session, full_name=payload.full_name, email=payload.email, date_of_birth=payload.date_of_birth
        )
    except StaffServiceError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc
    librarian_out = LibrarianOut(
        id=librarian.id,
        code=librarian.code,
        full_name=librarian.full_name,
        date_of_birth=librarian.date_of_birth,
        email=librarian.email,
    )
    return LibrarianCreateResponse(librarian=librarian_out, temporary_password=temporary_password)


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


@router.delete("/{librarian_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_librarian_endpoint(
    librarian_id: uuid.UUID,
    _: Profile = Depends(require_role("admin")),
    session: AsyncSession = Depends(get_session),
) -> None:
    try:
        await delete_librarian(session, librarian_id=librarian_id)
    except LookupError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    except StaffServiceError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc
