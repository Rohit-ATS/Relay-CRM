from typing import List, Optional, Literal
from pydantic import BaseModel, Field
from app.schemas.crm import SequenceStepRead


class FactItem(BaseModel):
    claim: str
    source_type: Literal["user-provided", "source-linked", "inference"] = Field(
        ...,
        description="Every fact must be strictly labeled as user-provided, source-linked, or inference"
    )
    confidence: float = Field(default=1.0, ge=0.0, le=1.0)


class AccountBrief(BaseModel):
    summary: str
    facts: List[FactItem] = []
    pain_points: List[str] = []
    talking_points: List[str] = []


class BriefGenerateRequest(BaseModel):
    account_id: str
    custom_instructions: Optional[str] = None


class SequenceStepGenerated(BaseModel):
    step_number: int
    delay_days: int
    subject: str
    body: str
    rationale: str


class SequenceGenerated(BaseModel):
    rationale: str
    steps: List[SequenceStepGenerated]


class SequenceGenerateRequest(BaseModel):
    account_id: str
    contact_id: Optional[str] = None
    custom_angle: Optional[str] = None


class SequenceApprovalRequest(BaseModel):
    notes: Optional[str] = None


class SequenceRejectRequest(BaseModel):
    reason: Optional[str] = None


class ProposedUpdate(BaseModel):
    current_stage: str
    proposed_stage: str
    confidence: float = Field(default=0.9, ge=0.0, le=1.0)
    reasoning: str
    evidence_quote: str
    recommended_task_title: str
    recommended_task_reason: str


class InteractionAnalysisRequest(BaseModel):
    account_id: str
    contact_id: Optional[str] = None
    channel: str = Field(default="email_reply", description="email_reply, call_transcript, meeting_note")
    content: str = Field(..., description="Simulated prospect reply, inbound email, or pasted call transcript")
    apply_immediately: bool = Field(default=False, description="If true, directly updates Deal and generates task without a separate confirmation step")


class InteractionAnalysisResponse(BaseModel):
    sentiment: str = Field(..., description="positive, neutral, negative, questioning, interested")
    intent: str = Field(..., description="request_demo, objection, unsubscribe, question, warm_followup")
    proposed_update: ProposedUpdate
    applied: bool = False
    activity_id: Optional[str] = None
    task_id: Optional[str] = None


class InteractionConfirmRequest(BaseModel):
    account_id: str
    contact_id: Optional[str] = None
    channel: str = "email_reply"
    content: str
    confirmed_stage: str
    task_title: str
    task_reason: str
    notes: Optional[str] = None
