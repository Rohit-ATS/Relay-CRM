from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.db.models import Activity
from app.schemas.ai import AccountBrief, BriefGenerateRequest
from app.services.crm_service import crm_service
from app.services.ai_service import ai_service

router = APIRouter(prefix="/api/enrich", tags=["Enrichment & Brief"])


@router.post("", response_model=AccountBrief)
@router.post("/brief", response_model=AccountBrief)
async def generate_brief(
    payload: BriefGenerateRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Generate or regenerate a structured account brief.
    Every fact is labeled as user-provided, source-linked, or inference.
    Saves the structured brief to the Account record and logs an Activity.
    """
    account = await crm_service.get_account(db, payload.account_id)
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found"
        )

    brief = await ai_service.generate_account_brief(
        company_name=account.company_name,
        domain=account.domain,
        industry=account.industry,
        source_notes=account.source_notes,
        custom_instructions=payload.custom_instructions
    )

    # Persist brief to account
    account.brief = brief.model_dump()
    db.add(account)

    # Log activity
    activity = Activity(
        account_id=account.id,
        type="brief_generated",
        summary=f"Generated structured account brief for {account.company_name} with {len(brief.facts)} labeled facts.",
        source="ai",
        metadata_json={
            "facts_count": len(brief.facts),
            "pain_points": brief.pain_points
        }
    )
    db.add(activity)
    await db.commit()

    return brief


@router.get("/{account_id}/brief", response_model=AccountBrief)
async def get_account_brief(
    account_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Retrieve existing brief or generate on the fly if not yet created."""
    account = await crm_service.get_account(db, account_id)
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")

    if account.brief:
        return AccountBrief(**account.brief)

    # Generate if empty
    brief = await ai_service.generate_account_brief(
        company_name=account.company_name,
        domain=account.domain,
        industry=account.industry,
        source_notes=account.source_notes
    )
    account.brief = brief.model_dump()
    db.add(account)
    await db.commit()
    return brief
