import { historicTeamName, previousTeamUrl } from './historicTeams.js'

export function teamHistoryUrl(name, id, teams = []) {
  const canonical = historicTeamName(name)
  const team = teams.find((row) => row.id === id || historicTeamName(row.name) === canonical)
  return team ? `/teams/${team.id}` : canonical ? previousTeamUrl(canonical) : null
}

export function matchHistoryUrl(filters = {}) {
  const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value != null && value !== '' && value !== 'Overall' && value !== 'all'))
  return `/matches${params.size ? `?${params}` : ''}`
}

export function supportsMatchScorers(season) {
  return Number.parseInt(String(season || ''), 10) >= 2025
}

export function competitionHistoryUrl(name, season, competitions = []) {
  if (name === 'League' || name === 'Cup') return matchHistoryUrl({ scope: name.toLowerCase(), season, status: 'played' })
  const current = competitions.find((row) => row.name === name && (!season || row.season?.replace('-', '/') === season.replace('-', '/')))
  return current ? `/competitions/${current.slug}` : matchHistoryUrl({ competition: name, season })
}

export function selectStreakMatches(matches, stat, outcomeFor) {
  if (!/^(longest|current)(Unbeaten|Winning|Winless)$/.test(stat)) return matches
  const accepts = stat.endsWith('Unbeaten') ? (outcome) => outcome !== 'L'
    : stat.endsWith('Winning') ? (outcome) => outcome === 'W' : (outcome) => outcome !== 'W'
  const chronological = [...matches].reverse()
  const runs = []
  let run = []
  for (const match of chronological) {
    if (accepts(outcomeFor(match))) run.push(match)
    else { if (run.length) runs.push(run); run = [] }
  }
  if (stat.startsWith('current')) return run.reverse()
  if (run.length) runs.push(run)
  const length = Math.max(0, ...runs.map((entry) => entry.length))
  return runs.filter((entry) => entry.length === length).flat().reverse()
}
