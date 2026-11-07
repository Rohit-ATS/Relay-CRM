import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

export type AgentResult<T> = { mode: "gemini" | "demo_fixture"; output: T; fallbackReason?: string };

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
