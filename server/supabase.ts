import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

export type AuthenticatedSupabase = { client: SupabaseClient; user: User };

/** Uses the caller's JWT and the publishable key, so every query remains subject to RLS. */
export async function getAuthenticatedSupabase(request: Request): Promise<AuthenticatedSupabase | null> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!url || !key || !token) return null;
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  return { client, user: data.user };
}
