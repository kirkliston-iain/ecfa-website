function normalized(value) {
  return String(value || '')
    .toLocaleLowerCase('en-GB')
    .replace(/[’']/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function historicPenaltyWinnerName(fixture) {
  if (fixture.penalty_winner_name) return fixture.penalty_winner_name

  const comment = normalized(fixture.comment)
  if (!comment.includes('penalt')) return ''

  const homeName = normalized(fixture.home_team_name)
  const awayName = normalized(fixture.away_team_name)
  if (homeName && comment.includes(`${homeName} won`)) return fixture.home_team_name
  if (awayName && comment.includes(`${awayName} won`)) return fixture.away_team_name
  return ''
}

export function historicDisplayedScore(fixture) {
  if (fixture.home_goals == null || fixture.away_goals == null) return 'v'
  const winner = normalized(historicPenaltyWinnerName(fixture))
  const homeMarker = winner && winner === normalized(fixture.home_team_name) ? 'P' : ''
  const awayMarker = winner && winner === normalized(fixture.away_team_name) ? 'P' : ''
  return `${fixture.home_goals}${homeMarker} - ${fixture.away_goals}${awayMarker}`
}
