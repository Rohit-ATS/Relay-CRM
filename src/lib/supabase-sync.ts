import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient, subscribeRelayWorkspace } from "./supabase-realtime";
import { loadData, saveData, type RelayData } from "./crm-store";

type CloudStatus = { configured: boolean; connected: boolean; hasData?: boolean; email?: string; workspaceId?: string; message?: string };
let status: CloudStatus = { configured: false, connected: false };
let currentUser: User | null = null;
let currentWorkspaceId: string | null = null;
let cloudDataLoaded = false;
let syncQueue: Promise<void> = Promise.resolve();
let started = false;
let stopRealtime: (() => void) | null = null;

export function getCloudStatus(): CloudStatus { return status; }
function publish(next: CloudStatus) {
  status = next;
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("relay:cloud-status", { detail: next }));
}
function stableUuid(localId: string): string {
  const key = "relay-supabase-id-map-v1";
  let map: Record<string, string> = {};
  try { map = JSON.parse(localStorage.getItem(key) ?? "{}") as Record<string, string>; } catch { /* regenerate a clean local map */ }
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(localId)) return localId;
  if (!map[localId]) map[localId] = crypto.randomUUID();
  localStorage.setItem(key, JSON.stringify(map));
  return map[localId];
}
function normalizeIds(data: RelayData): RelayData {
  const accountIds = new Map(data.accounts.map((row) => [row.id, stableUuid(row.id)]));
  const contactIds = new Map(data.contacts.map((row) => [row.id, stableUuid(row.id)]));
  const sequenceIds = new Map(data.sequences.map((row) => [row.id, stableUuid(row.id)]));
  for (const row of data.accounts) row.id = accountIds.get(row.id)!;
  for (const row of data.contacts) { row.id = contactIds.get(row.id)!; row.accountId = accountIds.get(row.accountId) ?? stableUuid(row.accountId); }
  for (const row of data.deals) { row.id = stableUuid(row.id); row.accountId = accountIds.get(row.accountId) ?? stableUuid(row.accountId); }
  for (const row of data.activities) {
    row.id = stableUuid(row.id); row.accountId = accountIds.get(row.accountId) ?? stableUuid(row.accountId);
    if (row.contactId) row.contactId = contactIds.get(row.contactId) ?? stableUuid(row.contactId);
  }
  for (const row of data.sequences) {
    const oldId = row.id; row.id = sequenceIds.get(oldId)!; row.accountId = accountIds.get(row.accountId) ?? stableUuid(row.accountId);
    row.steps = row.steps.map((step) => ({ ...step, id: stableUuid(step.id), sequenceId: row.id }));
  }
  for (const row of data.handoffs) {
    row.id = stableUuid(row.id); row.accountId = accountIds.get(row.accountId) ?? stableUuid(row.accountId);
  }
  return data;
}
function owner<T extends Record<string, unknown>>(row: T, workspaceId: string, userId: string) {
  return { ...row, workspace_id: workspaceId, user_id: userId };
}
async function upsert(client: SupabaseClient, table: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const { error } = await client.from(table).upsert(rows, { onConflict: "id" });
  if (error) throw error;
}
async function prune(client: SupabaseClient, table: string, workspaceId: string, ids: string[]) {
  let query = client.from(table).delete().eq("workspace_id", workspaceId);
  if (ids.length) query = query.not("id", "in", `(${ids.join(",")})`);
  const { error } = await query;
  if (error) throw error;
}

