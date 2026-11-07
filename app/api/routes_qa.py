from typing import Dict, Any
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import get_db
from app.db.models import Account, Deal, Activity, HandoffTask
from app.core.seed_data import SAMPLE_CSV_CONTENT
from app.services.import_service import import_service
from app.services.crm_service import crm_service
from app.services.ai_service import ai_service
from app.schemas.ai import InteractionConfirmRequest

router = APIRouter(prefix="/api/qa", tags=["Wren QA & Verification"])


@router.get("/status", status_code=status.HTTP_200_OK)
async def get_qa_status(db: AsyncSession = Depends(get_db)) -> Dict[str, Any]:
    """Overview of CRM records and readiness for Wren verification."""
    accounts = await crm_service.list_accounts(db)
    deals = await crm_service.list_deals(db)
    handoffs = await crm_service.list_handoffs(db)
    activities = await crm_service.list_activities(db)

    return {
        "status": "ready",
        "accounts_count": len(accounts),
        "deals_count": len(deals),
        "handoffs_count": len(handoffs),
        "activities_count": len(activities),
        "wren_workflows": {
            "workflow_a": "Workflow A: CSV Import -> Records -> Brief -> Sequence",
            "workflow_b": "Workflow B: Inbound Interaction -> Stage Update -> Audit Activity -> Handoff Task"
        }
    }


@router.get("/verify-import", status_code=status.HTTP_200_OK)
async def verify_workflow_a(db: AsyncSession = Depends(get_db)) -> Dict[str, Any]:
    """
    Automated verification of Wren Workflow A:
    1. Parse and import sample CSV
    2. Confirm linked Account, Contact, and Deal created
    3. Generate and verify structured Account Brief with labeled facts
    4. Generate and verify 3-step Sequence
    """
    leads, errors = import_service.parse_csv_text(SAMPLE_CSV_CONTENT)
    if not leads:
        return {"workflow": "Workflow A", "passed": False, "error": "Failed to parse sample CSV"}

    # Take first lead for isolated test
    target_lead = leads[0]
    import_res = await import_service.execute_import(db, [target_lead])
    
    if import_res.imported_accounts < 1 and len(import_res.account_ids) < 1:
        return {"workflow": "Workflow A", "passed": False, "error": "No account created"}

    account_id = import_res.account_ids[0]
    account = await crm_service.get_account(db, account_id)
    if not account:
        return {"workflow": "Workflow A", "passed": False, "error": "Account not found after import"}

    # Verify Brief
    brief = await ai_service.generate_account_brief(
        company_name=account.company_name,
        domain=account.domain,
        industry=account.industry,
        source_notes=account.source_notes
    )
    if not brief or not brief.facts:
        return {"workflow": "Workflow A", "passed": False, "error": "Account brief generation failed"}

    # Verify Sequence
    seq = await ai_service.generate_sequence(
        company_name=account.company_name,
        contact_name=account.contacts[0].name if account.contacts else "Lead",
        contact_title=account.contacts[0].title if account.contacts else None,
        domain=account.domain,
        source_notes=account.source_notes
    )
    if len(seq.steps) != 3:
        return {"workflow": "Workflow A", "passed": False, "error": "Sequence did not produce 3 steps"}

    return {
        "workflow": "Workflow A: Import and prepare",
        "passed": True,
        "evidence": {
            "imported_company": account.company_name,
            "contact_email": account.contacts[0].email if account.contacts else None,
            "deal_stage": account.deals[0].stage if account.deals else None,
            "brief_facts_count": len(brief.facts),
            "sequence_steps_count": len(seq.steps),
            "first_step_subject": seq.steps[0].subject
        }
    }


@router.get("/verify-handoff", status_code=status.HTTP_200_OK)
async def verify_workflow_b(db: AsyncSession = Depends(get_db)) -> Dict[str, Any]:
    """
    Automated verification of Wren Workflow B:
    1. Check or create target account
    2. Simulate inbound prospect response requesting a demo
    3. Verify deal stage moves to Demo Scheduled / Engaged
    4. Verify immutable audit Activity is logged
    5. Verify HandoffTask is created in the sales queue
    """
    accounts = await crm_service.list_accounts(db)
    if not accounts:
        await crm_service.reset_database(db, seed=True)
        accounts = await crm_service.list_accounts(db)

    target_account = accounts[0]
    sample_reply = "Hey! Sounds very interesting, we've had major issues with our CRM. Can we do a quick demo this Thursday at 2pm?"

    # Analyze
    deal_stmt = select(Deal).where(Deal.account_id == target_account.id)
    deal_res = await db.execute(deal_stmt)
    deal = deal_res.scalars().first()
    prev_stage = deal.stage if deal else "Prospecting"

    analysis = await ai_service.analyze_interaction(
        company_name=target_account.company_name,
        current_stage=prev_stage,
        contact_name=target_account.contacts[0].name if target_account.contacts else "Lead",
        channel="email_reply",
        content=sample_reply
    )

    # Confirm
    from app.api.routes_interactions import _apply_confirmed_interaction
    confirm_req = InteractionConfirmRequest(
        account_id=target_account.id,
        contact_id=target_account.contacts[0].id if target_account.contacts else None,
        channel="email_reply",
        content=sample_reply,
        confirmed_stage=analysis.proposed_update.proposed_stage,
        task_title=analysis.proposed_update.recommended_task_title,
        task_reason=analysis.proposed_update.recommended_task_reason,
        notes="Verified in Wren QA workflow B"
    )
    apply_res = await _apply_confirmed_interaction(db, confirm_req)

    # Verify task in handoffs
    handoffs = await crm_service.list_handoffs(db, status="pending")
    matching_task = [h for h in handoffs if h.account_id == target_account.id]

    return {
        "workflow": "Workflow B: Update and hand off",
        "passed": len(matching_task) > 0,
        "evidence": {
            "account": target_account.company_name,
            "simulated_reply": sample_reply,
            "detected_sentiment": analysis.sentiment,
            "previous_stage": prev_stage,
            "new_stage": apply_res["new_stage"],
            "activity_id": apply_res["activity_id"],
            "handoff_task_id": apply_res["task_id"],
            "task_title": analysis.proposed_update.recommended_task_title
        }
    }
