import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { generatedSequenceResultSchema, type GenerateSequencePayload, type GeneratedSequenceResult } from "../../src/shared/contracts";
import { generateValidated } from "./gemini";
import { OutreachOutputSchema } from "./contracts";

const prompt = await readFile(fileURLToPath(new URL("./prompts/outreach-planner.md", import.meta.url)), "utf8");
export async function runOutreachPlanner(input: GenerateSequencePayload, researchBrief?: string): Promise<GeneratedSequenceResult> {
  const result = await generateValidated(`${prompt}\n\nINPUT JSON:\n${JSON.stringify({ ...input, researchBrief: researchBrief ?? "No separate research brief; use only supplied account/contact context." })}`, OutreachOutputSchema);
  return generatedSequenceResultSchema.parse({
    mode: "gemini",
    brief: result.rationale,
    facts: [],
    assumptions: ["This is a draft only. A human must review it; no message has been sent."],
    steps: result.steps.map(({ evidenceUsed: _evidenceUsed, ...step }) => step),
  });
}
