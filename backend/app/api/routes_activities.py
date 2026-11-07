from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.crm import ActivityRead, ActivityCreate
from app.services.crm_service import crm_service

router = APIRouter(prefix="/api/activities", tags=["Activities"])


@router.get("", response_model=List[ActivityRead])
async def list_activities(
    account_id: Optional[str] = Query(None, description="Filter activities by account"),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve immutable audit timeline activities."""
    return await crm_service.list_activities(db, account_id=account_id, limit=limit)


@router.post("", response_model=ActivityRead, status_code=status.HTTP_201_CREATED)
async def create_activity(
    data: ActivityCreate,
    db: AsyncSession = Depends(get_db)
):
    """Add a manual activity or note to an account."""
    return await crm_service.create_activity(db, data)
