import {
  generatedSequenceResultSchema,
  generateSequencePayloadSchema,
  type Account,
  type Contact,
  type GeneratedSequenceResult,
  type SourcedFact,
} from "../src/shared/contracts";

type ProviderOutput = unknown;

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

function providerText(output: ProviderOutput): string | undefined {
  if (!output || typeof output !== "object") return undefined;
  const candidate = output as { output?: unknown; text?: unknown; choices?: Array<{ message?: { content?: unknown } }> };
  if (typeof candidate.output === "string") return candidate.output;
  if (typeof candidate.text === "string") return candidate.text;
  const content = candidate.choices?.[0]?.message?.content;
  return typeof content === "string" ? content : undefined;
}

async function callProvider(account: Account, contact: Contact, notes?: string): Promise<GeneratedSequenceResult> {
  const apiKey = process.env.RELAY_AI_API_KEY;
  const apiUrl = process.env.RELAY_AI_API_URL;
  if (!apiKey || !apiUrl) throw new Error("RELAY_AI_API_KEY or RELAY_AI_API_URL is not configured");

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: process.env.RELAY_AI_MODEL ?? "relay-default",
      input: { account, contact, notes: notes ?? "" },
      instructions: "Return JSON only matching the requested Relay sequence result. Use only supplied account, contact, and notes. Never invent sourced facts. Return exactly 3 email steps with delayDays, subject, body, and rationale. Set mode to provider.",
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Provider returned HTTP ${response.status}`);
  const text = providerText(await response.json());
  if (!text) throw new Error("Provider response did not contain JSON text");
  const parsed = JSON.parse(text.replace(/^```json\s*|\s*```$/g, ""));
  return generatedSequenceResultSchema.parse({ ...parsed, mode: "provider" });
}

export async function generateSequence(input: unknown): Promise<GeneratedSequenceResult> {
  const payload = generateSequencePayloadSchema.parse(input);
  try {
    return await callProvider(payload.account, payload.contact, payload.notes);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "The configured provider failed";
    return demoFixture(payload.account, payload.contact, payload.notes, reason);
  }
}
