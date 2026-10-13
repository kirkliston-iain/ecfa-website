export function fixtureMatchesFilters(fixture, filters, editKey) {
  if (fixture._editFilterKey === editKey) return true
  return (!filters.team || fixture.home_team?.id === filters.team || fixture.away_team?.id === filters.team)
    && (!filters.date || (fixture.fixture_date?.slice(0, 10) || 'tbc') === filters.date)
    && (!filters.status || fixture.status === filters.status)
}
export function fixtureStatusForSave(fixture, now = Date.now()) {
  const hasResult = fixture.home_score !== '' && fixture.home_score != null && fixture.away_score !== '' && fixture.away_score != null
  const started = fixture.fixture_date && Date.parse(fixture.fixture_date) <= now
  return !fixture._statusEdited && fixture.status === 'scheduled' && hasResult && started ? 'played' : fixture.status
}
