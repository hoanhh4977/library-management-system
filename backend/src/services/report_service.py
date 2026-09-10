from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.book import Book
from src.models.loan_detail import LoanDetail
from src.schemas.report import BookInventory, InventoryReport


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

    rows = [
        BookInventory(
            book_id=book.id,
            code=book.code,
            title=book.title,
            author=book.author,
            category=book.category,
            cover_image_url=book.cover_image_url,
            total=book.quantity + borrowing_by_book.get(book.id, 0),
            borrowing=borrowing_by_book.get(book.id, 0),
            remaining=book.quantity,
        )
        for book in books
    ]

    return InventoryReport(
        books=rows,
        total_titles=len(rows),
        total_copies=sum(r.total for r in rows),
        total_borrowing=sum(r.borrowing for r in rows),
    )
