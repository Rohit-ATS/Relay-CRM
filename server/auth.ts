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
  if (error || !data?.workspace_id) return null;
  return { userId: auth.user.id, workspaceId: data.workspace_id };
}
