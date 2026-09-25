alter table public.historic_fixtures
  add column if not exists penalty_winner_name text;

comment on column public.historic_fixtures.penalty_winner_name is
  'Team that won a tied historic fixture on penalties; null when not applicable or not yet confirmed.';

update public.historic_fixtures
set penalty_winner_name = case
  when lower(comment) like '%' || lower(home_team_name) || '%won%penalt%' then home_team_name
  when lower(comment) like '%' || lower(away_team_name) || '%won%penalt%' then away_team_name
  else penalty_winner_name
end
where penalty_winner_name is null
  and comment ilike '%penalt%';

update public.historic_fixtures
set penalty_winner_name = home_team_name
where id = 'd348d4cc-e462-472b-9f2e-946f08617499';
