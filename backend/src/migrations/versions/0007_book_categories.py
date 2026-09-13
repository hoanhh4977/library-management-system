"""extract books.category into categories + book_categories (many-to-many)

Revision ID: 0007_book_categories
Revises: 0006_loan_period_days
Create Date: 2026-09-13

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0007_book_categories"
down_revision: Union[str, None] = "0006_loan_period_days"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "categories",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(length=50), nullable=False, unique=True),
    )
    op.create_table(
        "book_categories",
        sa.Column(
            "book_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("books.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "category_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("categories.id", ondelete="CASCADE"),
            primary_key=True,
        ),
    )

    # Backfill: one Category row per distinct existing string value, then link every
    # book to its (single, at this point) category — the many-to-many shape is new
    # going forward, but no existing book actually has more than one yet.
    op.execute(
        """
        INSERT INTO categories (id, name)
        SELECT gen_random_uuid(), category
        FROM (SELECT DISTINCT category FROM books) AS distinct_categories
        """
    )
    op.execute(
        """
        INSERT INTO book_categories (book_id, category_id)
        SELECT b.id, c.id
        FROM books b
        JOIN categories c ON c.name = b.category
        """
    )

    op.drop_column("books", "category")


def downgrade() -> None:
    op.add_column("books", sa.Column("category", sa.String(length=50), nullable=True))
    op.execute(
        """
        UPDATE books b
        SET category = (
            SELECT c.name
            FROM book_categories bc
            JOIN categories c ON c.id = bc.category_id
            WHERE bc.book_id = b.id
            ORDER BY c.name
            LIMIT 1
        )
        """
    )
    op.alter_column("books", "category", nullable=False)
    op.drop_table("book_categories")
    op.drop_table("categories")
