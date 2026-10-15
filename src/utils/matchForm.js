import { historicTeamName } from './historicTeams.js'
import { historicPenaltyWinnerName } from './historicFixtureOutcome.js'

export function lastFiveForm(matches, team, fixture) {
  const same = (candidate) => Boolean(candidate && team && ((candidate.id && team.id && candidate.id === team.id) || historicTeamName(candidate.name) === historicTeamName(team.name)))
  return matches.filter(f => f.id !== fixture.id && f.status === 'played' && f.home_score != null && f.away_score != null && String(f.fixture_date).slice(0,10) < String(fixture.fixture_date).slice(0,10) && (same(f.home_team) || same(f.away_team)))
    .sort((a,b) => String(b.fixture_date).localeCompare(String(a.fixture_date)) || String(a.id).localeCompare(String(b.id)))
    .slice(0,5).reverse().map(f => {
      const isHome=same(f.home_team)
      const home=Number(f.went_to_extra_time ? f.home_extra_time_score ?? f.home_score : f.home_score)
      const away=Number(f.went_to_extra_time ? f.away_extra_time_score ?? f.away_score : f.away_score)
      let outcome=home>away?'W':home<away?'L':'D'
      if(f.decided_by_penalties && f.home_penalty_score!=null && f.away_penalty_score!=null && f.home_penalty_score!==f.away_penalty_score) outcome=f.home_penalty_score>f.away_penalty_score?'W':'L'
      const winner=f.is_historic && historicPenaltyWinnerName(f)
      if(winner) outcome=historicTeamName(winner)===historicTeamName(f.home_team?.name)?'W':'L'
      return isHome || outcome==='D' ? outcome : outcome==='W'?'L':'W'
    })
}
