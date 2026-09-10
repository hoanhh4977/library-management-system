import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from src.core.db import Base

UnlockRequestStatusEnum = Enum(
    "pending", "approved", "rejected", name="unlock_request_status", validate_strings=True
)


class CardUnlockRequest(Base):
    """Yêu cầu mở khóa thẻ — Librarian requests, only Admin can approve/reject (FR-010/FR-011).
    `reviewed_by`/`reviewed_at` are the audit trail required by FR-011."""

    __tablename__ = "card_unlock_requests"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    card_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("library_cards.id"), nullable=False)
    requested_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("profiles.id"), nullable=False)
    requested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default="now()")
    status: Mapped[str] = mapped_column(UnlockRequestStatusEnum, nullable=False, default="pending")
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profiles.id"), nullable=True
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
