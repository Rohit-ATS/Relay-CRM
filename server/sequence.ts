import {
  generatedSequenceResultSchema,
  generateSequencePayloadSchema,
  type GeneratedSequenceResult,
} from "../src/shared/contracts";
import { runOutreachPlanner } from "./agents/outreach-planner";
import { runLeadResearch } from "./agents/lead-research";

export async function generateSequence(input: unknown): Promise<GeneratedSequenceResult> {
  const payload = generateSequencePayloadSchema.parse(input);
  const research = await runLeadResearch({
    account: { companyName: payload.account.companyName, domain: payload.account.domain, notes: payload.notes },
    contact: { name: payload.contact.name, title: payload.contact.title, email: payload.contact.email, linkedinUrl: payload.contact.linkedinUrl },
  });
  const researchBrief = [research.output.summary, ...research.output.facts.map((fact) => `${fact.claim} (source: ${fact.sourceTitle} ${fact.sourceUrl})`), `Unknowns: ${research.output.unknowns.join("; ")}`, `Hypotheses (not facts): ${research.output.hypotheses.join("; ")}`, `LinkedIn activity evidence: ${research.output.linkedinActivityEvidence.map((item) => `${item.claim} (${item.observedAt}; ${item.sourceUrl})`).join("; ") || "No verified activity evidence found."}`, `Channel recommendation: ${research.output.channelRecommendation.channel}. ${research.output.channelRecommendation.reason}`].join("\n");
  const result = await runOutreachPlanner(payload, researchBrief);
  return generatedSequenceResultSchema.parse({
    ...result,
    facts: research.output.facts.map((fact) => ({
      key: "Research finding",
      value: fact.claim,
      source: { type: "external", label: fact.sourceTitle, url: fact.sourceUrl, observedAt: fact.observedAt, confidence: fact.confidence },
    })),
    assumptions: [...result.assumptions, ...research.output.hypotheses.map((hypothesis) => `Hypothesis: ${hypothesis}`)],
    channelRecommendation: {
      ...research.output.channelRecommendation,
      linkedinActivityEvidence: research.output.linkedinActivityEvidence,
    },
  });
}
