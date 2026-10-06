import { historicTeamName } from './historicTeams.js'

export function finalCompetition(name) {
  const label = String(name || '').toLowerCase()
  if (label.includes('league cup')) return 'League Cup'
  if (label.includes('knockout cup')) return 'Knockout Cup'
  if (label.includes('brian latto') || label.includes('consolation cup')) return 'Brian Latto Cup'
  return ''
}

function isFinal(name) {
  return /(?:^|[\s-])final$/i.test(String(name || '').trim()) && !/semi|quarter/i.test(String(name || ''))
}

// Link only a recorded final for the same season, cup and club. Never guess a
// league-clinching match, or pick arbitrarily between multiple recorded finals.
export function honourFixtureId(honour, liveFixtures = [], historicFixtures = []) {
  const competition = finalCompetition(honour.competition)
  if (!competition || honour.status !== 'winner' || !honour.winner_name) return null
  const teamName = historicTeamName(honour.winner_name)
  const includesTeam = (home, away) => [home, away].some((name) => historicTeamName(name) === teamName)
  const live = liveFixtures.filter((fixture) =>
    fixture.status === 'played' && fixture.hidden_from_public !== true
    && fixture.home_score != null && fixture.away_score != null
    && isFinal(fixture.round_name)
    && fixture.stage?.competition?.season === honour.season
    && finalCompetition(fixture.stage?.competition?.name) === competition
    && includesTeam(fixture.home_team?.name, fixture.away_team?.name))
  if (live.length) return live.length === 1 ? live[0].id : null
  const historic = historicFixtures.filter((fixture) =>
    fixture.season === honour.season && isFinal(fixture.competition_name)
    && finalCompetition(fixture.competition_name) === competition
    && fixture.home_goals != null && fixture.away_goals != null
    && includesTeam(fixture.home_team_name, fixture.away_team_name))
  return historic.length === 1 ? historic[0].id : null
}
