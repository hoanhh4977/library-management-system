import uuid
from datetime import date, datetime

from sqlalchemy import CheckConstraint, Date, DateTime, Enum, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from src.core.db import Base

LoanDetailStatusEnum = Enum(
    "borrowing", "returned", "pending_compensation", "compensated", name="loan_detail_status", validate_strings=True
)


class LoanDetail(Base):
    """Chi tiết phiếu mượn — composite PK (loan_id, book_id); each book line has its own status
    so a reader can return books from the same Loan at different times (FR-016)."""

    __tablename__ = "loan_details"
    __table_args__ = (CheckConstraint("quantity > 0", name="ck_loan_details_quantity_positive"),)

    loan_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("loans.id"), primary_key=True)
    book_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("books.id"), primary_key=True)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    actual_return_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(LoanDetailStatusEnum, nullable=False, default="borrowing")
    compensation_confirmed_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profiles.id"), nullable=True
    )
    compensation_confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
