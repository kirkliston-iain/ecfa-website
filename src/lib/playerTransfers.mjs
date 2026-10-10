export function londonDate() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

export function playerName(player) {
  return [player?.first_name, player?.last_name].filter(Boolean).join(' ')
}

// Match records retain the represented club even after current membership changes.
export function goalsBySeasonAndClub(goals, defaultSeason) {
  const totals = new Map()
  for (const row of goals) {
    const season = String(row.fixture?.stage?.competition?.season || defaultSeason).replace('-', '/')
    const team = row.team || { id: null, name: 'Team not recorded' }
    const key = `${season}:${team.id || team.name}`
    const existing = totals.get(key)
    if (existing) existing.goals += Number(row.goals || 0)
    else totals.set(key, { key, season, team, goals: Number(row.goals || 0) })
  }
  return [...totals.values()].sort((a, b) => b.season.localeCompare(a.season, 'en-GB', { numeric: true }) || a.team.name.localeCompare(b.team.name))
}
