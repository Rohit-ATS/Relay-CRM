from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.services.crm_service import crm_service
from app.core.seed_data import SEED_DATA_ACCOUNTS

router = APIRouter(prefix="/api", tags=["Demo & System"])


@router.post("/reset", status_code=status.HTTP_200_OK)
async def reset_demo_data(
    seed: bool = Query(True, description="Whether to repopulate database with sample leads"),
    db: AsyncSession = Depends(get_db)
):
    """
    One-click reset of CRM state.
    Purges demo database and reseeds with realistic B2B outbound accounts,
    deals, contacts, sequences, and timeline activities.
    Crucial for the 90-second judge demo and Wren testing.
    """
    return await crm_service.reset_database(db, seed=seed)


@router.post("/seed", status_code=status.HTTP_200_OK)
async def seed_data(
    db: AsyncSession = Depends(get_db)
):
    """Seed sample B2B leads into CRM."""
    return await crm_service.reset_database(db, seed=True)


@router.get("/demo-data", status_code=status.HTTP_200_OK)
async def get_demo_overview():
    """Returns overview of available seed accounts for testing."""
    return {
        "count": len(SEED_DATA_ACCOUNTS),
        "accounts": [
            {
                "company_name": acc["company_name"],
                "industry": acc.get("industry"),
                "contact": acc.get("contacts", [{}])[0].get("name") if acc.get("contacts") else None,
                "deal_stage": acc.get("deals", [{}])[0].get("stage") if acc.get("deals") else None
            }
            for acc in SEED_DATA_ACCOUNTS
        ]
    }
