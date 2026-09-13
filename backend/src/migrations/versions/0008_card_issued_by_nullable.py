"""library_cards.issued_by nullable — cards auto-issued at self-registration have no librarian

Revision ID: 0008_issued_by_nullable
Revises: 0007_book_categories
Create Date: 2026-09-14

"""
from typing import Sequence, Union

from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0008_issued_by_nullable"
down_revision: Union[str, None] = "0007_book_categories"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("library_cards", "issued_by", existing_type=postgresql.UUID(as_uuid=True), nullable=True)


def downgrade() -> None:
    op.alter_column("library_cards", "issued_by", existing_type=postgresql.UUID(as_uuid=True), nullable=False)
