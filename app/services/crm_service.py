import logging
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from sqlalchemy import select, or_, desc, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models import (
    Account,
    Contact,
    Deal,
    Sequence,
    SequenceStep,
    Activity,
    HandoffTask
)
from app.schemas.crm import (
    AccountCreate,
    AccountUpdate,
    ContactCreate,
    ContactUpdate,
    DealCreate,
    DealUpdate,
    ActivityCreate,
    HandoffTaskCreate,
    HandoffTaskUpdate,
    SequenceStepUpdate
)
from app.core.seed_data import SEED_DATA_ACCOUNTS

logger = logging.getLogger(__name__)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _clean_model_kwargs(model_cls, data_dict: Dict[str, Any]) -> Dict[str, Any]:
    valid_cols = {c.key for c in model_cls.__table__.columns}
    return {k: v for k, v in data_dict.items() if k in valid_cols}


class CRMService:

    # ------------------------------------------------------------------
    # ACCOUNTS
    # ------------------------------------------------------------------
    async def list_accounts(
        self,
        db: AsyncSession,
        query: Optional[str] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[Account]:
        stmt = select(Account).options(
            selectinload(Account.contacts),
            selectinload(Account.deals),
            selectinload(Account.activities),
            selectinload(Account.sequences),
            selectinload(Account.handoffs)
        )
        if query:
            q = f"%{query}%"
            stmt = stmt.where(
                or_(
                    Account.company_name.ilike(q),
                    Account.domain.ilike(q),
                    Account.industry.ilike(q)
                )
            )
        stmt = stmt.order_by(desc(Account.updated_at)).offset(offset).limit(limit)
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def get_account(self, db: AsyncSession, account_id: str) -> Optional[Account]:
        stmt = (
            select(Account)
            .where(Account.id == account_id)
            .options(
                selectinload(Account.contacts),
                selectinload(Account.deals),
                selectinload(Account.activities),
                selectinload(Account.sequences).selectinload(Sequence.steps),
                selectinload(Account.handoffs)
            )
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def create_account(self, db: AsyncSession, data: AccountCreate) -> Account:
        account = Account(**_clean_model_kwargs(Account, data.model_dump()))
        db.add(account)
        await db.flush()

        # Audit activity
        activity = Activity(
            account_id=account.id,
            type="account_created",
            summary=f"Created account record for {account.company_name}.",
            source="user",
            metadata_json={"company_name": account.company_name}
        )
        db.add(activity)
        await db.commit()
        await db.refresh(account)
        return account

    async def update_account(
        self,
        db: AsyncSession,
        account_id: str,
        data: AccountUpdate
    ) -> Optional[Account]:
        account = await self.get_account(db, account_id)
        if not account:
            return None

        update_dict = _clean_model_kwargs(Account, data.model_dump(exclude_unset=True))
        for key, value in update_dict.items():
            setattr(account, key, value)
        account.updated_at = utc_now()

        db.add(account)
        await db.commit()
        await db.refresh(account)
        return account

    async def delete_account(self, db: AsyncSession, account_id: str) -> bool:
        account = await self.get_account(db, account_id)
        if not account:
            return False
        await db.delete(account)
        await db.commit()
        return True

    # ------------------------------------------------------------------
    # CONTACTS
    # ------------------------------------------------------------------
    async def list_contacts(
        self,
        db: AsyncSession,
        account_id: Optional[str] = None
    ) -> List[Contact]:
        stmt = select(Contact)
        if account_id:
            stmt = stmt.where(Contact.account_id == account_id)
        stmt = stmt.order_by(desc(Contact.created_at))
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def get_contact(self, db: AsyncSession, contact_id: str) -> Optional[Contact]:
        stmt = select(Contact).where(Contact.id == contact_id)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def create_contact(self, db: AsyncSession, data: ContactCreate) -> Contact:
        contact = Contact(**_clean_model_kwargs(Contact, data.model_dump()))
        db.add(contact)
        await db.flush()

        # Log activity
        activity = Activity(
            account_id=contact.account_id,
            contact_id=contact.id,
            type="contact_added",
            summary=f"Added contact {contact.name} ({contact.title or 'N/A'}).",
            source="user",
            metadata_json={"email": contact.email}
        )
        db.add(activity)
        await db.commit()
        await db.refresh(contact)
        return contact

    async def update_contact(
        self,
        db: AsyncSession,
        contact_id: str,
        data: ContactUpdate
    ) -> Optional[Contact]:
        contact = await self.get_contact(db, contact_id)
        if not contact:
            return None

        update_dict = _clean_model_kwargs(Contact, data.model_dump(exclude_unset=True))
        for key, value in update_dict.items():
            setattr(contact, key, value)
        contact.updated_at = utc_now()

        db.add(contact)
        await db.commit()
        await db.refresh(contact)
        return contact

    # ------------------------------------------------------------------
    # DEALS & STAGE PROGRESSION
    # ------------------------------------------------------------------
    async def list_deals(
        self,
        db: AsyncSession,
        account_id: Optional[str] = None,
        stage: Optional[str] = None
    ) -> List[Deal]:
        stmt = select(Deal)
        if account_id:
            stmt = stmt.where(Deal.account_id == account_id)
        if stage:
            stmt = stmt.where(Deal.stage == stage)
        stmt = stmt.order_by(desc(Deal.updated_at))
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def get_deal(self, db: AsyncSession, deal_id: str) -> Optional[Deal]:
        stmt = select(Deal).where(Deal.id == deal_id)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def create_deal(self, db: AsyncSession, data: DealCreate) -> Deal:
        deal = Deal(**_clean_model_kwargs(Deal, data.model_dump()))
        db.add(deal)
        await db.flush()

        activity = Activity(
            account_id=deal.account_id,
            type="deal_created",
            summary=f"Created deal '{deal.name}' at stage '{deal.stage}'.",
            source="user",
            metadata_json={"deal_name": deal.name, "stage": deal.stage}
        )
        db.add(activity)
        await db.commit()
        await db.refresh(deal)
        return deal

    async def update_deal(
        self,
        db: AsyncSession,
        deal_id: str,
        data: DealUpdate
    ) -> Optional[Deal]:
        deal = await self.get_deal(db, deal_id)
        if not deal:
            return None

        prev_stage = deal.stage
        raw_dict = data.model_dump(exclude_unset=True, exclude={"audit_reason"})
        update_dict = _clean_model_kwargs(Deal, raw_dict)

        for key, value in update_dict.items():
            setattr(deal, key, value)
        deal.updated_at = utc_now()

        db.add(deal)

        # Audit log if stage changed or reason provided
        new_stage = deal.stage
        if prev_stage != new_stage or data.audit_reason:
            if prev_stage != new_stage:
                reason = f"Stage changed from '{prev_stage}' to '{new_stage}'."
                if data.audit_reason:
                    reason += f" Reason: {data.audit_reason}"
            else:
                reason = data.audit_reason or f"Deal updated."

            activity = Activity(
                account_id=deal.account_id,
                type="stage_change" if prev_stage != new_stage else "deal_updated",
                summary=f"Deal '{deal.name}': {reason}",
                source="user",
                metadata_json={
                    "deal_id": deal.id,
                    "previous_stage": prev_stage,
                    "new_stage": new_stage,
                    "audit_reason": data.audit_reason
                }
            )
            db.add(activity)

        await db.commit()
        await db.refresh(deal)
        return deal

    # ------------------------------------------------------------------
    # ACTIVITIES / AUDIT TIMELINE
    # ------------------------------------------------------------------
    async def list_activities(
        self,
        db: AsyncSession,
        account_id: Optional[str] = None,
        limit: int = 100
    ) -> List[Activity]:
        stmt = select(Activity)
        if account_id:
            stmt = stmt.where(Activity.account_id == account_id)
        stmt = stmt.order_by(desc(Activity.created_at)).limit(limit)
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def create_activity(self, db: AsyncSession, data: ActivityCreate) -> Activity:
        activity = Activity(**_clean_model_kwargs(Activity, data.model_dump()))
        db.add(activity)
        await db.commit()
        await db.refresh(activity)
        return activity

    # ------------------------------------------------------------------
    # SEQUENCES & APPROVAL
    # ------------------------------------------------------------------
    async def get_sequence(self, db: AsyncSession, sequence_id: str) -> Optional[Sequence]:
        stmt = (
            select(Sequence)
            .where(Sequence.id == sequence_id)
            .options(selectinload(Sequence.steps))
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def update_sequence_step(
        self,
        db: AsyncSession,
        sequence_id: str,
        step_id: str,
        data: SequenceStepUpdate
    ) -> Optional[SequenceStep]:
        stmt = select(SequenceStep).where(
            SequenceStep.id == step_id,
            SequenceStep.sequence_id == sequence_id
        )
        result = await db.execute(stmt)
        step = result.scalar_one_or_none()
        if not step:
            return None

        update_dict = data.model_dump(exclude_unset=True)
        for key, value in update_dict.items():
            setattr(step, key, value)

        db.add(step)
        await db.commit()
        await db.refresh(step)
        return step

    async def approve_sequence(
        self,
        db: AsyncSession,
        sequence_id: str,
        notes: Optional[str] = None
    ) -> Optional[Sequence]:
        sequence = await self.get_sequence(db, sequence_id)
        if not sequence:
            return None

        sequence.status = "approved"
        sequence.approved_at = utc_now()
        for step in sequence.steps:
            step.status = "approved"
            db.add(step)

        db.add(sequence)

        # Audit activity - explicitly records approval state without claiming external sending
        summary_msg = f"Outreach sequence approved by user ({len(sequence.steps)} steps)."
        if notes:
            summary_msg += f" Note: {notes}"

        activity = Activity(
            account_id=sequence.account_id,
            type="sequence_approved",
            summary=summary_msg,
            source="user",
            metadata_json={
                "sequence_id": sequence.id,
                "steps_count": len(sequence.steps),
                "notes": notes
            }
        )
        db.add(activity)

        # Also update any prospecting deal to 'Outreach'
        deal_stmt = select(Deal).where(Deal.account_id == sequence.account_id)
        deal_res = await db.execute(deal_stmt)
        deals = deal_res.scalars().all()
        for deal in deals:
            if deal.stage == "Prospecting":
                deal.stage = "Outreach"
                deal.next_step = "Outreach sequence approved. Step 1 scheduled."
                deal.updated_at = utc_now()
                db.add(deal)

        await db.commit()
        await db.refresh(sequence)
        return sequence

    async def reject_sequence(
        self,
        db: AsyncSession,
        sequence_id: str,
        reason: Optional[str] = None
    ) -> Optional[Sequence]:
        sequence = await self.get_sequence(db, sequence_id)
        if not sequence:
            return None

        sequence.status = "rejected"
        for step in sequence.steps:
            step.status = "rejected"
            db.add(step)

        db.add(sequence)

        activity = Activity(
            account_id=sequence.account_id,
            type="sequence_rejected",
            summary=f"Sequence rejected. Reason: {reason or 'User requested revision'}",
            source="user",
            metadata_json={"sequence_id": sequence.id, "reason": reason}
        )
        db.add(activity)

        await db.commit()
        await db.refresh(sequence)
        return sequence

    # ------------------------------------------------------------------
    # HANDOFF TASKS
    # ------------------------------------------------------------------
    async def list_handoffs(
        self,
        db: AsyncSession,
        status: Optional[str] = None
    ) -> List[HandoffTask]:
        stmt = select(HandoffTask)
        if status:
            stmt = stmt.where(HandoffTask.status == status)
        stmt = stmt.order_by(desc(HandoffTask.created_at))
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def update_handoff(
        self,
        db: AsyncSession,
        task_id: str,
        data: HandoffTaskUpdate
    ) -> Optional[HandoffTask]:
        stmt = select(HandoffTask).where(HandoffTask.id == task_id)
        result = await db.execute(stmt)
        task = result.scalar_one_or_none()
        if not task:
            return None

        update_dict = data.model_dump(exclude_unset=True)
        for key, value in update_dict.items():
            setattr(task, key, value)
        task.updated_at = utc_now()

        db.add(task)
        await db.commit()
        await db.refresh(task)
        return task

    # ------------------------------------------------------------------
    # DEMO RESET & SEEDING
    # ------------------------------------------------------------------
    async def reset_database(self, db: AsyncSession, seed: bool = True) -> Dict[str, Any]:
        """
        Clears all records and seeds with default demo data for reproducible demos.
        """
        # Order matters for foreign key deletion
        await db.execute(delete(Activity))
        await db.execute(delete(SequenceStep))
        await db.execute(delete(Sequence))
        await db.execute(delete(HandoffTask))
        await db.execute(delete(Deal))
        await db.execute(delete(Contact))
        await db.execute(delete(Account))
        await db.commit()

        if not seed:
            return {"status": "reset", "message": "Database cleared successfully."}

        seeded_accounts = []
        for acc_data in SEED_DATA_ACCOUNTS:
            account = Account(
                company_name=acc_data["company_name"],
                domain=acc_data.get("domain"),
                industry=acc_data.get("industry"),
                summary=acc_data.get("summary"),
                source_notes=acc_data.get("source_notes"),
                brief=acc_data.get("brief")
            )
            db.add(account)
            await db.flush()

            # Contacts
            for c_data in acc_data.get("contacts", []):
                contact = Contact(
                    account_id=account.id,
                    name=c_data["name"],
                    title=c_data.get("title"),
                    email=c_data["email"],
                    linkedin_url=c_data.get("linkedin_url"),
                    source=c_data.get("source", "csv_import"),
                    status=c_data.get("status", "lead")
                )
                db.add(contact)
                await db.flush()

            # Deals
            for d_data in acc_data.get("deals", []):
                deal = Deal(
                    account_id=account.id,
                    name=d_data["name"],
                    stage=d_data.get("stage", "Prospecting"),
                    value=d_data.get("value"),
                    next_step=d_data.get("next_step"),
                    owner=d_data.get("owner", "Founder")
                )
                db.add(deal)

            # Sequences
            for s_data in acc_data.get("sequences", []):
                seq = Sequence(
                    account_id=account.id,
                    status=s_data.get("status", "pending"),
                    rationale=s_data.get("rationale")
                )
                if s_data.get("status") == "approved":
                    seq.approved_at = utc_now()
                db.add(seq)
                await db.flush()

                for step_data in s_data.get("steps", []):
                    step = SequenceStep(
                        sequence_id=seq.id,
                        step_number=step_data["step_number"],
                        channel=step_data.get("channel", "email"),
                        delay_days=step_data.get("delay_days", 0),
                        subject=step_data["subject"],
                        body=step_data["body"],
                        rationale=step_data.get("rationale"),
                        status=step_data.get("status", "draft")
                    )
                    db.add(step)

            # Activities
            for a_data in acc_data.get("activities", []):
                act = Activity(
                    account_id=account.id,
                    type=a_data["type"],
                    summary=a_data["summary"],
                    source=a_data.get("source", "system"),
                    metadata_json=a_data.get("metadata_json")
                )
                db.add(act)

            # Handoffs
            for h_data in acc_data.get("handoffs", []):
                hand = HandoffTask(
                    account_id=account.id,
                    title=h_data["title"],
                    reason=h_data["reason"],
                    status=h_data.get("status", "pending")
                )
                db.add(hand)

            seeded_accounts.append(account.company_name)

        await db.commit()
        return {
            "status": "reset_and_seeded",
            "message": f"Successfully initialized demo environment with {len(seeded_accounts)} accounts.",
            "seeded_accounts": seeded_accounts
        }


crm_service = CRMService()
