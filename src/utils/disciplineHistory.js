// Keep each player's cards separate within a fixture: a red replaces that
// player's yellow-card points, never another player's points in the same game.
export function buildDisciplineHistory(cards) {
  const byPlayerFixture = new Map()
  for (const card of cards) {
    if (!card.fixture || !card.player_id) continue
    const key = `${card.fixture_id}::${card.player_id}`
    if (!byPlayerFixture.has(key)) {
      byPlayerFixture.set(key, { ...card.fixture, player: card.player, playerId: card.player_id, team: card.team, yellow: 0, red: 0 })
    }
    const game = byPlayerFixture.get(key)
    if (card.card_type === 'yellow') game.yellow += Number(card.card_count || 0)
    if (card.card_type === 'red') game.red += Number(card.card_count || 0)
  }
  return [...byPlayerFixture.values()].map((game) => ({
    ...game,
    points: game.red > 0 ? game.red * 4 : game.yellow * 2,
  })).sort((a, b) => (b.fixture_date || '').localeCompare(a.fixture_date || ''))
}
