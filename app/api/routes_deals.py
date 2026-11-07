from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.crm import DealRead, DealCreate, DealUpdate
from app.services.crm_service import crm_service

router = APIRouter(prefix="/api/deals", tags=["Deals"])


@router.get("", response_model=List[DealRead])
async def list_deals(
    account_id: Optional[str] = Query(None, description="Filter deals by account"),
    stage: Optional[str] = Query(None, description="Filter deals by stage"),
    db: AsyncSession = Depends(get_db)
):
    """List CRM deals."""
    return await crm_service.list_deals(db, account_id=account_id, stage=stage)


@router.get("/{deal_id}", response_model=DealRead)
async def get_deal(
    deal_id: str,
    db: AsyncSession = Depends(get_db)
):
    deal = await crm_service.get_deal(db, deal_id)
    if not deal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deal not found")
    return deal


@router.post("", response_model=DealRead, status_code=status.HTTP_201_CREATED)
async def create_deal(
    data: DealCreate,
    db: AsyncSession = Depends(get_db)
):
    return await crm_service.create_deal(db, data)


@router.patch("/{deal_id}", response_model=DealRead)
async def update_deal(
    deal_id: str,
    data: DealUpdate,
    db: AsyncSession = Depends(get_db)
):
    """
    Update deal fields (e.g. stage, next_step, value).
    Stage changes automatically record an Activity in the account's audit timeline.
    """
    deal = await crm_service.update_deal(db, deal_id, data)
    if not deal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deal not found")
    return deal
