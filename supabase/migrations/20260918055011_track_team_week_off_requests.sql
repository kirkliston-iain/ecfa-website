create table if not exists public.team_week_off_requests (
  id uuid primary key default gen_random_uuid(),
  season text not null,
  team_id uuid not null references public.teams(id) on delete restrict,
  source_fixture_id uuid references public.fixtures(id) on delete set null,
  original_fixture_date timestamptz,
  recorded_by uuid references auth.users(id) on delete set null,
  recorded_at timestamptz not null default now(),
  unique (season, team_id)
);

create index if not exists team_week_off_requests_fixture_idx
  on public.team_week_off_requests (source_fixture_id);
create index if not exists team_week_off_requests_team_idx
  on public.team_week_off_requests (team_id);
create index if not exists team_week_off_requests_recorded_by_idx
  on public.team_week_off_requests (recorded_by);

alter table public.team_week_off_requests enable row level security;
grant select on public.team_week_off_requests to authenticated;
revoke insert, update, delete on public.team_week_off_requests from anon, authenticated;

drop policy if exists "admins can view week off requests" on public.team_week_off_requests;
create policy "admins can view week off requests"
on public.team_week_off_requests for select
to authenticated
using (exists (
  select 1 from public.admin_profiles ap where ap.id = (select auth.uid())
));

create or replace function private.track_fixture_week_off_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  fixture_season text;
  existing_by_fixture public.team_week_off_requests%rowtype;
  existing_by_team public.team_week_off_requests%rowtype;
begin
  if not new.week_off_requested or new.week_off_requested_team_id is null then
    return new;
  end if;

  select c.season
    into fixture_season
  from public.stages s
  join public.competitions c on c.id = s.competition_id
  where s.id = new.stage_id;

  if fixture_season is null then
    raise exception 'The fixture season could not be identified.';
  end if;

  select * into existing_by_fixture
  from public.team_week_off_requests
  where season = fixture_season and source_fixture_id = new.id;

  select * into existing_by_team
  from public.team_week_off_requests
  where season = fixture_season and team_id = new.week_off_requested_team_id;

  if existing_by_team.id is not null
     and existing_by_team.source_fixture_id is distinct from new.id then
    raise exception 'This team has already used its week-off request for %.', fixture_season;
  end if;

  if existing_by_fixture.id is not null then
    update public.team_week_off_requests
    set team_id = new.week_off_requested_team_id
    where id = existing_by_fixture.id;
  else
    insert into public.team_week_off_requests (
      season,
      team_id,
      source_fixture_id,
      original_fixture_date,
      recorded_by
    ) values (
      fixture_season,
      new.week_off_requested_team_id,
      new.id,
      new.fixture_date,
      auth.uid()
    );
  end if;

  return new;
end;
$$;

revoke all on function private.track_fixture_week_off_request() from public, anon, authenticated;

drop trigger if exists fixtures_track_week_off_request on public.fixtures;
create trigger fixtures_track_week_off_request
after insert or update of week_off_requested, week_off_requested_team_id
on public.fixtures
for each row execute function private.track_fixture_week_off_request();

insert into public.team_week_off_requests (
  season,
  team_id,
  source_fixture_id,
  original_fixture_date,
  recorded_by
)
select
  c.season,
  f.week_off_requested_team_id,
  f.id,
  f.fixture_date,
  null
from public.fixtures f
join public.stages s on s.id = f.stage_id
join public.competitions c on c.id = s.competition_id
where f.week_off_requested is true
  and f.week_off_requested_team_id is not null
on conflict (season, team_id) do nothing;

drop trigger if exists admin_audit_trigger on public.team_week_off_requests;
create trigger admin_audit_trigger
after insert or update or delete on public.team_week_off_requests
for each row execute function private.capture_admin_audit();
