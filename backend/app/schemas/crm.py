from datetime import datetime
from typing import List, Optional, Any, Dict
from pydantic import BaseModel, Field, ConfigDict, computed_field, model_validator


# --- Activity ---
class ActivityBase(BaseModel):
    account_id: Optional[str] = None
    accountId: Optional[str] = None
    contact_id: Optional[str] = None
    contactId: Optional[str] = None
    type: str = Field(..., description="Action type: import, sequence_generated, sequence_approved, inbound_interaction, stage_change, etc.")
    summary: str
    source: str = Field(default="system", description="user, ai, system, or csv")
    metadata_json: Optional[Dict[str, Any]] = None

    @model_validator(mode="before")
    @classmethod
    def reconcile_ids(cls, data: Any):
        if isinstance(data, dict):
            if "accountId" in data and not data.get("account_id"):
                data["account_id"] = data["accountId"]
            if "contactId" in data and not data.get("contact_id"):
                data["contact_id"] = data["contactId"]
        return data


class ActivityCreate(ActivityBase):
    pass


class ActivityRead(BaseModel):
    id: str
    account_id: str
    contact_id: Optional[str] = None
    type: str
    summary: str
    source: str
    metadata_json: Optional[Dict[str, Any]] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

    @computed_field
    @property
    def accountId(self) -> str:
        return self.account_id

    @computed_field
    @property
    def createdAt(self) -> str:
        return self.created_at.isoformat()


# --- Sequence Step ---
class SequenceStepBase(BaseModel):
    step_number: int = 1
    channel: str = "email"
    delay_days: int = 0
    delayDays: Optional[int] = None
    subject: str
    body: str
    rationale: Optional[str] = None
    status: str = "draft"

    @model_validator(mode="before")
    @classmethod
    def reconcile_delay(cls, data: Any):
        if isinstance(data, dict):
            if "delayDays" in data and "delay_days" not in data:
                data["delay_days"] = data["delayDays"]
        return data


class SequenceStepUpdate(BaseModel):
    step_number: Optional[int] = None
    subject: Optional[str] = None
    body: Optional[str] = None
    delay_days: Optional[int] = None
    delayDays: Optional[int] = None
    rationale: Optional[str] = None
    status: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def reconcile_delay(cls, data: Any):
        if isinstance(data, dict):
            if "delayDays" in data and not data.get("delay_days"):
                data["delay_days"] = data["delayDays"]
        return data


class SequenceStepRead(BaseModel):
    id: str
    sequence_id: str
    step_number: int
    channel: str
    delay_days: int
    subject: str
    body: str
    rationale: Optional[str] = None
    status: str
    model_config = ConfigDict(from_attributes=True)

    @computed_field
    @property
    def sequenceId(self) -> str:
        return self.sequence_id

    @computed_field
    @property
    def delayDays(self) -> int:
        return self.delay_days


# --- Sequence ---
class SequenceBase(BaseModel):
    account_id: Optional[str] = None
    accountId: Optional[str] = None
    status: str = "pending"
    rationale: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def reconcile_account_id(cls, data: Any):
        if isinstance(data, dict):
            if "accountId" in data and not data.get("account_id"):
                data["account_id"] = data["accountId"]
        return data


class SequenceCreate(SequenceBase):
    pass


class SequenceRead(BaseModel):
    id: str
    account_id: str
    status: str
    rationale: Optional[str] = None
    created_at: datetime
    approved_at: Optional[datetime] = None
    steps: List[SequenceStepRead] = []
    model_config = ConfigDict(from_attributes=True)

    @computed_field
    @property
    def accountId(self) -> str:
        return self.account_id

    @computed_field
    @property
    def createdAt(self) -> str:
        return self.created_at.isoformat()

    @computed_field
    @property
    def approvedAt(self) -> Optional[str]:
        return self.approved_at.isoformat() if self.approved_at else None


# --- Handoff Task ---
class HandoffTaskBase(BaseModel):
    account_id: Optional[str] = None
    accountId: Optional[str] = None
    title: str
    reason: str
    status: str = "pending"
    due_at: Optional[datetime] = None
    dueAt: Optional[datetime] = None

    @model_validator(mode="before")
    @classmethod
    def reconcile_fields(cls, data: Any):
        if isinstance(data, dict):
            if "accountId" in data and not data.get("account_id"):
                data["account_id"] = data["accountId"]
            if "dueAt" in data and not data.get("due_at"):
                data["due_at"] = data["dueAt"]
        return data


class HandoffTaskCreate(HandoffTaskBase):
    pass


class HandoffTaskUpdate(BaseModel):
    title: Optional[str] = None
    reason: Optional[str] = None
    status: Optional[str] = Field(None, description="pending, completed, dismissed, open, done")
    due_at: Optional[datetime] = None
    dueAt: Optional[datetime] = None

    @model_validator(mode="before")
    @classmethod
    def reconcile_status(cls, data: Any):
        if isinstance(data, dict):
            if data.get("status") == "done":
                data["status"] = "completed"
            elif data.get("status") == "open":
                data["status"] = "pending"
            if "dueAt" in data and not data.get("due_at"):
                data["due_at"] = data["dueAt"]
        return data


class HandoffTaskRead(BaseModel):
    id: str
    account_id: str
    title: str
    reason: str
    status: str
    due_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)

    @computed_field
    @property
    def accountId(self) -> str:
        return self.account_id

    @computed_field
    @property
    def dueAt(self) -> Optional[str]:
        return self.due_at.isoformat() if self.due_at else None

    @computed_field
    @property
    def createdAt(self) -> str:
        return self.created_at.isoformat()

    @computed_field
    @property
    def updatedAt(self) -> str:
        return self.updated_at.isoformat()


