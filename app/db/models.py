import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    String,
    Float,
    Integer,
    DateTime,
    ForeignKey,
    Text,
    JSON
)
from sqlalchemy.orm import relationship

from app.db.session import Base


def generate_uuid() -> str:
    return str(uuid.uuid4())


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Account(Base):
    __tablename__ = "accounts"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    company_name = Column(String(255), nullable=False, index=True)
    domain = Column(String(255), nullable=True, index=True)
    industry = Column(String(255), nullable=True)
    summary = Column(Text, nullable=True)
    source_notes = Column(Text, nullable=True)
    brief = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    contacts = relationship("Contact", back_populates="account", cascade="all, delete-orphan", lazy="selectin")
    deals = relationship("Deal", back_populates="account", cascade="all, delete-orphan", lazy="selectin")
    activities = relationship("Activity", back_populates="account", cascade="all, delete-orphan", lazy="selectin", order_by="desc(Activity.created_at)")
    sequences = relationship("Sequence", back_populates="account", cascade="all, delete-orphan", lazy="selectin", order_by="desc(Sequence.created_at)")
    handoffs = relationship("HandoffTask", back_populates="account", cascade="all, delete-orphan", lazy="selectin", order_by="desc(HandoffTask.created_at)")


class Contact(Base):
    __tablename__ = "contacts"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    account_id = Column(String(36), ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    title = Column(String(255), nullable=True)
    email = Column(String(255), nullable=False, index=True)
    linkedin_url = Column(String(500), nullable=True)
    source = Column(String(100), default="csv_import", nullable=False)
    status = Column(String(50), default="lead", nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    account = relationship("Account", back_populates="contacts")
    activities = relationship("Activity", back_populates="contact", cascade="all, delete-orphan")


class Deal(Base):
    __tablename__ = "deals"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    account_id = Column(String(36), ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    stage = Column(String(100), default="Prospecting", nullable=False, index=True)
    value = Column(Float, nullable=True)
    next_step = Column(String(500), nullable=True)
    owner = Column(String(100), default="Founder", nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    account = relationship("Account", back_populates="deals")


class Sequence(Base):
    __tablename__ = "sequences"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    account_id = Column(String(36), ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(String(50), default="pending", nullable=False)  # draft, pending, approved, rejected
    rationale = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    approved_at = Column(DateTime(timezone=True), nullable=True)

    account = relationship("Account", back_populates="sequences")
    steps = relationship("SequenceStep", back_populates="sequence", cascade="all, delete-orphan", lazy="selectin", order_by="SequenceStep.step_number")


class SequenceStep(Base):
    __tablename__ = "sequence_steps"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    sequence_id = Column(String(36), ForeignKey("sequences.id", ondelete="CASCADE"), nullable=False, index=True)
    step_number = Column(Integer, nullable=False)
    channel = Column(String(50), default="email", nullable=False)
    delay_days = Column(Integer, default=0, nullable=False)
    subject = Column(String(255), nullable=False)
    body = Column(Text, nullable=False)
    rationale = Column(Text, nullable=True)
    status = Column(String(50), default="draft", nullable=False)  # draft, scheduled, approved, sent

    sequence = relationship("Sequence", back_populates="steps")


class Activity(Base):
    __tablename__ = "activities"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    account_id = Column(String(36), ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False, index=True)
    contact_id = Column(String(36), ForeignKey("contacts.id", ondelete="SET NULL"), nullable=True)
    type = Column(String(100), nullable=False)  # import, brief_generated, sequence_generated, sequence_approved, sequence_rejected, inbound_interaction, stage_change, task_created, manual_note
    summary = Column(Text, nullable=False)
    source = Column(String(50), default="system", nullable=False)  # user, ai, system, csv
    metadata_json = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    account = relationship("Account", back_populates="activities")
    contact = relationship("Contact", back_populates="activities")


class HandoffTask(Base):
    __tablename__ = "handoff_tasks"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    account_id = Column(String(36), ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    reason = Column(Text, nullable=False)
    status = Column(String(50), default="pending", nullable=False)  # pending, completed, dismissed
    due_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    account = relationship("Account", back_populates="handoffs")
