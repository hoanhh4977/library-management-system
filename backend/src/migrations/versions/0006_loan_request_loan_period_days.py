"""add loan_requests.loan_period_days

Revision ID: 0006_loan_period_days
Revises: 0005_extension_days
Create Date: 2026-09-11

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0006_loan_period_days"
down_revision: Union[str, None] = "0005_extension_days"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "loan_requests",
        sa.Column("loan_period_days", sa.Integer(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("loan_requests", "loan_period_days")
