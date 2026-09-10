import uuid
from datetime import datetime

from pydantic import BaseModel

from src.schemas.loan import LoanItemResult, LoanOut


class BorrowRequestItem(BaseModel):
    book_id: uuid.UUID
    quantity: int


class CreateBorrowRequest(BaseModel):
    items: list[BorrowRequestItem]


class CreateRenewRequest(BaseModel):
    loan_id: uuid.UUID


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
