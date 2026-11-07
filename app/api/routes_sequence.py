from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import get_db
from app.db.models import Sequence, SequenceStep, Activity, Contact
from app.schemas.crm import (
    SequenceRead,
    SequenceStepRead,
    SequenceStepUpdate
)
from app.schemas.ai import (
    SequenceGenerateRequest,
    SequenceApprovalRequest,
    SequenceRejectRequest
)
from app.services.crm_service import crm_service
from app.services.ai_service import ai_service

router = APIRouter(prefix="/api/sequence", tags=["Sequence & Approval"])


@router.post("", response_model=SequenceRead, status_code=status.HTTP_201_CREATED)
async def generate_sequence(
    payload: SequenceGenerateRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Generate an editable 3-step email outreach sequence tailored to account & contact context.
    Saved in CRM with status='pending'. Does NOT send messages externally.
    """
    account = await crm_service.get_account(db, payload.account_id)
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")

    # Pick contact
    contact: Optional[Contact] = None
    if payload.contact_id:
        contact = await crm_service.get_contact(db, payload.contact_id)
    elif account.contacts:
        contact = account.contacts[0]

    contact_name = contact.name if contact else "Executive Lead"
    contact_title = contact.title if contact else None

    # Call AI service (with deterministic fallback)
    generated = await ai_service.generate_sequence(
        company_name=account.company_name,
        contact_name=contact_name,
        contact_title=contact_title,
        domain=account.domain,
        source_notes=account.source_notes,
        brief=account.brief,
        custom_angle=payload.custom_angle
    )

    # Save to CRM database
    sequence = Sequence(
        account_id=account.id,
        status="pending",
        rationale=generated.rationale
    )
    db.add(sequence)
    await db.flush()

    for step_data in generated.steps:
        step = SequenceStep(
            sequence_id=sequence.id,
            step_number=step_data.step_number,
            channel="email",
            delay_days=step_data.delay_days,
            subject=step_data.subject,
            body=step_data.body,
            rationale=step_data.rationale,
            status="draft"
        )
        db.add(step)

    # Audit Activity
    activity = Activity(
        account_id=account.id,
        contact_id=contact.id if contact else None,
        type="sequence_generated",
        summary=f"AI generated 3-step outreach sequence for {contact_name} at {account.company_name}.",
        source="ai",
        metadata_json={
            "sequence_id": sequence.id,
            "rationale": generated.rationale,
            "steps_count": len(generated.steps)
        }
    )
    db.add(activity)

    await db.commit()
    await db.refresh(sequence)
    return sequence


@router.get("/{sequence_id}", response_model=SequenceRead)
async def get_sequence(
    sequence_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Retrieve sequence with all steps."""
    seq = await crm_service.get_sequence(db, sequence_id)
    if not seq:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sequence not found")
    return seq


@router.patch("/{sequence_id}/steps/{step_id}", response_model=SequenceStepRead)
async def update_sequence_step(
    sequence_id: str,
    step_id: str,
    payload: SequenceStepUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Edit draft sequence step before approval."""
    step = await crm_service.update_sequence_step(db, sequence_id, step_id, payload)
    if not step:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sequence step not found")
    return step


@router.post("/{sequence_id}/approve", response_model=SequenceRead)
async def approve_sequence(
    sequence_id: str,
    payload: Optional[SequenceApprovalRequest] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    Approve sequence.
    Updates status to 'approved', transitions Deal to 'Outreach',
    and logs an Activity. Does NOT claim fake email sending.
    """
    notes = payload.notes if payload else None
    seq = await crm_service.approve_sequence(db, sequence_id, notes=notes)
    if not seq:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sequence not found")
    return seq


@router.post("/{sequence_id}/reject", response_model=SequenceRead)
async def reject_sequence(
    sequence_id: str,
    payload: Optional[SequenceRejectRequest] = None,
    db: AsyncSession = Depends(get_db)
):
    """Reject sequence and log reason in audit timeline."""
    reason = payload.reason if payload else None
    seq = await crm_service.reject_sequence(db, sequence_id, reason=reason)
    if not seq:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sequence not found")
    return seq
