update public.historic_scorers
set player_name = 'David Taylor'
where lower(btrim(player_name)) in ('dave taylor', 'david taylor')
  and lower(coalesce(team_name, '')) like 'white lightning%';

update public.historic_match_scorers
set player_name = 'David Taylor'
where lower(btrim(player_name)) in ('dave taylor', 'david taylor')
  and lower(coalesce(team_name, '')) like 'white lightning%';
