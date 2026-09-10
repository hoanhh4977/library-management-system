"""add books.cover_image_url

Revision ID: 0003_book_cover_image
Revises: 0002_loan_requests
Create Date: 2026-09-11

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0003_book_cover_image"
down_revision: Union[str, None] = "0002_loan_requests"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("books", sa.Column("cover_image_url", sa.String(500), nullable=True))


def downgrade() -> None:
    op.drop_column("books", "cover_image_url")
