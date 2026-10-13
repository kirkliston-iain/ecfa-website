-- UK voting windows and capability-based access for this informal anonymous poll.
create schema if not exists prediction_api;
revoke all on schema prediction_api from public;
grant usage on schema prediction_api to anon, authenticated;
create or replace function public.prediction_window(p_kickoff timestamptz)
returns table(opens_at timestamptz, closes_at timestamptz)
language sql stable security invoker set search_path = '' as $$
select (date_trunc('week',p_kickoff at time zone 'Europe/London') + interval '5 hours') at time zone 'Europe/London',
case when extract(isodow from p_kickoff at time zone 'Europe/London') in (6,7)
 then (date_trunc('week',p_kickoff at time zone 'Europe/London') + interval '4 days 22 hours') at time zone 'Europe/London'
 else p_kickoff - interval '12 hours' end;
$$;
create or replace function prediction_api.entry_id() returns uuid
language sql stable security invoker set search_path = '' as $$
select case when (nullif(current_setting('request.headers',true),'')::jsonb->>'x-ecfa-prediction-entry') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
then (nullif(current_setting('request.headers',true),'')::jsonb->>'x-ecfa-prediction-entry')::uuid else null end;
$$;
revoke all on function prediction_api.entry_id() from public;
grant execute on function prediction_api.entry_id() to anon,authenticated;
drop policy "Read public fixture predictions" on public.weekend_predictions;
drop policy "Submit before weekend kickoff" on public.weekend_predictions;
create policy "Read own anonymous predictions" on public.weekend_predictions for select to anon, authenticated
using (entry_id = (select prediction_api.entry_id()) and exists(select 1 from public.fixtures f where f.id=fixture_id and f.hidden_from_public=false));
create policy "Submit inside UK voting window" on public.weekend_predictions for insert to anon, authenticated
with check (entry_id = (select prediction_api.entry_id()) and exists(select 1 from public.fixtures f cross join lateral public.prediction_window(f.fixture_date) w
 where f.id=fixture_id and f.hidden_from_public=false and f.status='scheduled' and f.home_team_id is not null and f.away_team_id is not null
 and now() >= w.opens_at and now() < w.closes_at));
revoke all on public.weekend_prediction_totals from anon,authenticated;
-- This privileged helper intentionally reads all votes only AFTER checking the
-- caller's unguessable browser capability, or after the final public deadline.
-- It exposes aggregates and that caller's scores; never IDs or other raw votes.
create or replace function prediction_api.summary(p_fixture_ids uuid[]) returns jsonb
language sql stable security definer set search_path = '' as $$
select coalesce(jsonb_agg(jsonb_build_object('fixture_id',f.id,'opens_at',w.opens_at,'closes_at',w.closes_at,
 'server_now',now(),'submitted',case when mine.id is not null then jsonb_build_object('home',mine.home_score,'away',mine.away_score) else null end,
 'can_view',now()>=w.closes_at or mine.id is not null,
 'crowd',case when now()>=w.closes_at or mine.id is not null then (select jsonb_build_object('total',count(*),
 'home_wins',count(*) filter(where p.home_score>p.away_score),'draws',count(*) filter(where p.home_score=p.away_score),
 'away_wins',count(*) filter(where p.home_score<p.away_score)) from public.weekend_predictions p where p.fixture_id=f.id
 and p.created_at>=w.opens_at and p.created_at<w.closes_at) else null end)), '[]'::jsonb)
from public.fixtures f cross join lateral public.prediction_window(f.fixture_date) w
left join public.weekend_predictions mine on mine.fixture_id=f.id and mine.entry_id=prediction_api.entry_id()
 and mine.created_at>=w.opens_at and mine.created_at<w.closes_at
where f.id=any(p_fixture_ids) and f.hidden_from_public=false and cardinality(p_fixture_ids)<=100;
$$;
revoke all on function prediction_api.summary(uuid[]) from public;
grant execute on function prediction_api.summary(uuid[]) to anon,authenticated;
create or replace function public.prediction_summary(p_fixture_ids uuid[]) returns jsonb
language sql stable security invoker set search_path = '' as $$ select prediction_api.summary(p_fixture_ids); $$;
revoke all on function public.prediction_summary(uuid[]) from public;
grant execute on function public.prediction_summary(uuid[]) to anon,authenticated;
