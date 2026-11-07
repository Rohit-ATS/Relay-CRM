-- Relay's persistent workspace schema. Apply with `supabase db push`.
-- All CRM reads/writes require an authenticated user who is a workspace member.
create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  company_name text not null,
  domain text,
  industry text,
  summary text,
  facts jsonb not null default '[]'::jsonb,
  source jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  account_id uuid not null references public.accounts(id) on delete cascade,
  name text not null,
  title text,
  email text,
  source jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.deals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  account_id uuid not null references public.accounts(id) on delete cascade,
  name text not null,
  stage text not null default 'prospecting',
  value numeric(14,2),
  next_step text,
  source jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  account_id uuid not null references public.accounts(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  type text not null,
  summary text not null,
  source jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.sequences (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  account_id uuid not null references public.accounts(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  status text not null default 'draft' check (status in ('draft','awaiting_approval','approved','rejected')),
  rationale text,
  source jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  approved_at timestamptz
);

create table if not exists public.sequence_steps (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  sequence_id uuid not null references public.sequences(id) on delete cascade,
  step_number integer not null check (step_number > 0),
  channel text not null default 'email' check (channel = 'email'),
  delay_days integer not null default 0 check (delay_days >= 0),
  subject text not null,
  body text not null,
  rationale text not null,
  evidence jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (sequence_id, step_number)
);

create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  account_id uuid references public.accounts(id) on delete set null,
  agent text not null check (agent in ('lead_research','outreach_planner','crm_steward','workflow_orchestrator')),
  status text not null default 'queued' check (status in ('queued','running','awaiting_approval','completed','failed')),
  provider text check (provider in ('gemini','demo_fixture')),
  input jsonb not null default '{}'::jsonb,
  output jsonb,
  error text,
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, idempotency_key)
);

create table if not exists public.approvals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  reviewer_id uuid references auth.users(id),
  target_type text not null check (target_type in ('sequence','crm_update')),
  target_id uuid not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected','applied')),
  proposal jsonb not null,
  evidence jsonb not null default '[]'::jsonb,
  decision_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  decided_at timestamptz
);

create table if not exists public.handoff_tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  account_id uuid not null references public.accounts(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  title text not null,
  reason text not null,
  status text not null default 'open' check (status in ('open','completed','dismissed')),
  source jsonb not null default '{}'::jsonb,
  due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists accounts_workspace_updated_idx on public.accounts(workspace_id, updated_at desc);
create index if not exists deals_workspace_stage_idx on public.deals(workspace_id, stage);
create index if not exists activities_workspace_created_idx on public.activities(workspace_id, created_at desc);
create index if not exists agent_runs_workspace_status_idx on public.agent_runs(workspace_id, status, created_at desc);
create index if not exists handoff_tasks_workspace_status_idx on public.handoff_tasks(workspace_id, status, created_at desc);

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.accounts enable row level security;
alter table public.contacts enable row level security;
alter table public.deals enable row level security;
alter table public.activities enable row level security;
alter table public.sequences enable row level security;
alter table public.sequence_steps enable row level security;
alter table public.agent_runs enable row level security;
alter table public.approvals enable row level security;
alter table public.handoff_tasks enable row level security;

drop policy if exists workspace_member_read on public.workspaces;
create policy workspace_member_read on public.workspaces for select to authenticated
  using (exists (select 1 from public.workspace_members m where m.workspace_id = id and m.user_id = auth.uid()));
drop policy if exists workspace_members_self_read on public.workspace_members;
create policy workspace_members_self_read on public.workspace_members for select to authenticated using (user_id = auth.uid());

-- Give each new Auth user a private workspace without allowing client-side membership escalation.
create or replace function public.relay_create_user_workspace()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare new_workspace_id uuid;
begin
  insert into public.workspaces (name, created_by)
  values ('Relay Workspace', new.id)
  returning id into new_workspace_id;
  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, new.id, 'owner');
  return new;
end;
$$;

drop trigger if exists relay_create_user_workspace on auth.users;
create trigger relay_create_user_workspace
  after insert on auth.users
  for each row execute procedure public.relay_create_user_workspace();

-- Workspace members can collaborate on CRM records; writes are attributed to the signed-in user.
do $$
declare table_name text;
begin
  foreach table_name in array array['accounts','contacts','deals','activities','sequences','sequence_steps','agent_runs','approvals','handoff_tasks'] loop
    execute format('drop policy if exists workspace_member_access on public.%I', table_name);
    execute format(
      'create policy workspace_member_access on public.%I for all to authenticated using (exists (select 1 from public.workspace_members m where m.workspace_id = %I.workspace_id and m.user_id = auth.uid())) with check (user_id = auth.uid() and exists (select 1 from public.workspace_members m where m.workspace_id = %I.workspace_id and m.user_id = auth.uid()))',
      table_name, table_name, table_name
    );
  end loop;
end $$;

-- Only authenticated workspace members may receive these changes through Realtime.
do $$
declare table_name text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach table_name in array array['agent_runs','activities','accounts','deals','handoff_tasks'] loop
      if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = table_name) then
        execute format('alter publication supabase_realtime add table public.%I', table_name);
      end if;
    end loop;
  end if;
end $$;
