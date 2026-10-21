export function registrationSummary(playerId, transfers, squadRows, seasonStart) {
  const seasonEnd = `${Number(seasonStart.slice(0, 4)) + 1}-07-01`
  const inSeason = date => date >= seasonStart && date < seasonEnd
  const moves = transfers.filter(row => row.player_id === playerId && inSeason(row.transfer_date))
  const clubs = new Set()
  const before = squadRows.filter(row => row.player_id === playerId && row.recorded_at.slice(0, 10) < seasonStart)
    .sort((a, b) => b.recorded_at.localeCompare(a.recorded_at))[0]
  if (before?.new_team_id) clubs.add(before.new_team_id)
  for (const row of squadRows.filter(row => row.player_id === playerId && inSeason((row.effective_date || row.recorded_at).slice(0, 10)))) {
    if (row.previous_team_id) clubs.add(row.previous_team_id)
    if (row.new_team_id) clubs.add(row.new_team_id)
  }
  for (const row of moves) { clubs.add(row.previous_team_id); clubs.add(row.new_team_id) }
  return { moves: moves.length, clubs: clubs.size, unconfirmed: moves.some(row => row.date_basis !== 'confirmed') }
}
