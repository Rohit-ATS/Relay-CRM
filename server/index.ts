import { createServer } from "node:http";
import { loadEnv } from "vite";
import { generateSequence } from "./sequence";
import { runLeadResearch } from "./agents/lead-research";
import { runCRMSteward } from "./agents/crm-steward";
import { handleLinkedInIntegration } from "./linkedin-integration";
import { authenticatedWorkspace } from "./auth";
import { getGeminiApiKey } from "./agents/gemini";

// Vite loads .env.local for the frontend, but this standalone API server is a
// separate process. Load the same repo-root env files here without exposing
// their values to browser code or overriding variables already provided by
// the shell/deployment environment.
for (const [name, value] of Object.entries(loadEnv("development", process.cwd(), ""))) {
  if (process.env[name] === undefined) process.env[name] = value;
}

const port = Number(process.env.PORT ?? process.env.RELAY_SERVER_PORT ?? 8787);
const allowedOrigins = new Set((process.env.CORS_ORIGINS ?? "http://localhost:5173,http://127.0.0.1:5173,https://rohit-ats.github.io,https://relay-crm-5y4c.onrender.com")
  .split(",").map((origin) => origin.trim()).filter(Boolean));
async function readJson(request: AsyncIterable<Uint8Array>): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
function send(response: import("node:http").ServerResponse, status: number, payload: unknown) {
  response.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
  response.end(JSON.stringify(payload));
}

createServer(async (request, response) => {
  const origin = request.headers.origin;
  if (origin && allowedOrigins.has(origin)) {
    response.setHeader("access-control-allow-origin", origin);
    response.setHeader("vary", "Origin");
    response.setHeader("access-control-allow-methods", "GET, POST, OPTIONS");
    response.setHeader("access-control-allow-headers", "authorization, content-type");
    response.setHeader("access-control-max-age", "600");
  }
  if (request.method === "OPTIONS") { response.writeHead(204); response.end(); return; }
  const path = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`).pathname;
  if (path.startsWith("/api/integrations/linkedin")) {
    await handleLinkedInIntegration(request, response, path);
    return;
  }
  if (request.method === "GET" && path === "/api/integrations/status") {
    send(response, 200, {
      gemini: Boolean(getGeminiApiKey()),
      supabase: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY),
      persistence: "Supabase Auth + RLS required for persistent workspace routes",
    });
    return;
  }
  if (request.method !== "POST" || !["/api/sequence", "/api/agents/research", "/api/agents/steward"].includes(path)) {
    send(response, 404, { error: "Not found" });
    return;
  }
  try {
    const workspace = await authenticatedWorkspace(request);
    if (!workspace) { send(response, 401, { error: "No valid Relay Supabase session was received. Sign in again from Settings." }); return; }
    const body = await readJson(request);
    const result = path === "/api/sequence"
      ? await generateSequence(body)
      : path === "/api/agents/research"
        ? await runLeadResearch(body)
        : await runCRMSteward(body);
    send(response, 200, result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request";
    send(response, 400, { error: message });
  }
}).listen(port, () => console.log(`Relay API listening on http://localhost:${port}`));
