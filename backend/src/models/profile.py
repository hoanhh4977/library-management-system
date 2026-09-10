import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, Enum, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from src.core.db import Base

RoleEnum = Enum("reader", "librarian", "admin", name="profile_role", validate_strings=True)


class Profile(Base):
    """Độc giả / Nhân viên thủ thư / Quản trị viên — one shared identity table.

    id == Supabase auth.users.id. `code` is unique per role (not globally),
    `email` is unique system-wide and doubles as the login identifier (FR-004).
    """

    __tablename__ = "profiles"
    __table_args__ = (UniqueConstraint("role", "code", name="uq_profiles_role_code"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    role: Mapped[str] = mapped_column(RoleEnum, nullable=False)
    code: Mapped[str] = mapped_column(String(20), nullable=False)
    full_name: Mapped[str] = mapped_column(String(100), nullable=False)
    date_of_birth: Mapped[date] = mapped_column(Date, nullable=False)
    phone: Mapped[str | None] = mapped_column(String(15), nullable=True)
    email: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    email_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default="now()")
