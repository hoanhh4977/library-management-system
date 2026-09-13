import logging
from datetime import datetime

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from src.core.db import SessionLocal
from src.services.card_service import lock_overdue_cards

logger = logging.getLogger(__name__)

# Overdue-ness is date-based (due_date < today), not minute-based — an hourly sweep
# is frequent enough to catch a violation the same day it appears without hammering
# the DB, and cheap regardless since lock_overdue_cards is a single bulk UPDATE.
LOCK_OVERDUE_CARDS_INTERVAL_MINUTES = 60

scheduler = AsyncIOScheduler()


async def _run_lock_overdue_cards() -> None:
    async with SessionLocal() as session:
        locked = await lock_overdue_cards(session)
        if locked:
            logger.info("lock_overdue_cards: locked %d card(s)", locked)


def start_scheduler() -> None:
    scheduler.add_job(
        _run_lock_overdue_cards,
        "interval",
        minutes=LOCK_OVERDUE_CARDS_INTERVAL_MINUTES,
        id="lock_overdue_cards",
        replace_existing=True,
    )
    scheduler.start()
    # Also fire once immediately — otherwise a violation that appeared while the
    # server was down (or before this job existed) would sit unhandled for up to a
    # full interval before the first scheduled run catches it.
    scheduler.modify_job("lock_overdue_cards", next_run_time=datetime.now())


def stop_scheduler() -> None:
    scheduler.shutdown(wait=False)
