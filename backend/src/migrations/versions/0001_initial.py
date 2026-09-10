"""initial schema

Revision ID: 0001_initial
Revises:
Create Date: 2026-09-10

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# create_type=False: types are created explicitly (once) in upgrade() below;
# letting create_table() also auto-create them double-creates within the same
# transaction and raises DuplicateObjectError under the asyncpg dialect.
profile_role = postgresql.ENUM("reader", "librarian", "admin", name="profile_role", create_type=False)
card_status = postgresql.ENUM("active", "locked", name="card_status", create_type=False)
loan_detail_status = postgresql.ENUM(
    "borrowing",
    "returned",
    "pending_compensation",
    "compensated",
    name="loan_detail_status",
    create_type=False,
)
unlock_request_status = postgresql.ENUM(
    "pending", "approved", "rejected", name="unlock_request_status", create_type=False
)


def upgrade() -> None:
    profile_role.create(op.get_bind(), checkfirst=True)
    card_status.create(op.get_bind(), checkfirst=True)
    loan_detail_status.create(op.get_bind(), checkfirst=True)
    unlock_request_status.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("role", profile_role, nullable=False),
        sa.Column("code", sa.String(20), nullable=False),
        sa.Column("full_name", sa.String(100), nullable=False),
        sa.Column("date_of_birth", sa.Date, nullable=False),
        sa.Column("phone", sa.String(15), nullable=True),
        sa.Column("email", sa.String(100), nullable=False, unique=True),
        sa.Column("email_verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("role", "code", name="uq_profiles_role_code"),
    )

    op.create_table(
        "books",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("code", sa.String(20), nullable=False, unique=True),
        sa.Column("title", sa.String(100), nullable=False),
        sa.Column("author", sa.String(100), nullable=False),
        sa.Column("publisher", sa.String(100), nullable=False),
        sa.Column("category", sa.String(50), nullable=False),
        sa.Column("quantity", sa.Integer, nullable=False, server_default="0"),
        sa.CheckConstraint("quantity >= 0", name="ck_books_quantity_non_negative"),
    )

    op.create_table(
        "library_cards",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("code", sa.String(20), nullable=False, unique=True),
        sa.Column("reader_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("profiles.id"), nullable=False, unique=True),
        sa.Column("issued_at", sa.Date, nullable=False, server_default=sa.text("now()")),
        sa.Column("issued_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("profiles.id"), nullable=False),
        sa.Column("status", card_status, nullable=False, server_default="active"),
    )

    op.create_table(
        "loans",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("code", sa.String(20), nullable=False, unique=True),
        sa.Column("reader_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("profiles.id"), nullable=False),
        sa.Column("librarian_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("profiles.id"), nullable=False),
        sa.Column("loan_date", sa.Date, nullable=False, server_default=sa.text("now()")),
        sa.Column("due_date", sa.Date, nullable=False),
        sa.Column("renewed", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.CheckConstraint("due_date >= loan_date", name="ck_loans_due_after_loan"),
    )

    op.create_table(
        "loan_details",
        sa.Column("loan_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("loans.id"), primary_key=True),
        sa.Column("book_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("books.id"), primary_key=True),
        sa.Column("quantity", sa.Integer, nullable=False, server_default="1"),
        sa.Column("actual_return_date", sa.Date, nullable=True),
        sa.Column("status", loan_detail_status, nullable=False, server_default="borrowing"),
        sa.Column("compensation_confirmed_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("profiles.id"), nullable=True),
        sa.Column("compensation_confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("quantity > 0", name="ck_loan_details_quantity_positive"),
    )

    op.create_table(
        "card_unlock_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("card_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("library_cards.id"), nullable=False),
        sa.Column("requested_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("profiles.id"), nullable=False),
        sa.Column("requested_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("status", unlock_request_status, nullable=False, server_default="pending"),
        sa.Column("reviewed_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("profiles.id"), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_index("ix_loan_details_status", "loan_details", ["status"])
    op.create_index("ix_loans_due_date", "loans", ["due_date"])
    op.create_index("ix_card_unlock_requests_card_status", "card_unlock_requests", ["card_id", "status"])


def downgrade() -> None:
    op.drop_table("card_unlock_requests")
    op.drop_table("loan_details")
    op.drop_table("loans")
    op.drop_table("library_cards")
    op.drop_table("books")
    op.drop_table("profiles")
    unlock_request_status.drop(op.get_bind(), checkfirst=True)
    loan_detail_status.drop(op.get_bind(), checkfirst=True)
    card_status.drop(op.get_bind(), checkfirst=True)
    profile_role.drop(op.get_bind(), checkfirst=True)
