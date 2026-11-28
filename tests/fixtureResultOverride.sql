-- Regression check only. Every simulated change is rolled back.
begin;
do $$
declare f public.fixtures; admin_id uuid; scorer_count integer;
begin
 select id into admin_id from public.admin_profiles limit 1;
 perform set_config('request.jwt.claim.sub',admin_id::text,true);
 select * into f from public.fixtures where id='939850ba-0fee-4818-b9ad-b74f0766d223';
 select count(*) into scorer_count from public.fixture_scorers where fixture_id=f.id;
 perform public.set_fixture_result_override(f.id,5,1,f.away_team_id,f.updated_at);
 if not exists(select 1 from public.fixtures where id=f.id and home_score=0 and away_score=3 and not went_to_extra_time and not decided_by_penalties) then raise exception 'Official result incorrect';end if;
 if not exists(select 1 from public.fixture_result_overrides where fixture_id=f.id and actual_home_score=5 and actual_away_score=1) then raise exception 'Actual score lost';end if;
 update public.fixtures set home_score=99,away_score=88 where id=f.id;
 if not exists(select 1 from public.fixtures where id=f.id and home_score=0 and away_score=3) then raise exception 'Ordinary fixture save bypassed override';end if;
 if (select count(*) from public.fixture_scorers where fixture_id=f.id)<>scorer_count then raise exception 'Scorers changed';end if;
 if has_table_privilege('anon','public.fixture_result_overrides','select') then raise exception 'Private scores exposed';end if;
 begin
  perform public.set_fixture_result_override(f.id,5,1,f.away_team_id,'2000-01-01'::timestamptz);
  raise exception 'Stale save accepted';
 exception when serialization_failure then null;end;
 perform public.set_fixture_result_override(f.id,5,1,null,(select updated_at from public.fixtures where id=f.id));
 if not exists(select 1 from public.fixtures where id=f.id and home_score=5 and away_score=1) then raise exception 'Restore failed';end if;
end $$;
rollback;