async function writeWorkspaceData(data: RelayData) {
  const client = getSupabaseBrowserClient();
  if (!client || !currentUser || !currentWorkspaceId) return;
  normalizeIds(data);
  saveData(data,false);
  const w = currentWorkspaceId, u = currentUser.id;
  const accounts = data.accounts.map((a) => owner({ id:a.id, company_name:a.companyName, domain:a.domain ?? null, industry:null, summary:a.summary ?? null, facts:a.facts ?? [], source:{ type:"crm_record" }, created_at:a.createdAt, updated_at:a.updatedAt }, w, u));
  const contacts = data.contacts.map((c) => owner({ id:c.id, account_id:c.accountId, name:c.name, title:c.title ?? null, email:c.email ?? null, source:c.source ?? {}, created_at:c.auditHistory[0]?.at ?? new Date().toISOString(), updated_at:new Date().toISOString() }, w, u));
  const deals = data.deals.map((d) => owner({ id:d.id, account_id:d.accountId, name:d.name, stage:d.stage, value:d.value ?? null, next_step:d.nextStep ?? null, source:{ type:"crm_record" }, created_at:d.auditHistory[0]?.at ?? new Date().toISOString(), updated_at:new Date().toISOString() }, w, u));
  const activities = data.activities.map((a) => owner({ id:a.id, account_id:a.accountId, contact_id:a.contactId ?? null, type:a.type, summary:a.summary, source:a.source ?? {}, metadata:{}, created_at:a.createdAt }, w, u));
  const sequences = data.sequences.map((s) => owner({ id:s.id, account_id:s.accountId, contact_id:null, status:s.status === "approved" ? "approved" : s.status === "rejected" ? "rejected" : "awaiting_approval", rationale:s.rationale ?? null, source:{ type:"relay_sequence" }, created_at:s.createdAt, updated_at:new Date().toISOString(), approved_at:s.approvedAt ?? null }, w, u));
  const steps = data.sequences.flatMap((s) => s.steps.map((step, index) => owner({ id:step.id, sequence_id:s.id, step_number:index+1, channel:step.channel, delay_days:step.delayDays, subject:step.subject, body:step.body, rationale:"Prepared from supplied CRM context.", evidence:step.source ?? [] }, w, u)));
  const handoffs = data.handoffs.map((h) => owner({ id:h.id, account_id:h.accountId, contact_id:null, title:h.title, reason:h.reason, status:h.status === "done" ? "completed" : "open", source:{ type:"human_confirmed_interaction" }, due_at:h.dueAt ?? null, created_at:h.auditHistory[0]?.at ?? new Date().toISOString(), updated_at:new Date().toISOString() }, w, u));
  const approvals: Record<string,unknown>[] = [
    ...data.sequences.map((s) => owner({ id:stableUuid(`sequence-approval:${s.id}`), reviewer_id:s.status === "approved" ? u : null, target_type:"sequence", target_id:s.id, status:s.status === "approved" ? "approved" : s.status === "rejected" ? "rejected" : "pending", proposal:{ rationale:s.rationale ?? "", steps:s.steps }, evidence:s.steps.map((step) => step.source?.label ?? "CRM context"), decision_reason:s.status === "approved" ? "Human approved the plan; no message sent." : null, created_at:s.createdAt, updated_at:new Date().toISOString(), decided_at:s.approvedAt ?? null }, w, u)),
  ];
  for (const activity of data.activities.filter((item) => item.type === "interaction")) {
    const deal = data.deals.find((item) => item.accountId === activity.accountId);
    if (!deal) continue;
    approvals.push(owner({ id:stableUuid(`crm-update:${activity.id}`), reviewer_id:u, target_type:"crm_update", target_id:deal.id, status:"applied", proposal:{ deal_id:deal.id, stage:deal.stage, next_step:deal.nextStep, activity_id:activity.id }, evidence:[activity.summary], decision_reason:"Applied only after the user confirmed the proposed update.", created_at:activity.createdAt, updated_at:activity.createdAt, decided_at:activity.createdAt }, w, u));
  }
  await upsert(client,"accounts",accounts); await upsert(client,"contacts",contacts); await upsert(client,"deals",deals);
  await upsert(client,"activities",activities); await upsert(client,"sequences",sequences); await upsert(client,"sequence_steps",steps); await upsert(client,"approvals",approvals); await upsert(client,"handoff_tasks",handoffs);
  // Mirror explicit local removals (including Reset demo data) while keeping the workspace scoped by RLS.
  await prune(client,"sequence_steps",w,steps.map((x) => String(x.id)));
  await prune(client,"approvals",w,approvals.map((x) => String(x.id)));
  await prune(client,"activities",w,activities.map((x) => String(x.id)));
  await prune(client,"handoff_tasks",w,handoffs.map((x) => String(x.id)));
  await prune(client,"deals",w,deals.map((x) => String(x.id)));
  await prune(client,"contacts",w,contacts.map((x) => String(x.id)));
  await prune(client,"sequences",w,sequences.map((x) => String(x.id)));
  await prune(client,"accounts",w,accounts.map((x) => String(x.id)));

  // A successful PostgREST response confirms each request, but a read-back also
  // catches ownership/RLS or workspace-filter mismatches before claiming a sync.
  const persisted = await readWorkspaceData(client,w);
  const expected = { accounts:accounts.length, contacts:contacts.length, deals:deals.length, activities:activities.length, sequences:sequences.length, handoffs:handoffs.length };
  const actual = { accounts:persisted.accounts.length, contacts:persisted.contacts.length, deals:persisted.deals.length, activities:persisted.activities.length, sequences:persisted.sequences.length, handoffs:persisted.handoffs.length };
  const missing = Object.keys(expected).filter((key) => expected[key as keyof typeof expected] !== actual[key as keyof typeof actual]);
  if (missing.length) {
    const detail = missing.map((key) => `${key}: expected ${expected[key as keyof typeof expected]}, read ${actual[key as keyof typeof actual]}`).join(", ");
    throw new Error(`Supabase did not confirm all CRM records after sync (${detail}). Check the applied migration and workspace RLS policies.`);
  }
}

