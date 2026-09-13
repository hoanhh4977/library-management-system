import uuid

from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from src.core.db import Base


class Category(Base):
    """Thể loại — its own table now instead of a free-text column on `books`, so the
    same "Lịch sử" or "Kỹ năng sống" category is one canonical row shared by every
    book that carries it, not a re-typed string per book."""

    __tablename__ = "categories"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)


class BookCategory(Base):
    """Many-to-many join — a book can carry more than one thể loại at once."""

    __tablename__ = "book_categories"

    book_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("books.id", ondelete="CASCADE"), primary_key=True
    )
    category_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("categories.id", ondelete="CASCADE"), primary_key=True
    )
