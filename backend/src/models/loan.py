import uuid
from datetime import date

from sqlalchemy import Boolean, CheckConstraint, Date, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from src.core.db import Base


class Loan(Base):
    """Phiếu mượn — one per borrowing transaction; may cover several books (see LoanDetail)."""

    __tablename__ = "loans"
    __table_args__ = (CheckConstraint("due_date >= loan_date", name="ck_loans_due_after_loan"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String(20), nullable=False, unique=True)
    reader_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("profiles.id"), nullable=False)
    librarian_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("profiles.id"), nullable=False)
    loan_date: Mapped[date] = mapped_column(Date, nullable=False, server_default="now()")
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    renewed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
