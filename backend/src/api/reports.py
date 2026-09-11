from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.db import get_session
from src.core.deps import require_role
from src.models.profile import Profile
from src.schemas.report import ActivityLog, ActivityTrend, InventoryReport, OverdueReport
from src.services.report_service import activity_log, activity_trend, inventory_report, overdue_report

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("/inventory", response_model=InventoryReport)
async def get_inventory_report(
    _: Profile = Depends(require_role("admin")),
    session: AsyncSession = Depends(get_session),
) -> InventoryReport:
    return await inventory_report(session)


@router.get("/trend", response_model=ActivityTrend)
async def get_activity_trend(
    days: int = 14,
    _: Profile = Depends(require_role("admin", "librarian")),
    session: AsyncSession = Depends(get_session),
) -> ActivityTrend:
    return await activity_trend(session, days)


@router.get("/overdue", response_model=OverdueReport)
async def get_overdue_report(
    _: Profile = Depends(require_role("admin", "librarian")),
    session: AsyncSession = Depends(get_session),
) -> OverdueReport:
    return await overdue_report(session)


@router.get("/activities", response_model=ActivityLog)
async def get_activity_log(
    limit: int = 500,
    _: Profile = Depends(require_role("admin", "librarian")),
    session: AsyncSession = Depends(get_session),
) -> ActivityLog:
    return await activity_log(session, limit)
