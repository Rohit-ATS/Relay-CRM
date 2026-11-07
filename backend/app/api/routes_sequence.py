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
from app.services.crm_service import crm_service, utc_now
from app.services.ai_service import ai_service

router = APIRouter(prefix="/api/sequence", tags=["Sequence & Approval"])


@router.post("", status_code=status.HTTP_201_CREATED)
async def generate_sequence(
    payload: SequenceGenerateRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Generate an editable 3-step email outreach sequence tailored to account & contact context.
    Saved in CRM with status='pending'. Supports both DB ID lookups and direct payload inputs from UI.
    """
    account = None
    if payload.account_id:
        account = await crm_service.get_account(db, payload.account_id)

    # Fallback to direct account payload from UI if not in DB
    company_name = "Target Company"
    domain = None
    source_notes = payload.notes
    account_id = payload.account_id

    if account:
        company_name = account.company_name
        domain = account.domain
        source_notes = payload.notes or account.source_notes
        account_id = account.id
    elif payload.account and isinstance(payload.account, dict):
        company_name = payload.account.get("companyName") or payload.account.get("company_name") or "Target Company"
        domain = payload.account.get("domain")
        source_notes = payload.notes or payload.account.get("summary")
        account_id = payload.account.get("id") or "acct_transient"

    # Pick contact
    contact_name = "Executive Lead"
    contact_title = None
    contact_id = payload.contact_id

    if account and account.contacts:
        contact = account.contacts[0]
        contact_name = contact.name
        contact_title = contact.title
        contact_id = contact.id
    elif payload.contact and isinstance(payload.contact, dict):
        contact_name = payload.contact.get("name") or "Executive Lead"
        contact_title = payload.contact.get("title")
        contact_id = payload.contact.get("id")

    # Call AI service (with deterministic fallback)
    generated = await ai_service.generate_sequence(
        company_name=company_name,
        contact_name=contact_name,
        contact_title=contact_title,
        domain=domain,
        source_notes=source_notes,
        custom_angle=payload.custom_angle
    )

    # If account exists in database, persist sequence
    sequence_id = "seq_" + str(account_id)
    steps_list = []
    
    if account:
        sequence = Sequence(
            account_id=account.id,
            status="pending",
            rationale=generated.rationale
        )
        db.add(sequence)
        await db.flush()
        sequence_id = sequence.id

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
            steps_list.append(step)

        # Audit Activity
        activity = Activity(
            account_id=account.id,
            contact_id=contact_id if contact_id != "acct_transient" else None,
            type="sequence_generated",
            summary=f"AI generated 3-step outreach sequence for {contact_name} at {company_name}.",
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

    # Format output matching both SequenceRead and GeneratedSequenceResult
    facts = [
        {"key": "company_name", "value": company_name, "source": {"type": "user", "label": "supplied account record", "confidence": 1.0}},
        {"key": "contact_name", "value": contact_name, "source": {"type": "user", "label": "supplied contact record", "confidence": 1.0}},
    ]
    if domain:
        facts.append({"key": "domain", "value": domain, "source": {"type": "user", "label": "supplied domain", "confidence": 1.0}})
    if source_notes:
        facts.append({"key": "notes", "value": source_notes[:100], "source": {"type": "user", "label": "supplied notes", "confidence": 1.0}})

    steps_source = steps_list if steps_list else generated.steps
    steps_response = [
        {
            "id": getattr(s, "id", f"step_{idx+1}"),
            "sequence_id": sequence_id,
            "step_number": getattr(s, "step_number", idx + 1),
            "delay_days": getattr(s, "delay_days", 0),
            "delayDays": getattr(s, "delay_days", 0),
            "channel": "email",
            "subject": s.subject,
            "body": s.body,
            "rationale": s.rationale,
            "status": getattr(s, "status", "draft")
        }
        for idx, s in enumerate(steps_source)
    ]

    return {
        "id": sequence_id,
        "account_id": account_id,
        "accountId": account_id,
        "status": "pending",
        "rationale": generated.rationale,
        "mode": "provider" if ai_service.anthropic_key or ai_service.openai_key else "demo_fixture",
        "brief": f"A tailored, email-first outreach plan for {contact_name} at {company_name}.",
        "facts": facts,
        "assumptions": [
            "Recipient is relevant to the supplied CRM context",
            "Human will review and approve drafts before delivery"
        ],
        "steps": steps_response,
        "created_at": utc_now().isoformat()
    }


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
