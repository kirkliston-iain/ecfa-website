-- Persistent draw links avoid depending on placeholder wording or fixture dates.
alter table public.fixtures
  add column home_winner_fixture_id uuid references public.fixtures(id),
  add column away_winner_fixture_id uuid references public.fixtures(id);

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
  if new.status <> 'played'
     or new.home_team_id is null
     or new.away_team_id is null then
    return new;
  end if;

  if new.decided_by_penalties
     and new.home_penalty_score is not null
     and new.away_penalty_score is not null then
    deciding_home_score := new.home_penalty_score;
    deciding_away_score := new.away_penalty_score;
  elsif new.went_to_extra_time
        and new.home_extra_time_score is not null
        and new.away_extra_time_score is not null then
    deciding_home_score := new.home_extra_time_score;
    deciding_away_score := new.away_extra_time_score;
  elsif new.home_score is not null and new.away_score is not null then
    deciding_home_score := new.home_score;
    deciding_away_score := new.away_score;
  else
    return new;
  end if;

  if deciding_home_score = deciding_away_score then
    return new;
  end if;

  select name into home_name from public.teams where id = new.home_team_id;
  select name into away_name from public.teams where id = new.away_team_id;

  winner_id := case
    when deciding_home_score > deciding_away_score then new.home_team_id
    else new.away_team_id
  end;
  source_label := 'Winner: ' || home_name || ' v ' || away_name;

  update public.fixtures
  set home_team_id = winner_id,
      home_placeholder = null,
      updated_at = now()
  where stage_id = new.stage_id and id <> new.id and status <> 'played'
    and (home_winner_fixture_id = new.id
      or (home_team_id is null and home_placeholder = source_label));

  update public.fixtures
  set away_team_id = winner_id,
      away_placeholder = null,
      updated_at = now()
  where stage_id = new.stage_id and id <> new.id and status <> 'played'
    and (away_winner_fixture_id = new.id
      or (away_team_id is null and away_placeholder = source_label));

  return new;
end;
$$;

