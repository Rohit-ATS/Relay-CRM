from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import get_db
from app.db.models import Deal, Activity, HandoffTask, Contact
from app.schemas.ai import (
    InteractionAnalysisRequest,
    InteractionAnalysisResponse,
    InteractionConfirmRequest
)
from app.services.crm_service import crm_service, utc_now
from app.services.ai_service import ai_service

router = APIRouter(prefix="/api/interactions", tags=["Interactions & Handoff"])


@router.post("", response_model=InteractionAnalysisResponse)
@router.post("/analyze", response_model=InteractionAnalysisResponse)
async def analyze_interaction(
    payload: InteractionAnalysisRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Analyze simulated prospect reply or pasted call transcript.
    Returns sentiment, intent, proposed deal stage update with reasoning & quote,
    and recommended human handoff task.
    If apply_immediately=True, persists changes immediately.
    """
    account = await crm_service.get_account(db, payload.account_id)
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")

    contact: Optional[Contact] = None
    if payload.contact_id:
        contact = await crm_service.get_contact(db, payload.contact_id)
    elif account.contacts:
        contact = account.contacts[0]

    # Current deal stage
    deal_stmt = select(Deal).where(Deal.account_id == account.id)
    deal_res = await db.execute(deal_stmt)
    deal = deal_res.scalars().first()
    current_stage = deal.stage if deal else "Prospecting"

    analysis = await ai_service.analyze_interaction(
        company_name=account.company_name,
        current_stage=current_stage,
        contact_name=contact.name if contact else None,
        channel=payload.channel,
        content=payload.content
    )

    if payload.apply_immediately:
        # Confirm and apply immediately
        confirm_req = InteractionConfirmRequest(
            account_id=payload.account_id,
            contact_id=payload.contact_id,
            channel=payload.channel,
            content=payload.content,
            confirmed_stage=analysis.proposed_update.proposed_stage,
            task_title=analysis.proposed_update.recommended_task_title,
            task_reason=analysis.proposed_update.recommended_task_reason,
            notes=f"Auto-applied: {analysis.proposed_update.reasoning}"
        )
        applied_res = await _apply_confirmed_interaction(db, confirm_req)
        analysis.applied = True
        analysis.activity_id = applied_res["activity_id"]
        analysis.task_id = applied_res.get("task_id")

    return analysis


@router.post("/confirm", status_code=status.HTTP_200_OK)
async def confirm_interaction(
    payload: InteractionConfirmRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Human confirmation step.
    Updates Account/Deal, appends immutable Activity with reason/evidence,
    and creates HandoffTask when signal is positive.
    """
    return await _apply_confirmed_interaction(db, payload)


async def _apply_confirmed_interaction(db: AsyncSession, payload: InteractionConfirmRequest):
    account = await crm_service.get_account(db, payload.account_id)
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")

    # 1. Update contact status if available
    contact: Optional[Contact] = None
    if payload.contact_id:
        contact = await crm_service.get_contact(db, payload.contact_id)
    elif account.contacts:
        contact = account.contacts[0]

    if contact:
        contact.status = "replied"
        contact.updated_at = utc_now()
        db.add(contact)

    # 2. Update Deal stage
    deal_stmt = select(Deal).where(Deal.account_id == account.id)
    deal_res = await db.execute(deal_stmt)
    deal = deal_res.scalars().first()
    prev_stage = "Prospecting"

    if deal:
        prev_stage = deal.stage
        deal.stage = payload.confirmed_stage
        deal.next_step = payload.task_title
        deal.updated_at = utc_now()
        db.add(deal)

    # 3. Create Immutable Activity
    summary_text = (
        f"Inbound interaction via {payload.channel}: '{payload.content[:100]}...'. "
        f"Deal moved from '{prev_stage}' to '{payload.confirmed_stage}'. "
        f"Reason: {payload.task_reason}"
    )
    activity = Activity(
        account_id=account.id,
        contact_id=contact.id if contact else None,
        type="inbound_interaction",
        summary=summary_text,
        source="ai",
        metadata_json={
            "channel": payload.channel,
            "content": payload.content,
            "previous_stage": prev_stage,
            "new_stage": payload.confirmed_stage,
            "notes": payload.notes
        }
    )
    db.add(activity)
    await db.flush()

    # 4. Create HandoffTask for positive/questioning signals
    task_id = None
    if payload.confirmed_stage not in ["Closed Lost", "Unqualified"]:
        handoff = HandoffTask(
            account_id=account.id,
            title=payload.task_title,
            reason=payload.task_reason,
            status="pending"
        )
        db.add(handoff)
        await db.flush()
        task_id = handoff.id

        # Also log task created activity
        task_act = Activity(
            account_id=account.id,
            contact_id=contact.id if contact else None,
            type="task_created",
            summary=f"Created sales handoff task: '{payload.task_title}'.",
            source="system",
            metadata_json={"task_id": task_id}
        )
        db.add(task_act)

    await db.commit()

    return {
        "status": "confirmed",
        "account_id": account.id,
        "previous_stage": prev_stage,
        "new_stage": payload.confirmed_stage,
        "activity_id": activity.id,
        "task_id": task_id
    }
