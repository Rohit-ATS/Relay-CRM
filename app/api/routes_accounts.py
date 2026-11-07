from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.crm import (
    AccountRead,
    AccountDetailRead,
    AccountCreate,
    AccountUpdate
)
from app.services.crm_service import crm_service

router = APIRouter(prefix="/api/accounts", tags=["Accounts"])


@router.get("", response_model=List[AccountRead])
async def list_accounts(
    query: Optional[str] = Query(None, description="Search by company name, domain, or industry"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db)
):
    """List and search CRM accounts."""
    return await crm_service.list_accounts(db, query=query, limit=limit, offset=offset)


@router.get("/{account_id}", response_model=AccountDetailRead)
async def get_account_detail(
    account_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Get complete account record with contacts, deals, activities, sequences, and handoff tasks."""
    account = await crm_service.get_account(db, account_id)
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    return account


@router.post("", response_model=AccountRead, status_code=status.HTTP_201_CREATED)
async def create_account(
    data: AccountCreate,
    db: AsyncSession = Depends(get_db)
):
    """Create a new account manually."""
    return await crm_service.create_account(db, data)


@router.patch("/{account_id}", response_model=AccountRead)
async def update_account(
    account_id: str,
    data: AccountUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update account fields."""
    account = await crm_service.update_account(db, account_id, data)
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    return account


@router.delete("/{account_id}", status_code=status.HTTP_200_OK)
async def delete_account(
    account_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Delete an account and its cascaded records."""
    success = await crm_service.delete_account(db, account_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    return {"status": "deleted", "account_id": account_id}
