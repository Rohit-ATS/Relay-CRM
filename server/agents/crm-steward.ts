import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { CRMStewardInputSchema, CRMStewardOutputSchema, type CRMStewardInput } from "./contracts";
import { generateValidated, type AgentResult } from "./gemini";

const prompt = await readFile(fileURLToPath(new URL("./prompts/crm-steward.md", import.meta.url)), "utf8");
export async function runCRMSteward(input: unknown): Promise<AgentResult<ReturnType<typeof CRMStewardOutputSchema.parse>>> {
  const data: CRMStewardInput = CRMStewardInputSchema.parse(input);
  const positive = /interested|schedule|demo|walkthrough|next week|pricing/i.test(data.interaction.text);
  const fallback = CRMStewardOutputSchema.parse({
    proposedChanges: positive ? [{ field: "stage", currentValue: data.deal.stage ?? "prospecting", proposedValue: "engaged", evidence: data.interaction.text.slice(0, 240), reason: "The supplied simulated interaction signals interest; confirm before applying." }] : [],
    confidence: positive ? 0.72 : 0.45,
    suggestedTask: { title: positive ? "Follow up on prospect interest" : "Review prospect interaction", reason: "Created from a simulated interaction and requires human review." },
    recommendHandoff: positive,
    summary: positive ? "The simulated interaction may indicate interest. Review the proposed stage change." : "No clear stage change was inferred. Review the interaction and decide on a follow-up.",
  });
  try {
    const output = await generateValidated(`${prompt}\n\nINPUT JSON:\n${JSON.stringify(data)}`, CRMStewardOutputSchema);
    return { mode: "gemini", output };
  } catch (error) {
    return { mode: "demo_fixture", output: fallback, ...(process.env.GEMINI_API_KEY ? { fallbackReason: error instanceof Error ? error.message : "Gemini unavailable" } : {}) };
  }
}
