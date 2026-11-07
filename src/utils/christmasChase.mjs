export const CHASE_SECONDS = 20
export const FALLBACK_GRINCH_LINES = [
  'Santa! Get back here — that golden boot is mine!',
  'VAR says I was on the nice list!',
  'I only stole Christmas. The referee stole my hat-trick!',
  'Those reindeer are definitely offside!',
]

const seasonKey = value => String(value || '').replace('/', '-')
const rank = values => [...values].sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name, 'en-GB')).filter(row => row.goals > 0).slice(0, 5)

// Current-season, completed public matches only. Penalty shoot-outs are not goals.
export function buildGrinchLines(fixtures, scorers, now = Date.now()) {
  const played = fixtures.filter(f => f.hidden_from_public === false && f.status === 'played'
    && seasonKey(f.stage?.competition?.season) === '2026-27'
    && Date.parse(f.fixture_date) <= now && f.home_score != null && f.away_score != null)
  const eligible = new Set(played.map(f => f.id))
  const players = new Map()
  for (const row of scorers) {
    if (!eligible.has(row.fixture_id) || !row.player?.id) continue
    const name = `${row.player.first_name || ''} ${row.player.last_name || ''}`.trim()
    if (!name) continue
    const player = players.get(row.player.id) || { name, goals: 0 }
    player.goals += Math.max(0, Number(row.goals) || 0)
    players.set(row.player.id, player)
  }
  const teams = new Map()
  for (const f of played) {
    const extra = f.went_to_extra_time && f.home_extra_time_score != null && f.away_extra_time_score != null
    for (const [team, score] of [[f.home_team, extra ? f.home_extra_time_score : f.home_score], [f.away_team, extra ? f.away_extra_time_score : f.away_score]]) {
      if (!team?.id || !team.name) continue
      const total = teams.get(team.id) || { name: team.name, goals: 0 }
      total.goals += Number(score) || 0
      teams.set(team.id, total)
    }
  }
  const playerLines = rank(players.values()).map((p, index) => [
    `${p.name}, I'm coming for your golden boot!`,
    `${p.name}, save some goals for the Grinch!`,
    `${p.name}, Santa says your finishing's too good!`,
    `${p.name}, my next hat-trick is catching you!`,
    `${p.name}, I'm stealing your shooting boots!`,
  ][index])
  const teamLines = rank(teams.values()).map((t, index) => [
    `${t.name}, I'm going to outscore you!`,
    `${t.name}, your goal tally is on my wish list!`,
    `${t.name}, even my sleigh can't keep up with your goals!`,
    `${t.name}, I'm signing the reindeer to catch you!`,
    `${t.name}, leave some goals under my tree!`,
  ][index])
  const lines = []
  for (let i = 0; i < 5; i++) {
    if (playerLines[i]) lines.push(playerLines[i])
    if (teamLines[i]) lines.push(teamLines[i])
  }
  return lines.length ? lines : FALLBACK_GRINCH_LINES
}
