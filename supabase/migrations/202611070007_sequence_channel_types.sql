alter table public.sequence_steps drop constraint if exists sequence_steps_channel_check;
alter table public.sequence_steps add constraint sequence_steps_channel_check
  check (channel in ('email','linkedin_manual','manual_review'));
