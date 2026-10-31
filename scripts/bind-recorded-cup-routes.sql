begin;
-- The published League Cup draw: A1/B4, A2/B3, B1/A4, B2/A3.
with slot_rules(label,group_name,position) as (values
 ('Winner of Group A','Group A',1),('Runner-up, Group A','Group A',2),
 ('3rd place, Group A','Group A',3),('4th place, Group A','Group A',4),
 ('Winner of Group B','Group B',1),('Runner-up, Group B','Group B',2),
 ('3rd place, Group B','Group B',3),('4th place, Group B','Group B',4)
), sources as (
 select f.id,hr.position hp,ar.position ap,hg.id hg,ag.id ag
 from fixtures f join stages fs on fs.id=f.stage_id
 join slot_rules hr on hr.label=f.home_placeholder join slot_rules ar on ar.label=f.away_placeholder
 join stages gs on gs.competition_id=fs.competition_id
 join groups hg on hg.stage_id=gs.id and hg.name=hr.group_name
 join groups ag on ag.stage_id=gs.id and ag.name=ar.group_name
 where f.round_name='Quarter-Final'
)
update fixtures f set home_source_group_id=s.hg,home_source_group_position=s.hp,
 away_source_group_id=s.ag,away_source_group_position=s.ap from sources s where f.id=s.id;

-- Resolve the explicitly numbered QF paths using their published group slots.
with numbered_quarters as (
 select f.id,f.stage_id,case when g.name='Group A' then f.home_source_group_position
   else 2+f.home_source_group_position end n
 from fixtures f join groups g on g.id=f.home_source_group_id
 where f.round_name='Quarter-Final' and f.home_source_group_position in (1,2)
), routes as (
 select sf.id,h.id hs,a.id aws from fixtures sf
 join numbered_quarters h on h.stage_id=sf.stage_id
  and sf.home_placeholder like 'Winner of QF'||h.n||' (%'
 join numbered_quarters a on a.stage_id=sf.stage_id
  and sf.away_placeholder like 'Winner of QF'||a.n||' (%'
 where sf.round_name='Semi-Final'
)
update fixtures f set home_winner_fixture_id=r.hs,away_winner_fixture_id=r.aws
from routes r where f.id=r.id;

with numbered_semis as (
 select sf.id,sf.stage_id,case when g.name='Group A' then 1 else 2 end n
 from fixtures sf join fixtures q on q.id=sf.home_winner_fixture_id
 join groups g on g.id=q.home_source_group_id where sf.round_name='Semi-Final'
), routes as (
 select f.id,h.id hs,a.id aws from fixtures f
 join numbered_semis h on h.stage_id=f.stage_id and f.home_placeholder='Winner of Semi-Final '||h.n
 join numbered_semis a on a.stage_id=f.stage_id and f.away_placeholder='Winner of Semi-Final '||a.n
 where f.round_name='Final'
)
update fixtures f set home_winner_fixture_id=r.hs,away_winner_fixture_id=r.aws from routes r where f.id=r.id;

-- Recover already-played Knockout Cup paths from the recorded winners.
-- There are no repeat meetings in this fixed single-elimination draw.
with outcomes as (
 select *,case
 when decided_by_penalties then case when home_penalty_score>away_penalty_score then home_team_id when away_penalty_score>home_penalty_score then away_team_id end
 when went_to_extra_time then case when home_extra_time_score>away_extra_time_score then home_team_id when away_extra_time_score>home_extra_time_score then away_team_id end
 else case when home_score>away_score then home_team_id when away_score>home_score then away_team_id end end winner
 from fixtures where status='played'
), sources as (
 select f.id,o.id source,'home' side from fixtures f join outcomes o on o.stage_id=f.stage_id and o.winner=f.home_team_id
 where (f.round_name='Quarter-Final' and o.round_name='Preliminary Round') or (f.round_name='Semi-Final' and o.round_name='Quarter-Final')
 union all
 select f.id,o.id,'away' from fixtures f join outcomes o on o.stage_id=f.stage_id and o.winner=f.away_team_id
 where (f.round_name='Quarter-Final' and o.round_name='Preliminary Round') or (f.round_name='Semi-Final' and o.round_name='Quarter-Final')
), combined as (
 select id,max(source::text) filter(where side='home')::uuid hs,max(source::text) filter(where side='away')::uuid aws
 from sources group by id
)
update fixtures f set home_winner_fixture_id=coalesce(f.home_winner_fixture_id,s.hs),
 away_winner_fixture_id=coalesce(f.away_winner_fixture_id,s.aws) from combined s where f.id=s.id;

-- Refresh linked routes without altering any results.
update fixtures set status=status where home_winner_fixture_id is not null or away_winner_fixture_id is not null
 or id in (select home_winner_fixture_id from fixtures where home_winner_fixture_id is not null)
 or id in (select away_winner_fixture_id from fixtures where away_winner_fixture_id is not null);
select public.refresh_cup_group_routes(id) from groups where id in
 (select home_source_group_id from fixtures union select away_source_group_id from fixtures);
commit;
