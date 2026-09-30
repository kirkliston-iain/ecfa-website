alter table public.appointment_weeks
  add column if not exists constraints jsonb not null
  default '{"unavailableReferees":[],"refereeTeamBlocks":[],"fixedAssignments":[],"notes":""}'::jsonb;
