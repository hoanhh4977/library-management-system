import uuid
from datetime import date, datetime

from pydantic import BaseModel


class BookInventory(BaseModel):
    book_id: uuid.UUID
    code: str
    title: str
    author: str
    categories: list[str]
    cover_image_url: str | None = None
    total: int
    borrowing: int
    remaining: int
    created_at: datetime


class InventoryReport(BaseModel):
    books: list[BookInventory]
    total_titles: int
    total_copies: int
    total_borrowing: int


class DailyActivity(BaseModel):
    activity_date: date
    borrowed: int
    returned: int


class ActivityTrend(BaseModel):
    days: list[DailyActivity]


class OverdueItem(BaseModel):
    loan_id: uuid.UUID
    loan_code: str
    book_id: uuid.UUID
    book_title: str
    book_cover_image_url: str | None = None
    reader_id: uuid.UUID
    reader_name: str
    reader_code: str
    due_date: date
    days_overdue: int
    quantity: int


class OverdueReport(BaseModel):
    items: list[OverdueItem]


class ActivityItem(BaseModel):
    loan_id: uuid.UUID
    loan_code: str
    book_id: uuid.UUID
    book_title: str
    book_cover_image_url: str | None = None
    reader_id: uuid.UUID
    reader_name: str
    reader_code: str
    quantity: int
    loan_date: date
    due_date: date
    actual_return_date: date | None
    status: str
    renewed: bool
    is_overdue: bool


class ActivityLog(BaseModel):
    items: list[ActivityItem]
