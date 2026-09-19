export function displayedScore(fixture) {
  if (fixture.went_to_extra_time && fixture.home_extra_time_score != null && fixture.away_extra_time_score != null) {
    return `${fixture.home_extra_time_score} - ${fixture.away_extra_time_score}`
  }
  return `${fixture.home_score} - ${fixture.away_score}`
}

export function outcomeNote(fixture) {
  if (fixture.decided_by_penalties && fixture.home_penalty_score != null && fixture.away_penalty_score != null) {
    const winner = fixture.home_penalty_score > fixture.away_penalty_score
      ? fixture.home_team?.name
      : fixture.away_team?.name
    const prefix = winner ? `${winner} won ` : ''
    return `${prefix}${fixture.home_penalty_score}-${fixture.away_penalty_score} on penalties`
  }
  if (fixture.went_to_extra_time) return 'After extra time'
  return ''
}

export function fullOutcomeNote(fixture) {
  const parts = []
  if (fixture.went_to_extra_time && fixture.home_score != null && fixture.away_score != null) {
    parts.push(`90 mins: ${fixture.home_score}-${fixture.away_score}`)
  }
  const result = outcomeNote(fixture)
  if (result) parts.push(result)
  return parts.join(' · ')
}
