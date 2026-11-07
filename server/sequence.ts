import {
  generatedSequenceResultSchema,
  generateSequencePayloadSchema,
  type Account,
  type Contact,
  type GeneratedSequenceResult,
  type SourcedFact,
} from "../src/shared/contracts";
import { runOutreachPlanner } from "./agents/outreach-planner";

function fact(key: string, value: string, label: string): SourcedFact {
  return { key, value, source: { type: "user", label, confidence: 1 } };
}

export function demoFixture(account: Account, contact: Contact, notes?: string, fallbackReason?: string): GeneratedSequenceResult {
  const accountLabel = `supplied account record${account.domain ? ` (${account.domain})` : ""}`;
  const contactLabel = "supplied contact record";
  const facts: SourcedFact[] = [fact("company_name", account.companyName, accountLabel), fact("contact_name", contact.name, contactLabel)];
  if (account.domain) facts.push(fact("domain", account.domain, accountLabel));
  if (contact.title) facts.push(fact("contact_title", contact.title, contactLabel));
  if (notes?.trim()) facts.push(fact("supplied_notes", notes.trim(), "supplied notes"));

  const result: GeneratedSequenceResult = {
    mode: "demo_fixture",
    brief: `A short, email-first introduction for ${contact.name} at ${account.companyName}, using only the supplied CRM context.`,
    facts,
    assumptions: ["The recipient is relevant to the supplied CRM context.", "The recipient has not opted out of outreach.", "A human will review and approve each draft before any external action."],
    steps: [
      { delayDays: 0, subject: `A quick question for ${account.companyName}`, body: `Hi ${contact.name.split(" ")[0]},\n\nI’m reaching out because ${account.companyName} is in our CRM as a potential fit. Would a short conversation about your current workflow be useful?\n\nBest,`, rationale: "Start with a concise permission-based question." },
      { delayDays: 3, subject: "Following up with a little context", body: `Hi ${contact.name.split(" ")[0]},\n\nFollowing up in case this is relevant. I’d be glad to compare notes on the workflow described in the supplied context and learn what you are prioritizing.\n\nBest,`, rationale: "Add context without asserting an unverified business fact." },
      { delayDays: 7, subject: "Should I close the loop?", body: `Hi ${contact.name.split(" ")[0]},\n\nI haven’t heard back, so I’ll close the loop for now. If this is worth exploring, reply with a better time or point me to the right person.\n\nBest,`, rationale: "Offer a low-pressure close and a clear handoff path." },
    ],
    ...(fallbackReason ? { fallbackReason } : {}),
  };
  return generatedSequenceResultSchema.parse(result);
}

export async function generateSequence(input: unknown): Promise<GeneratedSequenceResult> {
  const payload = generateSequencePayloadSchema.parse(input);
  try {
    return await runOutreachPlanner(payload);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Gemini request failed";
    return demoFixture(payload.account, payload.contact, payload.notes, process.env.GEMINI_API_KEY ? reason : undefined);
  }
}
