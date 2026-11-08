import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

export type AgentResult<T> = { provider: "gemini"; output: T };

export type GroundingSource = { title: string; url: string; domain?: string };

export async function generateValidated<T>(prompt: string, schema: z.ZodType<T>): Promise<T> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL ?? "gemini-3.8-flash",
    contents: prompt,
    config: { responseMimeType: "application/json", temperature: 0.2 },
  });
  if (!response.text) throw new Error("Gemini returned an empty response");
  let parsed: unknown;
  try { parsed = JSON.parse(response.text); }
  catch { throw new Error("Gemini returned invalid JSON"); }
  return schema.parse(parsed);
}

export async function generateGroundedValidated<T>(prompt: string, schema: z.ZodType<T>): Promise<{ output: T; sources: GroundingSource[] }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured on the Relay server. Add it to the repo-root .env.local and restart npm run server.");
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL ?? "gemini-3.8-flash",
    contents: prompt,
    config: { tools: [{ googleSearch: {} }], temperature: 0.2 },
  });
  if (!response.text) throw new Error("Google Search grounded research returned no analysis.");
  const sources = (response.candidates ?? []).flatMap((candidate) => candidate.groundingMetadata?.groundingChunks ?? [])
    .flatMap((chunk) => chunk.web?.uri ? [{ title: chunk.web.title ?? chunk.web.uri, url: chunk.web.uri, domain: chunk.web.domain }] : [])
    .filter((source, index, all) => all.findIndex((candidate) => candidate.url === source.url) === index);
  if (!sources.length) throw new Error("Gemini did not return verifiable Google Search sources for this lead. No research brief was saved.");
  const output = await generateValidated(`${prompt}\n\nGROUNDED RESEARCH TO STRUCTURE:\n${response.text}\n\nVERIFIED SEARCH SOURCE LIST (use only these source URLs):\n${JSON.stringify(sources)}`, schema);
  return { output, sources };
}
