-- Table grants are separate from RLS policies. Keep access authenticated-only;
-- the existing workspace_member_access policies continue to scope CRM rows.
grant usage on schema public to authenticated, service_role;

grant select on public.workspaces, public.workspace_members to authenticated;

grant select, insert, update, delete
  on public.accounts, public.contacts, public.deals, public.activities,
     public.sequences, public.sequence_steps, public.agent_runs,
     public.approvals, public.handoff_tasks
  to authenticated;

-- OAuth tokens are only accessed by the server using the service role key.
grant select, insert, update, delete on public.linkedin_connections to service_role;
