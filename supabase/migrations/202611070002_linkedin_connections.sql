-- LinkedIn OAuth tokens are encrypted by the Relay API and are server-only.
-- RLS is enabled without browser policies; only the server secret key can access rows.
create table if not exists public.linkedin_connections (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  member_id text,
  member_name text,
  scopes text[] not null default '{}',
  token_ciphertext text not null,
  token_iv text not null,
  token_auth_tag text not null,
  expires_at timestamptz not null,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.linkedin_connections enable row level security;
