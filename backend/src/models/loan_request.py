import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from src.core.db import Base

LoanRequestKindEnum = Enum("borrow", "renew", name="loan_request_kind", validate_strings=True)
LoanRequestStatusEnum = Enum("pending", "approved", "rejected", name="loan_request_status", validate_strings=True)


class LoanRequest(Base):
    """Yêu cầu mượn/gia hạn do Độc giả tự gửi qua app; Thủ thư duyệt (approve chạy đúng
    logic nghiệp vụ có sẵn ở loan_service — create_loan/renew_loan — nên mọi ràng buộc
    FR-012..FR-018 vẫn được áp dụng, chỉ khác người khởi tạo là Độc giả, người thực thi là
    Thủ thư phê duyệt).

    kind='borrow': items nằm ở LoanRequestItem. kind='renew': `loan_id` trỏ tới Phiếu mượn
    cần gia hạn, `loan_id` cho borrow luôn NULL và ngược lại.
    """

    __tablename__ = "loan_requests"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    reader_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("profiles.id"), nullable=False)
    kind: Mapped[str] = mapped_column(LoanRequestKindEnum, nullable=False)
    loan_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("loans.id"), nullable=True)
    status: Mapped[str] = mapped_column(LoanRequestStatusEnum, nullable=False, default="pending")
    requested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default="now()")
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profiles.id"), nullable=True
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class LoanRequestItem(Base):
    """One requested book line for a kind='borrow' LoanRequest."""

    __tablename__ = "loan_request_items"

    request_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("loan_requests.id"), primary_key=True
    )
    book_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("books.id"), primary_key=True)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
