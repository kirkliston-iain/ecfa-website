create table if not exists public.team_fundraisers (
  id uuid primary key default gen_random_uuid(),
  team_name text not null check (char_length(btrim(team_name)) between 2 and 160),
  title text not null check (char_length(btrim(title)) between 2 and 180),
  summary text not null check (char_length(btrim(summary)) between 5 and 800),
  fundraiser_url text,
  season text not null check (char_length(btrim(season)) between 4 and 12),
  amount_raised_text text,
  sort_order integer not null default 50,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists team_fundraisers_public_order_idx
on public.team_fundraisers (is_published, sort_order, team_name);

alter table public.team_fundraisers enable row level security;
grant select on public.team_fundraisers to anon, authenticated;
grant insert, update, delete on public.team_fundraisers to authenticated;

create policy "public can view published team fundraisers" on public.team_fundraisers for select
to anon, authenticated using (is_published = true);
create policy "admins can view all team fundraisers" on public.team_fundraisers for select
to authenticated using (exists (select 1 from public.admin_profiles ap where ap.id=(select auth.uid())));
create policy "admins can add team fundraisers" on public.team_fundraisers for insert
to authenticated with check (exists (select 1 from public.admin_profiles ap where ap.id=(select auth.uid())));
create policy "admins can update team fundraisers" on public.team_fundraisers for update
to authenticated
using (exists (select 1 from public.admin_profiles ap where ap.id=(select auth.uid())))
with check (exists (select 1 from public.admin_profiles ap where ap.id=(select auth.uid())));
create policy "admins can delete team fundraisers" on public.team_fundraisers for delete
to authenticated using (exists (select 1 from public.admin_profiles ap where ap.id=(select auth.uid())));

insert into public.team_fundraisers
  (team_name, title, summary, fundraiser_url, season, amount_raised_text, sort_order)
values
  ('South East Saints', 'South East Saints community fundraiser',
   'South East Saints organised a team fundraiser in support of Nathan Elliott.',
   'https://www.justgiving.com/crowdfunding/nathan-elliott-1?utm_medium=CF&utm_source=CL',
   '2026/27', 'Almost £2,000 raised', 10);

drop trigger if exists team_fundraisers_set_updated_at on public.team_fundraisers;
create trigger team_fundraisers_set_updated_at before update on public.team_fundraisers
for each row execute function private.set_updated_at();

drop trigger if exists admin_audit_trigger on public.team_fundraisers;
create trigger admin_audit_trigger after insert or update or delete on public.team_fundraisers
for each row execute function private.capture_admin_audit();
