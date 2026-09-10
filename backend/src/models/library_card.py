import uuid
from datetime import date

from sqlalchemy import Date, Enum, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from src.core.db import Base

CardStatusEnum = Enum("active", "locked", name="card_status", validate_strings=True)


class LibraryCard(Base):
    """Thẻ thư viện — at most one per Reader (reader_id is UNIQUE), issued in person."""

    __tablename__ = "library_cards"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String(20), nullable=False, unique=True)
    reader_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profiles.id"), nullable=False, unique=True
    )
    issued_at: Mapped[date] = mapped_column(Date, nullable=False, server_default="now()")
    issued_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("profiles.id"), nullable=False)
    status: Mapped[str] = mapped_column(CardStatusEnum, nullable=False, default="active")
