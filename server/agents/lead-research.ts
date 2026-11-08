import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { LeadResearchInputSchema, LeadResearchOutputSchema, type LeadResearchInput } from "./contracts";
import { generateGroundedValidated, type AgentResult, type GroundingSource } from "./gemini";

const prompt = await readFile(fileURLToPath(new URL("./prompts/lead-research.md", import.meta.url)), "utf8");
export async function runLeadResearch(input: unknown): Promise<AgentResult<ReturnType<typeof LeadResearchOutputSchema.parse>> & { sources: GroundingSource[] }> {
  const data: LeadResearchInput = LeadResearchInputSchema.parse(input);
  const grounded = await generateGroundedValidated(`${prompt}\n\nLEAD INPUT JSON:\n${JSON.stringify(data)}`, LeadResearchOutputSchema);
  return { provider: "gemini", output: grounded.output, sources: grounded.sources };
}
