import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { LeadResearchInputSchema, LeadResearchOutputSchema, type LeadResearchInput } from "./contracts";
import { generateValidated, type AgentResult } from "./gemini";

const prompt = await readFile(fileURLToPath(new URL("./prompts/lead-research.md", import.meta.url)), "utf8");
export async function runLeadResearch(input: unknown): Promise<AgentResult<ReturnType<typeof LeadResearchOutputSchema.parse>>> {
  const data: LeadResearchInput = LeadResearchInputSchema.parse(input);
  const facts = [
    { claim: `Company name: ${data.account.companyName}`, source: "Imported CRM account" },
    ...(data.account.domain ? [{ claim: `Domain: ${data.account.domain}`, source: "Imported CRM account" }] : []),
    ...(data.account.industry ? [{ claim: `Industry: ${data.account.industry}`, source: "Imported CRM account" }] : []),
    ...(data.account.notes ? [{ claim: `User notes: ${data.account.notes}`, source: "User-provided notes" }] : []),
  ];
  const fallback = LeadResearchOutputSchema.parse({ summary: `Research context for ${data.account.companyName} is limited to the supplied CRM record.`, facts, unknowns: ["Current priorities", "Buying timeline", "Existing vendor or process"], hypotheses: ["The contact may be relevant based on the supplied title; verify before outreach."] });
  try {
    const output = await generateValidated(`${prompt}\n\nINPUT JSON:\n${JSON.stringify(data)}`, LeadResearchOutputSchema);
    return { mode: "gemini", output };
  } catch (error) {
    return { mode: "demo_fixture", output: fallback, ...(process.env.GEMINI_API_KEY ? { fallbackReason: error instanceof Error ? error.message : "Gemini unavailable" } : {}) };
  }
}
