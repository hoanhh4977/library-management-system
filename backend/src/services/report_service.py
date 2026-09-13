from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.book import Book
from src.models.category import BookCategory, Category
from src.models.loan import Loan
from src.models.loan_detail import LoanDetail
from src.models.profile import Profile
from src.schemas.report import (
    ActivityItem,
    ActivityLog,
    ActivityTrend,
    BookInventory,
    DailyActivity,
    InventoryReport,
    OverdueItem,
    OverdueReport,
)


async def inventory_report(session: AsyncSession) -> InventoryReport:
    """FR-024: per-book (total, borrowing, remaining) + system-wide totals, computed
    on-demand (research.md §7) — `books.quantity` already tracks "remaining" live
    (decremented on loan, incremented on return), so total = remaining + borrowing.
    """
    borrowing_by_book = dict(
        (
            await session.execute(
                select(LoanDetail.book_id, func.sum(LoanDetail.quantity))
                .where(LoanDetail.status == "borrowing")
                .group_by(LoanDetail.book_id)
            )
        ).all()
    )

    books = (await session.execute(select(Book).order_by(Book.title))).scalars().all()

    categories_by_book: dict = {}
    if books:
        rows_raw = (
            await session.execute(
                select(BookCategory.book_id, Category.name)
                .join(Category, Category.id == BookCategory.category_id)
                .where(BookCategory.book_id.in_([b.id for b in books]))
                .order_by(Category.name)
            )
        ).all()
        categories_by_book = {book.id: [] for book in books}
        for book_id, name in rows_raw:
            categories_by_book[book_id].append(name)

    rows = [
        BookInventory(
            book_id=book.id,
            code=book.code,
            title=book.title,
            author=book.author,
            categories=categories_by_book.get(book.id, []),
            cover_image_url=book.cover_image_url,
            total=book.quantity + borrowing_by_book.get(book.id, 0),
            borrowing=borrowing_by_book.get(book.id, 0),
            remaining=book.quantity,
            created_at=book.created_at,
        )
        for book in books
    ]

    return InventoryReport(
        books=rows,
        total_titles=len(rows),
        total_copies=sum(r.total for r in rows),
        total_borrowing=sum(r.borrowing for r in rows),
    )


async def activity_trend(session: AsyncSession, days: int = 14) -> ActivityTrend:
    """Real borrow/return volume per day over the trailing `days` window, built from
    `loans.loan_date` and `loan_details.actual_return_date` — both already recorded on
    every transaction, so this needs no new data collection, just aggregation.
    """
    start = date.today() - timedelta(days=days - 1)

    borrowed_by_day = dict(
        (
            await session.execute(
                select(Loan.loan_date, func.sum(LoanDetail.quantity))
                .join(LoanDetail, LoanDetail.loan_id == Loan.id)
                .where(Loan.loan_date >= start)
                .group_by(Loan.loan_date)
            )
        ).all()
    )

    returned_by_day = dict(
        (
            await session.execute(
                select(LoanDetail.actual_return_date, func.sum(LoanDetail.quantity))
                .where(LoanDetail.actual_return_date >= start)
                .group_by(LoanDetail.actual_return_date)
            )
        ).all()
    )

    days_out = [
        DailyActivity(
            activity_date=start + timedelta(days=i),
            borrowed=borrowed_by_day.get(start + timedelta(days=i), 0),
            returned=returned_by_day.get(start + timedelta(days=i), 0),
        )
        for i in range(days)
    ]
    return ActivityTrend(days=days_out)


async def overdue_report(session: AsyncSession) -> OverdueReport:
    """Every still-borrowing loan line whose loan is past its due date — real per-loan
    data (`loans.due_date` + `loan_details.status`), not derivable from the per-book
    inventory report above.
    """
    today = date.today()
    rows = (
        await session.execute(
            select(LoanDetail, Loan, Book.title, Book.cover_image_url, Profile.full_name, Profile.code)
            .join(Loan, Loan.id == LoanDetail.loan_id)
            .join(Book, Book.id == LoanDetail.book_id)
            .join(Profile, Profile.id == Loan.reader_id)
            .where(LoanDetail.status == "borrowing", Loan.due_date < today)
            .order_by(Loan.due_date.asc())
        )
    ).all()

    items = [
        OverdueItem(
            loan_id=loan.id,
            loan_code=loan.code,
            book_id=detail.book_id,
            book_title=title,
            book_cover_image_url=cover_image_url,
            reader_id=loan.reader_id,
            reader_name=full_name,
            reader_code=code,
            due_date=loan.due_date,
            days_overdue=(today - loan.due_date).days,
            quantity=detail.quantity,
        )
        for detail, loan, title, cover_image_url, full_name, code in rows
    ]
    return OverdueReport(items=items)


async def activity_log(session: AsyncSession, limit: int = 500) -> ActivityLog:
    """Every loan line (most recent first) — the raw feed the admin "Library Activities"
    table filters into Borrow/Return/Overdue/Renewing tabs client-side. Built entirely
    from `loans`/`loan_details` columns that already exist; no fines/revenue fields
    exist anywhere in the schema, so that column is intentionally not modeled here.
    """
    today = date.today()
    rows = (
        await session.execute(
            select(LoanDetail, Loan, Book.title, Book.cover_image_url, Profile.full_name, Profile.code)
            .join(Loan, Loan.id == LoanDetail.loan_id)
            .join(Book, Book.id == LoanDetail.book_id)
            .join(Profile, Profile.id == Loan.reader_id)
            .order_by(Loan.loan_date.desc())
            .limit(limit)
        )
    ).all()

    items = [
        ActivityItem(
            loan_id=loan.id,
            loan_code=loan.code,
            book_id=detail.book_id,
            book_title=title,
            book_cover_image_url=cover_image_url,
            reader_id=loan.reader_id,
            reader_name=full_name,
            reader_code=code,
            quantity=detail.quantity,
            loan_date=loan.loan_date,
            due_date=loan.due_date,
            actual_return_date=detail.actual_return_date,
            status=detail.status,
            renewed=loan.renewed,
            is_overdue=detail.status == "borrowing" and loan.due_date < today,
        )
        for detail, loan, title, cover_image_url, full_name, code in rows
    ]
    return ActivityLog(items=items)
