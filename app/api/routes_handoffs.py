from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.crm import HandoffTaskRead, HandoffTaskUpdate
from app.services.crm_service import crm_service

router = APIRouter(prefix="/api/handoffs", tags=["Handoffs"])


@router.get("", response_model=List[HandoffTaskRead])
async def list_handoffs(
    status: Optional[str] = Query(None, description="Filter by status (pending, completed, dismissed)"),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve the warm lead handoff queue for human sales follow-up."""
    return await crm_service.list_handoffs(db, status=status)


@router.patch("/{task_id}", response_model=HandoffTaskRead)
async def update_handoff(
    task_id: str,
    data: HandoffTaskUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update handoff task status (e.g. mark completed)."""
    task = await crm_service.update_handoff(db, task_id, data)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Handoff task not found")
    return task
