import { z } from "zod";

// Shared by UI components and server routes. Zod schemas are the runtime boundary.

export const sourceTypeValues = ["user", "ai", "external"] as const;
export type SourceType = (typeof sourceTypeValues)[number];

export type SourceMetadata = {
  type: SourceType;
  label?: string;
  url?: string;
  confidence?: number;
};

export type SourcedFact = {
  key: string;
  value: string;
  source: SourceMetadata;
};

export const approvalStateValues = ["pending", "approved", "rejected"] as const;
export type ApprovalState = (typeof approvalStateValues)[number];

export const auditActionValues = ["created", "updated", "approved", "rejected"] as const;
export type AuditAction = (typeof auditActionValues)[number];

export type AuditEntry = {
  id: string;
  action: AuditAction;
  actor: "user" | "ai";
  at: string;
  summary?: string;
};

export type Account = {
  id: string;
  companyName: string;
  domain?: string;
  summary?: string;
  facts?: SourcedFact[];
  auditHistory: AuditEntry[];
  createdAt: string;
  updatedAt: string;
};

export type Contact = {
  id: string;
  accountId: string;
  name: string;
  title?: string;
  email?: string;
  source?: SourceMetadata;
  auditHistory: AuditEntry[];
};

export const dealStageValues = ["prospecting", "engaged", "won", "lost"] as const;
export type DealStage = (typeof dealStageValues)[number];

export type Deal = {
  id: string;
  accountId: string;
  name: string;
  stage: DealStage;
  value?: number;
  nextStep?: string;
  auditHistory: AuditEntry[];
};

export type Sequence = {
  id: string;
  accountId: string;
  status: ApprovalState;
  rationale?: string;
  steps: SequenceStep[];
  auditHistory: AuditEntry[];
  createdAt: string;
  approvedAt?: string;
};

export const sequenceChannelValues = ["email"] as const;
export type SequenceChannel = (typeof sequenceChannelValues)[number];

export type SequenceStep = {
  id: string;
  sequenceId: string;
  channel: SequenceChannel;
  delayDays: number;
  subject: string;
  body: string;
  status: ApprovalState;
  source?: SourceMetadata;
};

export const activityTypeValues = ["note", "sequence_approval", "interaction", "audit"] as const;
export type ActivityType = (typeof activityTypeValues)[number];

export type Activity = {
  id: string;
  accountId: string;
  contactId?: string;
  type: ActivityType;
  summary: string;
  source?: SourceMetadata;
  createdAt: string;
  auditHistory: AuditEntry[];
};

export const handoffStatusValues = ["open", "done"] as const;
export type HandoffStatus = (typeof handoffStatusValues)[number];

export type HandoffTask = {
  id: string;
  accountId: string;
  title: string;
  reason: string;
  status: HandoffStatus;
  dueAt?: string;
  auditHistory: AuditEntry[];
};

const sourceMetadataSchema = z.object({
  type: z.enum(sourceTypeValues),
  label: z.string().optional(),
  url: z.string().url().optional(),
  confidence: z.number().min(0).max(1).optional(),
});

const sourcedFactSchema = z.object({
  key: z.string().min(1),
  value: z.string(),
  source: sourceMetadataSchema,
});

const auditEntrySchema = z.object({
  id: z.string().min(1),
  action: z.enum(auditActionValues),
  actor: z.enum(["user", "ai"]),
  at: z.string().datetime(),
  summary: z.string().optional(),
});

export const accountSchema = z.object({
  id: z.string().min(1), companyName: z.string().min(1), domain: z.string().optional(),
  summary: z.string().optional(), facts: z.array(sourcedFactSchema).optional(),
  auditHistory: z.array(auditEntrySchema), createdAt: z.string().datetime(), updatedAt: z.string().datetime(),
});

export const contactSchema = z.object({
  id: z.string().min(1), accountId: z.string().min(1), name: z.string().min(1),
  title: z.string().optional(), email: z.string().email().optional(), source: sourceMetadataSchema.optional(),
  auditHistory: z.array(auditEntrySchema),
});

export const dealSchema = z.object({
  id: z.string().min(1), accountId: z.string().min(1), name: z.string().min(1),
  stage: z.enum(dealStageValues), value: z.number().optional(), nextStep: z.string().optional(),
  auditHistory: z.array(auditEntrySchema),
});

export const sequenceStepSchema = z.object({
  id: z.string().min(1), sequenceId: z.string().min(1), channel: z.enum(sequenceChannelValues),
  delayDays: z.number().int().nonnegative(), subject: z.string().min(1), body: z.string().min(1),
  status: z.enum(approvalStateValues), source: sourceMetadataSchema.optional(),
});

export const sequenceSchema = z.object({
  id: z.string().min(1), accountId: z.string().min(1), status: z.enum(approvalStateValues),
  rationale: z.string().optional(), steps: z.array(sequenceStepSchema), auditHistory: z.array(auditEntrySchema),
  createdAt: z.string().datetime(), approvedAt: z.string().datetime().optional(),
});

export const activitySchema = z.object({
  id: z.string().min(1), accountId: z.string().min(1), contactId: z.string().optional(),
  type: z.enum(activityTypeValues), summary: z.string().min(1), source: sourceMetadataSchema.optional(),
  createdAt: z.string().datetime(), auditHistory: z.array(auditEntrySchema),
});

export const handoffTaskSchema = z.object({
  id: z.string().min(1), accountId: z.string().min(1), title: z.string().min(1), reason: z.string().min(1),
  status: z.enum(handoffStatusValues), dueAt: z.string().datetime().optional(), auditHistory: z.array(auditEntrySchema),
});

// API request payloads: intentionally small and free of server-generated fields.
export type CreateAccountPayload = Pick<Account, "companyName"> & Partial<Pick<Account, "domain" | "summary" | "facts">>;
export type CreateContactPayload = Pick<Contact, "accountId" | "name"> & Partial<Pick<Contact, "title" | "email" | "source">>;
export type CreateDealPayload = Pick<Deal, "accountId" | "name" | "stage"> & Partial<Pick<Deal, "value" | "nextStep">>;
export type CreateSequencePayload = { accountId: string; contactId?: string; notes?: string };
export type ApproveSequencePayload = { sequenceId: string; approved: boolean };
export type CreateActivityPayload = Pick<Activity, "accountId" | "type" | "summary"> & Partial<Pick<Activity, "contactId" | "source">>;
export type CreateHandoffTaskPayload = Pick<HandoffTask, "accountId" | "title" | "reason"> & Partial<Pick<HandoffTask, "dueAt">>;

export const createAccountPayloadSchema = accountSchema.pick({ companyName: true, domain: true, summary: true, facts: true });
export const createContactPayloadSchema = contactSchema.pick({ accountId: true, name: true, title: true, email: true, source: true });
export const createDealPayloadSchema = dealSchema.pick({ accountId: true, name: true, stage: true, value: true, nextStep: true });
export const createSequencePayloadSchema = z.object({ accountId: z.string().min(1), contactId: z.string().min(1).optional(), notes: z.string().optional() });
export const approveSequencePayloadSchema = z.object({ sequenceId: z.string().min(1), approved: z.boolean() });
export const createActivityPayloadSchema = activitySchema.pick({ accountId: true, contactId: true, type: true, summary: true, source: true });
export const createHandoffTaskPayloadSchema = handoffTaskSchema.pick({ accountId: true, title: true, reason: true, dueAt: true });
