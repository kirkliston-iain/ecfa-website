create table if not exists public.referee_contacts (
  referee_id uuid primary key references public.referees(id) on delete cascade,
  mobile text not null check (mobile ~ '^[0-9 +()-]{7,25}$'),
  updated_at timestamptz not null default now()
);

alter table public.referee_contacts enable row level security;

revoke all on table public.referee_contacts from anon;
revoke all on table public.referee_contacts from authenticated;
grant select on table public.referee_contacts to authenticated;
grant all on table public.referee_contacts to service_role;

drop policy if exists "managers read referee contacts" on public.referee_contacts;
create policy "managers read referee contacts"
on public.referee_contacts
for select
to authenticated
using (
  exists (
    select 1
    from public.admin_profiles
    where admin_profiles.id = (select auth.uid())
  )
);

-- Contact values are intentionally not committed to source control.
-- They are private operational data stored directly in Supabase.
