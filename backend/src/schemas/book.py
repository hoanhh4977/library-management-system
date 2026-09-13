import uuid

from pydantic import BaseModel, Field


class BookOut(BaseModel):
    id: uuid.UUID
    code: str
    title: str
    author: str
    publisher: str
    categories: list[str]
    quantity: int
    cover_image_url: str | None = None


class BookCreate(BaseModel):
    title: str
    author: str
    publisher: str
    categories: list[str] = Field(min_length=1)
    quantity: int = Field(ge=0)
    cover_image_url: str | None = None


class BookUpdate(BaseModel):
    title: str | None = None
    author: str | None = None
    publisher: str | None = None
    categories: list[str] | None = None
    quantity: int | None = Field(default=None, ge=0)
    cover_image_url: str | None = None
