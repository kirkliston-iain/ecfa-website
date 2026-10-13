create table public.weekend_predictions (
  id uuid primary key default gen_random_uuid(),
  fixture_id uuid not null references public.fixtures(id) on delete cascade,
  entry_id uuid not null,
  home_score smallint not null check (home_score between 0 and 20),
  away_score smallint not null check (away_score between 0 and 20),
  created_at timestamptz not null default now(),
  unique (entry_id, fixture_id)
);
create index weekend_predictions_fixture_idx on public.weekend_predictions(fixture_id);
alter table public.weekend_predictions enable row level security;
revoke all on public.weekend_predictions from anon, authenticated;
grant select on public.weekend_predictions to anon, authenticated;
grant insert (fixture_id, entry_id, home_score, away_score) on public.weekend_predictions to anon, authenticated;
create policy "Read public fixture predictions" on public.weekend_predictions for select to anon, authenticated
using (exists (select 1 from public.fixtures f where f.id = fixture_id and f.hidden_from_public = false));
create policy "Submit before weekend kickoff" on public.weekend_predictions for insert to anon, authenticated
with check (exists (select 1 from public.fixtures f where f.id = fixture_id
 and f.hidden_from_public = false and f.status = 'scheduled' and f.fixture_date > now()
 and f.home_team_id is not null and f.away_team_id is not null
 and extract(isodow from f.fixture_date at time zone 'Europe/London') in (6,7)));
create view public.weekend_prediction_totals with (security_invoker = true) as
select fixture_id, count(*) as total,
 count(*) filter (where home_score > away_score) as home_wins,
 count(*) filter (where home_score = away_score) as draws,
 count(*) filter (where home_score < away_score) as away_wins
from public.weekend_predictions group by fixture_id;
grant select on public.weekend_prediction_totals to anon, authenticated;
comment on table public.weekend_predictions is 'Informal anonymous weekend score poll. No names or contact details. Entries are immutable; browser entry IDs are not verified identities.';
