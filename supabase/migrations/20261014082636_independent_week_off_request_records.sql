-- Keep historical match details even when a linked fixture is moved or deleted.
alter table public.team_week_off_requests
  add column request_description text;
alter table public.team_week_off_requests
  alter column recorded_by set default auth.uid();

update public.team_week_off_requests r
set request_description = h.name || ' v ' || a.name || ' · ' || c.name
from public.fixtures f
join public.teams h on h.id = f.home_team_id
join public.teams a on a.id = f.away_team_id
join public.stages s on s.id = f.stage_id
join public.competitions c on c.id = s.competition_id
where r.source_fixture_id = f.id;

create function private.snapshot_week_off_request()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if nullif(btrim(new.request_description), '') is null and new.source_fixture_id is not null then
    select h.name || ' v ' || a.name || ' · ' || c.name
    into new.request_description
    from public.fixtures f
    join public.teams h on h.id = f.home_team_id
    join public.teams a on a.id = f.away_team_id
    join public.stages s on s.id = f.stage_id
    join public.competitions c on c.id = s.competition_id
    where f.id = new.source_fixture_id;
  end if;
  if nullif(btrim(new.request_description), '') is null then
    raise exception 'Please enter the match or request details.';
  end if;
  return new;
end;
$$;
revoke all on function private.snapshot_week_off_request() from public, anon, authenticated;
create trigger snapshot_week_off_request
before insert on public.team_week_off_requests
for each row execute function private.snapshot_week_off_request();

grant insert on public.team_week_off_requests to authenticated;
create policy "admins can record independent week off requests"
on public.team_week_off_requests for insert to authenticated
with check (
  recorded_by = (select auth.uid())
  and exists (select 1 from public.admin_profiles ap where ap.id = (select auth.uid()))
);
