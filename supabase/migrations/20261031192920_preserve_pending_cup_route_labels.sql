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

  source_label := 'Winner: ' || coalesce(home_name,new.home_placeholder,'TBC') || ' v ' || coalesce(away_name,new.away_placeholder,'TBC');

  update public.fixtures
  set home_team_id = winner_id,
      home_placeholder = case when winner_id is null then coalesce(home_placeholder,source_label) else null end,
      updated_at = now()
  where stage_id in (select id from public.stages where competition_id = (select competition_id from public.stages where id=new.stage_id))
    and id <> new.id and status <> 'played'
    and (home_winner_fixture_id = new.id
      or (winner_id is not null and home_team_id is null and home_placeholder = source_label));

  update public.fixtures
  set away_team_id = winner_id,
      away_placeholder = case when winner_id is null then coalesce(away_placeholder,source_label) else null end,
      updated_at = now()
  where stage_id in (select id from public.stages where competition_id = (select competition_id from public.stages where id=new.stage_id))
    and id <> new.id and status <> 'played'
    and (away_winner_fixture_id = new.id
      or (winner_id is not null and away_team_id is null and away_placeholder = source_label));

  return new;
end;
$$;


