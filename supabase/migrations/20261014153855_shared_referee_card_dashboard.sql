create or replace function public.referee_portal_dashboard(p_referee_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare ref uuid; ref_name text; current_season text; since_year int; result jsonb;
begin
 if not private.valid_referee_portal_session() then raise exception 'Please sign in with the referee portal code.'; end if;
 ref:=coalesce(p_referee_id,(select id from public.referees order by name limit 1));
 select name into ref_name from public.referees where id=ref;
 if ref_name is null then raise exception 'Referee not found.'; end if;
 select max(season) into current_season from public.competitions;
 since_year:=coalesce(substring(current_season from '^([0-9]{4})')::int,extract(year from current_date)::int)-1;
 with matches as (
 select f.id,'live'::text source,f.id card_fixture_id,f.fixture_date,h.name home,a.name away,
 f.home_score,f.away_score,replace(c.season,'-','/') season,c.name competition
 from public.fixtures f join public.stages s on s.id=f.stage_id join public.competitions c on c.id=s.competition_id
 join public.teams h on h.id=f.home_team_id join public.teams a on a.id=f.away_team_id
 where f.referee_name=ref_name and f.status='played' and not coalesce(f.hidden_from_public,false)
 and substring(c.season from '^([0-9]{4})')::int>=since_year
 union all
 select hf.id,'historic',hf.source_fixture_id,hf.fixture_date::timestamptz,hf.home_team_name,hf.away_team_name,
 hf.home_goals,hf.away_goals,replace(hf.season,'-','/'),hf.competition_name
 from public.historic_fixtures hf left join public.fixtures sf on sf.id=hf.source_fixture_id
 where coalesce(hf.referee_name,sf.referee_name)=ref_name and hf.home_goals is not null and hf.away_goals is not null
 and not coalesce(sf.hidden_from_public,false) and substring(hf.season from '^([0-9]{4})')::int>=since_year
 and not exists(select 1 from public.fixtures lf join public.stages ls on ls.id=lf.stage_id
 join public.competitions lc on lc.id=ls.competition_id where lf.id=hf.source_fixture_id and lf.status='played'
 and lf.referee_name=ref_name and substring(lc.season from '^([0-9]{4})')::int>=since_year)
 ), detailed as (
 select m.*,
 coalesce(sum(d.card_count) filter(where d.card_type='yellow'),0) yellow,
 coalesce(sum(d.card_count) filter(where d.card_type='red'),0) red,
 coalesce(jsonb_agg(jsonb_build_object('id',d.id,'player_id',d.player_id,'player',
 coalesce(nullif(trim(concat_ws(' ',p.first_name,p.last_name)),''),'Player not recorded'),
 'team_id',d.team_id,'team',coalesce(t.name,'Team not recorded'),'type',d.card_type,'count',d.card_count)
 order by t.name,p.last_name,p.first_name) filter(where d.id is not null and d.card_type in ('yellow','red')),'[]'::jsonb) cards
 from matches m left join public.discipline_records d on d.fixture_id=m.card_fixture_id
 left join public.players p on p.id=d.player_id left join public.teams t on t.id=d.team_id
 group by m.id,m.source,m.card_fixture_id,m.fixture_date,m.home,m.away,m.home_score,m.away_score,m.season,m.competition
 )
 select jsonb_build_object('referee',ref_name,'referee_id',ref,'referees',(select jsonb_agg(jsonb_build_object('id',id,'name',name) order by name) from public.referees),'season',current_season,'since_season',since_year||'/'||right((since_year+1)::text,2),
 'games',count(*),'yellow',coalesce(sum(yellow),0),'red',coalesce(sum(red),0),
 'cards_per_game',case when count(*)=0 then 0 else round(coalesce(sum(yellow+red),0)::numeric/count(*),2) end,
 'matches',coalesce(jsonb_agg(to_jsonb(detailed)-'card_fixture_id' order by fixture_date desc,id),'[]'::jsonb),
 'history_notice',case when not exists(select 1 from matches where substring(season from '^([0-9]{4})')::int=since_year)
 then 'No linked referee and card records are available for '||since_year||'/'||right((since_year+1)::text,2)||'. This is unavailable history, not a zero-card total.' else null end)
 into result from detailed;
 return result;
end $$;
revoke all on function public.referee_portal_dashboard(uuid) from public;
grant execute on function public.referee_portal_dashboard(uuid) to anon,authenticated;
