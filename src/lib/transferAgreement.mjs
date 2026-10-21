export function transferSeasonStart(date) {
  const year = Number(date.slice(0, 4)) - (Number(date.slice(5, 7)) < 7 ? 1 : 0)
  return `${year}-07-01`
}

// Check immediately before saving, including the remove/re-add squad workflow.
// Restoring someone to the same club and their first move need no warning.
export async function confirmTransferAgreement(client, { playerId, playerName, previousTeamId, newTeamId, date }, confirm) {
  let previous = previousTeamId
  if (!previous) {
    const result = await client.from('player_squad_history').select('previous_team_id')
      .eq('player_id', playerId).eq('event_type', 'removed')
      .order('recorded_at', { ascending: false }).order('id').limit(1).maybeSingle()
    if (result.error) throw new Error('Could not check previous squad membership. Please try again before saving.')
    previous = result.data?.previous_team_id
  }
  if (!previous || !newTeamId || previous === newTeamId) return true

  const result = await client.from('player_transfers').select('id', { count: 'exact', head: true })
    .eq('player_id', playerId).gte('transfer_date', transferSeasonStart(date)).lte('transfer_date', date)
  if (result.error || result.count == null) throw new Error('Could not check transfer history. Please try again before saving.')
  if (result.count < 1) return true

  const alreadyMoved = result.count === 1 ? 'already moved once' : `already moved ${result.count} times`
  return confirm(`${playerName} has ${alreadyMoved} this season.\n\nThey cannot move again unless it has been agreed by the league.\n\nOnly select OK if league agreement has been given for this move. Select Cancel to leave the squad unchanged.`)
}
