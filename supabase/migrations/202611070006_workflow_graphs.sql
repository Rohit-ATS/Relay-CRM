create table if not exists public.workflows (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  name text not null default 'Lead outreach workflow',
  nodes jsonb not null default '[]'::jsonb,
  edges jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft','awaiting_approval','approved','running','paused','completed','failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, account_id)
);

alter table public.workflows enable row level security;
drop policy if exists workflow_workspace_access on public.workflows;
create policy workflow_workspace_access on public.workflows for all to authenticated
  using (exists (select 1 from public.workspace_members m where m.workspace_id = workflows.workspace_id and m.user_id = auth.uid()))
  with check (user_id = auth.uid() and exists (select 1 from public.workspace_members m where m.workspace_id = workflows.workspace_id and m.user_id = auth.uid()));
grant select, insert, update, delete on public.workflows to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'workflows') then
    alter publication supabase_realtime add table public.workflows;
  end if;
end $$;
