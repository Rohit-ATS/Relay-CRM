from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.crm import (
    ContactRead,
    ContactCreate,
    ContactUpdate
)
from app.services.crm_service import crm_service

router = APIRouter(prefix="/api/contacts", tags=["Contacts"])


@router.get("", response_model=List[ContactRead])
async def list_contacts(
    account_id: Optional[str] = Query(None, description="Filter contacts by account ID"),
    db: AsyncSession = Depends(get_db)
):
    """List CRM contacts with optional account filter."""
    return await crm_service.list_contacts(db, account_id=account_id)


@router.get("/{contact_id}", response_model=ContactRead)
async def get_contact(
    contact_id: str,
    db: AsyncSession = Depends(get_db)
):
    contact = await crm_service.get_contact(db, contact_id)
    if not contact:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contact not found")
    return contact


@router.post("", response_model=ContactRead, status_code=status.HTTP_201_CREATED)
async def create_contact(
    data: ContactCreate,
    db: AsyncSession = Depends(get_db)
):
    return await crm_service.create_contact(db, data)


@router.patch("/{contact_id}", response_model=ContactRead)
async def update_contact(
    contact_id: str,
    data: ContactUpdate,
    db: AsyncSession = Depends(get_db)
):
    contact = await crm_service.update_contact(db, contact_id, data)
    if not contact:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contact not found")
    return contact
