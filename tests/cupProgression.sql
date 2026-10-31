begin;
do $$
declare cup_stage uuid; q1 uuid; sf uuid; final_id uuid; selected_team uuid; opponent uuid; group_record record;
begin
 select s.id into cup_stage from stages s join competitions c on c.id=s.competition_id where c.slug='league-cup' and s.name='Knockout Stage';
 select id into q1 from fixtures where stage_id=cup_stage and round_name='Quarter-Final' and home_source_group_position=1 and home_source_group_id=(select g.id from groups g join stages s on s.id=g.stage_id where s.competition_id=(select competition_id from stages where id=cup_stage) and g.name='Group A');
 select id into sf from fixtures where home_winner_fixture_id=q1;
 select id into final_id from fixtures where home_winner_fixture_id=sf;
 if q1 is null or sf is null or final_id is null then raise exception 'Published QF1/SF1/final path missing'; end if;
 if exists(select 1 from fixtures where stage_id=cup_stage and round_name='Quarter-Final' and (home_team_id is not null or away_team_id is not null)) then raise exception 'Incomplete group promoted early'; end if;
 for group_record in select distinct home_source_group_id id from fixtures where stage_id=cup_stage and home_source_group_id is not null loop
   -- A complete group with a clear ordering: the smaller team UUID wins.
   update fixtures set status='played',home_score=case when home_team_id::text<away_team_id::text then 1 else 0 end,
     away_score=case when home_team_id::text<away_team_id::text then 0 else 1 end where group_id=group_record.id;
 end loop;
 if (select count(*) from fixtures where stage_id=cup_stage and round_name='Quarter-Final' and home_team_id is not null and away_team_id is not null)<>4 then raise exception 'Completed groups did not populate all QFs'; end if;
 select home_team_id,away_team_id into selected_team,opponent from fixtures where id=q1;
 update fixtures set status='played',home_score=1,away_score=0 where id=q1;
 if (select home_team_id from fixtures where id=sf) is distinct from selected_team then raise exception 'Normal-time winner not promoted'; end if;
 update fixtures set home_score=1,away_score=1,went_to_extra_time=true,home_extra_time_score=1,away_extra_time_score=2 where id=q1;
 if (select home_team_id from fixtures where id=sf) is distinct from opponent then raise exception 'Extra-time winner not promoted'; end if;
 update fixtures set decided_by_penalties=true,home_penalty_score=5,away_penalty_score=4 where id=q1;
 if (select home_team_id from fixtures where id=sf) is distinct from selected_team then raise exception 'Penalty correction not promoted'; end if;
 update fixtures set status='scheduled' where id=q1;
 if (select home_team_id from fixtures where id=sf) is not null then raise exception 'Reopened tie left stale winner'; end if;
 -- Complete the published QF paths, then both SFs and verify the final.
 update fixtures set status='played',home_score=2,away_score=0,went_to_extra_time=false,home_extra_time_score=null,away_extra_time_score=null,decided_by_penalties=false,home_penalty_score=null,away_penalty_score=null where stage_id=cup_stage and round_name='Quarter-Final';
 if (select count(*) from fixtures where stage_id=cup_stage and round_name='Semi-Final' and home_team_id is not null and away_team_id is not null)<>2 then raise exception 'QF winners missing from SFs'; end if;
 update fixtures set status='played',home_score=2,away_score=0 where stage_id=cup_stage and round_name='Semi-Final';
 if not exists(select 1 from fixtures where id=final_id and home_team_id is not null and away_team_id is not null) then raise exception 'Semi winners missing from final'; end if;
 -- Cross-competition routes must fail validation.
 begin
   update fixtures set home_winner_fixture_id=(select f.id from fixtures f join stages s on s.id=f.stage_id join competitions c on c.id=s.competition_id where c.slug='knockout-cup' and f.round_name='Semi-Final' limit 1) where id=final_id;
   raise exception 'Invalid route accepted';
 exception when raise_exception then
   if sqlerrm='Invalid route accepted' then raise; end if;
 end;
 -- Tied group standings stay unresolved pending the further official tiebreaks.
 update fixtures set home_score=0,away_score=0 where group_id=(select home_source_group_id from fixtures where id=q1);
 if confirmed_cup_group_place((select home_source_group_id from fixtures where id=q1),1) is not null then raise exception 'Tied group winner guessed'; end if;
end $$;
rollback;
