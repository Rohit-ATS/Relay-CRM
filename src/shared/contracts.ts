import { z } from "zod";

// Shared by UI components and server routes. Zod schemas are the runtime boundary.

export const sourceTypeValues = ["user", "ai", "external"] as const;
export type SourceType = (typeof sourceTypeValues)[number];

export type SourceMetadata = {
  type: SourceType;
  label?: string;
  url?: string;
  confidence?: number;
  observedAt?: string;
};

/** Workspace ownership is filled from the authenticated Supabase session. */
export type WorkspaceOwnership = { workspaceId?: string; userId?: string };

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

export type Account = WorkspaceOwnership & {
  id: string;
  companyName: string;
  domain?: string;
  summary?: string;
  facts?: SourcedFact[];
  auditHistory: AuditEntry[];
  createdAt: string;
  updatedAt: string;
};

export type Contact = WorkspaceOwnership & {
  id: string;
  accountId: string;
  name: string;
  title?: string;
  email?: string;
  linkedinUrl?: string;
  source?: SourceMetadata;
  auditHistory: AuditEntry[];
};

export const dealStageValues = ["prospecting", "engaged", "won", "lost"] as const;
export type DealStage = (typeof dealStageValues)[number];

export type Deal = WorkspaceOwnership & {
  id: string;
  accountId: string;
  name: string;
  stage: DealStage;
  value?: number;
  nextStep?: string;
  auditHistory: AuditEntry[];
};

export type Sequence = WorkspaceOwnership & {
  id: string;
  accountId: string;
  status: ApprovalState;
  rationale?: string;
  steps: SequenceStep[];
  auditHistory: AuditEntry[];
  createdAt: string;
  approvedAt?: string;
};

export const sequenceChannelValues = ["email", "linkedin_manual", "manual_review"] as const;
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

export type Activity = WorkspaceOwnership & {
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

export type HandoffTask = WorkspaceOwnership & {
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
  observedAt: z.string().datetime().optional(),
});

