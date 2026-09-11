"""add loan_requests.extension_days

Revision ID: 0005_extension_days
Revises: 0004_book_created_at
Create Date: 2026-09-11

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0005_extension_days"
down_revision: Union[str, None] = "0004_book_created_at"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "loan_requests",
        sa.Column("extension_days", sa.Integer(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("loan_requests", "extension_days")
