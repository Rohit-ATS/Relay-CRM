import { z } from "zod";

export const LeadResearchInputSchema = z.object({
  account: z.object({ companyName: z.string().min(1), domain: z.string().optional(), industry: z.string().optional(), notes: z.string().optional() }),
  contact: z.object({ name: z.string().min(1), title: z.string().optional(), email: z.string().email().optional() }),
});
export const LeadResearchOutputSchema = z.object({
  summary: z.string().min(1),
  facts: z.array(z.object({ claim: z.string().min(1), source: z.string().min(1), observedAt: z.string().datetime().optional() })),
  unknowns: z.array(z.string()),
  hypotheses: z.array(z.string()),
});
export const OutreachInputSchema = z.object({ account: z.record(z.unknown()), contact: z.record(z.unknown()), research: LeadResearchOutputSchema, campaignGoal: z.string().min(1), tone: z.string().min(1) });
export const OutreachOutputSchema = z.object({
  rationale: z.string().min(1),
  steps: z.array(z.object({ delayDays: z.number().int().min(0).max(30), subject: z.string().min(1).max(160), body: z.string().min(1).max(4000), rationale: z.string().min(1), evidenceUsed: z.array(z.string()) })).length(3),
});
export const CRMStewardInputSchema = z.object({ account: z.record(z.unknown()), deal: z.record(z.unknown()), recentActivities: z.array(z.record(z.unknown())), interaction: z.object({ kind: z.enum(["prospect_reply", "call_note"]), text: z.string().min(3).max(4000) }) });
export const CRMStewardOutputSchema = z.object({
  proposedChanges: z.array(z.object({ field: z.string().min(1), currentValue: z.unknown().optional(), proposedValue: z.unknown(), evidence: z.string().min(1), reason: z.string().min(1) })),
  confidence: z.number().min(0).max(1),
  suggestedTask: z.object({ title: z.string().min(1), reason: z.string().min(1) }),
  recommendHandoff: z.boolean(),
  summary: z.string().min(1),
});
export type LeadResearchInput = z.infer<typeof LeadResearchInputSchema>;
export type CRMStewardInput = z.infer<typeof CRMStewardInputSchema>;
