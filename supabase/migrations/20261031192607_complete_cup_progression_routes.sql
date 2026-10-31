-- Group qualifiers keep a permanent source, like knockout winners.
alter table public.fixtures
  add column home_source_group_id uuid references public.groups(id),
  add column home_source_group_position integer check (home_source_group_position > 0),
  add column away_source_group_id uuid references public.groups(id),
  add column away_source_group_position integer check (away_source_group_position > 0),
  add constraint home_group_source_complete check ((home_source_group_id is null) = (home_source_group_position is null)),
  add constraint away_group_source_complete check ((away_source_group_id is null) = (away_source_group_position is null)),
  add constraint home_single_cup_source check (home_winner_fixture_id is null or home_source_group_id is null),
  add constraint away_single_cup_source check (away_winner_fixture_id is null or away_source_group_id is null);

-- Resolve only completed groups. A tie on points/GD requires confirmation of
-- the handbook's further tiebreaks; never select alphabetically or by UUID.
create or replace function public.confirmed_cup_group_place(source_group uuid, place integer)
returns uuid language sql stable security invoker set search_path=public as $$
with members as (
  select distinct team_id from public.stage_teams where group_id=source_group
), matches as (
  select * from public.fixtures where group_id=source_group
), ready as (
  select (select count(*) from members) >= 2
    and count(*) >= (select count(*) * (count(*)-1) / 2 from members)
    and bool_and(status='played' and home_score is not null and away_score is not null)
    as complete from matches
), team_results as (
  select home_team_id team_id, home_score gf, away_score ga from matches where status='played'
  union all select away_team_id, away_score, home_score from matches where status='played'
), standings as (
  select m.team_id,
    coalesce(sum(case when r.gf>r.ga then 3 when r.gf=r.ga then 1 else 0 end),0) points,
    coalesce(sum(r.gf-r.ga),0) gd
  from members m left join team_results r using(team_id) group by m.team_id
), ranked as (
  select *,rank() over(order by points desc,gd desc) pos,
    count(*) over(partition by points,gd) tied from standings
)
select team_id from ranked,ready where complete and pos=place and tied=1;
$$;

create or replace function public.refresh_cup_group_routes(source_group uuid)
returns void language plpgsql security invoker set search_path=public as $$
declare slot record; winner uuid;
begin
  for slot in
    select id,home_source_group_position pos,'home' side from public.fixtures
      where home_source_group_id=source_group and status<>'played'
    union all
    select id,away_source_group_position,'away' from public.fixtures
      where away_source_group_id=source_group and status<>'played'
  loop
    winner := public.confirmed_cup_group_place(source_group,slot.pos);
    if slot.side='home' then
      update public.fixtures set home_team_id=winner,updated_at=now() where id=slot.id and home_team_id is distinct from winner;
    else
      update public.fixtures set away_team_id=winner,updated_at=now() where id=slot.id and away_team_id is distinct from winner;
    end if;
  end loop;
end;
$$;

create or replace function public.refresh_cup_group_routes_after_result()
returns trigger language plpgsql security invoker set search_path=public as $$
begin
  if tg_op<>'INSERT' and old.group_id is not null then
    perform public.refresh_cup_group_routes(old.group_id);
  end if;
  if tg_op<>'DELETE' and new.group_id is not null then
    perform public.refresh_cup_group_routes(new.group_id);
  end if;
  return null;
end;
$$;
create trigger refresh_cup_group_routes_after_result
  after insert or delete or update of status,home_score,away_score,home_team_id,away_team_id,group_id
  on public.fixtures for each row execute function public.refresh_cup_group_routes_after_result();

-- Reject broken or cross-competition draw links before they can be saved.
create or replace function public.validate_cup_route_sources()
returns trigger language plpgsql security invoker set search_path=public as $$
declare source_id uuid; source_comp uuid; target_comp uuid; source_round text;
  target_order integer; source_order integer;
begin
  select competition_id into target_comp from public.stages where id=new.stage_id;
  target_order := case new.round_name when 'Preliminary Round' then 1 when 'Quarter-Final' then 2 when 'Semi-Final' then 3 when 'Final' then 4 end;
  foreach source_id in array array[new.home_winner_fixture_id,new.away_winner_fixture_id] loop
    if source_id is null then continue; end if;
    select s.competition_id,f.round_name into source_comp,source_round
      from public.fixtures f join public.stages s on s.id=f.stage_id where f.id=source_id;
    source_order := case source_round when 'Preliminary Round' then 1 when 'Quarter-Final' then 2 when 'Semi-Final' then 3 when 'Final' then 4 end;
    if source_id=new.id or source_comp is distinct from target_comp
      or source_order is null or target_order is null or source_order>=target_order then
      raise exception 'A cup winner source must be an earlier round in the same competition.';
    end if;
  end loop;
  foreach source_id in array array[new.home_source_group_id,new.away_source_group_id] loop
    if source_id is null then continue; end if;
    select s.competition_id into source_comp from public.groups g join public.stages s on s.id=g.stage_id where g.id=source_id;
    if source_comp is distinct from target_comp then raise exception 'A group qualifier source must belong to the same competition.'; end if;
  end loop;
  return new;
end;
$$;
create trigger validate_cup_route_sources before insert or update of
  stage_id,round_name,home_winner_fixture_id,away_winner_fixture_id,home_source_group_id,away_source_group_id
  on public.fixtures for each row execute function public.validate_cup_route_sources();

create or replace function public.advance_knockout_winner()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  home_name text;
  away_name text;
  winner_id uuid;
  source_label text;
  deciding_home_score integer;
  deciding_away_score integer;
begin
  winner_id := null;
  if new.status = 'played' and new.home_team_id is not null and new.away_team_id is not null then
    if new.decided_by_penalties then
      deciding_home_score := new.home_penalty_score;
      deciding_away_score := new.away_penalty_score;
    elsif new.went_to_extra_time then
      deciding_home_score := new.home_extra_time_score;
      deciding_away_score := new.away_extra_time_score;
    else
      deciding_home_score := new.home_score;
      deciding_away_score := new.away_score;
    end if;
    if deciding_home_score > deciding_away_score then winner_id := new.home_team_id;
    elsif deciding_away_score > deciding_home_score then winner_id := new.away_team_id;
    end if;
  end if;

  select name into home_name from public.teams where id = new.home_team_id;
  select name into away_name from public.teams where id = new.away_team_id;

  source_label := 'Winner: ' || coalesce(home_name,'TBC') || ' v ' || coalesce(away_name,'TBC');

  update public.fixtures
  set home_team_id = winner_id,
      home_placeholder = case when winner_id is null then source_label else null end,
      updated_at = now()
  where stage_id in (select id from public.stages where competition_id = (select competition_id from public.stages where id=new.stage_id))
    and id <> new.id and status <> 'played'
    and (home_winner_fixture_id = new.id
      or (winner_id is not null and home_team_id is null and home_placeholder = source_label));

  update public.fixtures
  set away_team_id = winner_id,
      away_placeholder = case when winner_id is null then source_label else null end,
      updated_at = now()
  where stage_id in (select id from public.stages where competition_id = (select competition_id from public.stages where id=new.stage_id))
    and id <> new.id and status <> 'played'
    and (away_winner_fixture_id = new.id
      or (winner_id is not null and away_team_id is null and away_placeholder = source_label));

  return new;
end;
$$;


-- Team corrections also refresh downstream slots; existing result trigger remains.
create trigger advance_knockout_winner_after_team_correction
  after update of home_team_id,away_team_id on public.fixtures
  for each row execute function public.advance_knockout_winner();
