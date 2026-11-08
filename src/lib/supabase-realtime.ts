import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null | undefined;
export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (browserClient !== undefined) return browserClient;
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    browserClient = null;
    return browserClient;
  }
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Supabase URL must use http or https.");
    browserClient = createClient(parsed.toString().replace(/\/$/, ""), key);
  } catch (error) {
    console.warn("Relay could not initialize Supabase:", error instanceof Error ? error.message : error);
    browserClient = null;
  }
  return browserClient;
}

export type RelayRealtimeTable = "agent_runs" | "activities" | "accounts" | "contacts" | "deals" | "sequences" | "sequence_steps" | "approvals" | "handoff_tasks" | "workflows";
export type RelayRealtimeEvent = { table: RelayRealtimeTable; eventType: string; record: Record<string, unknown> };

/** Subscribes only after Supabase Auth has an authenticated workspace member session. */
export async function subscribeRelayWorkspace(
  workspaceId: string,
  onChange: (event: RelayRealtimeEvent) => void,
  onStatus?: (status: string) => void,
): Promise<(() => void) | null> {
  const client = getSupabaseBrowserClient();
  if (!client) { onStatus?.("not_configured"); return null; }
  const { data: { session } } = await client.auth.getSession();
  if (!session) { onStatus?.("authentication_required"); return null; }
  const tables: RelayRealtimeTable[] = ["agent_runs", "activities", "accounts", "contacts", "deals", "sequences", "sequence_steps", "approvals", "handoff_tasks", "workflows"];
  let channel: RealtimeChannel = client.channel(`relay:${workspaceId}`);
  for (const table of tables) {
    channel = channel.on("postgres_changes", {
      event: "*", schema: "public", table, filter: `workspace_id=eq.${workspaceId}`,
    }, (payload) => {
      const record = (payload.new && Object.keys(payload.new).length ? payload.new : payload.old) as Record<string, unknown>;
      onChange({ table, eventType: payload.eventType, record });
    });
  }
  channel.subscribe((status) => onStatus?.(status.toLowerCase()));
  return () => { void client.removeChannel(channel); };
}
