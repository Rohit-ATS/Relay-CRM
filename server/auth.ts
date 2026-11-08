import { createClient } from "@supabase/supabase-js";
import type { IncomingMessage } from "node:http";

export async function authenticatedWorkspace(request: IncomingMessage): Promise<{ userId: string; workspaceId: string } | null> {
  const token = request.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!token || !url || !key) return null;
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: auth, error: authError } = await client.auth.getUser(token);
  if (authError || !auth.user) return null;
  const { data, error } = await client.from("workspace_members").select("workspace_id").eq("user_id", auth.user.id).limit(1).maybeSingle();
  if (error) throw new Error(`Could not read this user's Relay workspace membership: ${error.message}. Check migrations 202611070001_relay_core.sql and 202611070004_grant_workspace_access.sql.`);
  if (!data?.workspace_id) throw new Error("This Supabase user has no Relay workspace membership. Apply migrations 202611070001_relay_core.sql and 202611070003_backfill_relay_workspaces.sql, then sign out and back in.");
  return { userId: auth.user.id, workspaceId: data.workspace_id };
}