async function readWorkspaceData(client: SupabaseClient, workspaceId: string): Promise<RelayData> {
  const tables = ["accounts","contacts","deals","activities","sequences","sequence_steps","handoff_tasks"] as const;
  const results = await Promise.all(tables.map((table) => client.from(table).select("*").eq("workspace_id",workspaceId)));
  const failed = results.find((result) => result.error);
  if (failed?.error) throw failed.error;
  const [a,c,d,act,seq,steps,h] = results.map((result) => (result.data ?? []) as Record<string, any>[]);
  const sequenceSteps = new Map<string, RelayData["sequences"][number]["steps"]>();
  for (const step of [...steps].sort((left,right) => left.step_number-right.step_number)) {
    const list = sequenceSteps.get(step.sequence_id) ?? [];
    list.push({ id:step.id, sequenceId:step.sequence_id, channel:"email", delayDays:step.delay_days, subject:step.subject, body:step.body, status:"pending", source:{ type:"ai", label:"Saved sequence step" } });
    sequenceSteps.set(step.sequence_id,list);
  }
  return {
    accounts:a.map((row) => ({ id:row.id, workspaceId:row.workspace_id, userId:row.user_id, companyName:row.company_name, domain:row.domain ?? undefined, summary:row.summary ?? undefined, facts:row.facts ?? [], auditHistory:[], createdAt:row.created_at, updatedAt:row.updated_at })),
    contacts:c.map((row) => ({ id:row.id, accountId:row.account_id, name:row.name, title:row.title ?? undefined, email:row.email ?? undefined, source:row.source ?? undefined, auditHistory:[] })),
    deals:d.map((row) => ({ id:row.id, accountId:row.account_id, name:row.name, stage:row.stage, value:row.value == null ? undefined : Number(row.value), nextStep:row.next_step ?? undefined, auditHistory:[] })),
    activities:act.map((row) => ({ id:row.id, accountId:row.account_id, contactId:row.contact_id ?? undefined, type:row.type, summary:row.summary, source:row.source ?? undefined, createdAt:row.created_at, auditHistory:[] })),
    sequences:seq.map((row) => ({ id:row.id, accountId:row.account_id, status:row.status === "approved" ? "approved" : row.status === "rejected" ? "rejected" : "pending", rationale:row.rationale ?? undefined, steps:sequenceSteps.get(row.id) ?? [], auditHistory:[], createdAt:row.created_at, approvedAt:row.approved_at ?? undefined })),
    handoffs:h.map((row) => ({ id:row.id, accountId:row.account_id, title:row.title, reason:row.reason, status:row.status === "open" ? "open" : "done", dueAt:row.due_at ?? undefined, auditHistory:[] })),
  };
}

async function connectSession(user: User) {
  const client = getSupabaseBrowserClient();
  if (!client) return;
  try {
    const { data: membership, error } = await client.from("workspace_members").select("workspace_id").eq("user_id",user.id).limit(1).maybeSingle();
    if (error) throw error;
    if (!membership?.workspace_id) throw new Error("No Relay workspace is attached to this account. Create a new Supabase Auth user after applying the migration.");
    const workspaceId = membership.workspace_id as string;
    currentUser = user; currentWorkspaceId = workspaceId;
    const remote = await readWorkspaceData(client,workspaceId);
    cloudDataLoaded = remote.accounts.length > 0;
    if (cloudDataLoaded) saveData(remote,false);
    publish({ configured:true, connected:true, hasData:cloudDataLoaded, email:user.email ?? undefined, workspaceId, message:cloudDataLoaded ? "Supabase workspace connected; records sync live." : "Connected to an empty workspace. Initialize it from Settings to sync this browser's CRM records." });
    stopRealtime?.();
    stopRealtime = await subscribeRelayWorkspace(workspaceId, async () => {
      try { const latest = await readWorkspaceData(client,currentWorkspaceId!); cloudDataLoaded = latest.accounts.length > 0; saveData(latest,false); window.dispatchEvent(new CustomEvent("relay:cloud-data-updated")); }
      catch (error) { publish({ configured:true, connected:true, email:user.email, workspaceId:currentWorkspaceId!, message:error instanceof Error ? `Refresh failed: ${error.message}` : "Refresh failed." }); }
    }, (connection) => {
      if (connection === "subscribed") {
        void readWorkspaceData(client,workspaceId).then((latest) => { cloudDataLoaded = latest.accounts.length > 0; saveData(latest,false); window.dispatchEvent(new CustomEvent("relay:cloud-data-updated")); }).catch(() => undefined);
      }
      if (["channel_error","timed_out","closed"].includes(connection)) publish({ configured:true, connected:true, email:user.email, workspaceId:currentWorkspaceId!, message:`Realtime ${connection}; reconnecting when the client reconnects.` });
    });
    if (cloudDataLoaded) window.dispatchEvent(new CustomEvent("relay:cloud-data-updated"));
  } catch (error) {
    currentUser = null; currentWorkspaceId = null; cloudDataLoaded = false;
    publish({ configured:true, connected:false, email:user.email, message:error instanceof Error ? error.message : "Could not load the Supabase workspace." });
  }
}