const ownershipSchema = z.object({
  workspaceId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
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

export const accountSchema = ownershipSchema.extend({
  id: z.string().min(1), companyName: z.string().min(1), domain: z.string().optional(),
  summary: z.string().optional(), facts: z.array(sourcedFactSchema).optional(),
  auditHistory: z.array(auditEntrySchema), createdAt: z.string().datetime(), updatedAt: z.string().datetime(),
});

export const contactSchema = ownershipSchema.extend({
  id: z.string().min(1), accountId: z.string().min(1), name: z.string().min(1),
  title: z.string().optional(), email: z.string().email().optional(), linkedinUrl: z.string().url().optional(), source: sourceMetadataSchema.optional(),
  auditHistory: z.array(auditEntrySchema),
});

export const dealSchema = ownershipSchema.extend({
  id: z.string().min(1), accountId: z.string().min(1), name: z.string().min(1),
  stage: z.enum(dealStageValues), value: z.number().optional(), nextStep: z.string().optional(),
  auditHistory: z.array(auditEntrySchema),
});

export const sequenceStepSchema = z.object({
  id: z.string().min(1), sequenceId: z.string().min(1), channel: z.enum(sequenceChannelValues),
  delayDays: z.number().int().nonnegative(), subject: z.string().min(1), body: z.string().min(1),
  status: z.enum(approvalStateValues), source: sourceMetadataSchema.optional(),
});

export const sequenceSchema = ownershipSchema.extend({
  id: z.string().min(1), accountId: z.string().min(1), status: z.enum(approvalStateValues),
  rationale: z.string().optional(), steps: z.array(sequenceStepSchema), auditHistory: z.array(auditEntrySchema),
  createdAt: z.string().datetime(), approvedAt: z.string().datetime().optional(),
});

export const activitySchema = ownershipSchema.extend({
  id: z.string().min(1), accountId: z.string().min(1), contactId: z.string().optional(),
  type: z.enum(activityTypeValues), summary: z.string().min(1), source: sourceMetadataSchema.optional(),
  createdAt: z.string().datetime(), auditHistory: z.array(auditEntrySchema),
});

export const handoffTaskSchema = ownershipSchema.extend({
  id: z.string().min(1), accountId: z.string().min(1), title: z.string().min(1), reason: z.string().min(1),
  status: z.enum(handoffStatusValues), dueAt: z.string().datetime().optional(), auditHistory: z.array(auditEntrySchema),
});

export const agentNameValues = ["lead_research", "outreach_planner", "crm_steward", "workflow_orchestrator"] as const;
export const agentRunStatusValues = ["queued", "running", "awaiting_approval", "completed", "failed"] as const;
export const agentRunSchema = ownershipSchema.extend({
  id: z.string().uuid(),
  agent: z.enum(agentNameValues),
  status: z.enum(agentRunStatusValues),
  input: z.record(z.unknown()),
  output: z.record(z.unknown()).optional(),
  provider: z.enum(["gemini"]).optional(),
  error: z.string().max(1000).optional(),
  accountId: z.string().uuid().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type AgentRun = z.infer<typeof agentRunSchema>;

export const approvalTargetValues = ["sequence", "crm_update"] as const;
export const approvalStatusValues = ["pending", "approved", "rejected", "applied"] as const;
export const approvalSchema = ownershipSchema.extend({
  id: z.string().uuid(),
  targetType: z.enum(approvalTargetValues),
  targetId: z.string().uuid(),
  status: z.enum(approvalStatusValues),
  proposal: z.record(z.unknown()),
  evidence: z.array(z.string()),
  reviewerId: z.string().uuid().optional(),
  decidedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Approval = z.infer<typeof approvalSchema>;

// API request payloads: intentionally small and free of server-generated fields.
export type CreateAccountPayload = Pick<Account, "companyName"> & Partial<Pick<Account, "domain" | "summary" | "facts">>;
export type CreateContactPayload = Pick<Contact, "accountId" | "name"> & Partial<Pick<Contact, "title" | "email" | "source">>;
export type CreateDealPayload = Pick<Deal, "accountId" | "name" | "stage"> & Partial<Pick<Deal, "value" | "nextStep">>;
export type CreateSequencePayload = { accountId: string; contactId?: string; notes?: string };
export type ApproveSequencePayload = { sequenceId: string; approved: boolean };
export type CreateActivityPayload = Pick<Activity, "accountId" | "type" | "summary"> & Partial<Pick<Activity, "contactId" | "source">>;
export type CreateHandoffTaskPayload = Pick<HandoffTask, "accountId" | "title" | "reason"> & Partial<Pick<HandoffTask, "dueAt">>;

export const createAccountPayloadSchema = accountSchema.pick({ companyName: true, domain: true, summary: true, facts: true });
export const createContactPayloadSchema = contactSchema.pick({ accountId: true, name: true, title: true, email: true, linkedinUrl: true, source: true });
export const createDealPayloadSchema = dealSchema.pick({ accountId: true, name: true, stage: true, value: true, nextStep: true });
export const createSequencePayloadSchema = z.object({ accountId: z.string().min(1), contactId: z.string().min(1).optional(), notes: z.string().optional() });
export const approveSequencePayloadSchema = z.object({ sequenceId: z.string().min(1), approved: z.boolean() });
export const createActivityPayloadSchema = activitySchema.pick({ accountId: true, contactId: true, type: true, summary: true, source: true });
export const createHandoffTaskPayloadSchema = handoffTaskSchema.pick({ accountId: true, title: true, reason: true, dueAt: true });

// Server-only AI workflow contracts. These describe a proposal, not a persisted sequence.
export type GenerateSequencePayload = {
  account: Account;
  contact: Contact;
  notes?: string;
};

export type GeneratedOutreachStep = {
  channel: SequenceChannel;
  delayDays: number;
  subject: string;
  body: string;
  rationale: string;
};

export type GeneratedSequenceResult = {
  mode: "gemini";
  brief: string;
  facts: SourcedFact[];
  assumptions: string[];
  steps: GeneratedOutreachStep[];
  channelRecommendation: { channel: "email" | "linkedin" | "manual_review"; reason: string; linkedinActivityEvidence: { claim: string; sourceUrl: string; observedAt: string }[] };
};

export const generateSequencePayloadSchema = z.object({
  account: accountSchema,
  contact: contactSchema,
  notes: z.string().max(4000).optional(),
});

const generatedOutreachStepSchema = z.object({
  channel: z.enum(sequenceChannelValues),
  delayDays: z.number().int().nonnegative(),
  subject: z.string().min(1),
  body: z.string().min(1),
  rationale: z.string().min(1),
});

export const generatedSequenceResultSchema = z.object({
  mode: z.literal("gemini"),
  brief: z.string().min(1),
  facts: z.array(sourcedFactSchema),
  assumptions: z.array(z.string()),
  steps: z.array(generatedOutreachStepSchema).length(3),
  channelRecommendation: z.object({ channel: z.enum(["email","linkedin","manual_review"]), reason: z.string(), linkedinActivityEvidence: z.array(z.object({ claim: z.string(), sourceUrl: z.string().url(), observedAt:z.string().datetime() })) }),
});
