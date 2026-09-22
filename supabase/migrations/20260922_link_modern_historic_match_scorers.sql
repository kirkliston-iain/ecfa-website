alter table public.historic_match_scorers
  add column if not exists historic_fixture_id uuid
  references public.historic_fixtures(id) on delete cascade;

update public.historic_match_scorers as scorer
set historic_fixture_id = fixture.id
from public.historic_fixtures as fixture
where scorer.historic_fixture_id is null
  and substring(scorer.season from 1 for 4) ~ '^[0-9]{4}$'
  and substring(scorer.season from 1 for 4)::integer >= 2025
  and fixture.season = scorer.season
  and fixture.fixture_date = scorer.fixture_date
  and fixture.home_team_name = scorer.home_team_name
  and fixture.away_team_name = scorer.away_team_name;

create index if not exists historic_match_scorers_fixture_id_idx
  on public.historic_match_scorers (historic_fixture_id);
