import uuid
from datetime import date, datetime

from pydantic import BaseModel


class NewLoanItem(BaseModel):
    book_id: uuid.UUID
    quantity: int


class NewLoanRequest(BaseModel):
    reader_id: uuid.UUID
    items: list[NewLoanItem]


class LoanItemResult(BaseModel):
    book_id: uuid.UUID
    ok: bool
    detail: str | None = None


class LoanDetailOut(BaseModel):
    book_id: uuid.UUID
    book_title: str
    book_cover_image_url: str | None = None
    quantity: int
    actual_return_date: date | None
    status: str


class LoanOut(BaseModel):
    id: uuid.UUID
    code: str
    reader_id: uuid.UUID
    librarian_id: uuid.UUID
    loan_date: date
    due_date: date
    renewed: bool
    details: list[LoanDetailOut]


class NewLoanResponse(BaseModel):
    loan: LoanOut | None
    items: list[LoanItemResult]


class ReturnItemResponse(BaseModel):
    book_id: uuid.UUID
    status: str
    actual_return_date: date
    on_time: bool


class RenewResponse(BaseModel):
    due_date: date
    renewed: bool


class ReportLostResponse(BaseModel):
    book_id: uuid.UUID
    status: str


class ConfirmCompensationResponse(BaseModel):
    book_id: uuid.UUID
    status: str
    compensation_confirmed_by: uuid.UUID
    compensation_confirmed_at: datetime
