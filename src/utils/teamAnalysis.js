import { historicTeamName } from './historicTeams.js'
import { cleanVenueName, isVenueLinkable } from './venueGrouping.js'

export const normal = value => historicTeamName(value).toLowerCase().replace(/[’']/g, '').replace(/\s+/g, ' ').trim()
export const seasonLabel = value => String(value || '').replace('-', '/')
export function reportSeasons(today) {
  const year = Number(today.slice(0, 4)) - (Number(today.slice(5, 7)) < 7 ? 1 : 0)
  return [year, year - 1].map(y => `${y}/${String(y + 1).slice(-2)}`)
}
export function periodBounds({ mode, season, month, today }) {
  const seasons = reportSeasons(today)
  if ((!seasons.includes(season) && season !== 'all') || (mode === 'to-date' && season !== seasons[0])) throw new Error('Choose this season or last season.')
  const startSeason = season === 'all' ? seasons[1] : season
  const endSeason = season === 'all' ? seasons[0] : season
  const start = `${startSeason.slice(0, 4)}-07-01`
  const end = `${Number(endSeason.slice(0, 4)) + 1}-06-30`
  if (mode === 'month') {
    if (!/^\d{4}-\d{2}$/.test(month) || `${month}-01` < start || `${month}-01` > end || `${month}-01` > today) throw new Error('Choose a month within the selected season.')
    const next = new Date(`${month}-01T12:00:00Z`)
    next.setUTCMonth(next.getUTCMonth() + 1)
    next.setUTCDate(0)
    return { start: `${month}-01`, end: [next.toISOString().slice(0, 10), today].sort()[0] }
  }
  return { start, end: [end, today].sort()[0] }
}
const matchKey = f => [f.season, f.date, normal(f.home), normal(f.away)].join('|')
export function normaliseMatches(live, historic) {
  const rows = live.filter(f => !f.hidden_from_public).map(f => ({
    id: `live:${f.id}`, sourceId: f.id, season: seasonLabel(f.stage?.competition?.season),
    date: String(f.fixture_date || '').slice(0, 10), home: historicTeamName(f.home_team?.name), away: historicTeamName(f.away_team?.name),
    hs: f.went_to_extra_time && f.home_extra_time_score != null ? Number(f.home_extra_time_score) : f.home_score,
    as: f.went_to_extra_time && f.away_extra_time_score != null ? Number(f.away_extra_time_score) : f.away_score,
    competition: f.stage?.competition?.name || 'Unclassified', status: f.status,
    venue: cleanVenueName(f.venue), referee: f.referee_name?.trim() || '',
    extra: !!f.went_to_extra_time, penalties: !!f.decided_by_penalties,
    shootout: f.decided_by_penalties ? `${f.home_penalty_score ?? '?'}-${f.away_penalty_score ?? '?'}` : '',
  }))
  rows.push(...historic.map(f => ({
    id: `historic:${f.id}`, sourceId: f.id, season: seasonLabel(f.season), date: String(f.fixture_date || '').slice(0, 10),
    home: historicTeamName(f.home_team_name), away: historicTeamName(f.away_team_name), hs: f.home_goals, as: f.away_goals,
    competition: f.competition_name || 'Unclassified', status: 'played',
    venue: isVenueLinkable(f.comment) && !/walkover|awarded|postpon|cancel|extra time|penalt/i.test(f.comment || '') ? cleanVenueName(f.comment) : '',
    referee: f.referee_name?.trim() || '', extra: /extra time|\baet\b/i.test(f.comment || ''),
    penalties: !!f.penalty_winner_name || /penalt/i.test(f.comment || ''),
    shootout: f.penalty_winner_name ? `${f.penalty_winner_name} won` : '',
    awarded: /walkover|awarded|\bw\s*\/\s*o\b/i.test(f.comment || ''),
  })))
  const seen = new Set()
  return rows.filter(f => {
    if (f.status !== 'played' || f.hs == null || f.as == null || !f.home || !f.away) return false
    const key = matchKey(f)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
}
export function summary(matches) {
  const p = matches.length, w = matches.filter(f => f.result === 'W').length, d = matches.filter(f => f.result === 'D').length
  const gf = matches.reduce((n, f) => n + f.gf, 0), ga = matches.reduce((n, f) => n + f.ga, 0)
  return { p, w, d, l: p - w - d, gf, ga, gd: gf - ga, win: p ? w / p * 100 : 0,
    scored: matches.filter(f => f.gf > 0).length, blank: matches.filter(f => f.gf === 0).length,
    cs: matches.filter(f => f.ga === 0).length, conceded2: matches.filter(f => f.ga >= 2).length,
    btts: matches.filter(f => f.gf > 0 && f.ga > 0).length, over25: matches.filter(f => f.gf + f.ga >= 3).length,
    gfpg: p ? gf / p : 0, gapg: p ? ga / p : 0 }
}
function grouped(matches, key) {
  const groups = new Map()
  matches.forEach(f => { const name = key(f) || 'Not recorded'; if (!groups.has(name)) groups.set(name, []); groups.get(name).push(f) })
  return [...groups].map(([name, rows]) => ({ name, ...summary(rows) })).sort((a, b) => b.p - a.p || b.win - a.win || a.name.localeCompare(b.name))
}
function longest(matches, predicate) {
  let best = 0, run = 0
  matches.forEach(f => { run = predicate(f) ? run + 1 : 0; best = Math.max(best, run) })
  return best
}
export function buildTeamAnalysis(data, team, options) {
  const bounds = periodBounds(options)
  const teamMatches = data.matches.filter(f => normal(f.home) === normal(team.name) || normal(f.away) === normal(team.name)).map(f => {
    const home = normal(f.home) === normal(team.name), gf = Number(home ? f.hs : f.as), ga = Number(home ? f.as : f.hs)
    return { ...f, opponent: home ? f.away : f.home, designation: home ? 'Home' : 'Away', gf, ga, result: gf > ga ? 'W' : gf < ga ? 'L' : 'D' }
  })
  const selectedSeasons = options.season === 'all' ? reportSeasons(options.today) : [options.season]
  const selected = f => selectedSeasons.includes(f.season) && f.date >= bounds.start && f.date <= bounds.end && (!options.competition || f.competition === options.competition)
  const matches = teamMatches.filter(selected), stats = summary(matches)
  const opponents = grouped(matches, f => f.opponent)
  const eligible = opponents.filter(o => o.p >= 2)
  const joy = [...eligible].sort((a,b) => b.win - a.win || b.gd - a.gd || b.w - a.w)[0]
  const bogey = [...eligible].sort((a,b) => a.win - b.win || a.gd - b.gd || b.l - a.l)[0]
  const lookup = new Map(matches.map(f => [f.id, f]))
  const matchByKey = new Map(matches.map(f => [matchKey(f), f]))
  const goals = [], seen = new Set()
  for (const s of data.scorers) {
    if (normal(s.team) !== normal(team.name)) continue
    const f = lookup.get(s.fixtureId) || matchByKey.get(matchKey(s))
    if (!f) continue
    // Imported history may also exist for the live match: prefer live scorer records.
    if (!s.fixtureId?.startsWith('live:') && data.scorers.some(other => other.fixtureId === f.id && other.fixtureId?.startsWith('live:') && normal(other.team) === normal(team.name))) continue
    const key = `${f.id}|${String(s.player).trim().toLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)
    goals.push({ ...s, fixtureId: f.id, opponent: f.opponent, competition: f.competition, date: f.date, goals: Number(s.goals) })
  }
  const players = new Map()
  goals.forEach(g => {
    const key = g.player.trim().toLowerCase()
    if (!players.has(key)) players.set(key, { name: g.player, goals: 0, scoringMatches: new Set(), multi: new Map(), opponents: new Map(), competitions: new Map() })
    const p = players.get(key)
    p.goals += g.goals; p.scoringMatches.add(g.fixtureId); p.multi.set(g.fixtureId, (p.multi.get(g.fixtureId) || 0) + g.goals)
    p.opponents.set(g.opponent, (p.opponents.get(g.opponent) || 0) + g.goals)
    p.competitions.set(g.competition, (p.competitions.get(g.competition) || 0) + g.goals)
  })
  const archiveTotals = new Map()
  const archiveSeason = options.season === 'all' ? reportSeasons(options.today)[1] : options.season
  if (options.mode === 'season' && !options.competition && options.season !== reportSeasons(options.today)[0]) {
    for (const row of data.historicScorers || []) {
      if (seasonLabel(row.season) !== archiveSeason || normal(row.team_name) !== normal(team.name)) continue
      const key = String(row.player_name).trim().toLowerCase()
      if (!archiveTotals.has(key)) archiveTotals.set(key,{name:row.player_name,goals:0,linkedGoals:goals.filter(g=>g.player.trim().toLowerCase()===key&&lookup.get(g.fixtureId)?.season===archiveSeason).reduce((n,g)=>n+g.goals,0)})
      archiveTotals.get(key).goals += Number(row.goals || 0)
    }
  }
  const playerRows = [...players.values()].map(p => ({ ...p, scoringMatches: p.scoringMatches.size, braces: [...p.multi.values()].filter(n => n === 2).length, hattricks: [...p.multi.values()].filter(n => n >= 3).length,
    opponents: [...p.opponents].sort((a,b) => b[1] - a[1]), competitions: [...p.competitions].sort((a,b) => b[1] - a[1]) })).sort((a,b) => b.goals - a.goals || a.name.localeCompare(b.name))
  const cards = data.cards.filter(c => normal(c.team) === normal(team.name) && lookup.has(`live:${c.fixture_id}`)).map(c => ({ ...c, match: lookup.get(`live:${c.fixture_id}`) }))
  const previousSeason = options.season === 'all' ? reportSeasons(options.today)[1] : `${Number(options.season.slice(0,4)) - 1}/${String(Number(options.season.slice(0,4))).slice(-2)}`
  const previous = options.season === reportSeasons(options.today)[0] ? teamMatches.filter(f => f.season === previousSeason && f.date <= options.today && (!options.competition || f.competition === options.competition)) : []
  const comparable = options.mode === 'month' ? previous.filter(f => f.date.slice(5,7) === options.month.slice(5,7)) : options.mode === 'to-date' ? previous.slice(0, matches.length) : previous
  const covered = new Set(goals.map(g => g.fixtureId)).size
  const yellow = cards.filter(c => c.card_type === 'yellow').reduce((n,c) => n + Number(c.card_count || 0), 0)
  const red = cards.filter(c => c.card_type === 'red').reduce((n,c) => n + Number(c.card_count || 0), 0)
  const findings = []
  if (stats.p) findings.push(`${stats.w} wins from ${stats.p} matches (${stats.win.toFixed(1)}%). ${stats.gfpg.toFixed(2)} goals scored and ${stats.gapg.toFixed(2)} conceded per match.`)
  if (joy && joy.w > 0) findings.push(`Most joy: ${joy.name}, with ${joy.w} wins in ${joy.p} meetings (${joy.win.toFixed(1)}%).`)
  if (bogey && bogey.l > 0) findings.push(`Bogey opponent: ${bogey.name}, with ${bogey.w} wins, ${bogey.d} draws and ${bogey.l} losses in ${bogey.p} meetings.`)
  const recordedGoals = playerRows.reduce((n,p) => n + p.goals,0)
  if (playerRows.length) findings.push(`Leading recorded scorer: ${playerRows[0].name} (${playerRows[0].goals} goals). The top two contribute ${((playerRows.slice(0,2).reduce((n,p) => n+p.goals,0) / recordedGoals) * 100).toFixed(1)}% of named-player goals.`)
  const venues = grouped(matches, f => f.venue)
  const bestVenue = venues.filter(v => v.name !== 'Not recorded' && v.p >= 2).sort((a,b) => b.win - a.win || b.p - a.p)[0]
  if (bestVenue) findings.push(`Strongest recorded venue by win rate: ${bestVenue.name} (${bestVenue.w}/${bestVenue.p}, ${bestVenue.win.toFixed(1)}%).`)
  return { team, options, bounds, matches, stats, archiveSeason, seasons:grouped(matches,f=>f.season).sort((a,b)=>a.name.localeCompare(b.name)), seasonScorers:[...archiveTotals.values()].sort((a,b)=>b.goals-a.goals), opponents, joy, bogey, venues, referees: grouped(matches, f => f.referee),
    competitions: grouped(matches, f => f.competition), homeAway: grouped(matches, f => f.designation), months: grouped(matches, f => f.date.slice(0,7)).sort((a,b) => a.name.localeCompare(b.name)),
    scorelines: grouped(matches, f => `${f.gf}-${f.ga}`).sort((a,b) => b.p-a.p), players: playerRows, goals, covered, recordedGoals, cards, yellow, red,
    comparison: comparable.length ? summary(comparable) : null, previousSeason, findings,
    streaks: { winning: longest(matches, f => f.result === 'W'), unbeaten: longest(matches, f => f.result !== 'L'), losing: longest(matches, f => f.result === 'L'), scoring: longest(matches, f => f.gf > 0), clean: longest(matches, f => f.ga === 0) },
    warnings: [
      ...data.warnings,
      ...(options.season === 'all' ? [`All combines ${reportSeasons(options.today).join(' and ')} only. Historical card coverage remains unavailable; card totals relate to live fixtures only.`] : []),
      'W/D/L uses the final match score, including extra time where recorded. Shoot-outs are listed separately and do not add goals or change a drawn match into a statistical win.',
      'Home/away follows fixture designation; shared and neutral venues may not represent a home-ground advantage.',
      'Opponent highlights require at least two meetings; rankings use win rate, then goal difference. They describe this selection only.',
      `Named scorer records cover ${covered} of ${stats.p} matches. ${recordedGoals} named-player goals are recorded against ${stats.gf} team goals; gaps can include own goals or missing records. Scoring matches are not appearances.`,
      'Historical card records, complete appearances, minutes, assists, shots, possession and goal timings are not available in these source tables. No values are inferred.',
      'Recorded card totals do not prove that every match card return is complete. Referee win rates describe results and do not imply causation.',
    ] }
}
