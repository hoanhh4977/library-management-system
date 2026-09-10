"""loan requests (reader self-service borrow/renew, librarian-approved)

Revision ID: 0002_loan_requests
Revises: 0001_initial
Create Date: 2026-09-11

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002_loan_requests"
down_revision: Union[str, None] = "0001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

loan_request_kind = postgresql.ENUM("borrow", "renew", name="loan_request_kind", create_type=False)
loan_request_status = postgresql.ENUM("pending", "approved", "rejected", name="loan_request_status", create_type=False)


def upgrade() -> None:
    loan_request_kind.create(op.get_bind(), checkfirst=True)
    loan_request_status.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "loan_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("reader_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("profiles.id"), nullable=False),
        sa.Column("kind", loan_request_kind, nullable=False),
        sa.Column("loan_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("loans.id"), nullable=True),
        sa.Column("status", loan_request_status, nullable=False, server_default="pending"),
        sa.Column("requested_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("reviewed_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("profiles.id"), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        "loan_request_items",
        sa.Column("request_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("loan_requests.id"), primary_key=True),
        sa.Column("book_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("books.id"), primary_key=True),
        sa.Column("quantity", sa.Integer, nullable=False, server_default="1"),
    )

    op.create_index("ix_loan_requests_status", "loan_requests", ["status"])
    op.create_index("ix_loan_requests_reader", "loan_requests", ["reader_id"])


def downgrade() -> None:
    op.drop_table("loan_request_items")
    op.drop_table("loan_requests")
    loan_request_status.drop(op.get_bind(), checkfirst=True)
    loan_request_kind.drop(op.get_bind(), checkfirst=True)
