import uuid
from datetime import date, datetime

from pydantic import BaseModel


class EmailExistsResponse(BaseModel):
    exists: bool


class CompleteRegistrationRequest(BaseModel):
    """auth_user_id/email are NOT here on purpose — they come from the verified Supabase
    JWT (see api/auth.py), never from client-supplied fields, to prevent spoofing."""

    full_name: str
    date_of_birth: date
    phone: str


class CardOut(BaseModel):
    id: uuid.UUID
    code: str
    status: str
    issued_at: date


class ReaderOut(BaseModel):
    id: uuid.UUID
    code: str
    full_name: str
    date_of_birth: date
    phone: str | None
    email: str
    library_card: CardOut | None
    created_at: datetime


class ReaderUpdate(BaseModel):
    full_name: str | None = None
    date_of_birth: date | None = None
    phone: str | None = None


class LibrarianOut(BaseModel):
    id: uuid.UUID
    code: str
    full_name: str
    date_of_birth: date
    email: str


class LibrarianUpdate(BaseModel):
    full_name: str | None = None
    date_of_birth: date | None = None


class LibrarianCreate(BaseModel):
    full_name: str
    email: str
    date_of_birth: date


class LibrarianCreateResponse(BaseModel):
    librarian: LibrarianOut
    temporary_password: str
