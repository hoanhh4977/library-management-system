import uuid

from pydantic import BaseModel


class BookInventory(BaseModel):
    book_id: uuid.UUID
    code: str
    title: str
    author: str
    category: str
    cover_image_url: str | None = None
    total: int
    borrowing: int
    remaining: int


class InventoryReport(BaseModel):
    books: list[BookInventory]
    total_titles: int
    total_copies: int
    total_borrowing: int
