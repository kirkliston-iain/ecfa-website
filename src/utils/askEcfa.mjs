import { historicTeamName, HISTORIC_TEAM_ALIASES } from './historicTeams.js'
import { historicPenaltyWinnerName } from './historicFixtureOutcome.js'

export const normalise = value => String(value || '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
const canonical = value => normalise(historicTeamName(value))
export const matchDay = match => String(match.fixture_date || '').slice(0, 10)
export function matchGoals(match) {
  return match.went_to_extra_time && match.home_extra_time_score != null && match.away_extra_time_score != null
    ? [Number(match.home_extra_time_score), Number(match.away_extra_time_score)]
    : [Number(match.home_score), Number(match.away_score)]
}
export function matchOutcome(match, team) {
  const [home, away] = matchGoals(match)
  let result = home > away ? 'W' : home < away ? 'L' : 'D'
  const historicWinner = match.is_historic && historicPenaltyWinnerName(match)
  if (historicWinner) result = canonical(historicWinner) === canonical(match.home_team?.name) ? 'W' : 'L'
  else if (match.decided_by_penalties) {
    if (match.home_penalty_score == null || match.away_penalty_score == null || match.home_penalty_score === match.away_penalty_score) return '?'
    result = Number(match.home_penalty_score) > Number(match.away_penalty_score) ? 'W' : 'L'
  }
  return canonical(match.home_team?.name) === canonical(team) || result === 'D' ? result : result === 'W' ? 'L' : result === 'L' ? 'W' : '?'
}
export const dateLabel = day => new Date(`${day}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/London' })
export function mentionedTeams(question, matches) {
  const q = ` ${normalise(question)} `
  const teams = new Map()
  for (const match of matches) for (const team of [match.home_team, match.away_team]) {
    if (team?.name) teams.set(canonical(team.name), historicTeamName(team.name))
  }
  const aliases = Object.entries(HISTORIC_TEAM_ALIASES)
  const extra = { SES: 'South East Saints', 'St Marys': 'St Marys Metropolitan Church', KCC: 'Kirkliston Community Church', Chapel: 'Charlotte Chapel', Liberton: 'Liberton Church', Mission: 'The Mission' }
  return [...teams].map(([key, name]) => {
    const variants = [name, name.replace(/ (?:community church|metropolitan church|baptist church|church|united salvation army)$/i, ''), ...aliases.filter(([, target]) => canonical(target) === key).map(([alias]) => alias), ...Object.entries(extra).filter(([, target]) => canonical(target) === key).map(([alias]) => alias)]
    const positions = variants.flatMap(v => [q.indexOf(` ${normalise(v)} `), q.indexOf(` ${normalise(v)}s `)]).filter(i => i >= 0)
    return { name, position: positions.length ? Math.min(...positions) : -1 }
  }).filter(t => t.position >= 0).sort((a,b) => a.position - b.position).map(t => t.name)
}
function hasTeam(match, team) { return [match.home_team?.name, match.away_team?.name].some(name => canonical(name) === canonical(team)) }
function historyLink(team, opponent, season, scope) {
  const params = new URLSearchParams()
  if (team) params.set('team', team)
  if (opponent) params.set('opponent', opponent)
  if (season) params.set('season', season)
  if (scope !== 'all') params.set('scope', scope)
  return `/matches?${params}`
}
export function answerQuestion(question, matches, { today, season: selection = 'auto', scope: selectedScope = 'auto' } = {}) {
  const q = normalise(question)
  const ordered = [...matches].sort((a,b) => String(b.fixture_date).localeCompare(String(a.fixture_date)))
  const seasons = [...new Set(matches.map(m => m.season?.replace('-', '/')).filter(Boolean))].sort().reverse()
  const currentSeason = seasons[0] || ''
  const aggregate = /\b(how many|total|number of|average|per game|per match)\b/.test(q) && /\b(goals|matches|games)\b/.test(q)
  const ranking = /\b(best|most|worst|fewest|top|highest|lowest|biggest)\b/.test(q)
  const seasonToken = String(question).replace(/\b\d{4}-\d{2}-\d{2}\b/g, '').match(/\b(20\d{2}|\d{2})\s*[/–-]\s*(20\d{2}|\d{2})\b/)
  const explicitSeason = seasonToken ? `${seasonToken[1].length === 2 ? '20' : ''}${seasonToken[1]}/${seasonToken[2].slice(-2)}` : ''
  let season = selection !== 'auto' ? selection === 'all' ? '' : selection : explicitSeason || (/\b(this|current) season\b/.test(q) || ((ranking || aggregate) && !/\b(all time|ever|history|overall)\b/.test(q)) ? currentSeason : '')
  if (/\blast season\b/.test(q) && selection === 'auto') { const year = Number(currentSeason.slice(0,4)) - 1; season = `${year}/${String(year+1).slice(-2)}` }
  const scope = selectedScope !== 'auto' ? selectedScope : /\ball competitions\b/.test(q) ? 'all' : /\bcups?\b/.test(q) ? 'cup' : /\bleagues?\b/.test(q) ? 'league' : 'all'
  const teams = mentionedTeams(question, matches)
  const [team, opponent] = teams
  const sourceLink = { label: 'Explore match history', to: historyLink(team, opponent, season, scope) }
  const context = `${season || 'All recorded seasons'} · ${scope === 'all' ? 'All competitions' : scope === 'league' ? 'League only' : 'Cups only'}`
  const answer = (text, rows = [], links = [sourceLink], extra = {}) => ({ text, matches: rows.slice(0, 6), links, context, ...extra })
  if (teams.length > 2) return answer('Please ask about one team, or two teams for a head-to-head comparison.')
  // Avoid silently answering a different question when unsupported time qualifiers are present.
  const beforeDate = String(question).match(/\bbefore\s+(\d{4}-\d{2}-\d{2})\b/i)?.[1]
  let through = today
  if (/\bbefore yesterday\b/.test(q)) { const d = new Date(`${today}T12:00:00Z`); d.setUTCDate(d.getUTCDate()-2); through = d.toISOString().slice(0,10) }
  else if (/\bbefore today\b/.test(q)) { const d = new Date(`${today}T12:00:00Z`); d.setUTCDate(d.getUTCDate()-1); through = d.toISOString().slice(0,10) }
  else if (beforeDate && !Number.isNaN(Date.parse(beforeDate))) { const d = new Date(`${beforeDate}T12:00:00Z`); d.setUTCDate(d.getUTCDate()-1); through = d.toISOString().slice(0,10) }
  if ((/\b(since|between|before|after)\b/.test(q) || (/\bin 20\d{2}\b/.test(q) && !explicitSeason)) && !beforeDate && !/\bbefore (today|yesterday)\b/.test(q)) return answer('For date comparisons, please include a season in your question, or write “before YYYY-MM-DD”. I cannot reliably apply that date range yet.')
  const scoped = ordered.filter(m => (!season || m.season?.replace('-', '/') === season) && (scope === 'all' || (scope === 'cup' ? /cup/i.test(m.competition_name || '') : /league/i.test(m.competition_name || '') && !/cup/i.test(m.competition_name || ''))))
  const eligible = scoped.filter(m => m.status === 'played' && m.home_score != null && m.away_score != null && matchDay(m) <= through)
  const rows = eligible.filter(m => (!team || hasTeam(m,team)) && (!opponent || hasTeam(m,opponent)))
  const datedContext = through !== today ? `${context} · Through ${dateLabel(through)}` : context
  const finish = (text, found = [], links = [sourceLink], extra = {}) => answer(text, found, links, { context: datedContext, ...extra })
  if (aggregate && !/\b(who|player|players|scorer|scorers)\b/.test(q) && /\b(goals|matches|games)\b/.test(q) && !/\b(won|wins|lost|losses|draws|drew|clean sheets|unbeaten)\b/.test(q)) {
    if (!rows.length) return finish('No completed, scored matches are available for this selection.')
    const conceded = /\b(conceded|against|let in)\b/.test(q)
    const goals = rows.reduce((sum,m) => {
      const [home,away] = matchGoals(m)
      if (!team) return sum + home + away
      const isHome = canonical(m.home_team?.name) === canonical(team)
      return sum + (conceded ? isHome ? away : home : isHome ? home : away)
    },0)
    const subject = team ? `${team}${opponent ? ` against ${opponent}` : ''}: ` : ''
    if (/\b(average|per game|per match)\b/.test(q)) return finish(`${subject}${(goals/rows.length).toFixed(2)} goals ${team && conceded ? 'conceded' : 'scored'} per game (${goals.toLocaleString('en-GB')} goals across ${rows.length} completed matches).`, [], undefined, { totals:{goals,matches:rows.length} })
    const text = /\bgoals\b/.test(q)
      ? `${subject}${goals.toLocaleString('en-GB')} goals have been ${team && conceded ? 'conceded' : 'scored'} across ${rows.length} completed match${rows.length === 1 ? '' : 'es'}.`
      : `${subject}${rows.length} completed match${rows.length === 1 ? '' : 'es'} are recorded, with ${goals.toLocaleString('en-GB')} goals${team ? conceded ? ' conceded' : ' scored' : ''}.`
    return finish(text, [], undefined, { totals:{goals,matches:rows.length} })
  }
  if (/\b(next|upcoming|coming up)\b/.test(q)) {
    const next = scoped.filter(m => m.status === 'scheduled' && matchDay(m) >= today && (!team || hasTeam(m,team)) && (!opponent || hasTeam(m,opponent))).reverse()
    return finish(next.length ? `${team || 'ECFA'}: the next recorded fixture is on ${dateLabel(matchDay(next[0]))}.` : 'No upcoming fixture is recorded for this selection.', next)
  }
  if (/\b(scorer|scorers|scored|goalscorer|goalscorers)\b/.test(q) && /\b(who|player|players|top|leading)\b/.test(q)) return finish('Open Goalscorers for the recorded player totals, season filters and scoring history. Team goals and individual scorer records have different coverage.', [], [{ label: 'View goalscorers', to: `/goalscorers?season=${encodeURIComponent(season || 'overall')}&competition=${scope === 'all' ? 'all' : scope === 'league' ? 'League' : 'Cup'}` }])
  if (!rows.length && team) return finish(`No completed, scored matches were found for ${team}${opponent ? ` against ${opponent}` : ''} in this selection.`)
  if (team && /\b(unbeaten|undefeated|without losing|winning streak|wins in a row)\b/.test(q)) {
    const winsOnly = /\b(winning|wins in a row)\b/.test(q)
    const index = rows.findIndex(m => winsOnly ? matchOutcome(m, team) !== 'W' : !['W','D'].includes(matchOutcome(m, team)))
    const streak = index < 0 ? rows : rows.slice(0,index)
    return finish(`${team} have ${streak.length} consecutive recorded ${winsOnly ? 'wins' : 'games without defeat'}${opponent ? ` against ${opponent}` : ''}.${index < 0 ? ' No earlier break in the run was found within these records.' : ''}`, [...streak, ...(rows[index] ? [rows[index]] : [])])
  }
  if (team && /\b(last|latest|most recent)\b/.test(q)) {
    const result = /\b(lose|lost|loss|defeat|beaten)\b/.test(q) ? 'L' : /\b(win|won|beat|victory)\b/.test(q) ? 'W' : /\b(draw|drew|drawn)\b/.test(q) ? 'D' : ''
    const found = rows.find(m => !result || matchOutcome(m,team) === result)
    if (!found) return finish(`No recorded ${result === 'L' ? 'defeat' : result === 'W' ? 'win' : result === 'D' ? 'draw' : 'result'} was found for ${team} in this selection. This does not establish a complete historical record.`)
    const verb = result === 'L' ? 'last lost' : result === 'W' ? 'last won' : result === 'D' ? 'last drew' : 'last played'
    return finish(`${team} ${verb}${opponent ? ` against ${opponent}` : ''} on ${dateLabel(matchDay(found))}, based on available records.`, [found])
  }
  if (/\b(best defence|best defense|fewest goals|most goals|best attack|most wins|most victories|most clean sheets|worst defence|worst defense|biggest win|highest scoring|biggest score)\b/.test(q)) {
    if (/\b(biggest win|highest scoring|biggest score)\b/.test(q)) {
      const value = m => { const [h,a] = matchGoals(m); return /highest scoring|biggest score/.test(q) ? h+a : Math.abs(h-a) }
      const sorted = rows.filter(m => !team || !/biggest win/.test(q) || matchOutcome(m,team) === 'W').sort((a,b) => value(b)-value(a))
      if (!sorted.length) return finish('No completed results are available in this selection.')
      const tied = sorted.filter(m => value(m) === value(sorted[0]))
      return finish(`The ${/highest scoring|biggest score/.test(q) ? 'highest match goal total' : 'largest winning margin'} is ${value(sorted[0])} goals, shared by ${tied.length} recorded match${tied.length === 1 ? '' : 'es'}.`, tied)
    }
    const totals = new Map()
    for (const m of eligible) for (const t of [m.home_team?.name, m.away_team?.name]) {
      const name = historicTeamName(t); if (!name) continue
      const record = totals.get(name) || { name, played:0, gf:0, ga:0, wins:0, clean:0 }
      const home = canonical(t) === canonical(m.home_team?.name), [h,a] = matchGoals(m)
      record.played++; record.gf += home ? h : a; record.ga += home ? a : h; record.wins += matchOutcome(m,t) === 'W' ? 1 : 0; record.clean += (home ? a : h) === 0 ? 1 : 0
      totals.set(name,record)
    }
    const field = /defence|defense|fewest/.test(q) ? 'ga' : /wins|victories/.test(q) ? 'wins' : /clean sheets/.test(q) ? 'clean' : 'gf'
    const ascending = field === 'ga' && !/worst/.test(q)
    const ranked = [...totals.values()].sort((a,b) => (ascending ? a[field]-b[field] : b[field]-a[field]) || a.name.localeCompare(b.name))
    if (!ranked.length) return finish('No completed results are available in this selection.')
    const best = ranked.filter(t => t[field] === ranked[0][field])
    return finish(`${best.map(t => `${t.name}: ${t[field]} ${field === 'ga' ? 'goals conceded' : field === 'gf' ? 'goals scored' : field === 'clean' ? 'clean sheets' : 'wins'} in ${t.played} games`).join('; ')}. Totals are not adjusted for games played.`, [], best.map(t => ({ label: `${t.name} results`, to: historyLink(t.name,'',season,scope) })))
  }
  if (team && /\b(how many|record|summary|stats|statistics|head to head|results|meetings|form)\b/.test(q)) {
    const tally = { W:0,D:0,L:0,'?':0 }; let gf = 0, ga = 0, clean = 0
    for (const m of rows) { const home = canonical(m.home_team?.name) === canonical(team), [h,a] = matchGoals(m); gf += home ? h : a; ga += home ? a : h; clean += (home ? a : h) === 0 ? 1 : 0; tally[matchOutcome(m,team)]++ }
    return finish(`${team}${opponent ? ` against ${opponent}` : ''}: ${rows.length} recorded games, ${tally.W} wins, ${tally.D} draws, ${tally.L} losses; ${gf} goals scored, ${ga} conceded and ${clean} clean sheets.${tally['?'] ? ` ${tally['?']} shootout outcome(s) are incomplete.` : ''}`, rows)
  }
  return finish('I cannot reliably answer that question yet. Try a team’s last defeat, latest win, unbeaten run, next fixture, head-to-head record, or the best attack/defence. You can also search the website below.', [], [{ label:'Browse team statistics',to:'/stats' }, { label:'Goalscorers',to:'/goalscorers' }, { label:'Referee profiles',to:'/referees' }, sourceLink])
}
