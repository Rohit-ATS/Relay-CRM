-- Repair workspaces for Auth users created before the workspace trigger existed.
-- Existing workspace owners are also restored as members if that row is missing.
insert into public.workspaces (name, created_by)
select 'Relay Workspace', u.id
from auth.users u
where not exists (
  select 1 from public.workspace_members m where m.user_id = u.id
)
and not exists (
  select 1 from public.workspaces w where w.created_by = u.id
);

insert into public.workspace_members (workspace_id, user_id, role)
select w.id, w.created_by, 'owner'
from public.workspaces w
where not exists (
  select 1
  from public.workspace_members m
  where m.workspace_id = w.id and m.user_id = w.created_by
)
on conflict (workspace_id, user_id) do nothing;
