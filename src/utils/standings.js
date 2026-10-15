export function computeStandings(teams, fixtures) {
  const table = {}
  for (const team of teams) {
    if (!team) continue
    table[team.id] = {
      teamId: team.id,
      teamName: team.name,
      teamLogo: team.logo_url,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
    }
  }
  for (const f of fixtures) {
    if (f.status !== 'played' || f.home_score == null || f.away_score == null) continue
    const home = table[f.home_team?.id]
    const away = table[f.away_team?.id]
    if (!home || !away) continue
    home.played += 1
    away.played += 1
    home.goalsFor += f.home_score
    home.goalsAgainst += f.away_score
    away.goalsFor += f.away_score
    away.goalsAgainst += f.home_score
    if (f.home_score > f.away_score) {
      home.won += 1
      home.points += 3
      away.lost += 1
    } else if (f.home_score < f.away_score) {
      away.won += 1
      away.points += 3
      home.lost += 1
    } else {
      home.drawn += 1
      away.drawn += 1
      home.points += 1
      away.points += 1
    }
  }
  return Object.values(table)
    .map((row) => ({ ...row, goalDifference: row.goalsFor - row.goalsAgainst }))
    .sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor)
}

