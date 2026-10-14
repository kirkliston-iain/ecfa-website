export function summariseRefereeCards(matches = []) {
  const players = new Map(), teams = new Map()
  let yellow = 0, red = 0
  for (const match of matches) {
    yellow += Number(match.yellow || 0); red += Number(match.red || 0)
    for (const card of match.cards || []) {
      const count = Number(card.count || 0)
      if (!['yellow', 'red'].includes(card.type)) continue
      const playerKey = JSON.stringify([card.player_id || card.player, card.team_id || card.team])
      const teamKey = card.team_id || card.team
      for (const [map, key, row] of [
        [players, playerKey, { id: card.player_id, name: card.player, team: card.team, yellow: 0, red: 0 }],
        [teams, teamKey, { id: card.team_id, name: card.team, yellow: 0, red: 0 }],
      ]) {
        if (!map.has(key)) map.set(key, row)
        map.get(key)[card.type] += count
      }
    }
  }
  const sorted = (map) => [...map.values()].map(row => ({ ...row, total: row.yellow + row.red })).sort((a,b) => b.total-a.total || a.name.localeCompare(b.name))
  const games = matches.length
  return { games, yellow, red, total: yellow + red, average: games ? (yellow+red)/games : null,
    yellowAverage: games ? yellow/games : null, redAverage: games ? red/games : null,
    players: sorted(players), teams: sorted(teams).map(row => {
      const games = matches.filter(m => m.home === row.name || m.away === row.name).length
      return { ...row, games, average: games ? row.total/games : null }
    }) }
}

