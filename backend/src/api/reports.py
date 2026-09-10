from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.db import get_session
from src.core.deps import require_role
from src.models.profile import Profile
from src.schemas.report import InventoryReport
from src.services.report_service import inventory_report

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("/inventory", response_model=InventoryReport)
async def get_inventory_report(
    _: Profile = Depends(require_role("admin")),
    session: AsyncSession = Depends(get_session),
) -> InventoryReport:
    return await inventory_report(session)
