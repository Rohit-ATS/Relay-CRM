import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { CRMStewardInputSchema, CRMStewardOutputSchema, type CRMStewardInput } from "./contracts";
import { generateValidated, type AgentResult } from "./gemini";

const prompt = await readFile(fileURLToPath(new URL("./prompts/crm-steward.md", import.meta.url)), "utf8");
export async function runCRMSteward(input: unknown): Promise<AgentResult<ReturnType<typeof CRMStewardOutputSchema.parse>>> {
  const data: CRMStewardInput = CRMStewardInputSchema.parse(input);
  const output = await generateValidated(`${prompt}\n\nINPUT JSON:\n${JSON.stringify(data)}`, CRMStewardOutputSchema);
  return { provider: "gemini", output };
}
