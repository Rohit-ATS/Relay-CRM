import { createHmac, createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { IncomingMessage, ServerResponse } from "node:http";
import { z } from "zod";
import { getAuthenticatedSupabase } from "./supabase";

const SEARCH_SCHEMA = z.object({ vanityName: z.string().trim().min(1).max(100) });
const CALLBACK_COOKIE = "relay_linkedin_oauth_state";
type OAuthState = { userId: string; workspaceId: string; nonce: string; issuedAt: number };
type WorkspaceAuth = { userId: string; workspaceId: string };

function send(response: ServerResponse, status: number, payload: unknown) {
  response.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
  response.end(JSON.stringify(payload));
}
function redirect(response: ServerResponse, location: string, cookie = "") {
  response.writeHead(302, { location, "cache-control": "no-store", "set-cookie": cookie });
  response.end();
}
function appUrl(): string { return (process.env.RELAY_APP_URL ?? "http://localhost:5173").replace(/\/$/, ""); }
function callbackUri(): string { return process.env.LINKEDIN_REDIRECT_URI ?? ""; }
function getAdminClient() {
  const url = process.env.SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) throw new Error("Add SUPABASE_URL and the server-only SUPABASE_SECRET_KEY to enable secure LinkedIn token storage.");
  return createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
}
function tokenKey(): Buffer {
  const encoded = process.env.LINKEDIN_TOKEN_ENCRYPTION_KEY ?? "";
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32) throw new Error("LINKEDIN_TOKEN_ENCRYPTION_KEY must be a base64 encoded 32-byte key.");
  return key;
}
function encryptToken(token: string) {
  const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", tokenKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return { token_ciphertext: ciphertext.toString("base64"), token_iv: iv.toString("base64"), token_auth_tag: cipher.getAuthTag().toString("base64") };
}
function decryptToken(row: { token_ciphertext: string; token_iv: string; token_auth_tag: string }): string {
  const decipher = createDecipheriv("aes-256-gcm", tokenKey(), Buffer.from(row.token_iv, "base64"));
  decipher.setAuthTag(Buffer.from(row.token_auth_tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(row.token_ciphertext, "base64")), decipher.final()]).toString("utf8");
}
function signedState(state: OAuthState): string {
  const payload = Buffer.from(JSON.stringify(state)).toString("base64url");
  const secret = process.env.LINKEDIN_OAUTH_STATE_SECRET ?? "";
  if (secret.length < 32) throw new Error("Set LINKEDIN_OAUTH_STATE_SECRET to a random secret of at least 32 characters.");
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}
function readSignedState(value: string): OAuthState | null {
  try {
    const [payload, signature] = value.split(".");
    const secret = process.env.LINKEDIN_OAUTH_STATE_SECRET ?? "";
    if (!payload || !signature || secret.length < 32) return null;
    const expected = createHmac("sha256", secret).update(payload).digest();
    const actual = Buffer.from(signature, "base64url");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
    const state = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as OAuthState;
    if (!state.userId || !state.workspaceId || !state.nonce || Date.now() - state.issuedAt > 10 * 60_000) return null;
    return state;
  } catch { return null; }
}
function readCookie(request: IncomingMessage, name: string): string | undefined {
  const header = request.headers.cookie ?? "";
  return header.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1);
}
function stateCookie(value: string, secure: boolean, clear = false): string {
  return `${CALLBACK_COOKIE}=${clear ? "" : encodeURIComponent(value)}; HttpOnly; SameSite=Lax; Path=/api/integrations/linkedin/callback; Max-Age=${clear ? 0 : 600}${secure ? "; Secure" : ""}`;
}
async function getWorkspaceAuth(request: IncomingMessage): Promise<WorkspaceAuth | null> {
  const authorization = request.headers.authorization;
  if (!authorization) return null;
  const webRequest = new Request("http://relay.local/api/integrations/linkedin", { headers: { authorization } });
  const auth = await getAuthenticatedSupabase(webRequest);
  if (!auth) return null;
  const { data, error } = await auth.client.from("workspace_members").select("workspace_id").eq("user_id", auth.user.id).limit(1).maybeSingle();
  if (error || !data?.workspace_id) return null;
  return { userId: auth.user.id, workspaceId: data.workspace_id as string };
}
async function readBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
function missingIntegrationEnv(): string[] {
  return ["LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET", "LINKEDIN_REDIRECT_URI", "LINKEDIN_OAUTH_STATE_SECRET", "LINKEDIN_TOKEN_ENCRYPTION_KEY", "SUPABASE_URL", "SUPABASE_SECRET_KEY"]
    .filter((name) => !process.env[name]);
}
function integrationConfigured(): boolean {
  return missingIntegrationEnv().length === 0;
}
async function status(request: IncomingMessage, response: ServerResponse) {
  const auth = await getWorkspaceAuth(request);
  if (!auth) return send(response, 401, { error: "Sign in to your Relay workspace before connecting LinkedIn." });
  const missing = missingIntegrationEnv();
  if (missing.length) return send(response, 200, { configured: false, connected: false, missing, message: "Add these server-only settings to the repo-root .env.local and restart npm run server." });
  const { data, error } = await getAdminClient().from("linkedin_connections").select("member_name,member_id,scopes,expires_at,connected_at").eq("workspace_id", auth.workspaceId).maybeSingle();
  if (error) throw new Error(`Could not read LinkedIn connection: ${error.message}`);
  return send(response, 200, data ? { configured: true, connected: true, memberName: data.member_name, memberId: data.member_id, scopes: data.scopes, expiresAt: data.expires_at, connectedAt: data.connected_at } : { configured: true, connected: false, message: "LinkedIn is ready to connect for this Relay workspace." });
}
async function start(request: IncomingMessage, response: ServerResponse) {
  const auth = await getWorkspaceAuth(request);
  if (!auth) return send(response, 401, { error: "Sign in to your Relay workspace before connecting LinkedIn." });
  if (!integrationConfigured()) return send(response, 503, { error: "LinkedIn integration is not configured on the Relay API server." });
  const state = signedState({ ...auth, nonce: randomBytes(24).toString("base64url"), issuedAt: Date.now() });
  const scopes = (process.env.LINKEDIN_SCOPES ?? "openid profile email rw_organization_admin").split(/\s+/).filter(Boolean);
  const url = new URL("https://www.linkedin.com/oauth/v2/authorization");
  url.search = new URLSearchParams({ response_type: "code", client_id: process.env.LINKEDIN_CLIENT_ID!, redirect_uri: callbackUri(), state, scope: scopes.join(" ") }).toString();
  return sendWithCookie(response, 200, { authorizationUrl: url.toString() }, stateCookie(state, callbackUri().startsWith("https://")));
}
function sendWithCookie(response: ServerResponse, statusCode: number, payload: unknown, cookie: string) {
  response.writeHead(statusCode, { "content-type": "application/json", "cache-control": "no-store", "set-cookie": cookie });
  response.end(JSON.stringify(payload));
}
async function callback(request: IncomingMessage, response: ServerResponse, url: URL) {
  const clearCookie = stateCookie("", callbackUri().startsWith("https://"), true);
  const fail = (code: string) => redirect(response, `${appUrl()}/integrations?linkedin=error&reason=${encodeURIComponent(code)}`, clearCookie);
  if (url.searchParams.has("error")) return fail("authorization_denied");
  const code = url.searchParams.get("code"), stateValue = url.searchParams.get("state"), cookieValue = readCookie(request, CALLBACK_COOKIE);
  if (!code || !stateValue || !cookieValue || decodeURIComponent(cookieValue) !== stateValue) return fail("state_check_failed");
  const state = readSignedState(stateValue);
  if (!state) return fail("state_expired");
  if (!integrationConfigured()) return fail("server_not_configured");
  const tokenResponse = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: callbackUri(), client_id: process.env.LINKEDIN_CLIENT_ID!, client_secret: process.env.LINKEDIN_CLIENT_SECRET! }),
  });
  const tokenBody = await tokenResponse.json() as { access_token?: string; expires_in?: number; scope?: string; error?: string };
  if (!tokenResponse.ok || !tokenBody.access_token) return fail("token_exchange_failed");
  const profileResponse = await fetch("https://api.linkedin.com/v2/userinfo", { headers: { authorization: `Bearer ${tokenBody.access_token}` } });
  const profile = await profileResponse.json() as { sub?: string; name?: string; email?: string };
  if (!profileResponse.ok) return fail("profile_lookup_failed");
  const encrypted = encryptToken(tokenBody.access_token);
  const expiresIn = Math.max(60, Math.min(tokenBody.expires_in ?? 3600, 60 * 60 * 24 * 365));
  const { error } = await getAdminClient().from("linkedin_connections").upsert({
    workspace_id: state.workspaceId, user_id: state.userId, member_id: profile.sub ?? null, member_name: profile.name ?? profile.email ?? "LinkedIn member",
    scopes: tokenBody.scope?.split(/\s+/).filter(Boolean) ?? [], ...encrypted,
    expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(), connected_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }, { onConflict: "workspace_id" });
  if (error) return fail("token_storage_failed");
  return redirect(response, `${appUrl()}/integrations?linkedin=connected`, clearCookie);
}
async function disconnect(request: IncomingMessage, response: ServerResponse) {
  const auth = await getWorkspaceAuth(request);
  if (!auth) return send(response, 401, { error: "Sign in to your Relay workspace first." });
  const { error } = await getAdminClient().from("linkedin_connections").delete().eq("workspace_id", auth.workspaceId);
  if (error) throw new Error(`Could not disconnect LinkedIn: ${error.message}`);
  return send(response, 200, { disconnected: true });
}
async function lookupOrganization(request: IncomingMessage, response: ServerResponse) {
  const auth = await getWorkspaceAuth(request);
  if (!auth) return send(response, 401, { error: "Sign in to your Relay workspace first." });
  const parsed = SEARCH_SCHEMA.safeParse(await readBody(request));
  if (!parsed.success) return send(response, 400, { error: "Enter a LinkedIn company page vanity name, such as linkedin." });
  const { data, error } = await getAdminClient().from("linkedin_connections").select("token_ciphertext,token_iv,token_auth_tag,expires_at").eq("workspace_id", auth.workspaceId).maybeSingle();
  if (error) throw new Error(`Could not read LinkedIn connection: ${error.message}`);
  if (!data) return send(response, 409, { error: "Connect LinkedIn before looking up an organization." });
  if (new Date(data.expires_at).getTime() <= Date.now()) return send(response, 409, { error: "The LinkedIn authorization expired. Reconnect LinkedIn from Integrations." });
  const token = decryptToken(data);
  const version = process.env.LINKEDIN_API_VERSION ?? "202610";
  const url = new URL("https://api.linkedin.com/rest/organizations");
  url.searchParams.set("q", "vanityName"); url.searchParams.set("vanityName", parsed.data.vanityName);
  const upstream = await fetch(url, { headers: { authorization: `Bearer ${token}`, "linkedin-version": version, "x-restli-protocol-version": "2.0.0" } });
  const payload = await upstream.json() as unknown;
  if (!upstream.ok) return send(response, upstream.status, { error: "LinkedIn organization lookup failed. Check that your app has Community Management access and the granted scope includes rw_organization_admin.", details: payload });
  return send(response, 200, { source: "LinkedIn Community Management API", queriedAt: new Date().toISOString(), data: payload });
}

export async function handleLinkedInIntegration(request: IncomingMessage, response: ServerResponse, path: string) {
  try {
    const url = new URL(request.url ?? path, "http://relay.local");
    if (path === "/api/integrations/linkedin/callback" && request.method === "GET") return await callback(request, response, url);
    if (path === "/api/integrations/linkedin/status" && request.method === "GET") return await status(request, response);
    if (path === "/api/integrations/linkedin/start" && request.method === "POST") return await start(request, response);
    if (path === "/api/integrations/linkedin/organizations" && request.method === "POST") return await lookupOrganization(request, response);
    if (path === "/api/integrations/linkedin" && request.method === "DELETE") return await disconnect(request, response);
    return send(response, 405, { error: "Method not allowed" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "LinkedIn integration request failed.";
    return send(response, 500, { error: message });
  }
}