export async function initializeSupabaseWorkspace(): Promise<void> {
  if (started) return;
  started = true;
  const client = getSupabaseBrowserClient();
  if (!client) { publish({ configured:false, connected:false, message:"Local demo mode; add Supabase URL and publishable key to the repo-root .env.local to connect." }); return; }
  publish({ configured:true, connected:false, message:"Sign in to connect your workspace." });
  window.addEventListener("relay:data-saved", (event) => {
    if (!currentUser || !currentWorkspaceId || !cloudDataLoaded) return;
    const snapshot = (event as CustomEvent<RelayData>).detail;
    syncQueue = syncQueue.then(() => writeWorkspaceData(snapshot)).then(() => {
      publish({ configured:true, connected:true, hasData:true, email:currentUser?.email ?? undefined, workspaceId:currentWorkspaceId ?? undefined, message:"Changes saved to Supabase." });
    }).catch((error) => publish({ configured:true, connected:true, hasData:true, email:currentUser?.email ?? undefined, workspaceId:currentWorkspaceId ?? undefined, message:error instanceof Error ? `Sync failed: ${error.message}` : "Sync failed." }));
  });
  client.auth.onAuthStateChange((_event,session) => {
    setTimeout(() => {
      if (session?.user) void connectSession(session.user);
      else { stopRealtime?.(); stopRealtime=null; currentUser=null; currentWorkspaceId=null; cloudDataLoaded=false; publish({ configured:true, connected:false, message:"Signed out; this browser is using local demo records." }); }
    },0);
  });
  const { data: { session }, error } = await client.auth.getSession();
  if (error) publish({ configured:true, connected:false, message:error.message });
  else if (session?.user) await connectSession(session.user);
}

export async function sendCloudMagicLink(email: string): Promise<void> {
  const client = getSupabaseBrowserClient();
  if (!client) throw new Error("Supabase is not configured. Add the browser URL and publishable key to .env.local.");
  const { error } = await client.auth.signInWithOtp({ email, options:{ emailRedirectTo:`${location.origin}/settings` } });
  if (error) throw error;
}
export async function startCloudAgentRun(agent: "lead_research" | "outreach_planner" | "crm_steward", accountId: string, input: Record<string, unknown>): Promise<string | undefined> {
  const client = getSupabaseBrowserClient();
  if (!client || !currentUser || !currentWorkspaceId || !cloudDataLoaded) return undefined;
  const id = crypto.randomUUID(), now = new Date().toISOString();
  const row = { id, workspace_id:currentWorkspaceId, user_id:currentUser.id, account_id:accountId, agent, status:"queued", input, created_at:now, updated_at:now };
  const { error } = await client.from("agent_runs").insert(row);
  if (error) { publish({ ...status, message:`Agent run could not be logged: ${error.message}` }); return undefined; }
  await client.from("agent_runs").update({ status:"running", updated_at:new Date().toISOString() }).eq("id",id);
  return id;
}
export async function finishCloudAgentRun(id: string | undefined, result: { status:"awaiting_approval" | "completed" | "failed"; output?: Record<string, unknown>; provider?: "gemini" | "demo_fixture"; error?: string }): Promise<void> {
  const client = getSupabaseBrowserClient();
  if (!client || !id) return;
  const { error } = await client.from("agent_runs").update({ ...result, updated_at:new Date().toISOString() }).eq("id",id);
  if (error) publish({ ...status, message:`Agent run status could not be saved: ${error.message}` });
}
export async function initializeCloudFromLocal(): Promise<void> {
  if (!currentUser || !currentWorkspaceId) throw new Error("Sign in to a Supabase workspace first.");
  await writeWorkspaceData(loadData());
  cloudDataLoaded = true;
  publish({ configured:true, connected:true, hasData:true, email:currentUser.email ?? undefined, workspaceId:currentWorkspaceId, message:"This browser's CRM records are now saved in Supabase." });
  window.dispatchEvent(new CustomEvent("relay:cloud-data-updated"));
}
export async function signOutCloud(): Promise<void> {
  const client = getSupabaseBrowserClient();
  if (!client) return;
  const { error } = await client.auth.signOut();
  if (error) throw error;
}
export async function flushCloudSync(): Promise<void> { await syncQueue; }
