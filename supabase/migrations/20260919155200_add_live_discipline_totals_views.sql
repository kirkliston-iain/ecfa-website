create or replace view public.discipline_player_totals
with (security_invoker = true) as
with per_match as (
  select dr.player_id, dr.fixture_id, min(f.fixture_date)::date as fixture_date,
    sum(case when dr.card_type = 'yellow' then coalesce(dr.card_count, 0) else 0 end)::integer as yellow_count,
    sum(case when dr.card_type = 'red' then coalesce(dr.card_count, 0) else 0 end)::integer as red_count
  from public.discipline_records dr
  join public.fixtures f on f.id = dr.fixture_id
  where dr.player_id is not null
  group by dr.player_id, dr.fixture_id
), scored as (
  select player_id, fixture_id, fixture_date,
    (case when red_count > 0 then red_count * 4 else yellow_count * 2 end)::integer as points
  from per_match
), running as (
  select scored.*,
    sum(points) over (partition by player_id order by fixture_date, fixture_id
      rows between unbounded preceding and current row)::integer as cumulative_points
  from scored
), totals as (
  select player_id, sum(points)::integer as points from scored group by player_id
), thresholds as (
  select player_id, points,
    case when points >= 30 then 30 when points >= 28 then 28 when points >= 24 then 24
      when points >= 18 then 18 when points >= 10 then 10 end::integer as threshold_points,
    case when points >= 30 then 10 when points >= 28 then 7 when points >= 24 then 5
      when points >= 18 then 3 when points >= 10 then 1 end::integer as ban_games
  from totals
)
select p.id as player_id, p.first_name, p.last_name, p.team_id, t.name as team_name,
  th.points, th.threshold_points, th.ban_games,
  min(r.fixture_date) filter (where th.threshold_points is not null
    and r.cumulative_points >= th.threshold_points)::date as threshold_start_date
from thresholds th
join public.players p on p.id = th.player_id
left join public.teams t on t.id = p.team_id
join running r on r.player_id = th.player_id
group by p.id, p.first_name, p.last_name, p.team_id, t.name,
  th.points, th.threshold_points, th.ban_games;

create or replace view public.discipline_team_totals
with (security_invoker = true) as
with per_match as (
  select dr.team_id, dr.player_id, dr.fixture_id,
    sum(case when dr.card_type = 'yellow' then coalesce(dr.card_count, 0) else 0 end)::integer as yellow_count,
    sum(case when dr.card_type = 'red' then coalesce(dr.card_count, 0) else 0 end)::integer as red_count
  from public.discipline_records dr
  where dr.team_id is not null and dr.player_id is not null
  group by dr.team_id, dr.player_id, dr.fixture_id
), scored as (
  select team_id, yellow_count, red_count,
    (case when red_count > 0 then red_count * 4 else yellow_count * 2 end)::integer as points
  from per_match
)
select t.id as team_id, t.name as team_name,
  coalesce(sum(s.yellow_count), 0)::integer as yellow_count,
  coalesce(sum(s.red_count), 0)::integer as red_count,
  coalesce(sum(s.points), 0)::integer as points
from scored s
join public.teams t on t.id = s.team_id
group by t.id, t.name;

grant select on public.discipline_player_totals to anon;
grant select on public.discipline_team_totals to anon;
grant select on public.discipline_player_totals to authenticated;
grant select on public.discipline_team_totals to authenticated;
