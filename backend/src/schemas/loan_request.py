import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel

from src.schemas.loan import LoanItemResult, LoanOut

RenewalDays = Literal[1, 3, 5, 7]
LoanPeriodDays = Literal[7, 14, 21, 30]


class BorrowRequestItem(BaseModel):
    book_id: uuid.UUID
    quantity: int


class CreateBorrowRequest(BaseModel):
    items: list[BorrowRequestItem]
    loan_period_days: LoanPeriodDays = 14


class CreateRenewRequest(BaseModel):
    loan_id: uuid.UUID
    extension_days: RenewalDays


class RequestItemOut(BaseModel):
    book_id: uuid.UUID
    book_title: str
    book_cover_image_url: str | None = None
    quantity: int


class LoanRequestOut(BaseModel):
    id: uuid.UUID
    kind: str
    status: str
    reader_id: uuid.UUID
    reader_name: str
    loan_id: uuid.UUID | None
    loan_code: str | None
    extension_days: int | None = None
    loan_period_days: int | None = None
    items: list[RequestItemOut]
    requested_at: datetime
    reviewed_by: uuid.UUID | None
    reviewed_at: datetime | None


class ApproveBorrowResponse(BaseModel):
    loan: LoanOut | None
    items: list[LoanItemResult]


class ApproveRenewResponse(BaseModel):
    due_date: str
    renewed: bool