# --- Deal ---
class DealBase(BaseModel):
    account_id: Optional[str] = None
    accountId: Optional[str] = None
    name: str
    stage: str = "Prospecting"
    value: Optional[float] = None
    next_step: Optional[str] = None
    nextStep: Optional[str] = None
    owner: str = "Founder"

    @model_validator(mode="before")
    @classmethod
    def reconcile_fields(cls, data: Any):
        if isinstance(data, dict):
            if "accountId" in data and not data.get("account_id"):
                data["account_id"] = data["accountId"]
            if "nextStep" in data and not data.get("next_step"):
                data["next_step"] = data["nextStep"]
        return data


class DealCreate(DealBase):
    pass


class DealUpdate(BaseModel):
    name: Optional[str] = None
    stage: Optional[str] = None
    value: Optional[float] = None
    next_step: Optional[str] = None
    nextStep: Optional[str] = None
    owner: Optional[str] = None
    audit_reason: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def reconcile_fields(cls, data: Any):
        if isinstance(data, dict):
            if "nextStep" in data and not data.get("next_step"):
                data["next_step"] = data["nextStep"]
        return data


class DealRead(BaseModel):
    id: str
    account_id: str
    name: str
    stage: str
    value: Optional[float] = None
    next_step: Optional[str] = None
    owner: str
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)

    @computed_field
    @property
    def accountId(self) -> str:
        return self.account_id

    @computed_field
    @property
    def nextStep(self) -> Optional[str]:
        return self.next_step

    @computed_field
    @property
    def createdAt(self) -> str:
        return self.created_at.isoformat()

    @computed_field
    @property
    def updatedAt(self) -> str:
        return self.updated_at.isoformat()


# --- Contact ---
class ContactBase(BaseModel):
    account_id: Optional[str] = None
    accountId: Optional[str] = None
    name: str
    title: Optional[str] = None
    email: str
    linkedin_url: Optional[str] = None
    source: str = "csv_import"
    status: str = "lead"

    @model_validator(mode="before")
    @classmethod
    def reconcile_account_id(cls, data: Any):
        if isinstance(data, dict):
            if "accountId" in data and not data.get("account_id"):
                data["account_id"] = data["accountId"]
        return data


class ContactCreate(ContactBase):
    pass


class ContactUpdate(BaseModel):
    name: Optional[str] = None
    title: Optional[str] = None
    email: Optional[str] = None
    linkedin_url: Optional[str] = None
    status: Optional[str] = None


class ContactRead(BaseModel):
    id: str
    account_id: str
    name: str
    title: Optional[str] = None
    email: str
    linkedin_url: Optional[str] = None
    source: str
    status: str
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)

    @computed_field
    @property
    def accountId(self) -> str:
        return self.account_id

    @computed_field
    @property
    def createdAt(self) -> str:
        return self.created_at.isoformat()

    @computed_field
    @property
    def updatedAt(self) -> str:
        return self.updated_at.isoformat()


# --- Account ---
class AccountBase(BaseModel):
    company_name: Optional[str] = None
    companyName: Optional[str] = None
    domain: Optional[str] = None
    industry: Optional[str] = None
    summary: Optional[str] = None
    source_notes: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def reconcile_names(cls, data: Any):
        if isinstance(data, dict):
            if "companyName" in data and not data.get("company_name"):
                data["company_name"] = data["companyName"]
            elif "company_name" in data and not data.get("companyName"):
                data["companyName"] = data["company_name"]
        return data


class AccountCreate(AccountBase):
    @model_validator(mode="after")
    def validate_name(self):
        if not self.company_name and not self.companyName:
            raise ValueError("company_name or companyName is required")
        if not self.company_name:
            self.company_name = self.companyName
        return self


class AccountUpdate(BaseModel):
    company_name: Optional[str] = None
    companyName: Optional[str] = None
    domain: Optional[str] = None
    industry: Optional[str] = None
    summary: Optional[str] = None
    source_notes: Optional[str] = None
    brief: Optional[Dict[str, Any]] = None

    @model_validator(mode="before")
    @classmethod
    def reconcile_names(cls, data: Any):
        if isinstance(data, dict):
            if "companyName" in data and not data.get("company_name"):
                data["company_name"] = data["companyName"]
        return data


class AccountRead(BaseModel):
    id: str
    company_name: str
    domain: Optional[str] = None
    industry: Optional[str] = None
    summary: Optional[str] = None
    source_notes: Optional[str] = None
    brief: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)

    @computed_field
    @property
    def companyName(self) -> str:
        return self.company_name

    @computed_field
    @property
    def createdAt(self) -> str:
        return self.created_at.isoformat()

    @computed_field
    @property
    def updatedAt(self) -> str:
        return self.updated_at.isoformat()


class AccountDetailRead(AccountRead):
    contacts: List[ContactRead] = []
    deals: List[DealRead] = []
    activities: List[ActivityRead] = []
    sequences: List[SequenceRead] = []
    handoffs: List[HandoffTaskRead] = []
    model_config = ConfigDict(from_attributes=True)

    @computed_field
    @property
    def auditHistory(self) -> List[Dict[str, Any]]:
        return [
            {
                "id": a.id,
                "action": "created" if a.type in ["import", "account_created", "deal_created"] else "updated",
                "actor": a.source if a.source in ["user", "ai"] else "user",
                "at": a.created_at.isoformat(),
                "summary": a.summary
            }
            for a in self.activities
        ]
