create table if not exists public.player_private_details (
  player_id uuid primary key references public.players(id) on delete cascade,
  date_of_birth date not null,
  updated_at timestamptz not null default now()
);

alter table public.player_private_details enable row level security;

revoke all on table public.player_private_details from anon;
revoke all on table public.player_private_details from authenticated;
grant select, insert, update, delete on table public.player_private_details to authenticated;
grant all on table public.player_private_details to service_role;

drop policy if exists "administrators manage player private details" on public.player_private_details;
create policy "administrators manage player private details"
on public.player_private_details
for all
to authenticated
using (
  exists (
    select 1
    from public.admin_profiles
    where admin_profiles.id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.admin_profiles
    where admin_profiles.id = (select auth.uid())
  )
);
