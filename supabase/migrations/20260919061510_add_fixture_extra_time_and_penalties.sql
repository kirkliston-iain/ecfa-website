alter table public.fixtures
  add column went_to_extra_time boolean not null default false,
  add column home_extra_time_score integer,
  add column away_extra_time_score integer,
  add column decided_by_penalties boolean not null default false,
  add column home_penalty_score integer,
  add column away_penalty_score integer;

alter table public.fixtures
  add constraint fixtures_extra_time_scores_nonnegative
    check (home_extra_time_score >= 0 and away_extra_time_score >= 0),
  add constraint fixtures_penalty_scores_nonnegative
    check (home_penalty_score >= 0 and away_penalty_score >= 0),
  add constraint fixtures_extra_time_scores_match_flag
    check (
      (went_to_extra_time and home_extra_time_score is not null and away_extra_time_score is not null)
      or
      (not went_to_extra_time and home_extra_time_score is null and away_extra_time_score is null)
    ),
  add constraint fixtures_penalty_scores_match_flag
    check (
      (decided_by_penalties and home_penalty_score is not null and away_penalty_score is not null)
      or
      (not decided_by_penalties and home_penalty_score is null and away_penalty_score is null)
    ),
  add constraint fixtures_penalty_scores_have_winner
    check (not decided_by_penalties or home_penalty_score <> away_penalty_score);
