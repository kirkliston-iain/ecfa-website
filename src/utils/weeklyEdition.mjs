import { computeStandings } from './standings.js'

export function londonDate(value) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value))
}
export function shiftDay(day, offset) {
  const value = new Date(`${day}T12:00:00Z`)
  value.setUTCDate(value.getUTCDate() + offset)
  return value.toISOString().slice(0, 10)
}
export function hasRefereeProfile(referee) {
  return Boolean(referee.about?.trim() || (Array.isArray(referee.survey_answers) && referee.survey_answers.some(row => row.answer?.trim())))
}
const goals = fixture => fixture.went_to_extra_time && fixture.home_extra_time_score != null && fixture.away_extra_time_score != null
  ? [Number(fixture.home_extra_time_score), Number(fixture.away_extra_time_score)]
  : [Number(fixture.home_score), Number(fixture.away_score)]
const pick = (row, keys) => Object.fromEntries(keys.map(key => [key, row[key] ?? null]))
const team = row => row ? pick(row, ['id', 'name', 'logo_url']) : null
function fixtureSummary(fixture) {
  return { ...pick(fixture, ['id', 'fixture_date', 'status', 'venue', 'home_score', 'away_score', 'round_name', 'went_to_extra_time', 'home_extra_time_score', 'away_extra_time_score', 'decided_by_penalties', 'home_penalty_score', 'away_penalty_score']), home_team: team(fixture.home_team), away_team: team(fixture.away_team), competition: fixture.stage.competition.name, slug: fixture.stage.competition.slug }
}
export function buildWeeklyEdition(raw, date) {
  const competition = raw.competitions.filter(c => c.slug === 'appin-league').sort((a,b) => b.season.localeCompare(a.season))[0]
  if (!competition) throw new Error('No current league competition found')
  const season = competition.season
  const start = shiftDay(date, -6)
  const fixtures = raw.fixtures.filter(f => f.hidden_from_public === false && f.stage?.competition?.season === season && f.fixture_date && f.home_team && f.away_team)
  const played = fixtures.filter(f => f.status === 'played' && f.home_score != null && f.away_score != null && londonDate(f.fixture_date) <= date)
  const leagueStages = raw.stages.filter(s => s.competition_id === competition.id && s.stage_type === 'group')
  const tableSets = leagueStages.flatMap(stage => (stage.groups || []).map(group => {
    const teams = raw.stage_teams.filter(t => t.stage_id === stage.id && t.group_id === group.id).map(t => t.team)
    const matches = played.filter(f => f.stage_id === stage.id && f.group_id === group.id)
    return { name: group.name, rows: computeStandings(teams, matches) }
  }))
  const rows = tableSets.flatMap(t => t.rows)
  const league = played.filter(f => f.stage?.competition?.slug === 'appin-league')
  const leaders = (field, ascending = false) => {
    const eligible = rows.filter(r => r.played > 0)
    if (!eligible.length) return []
    const best = (ascending ? Math.min : Math.max)(...eligible.map(r => r[field]))
    return eligible.filter(r => r[field] === best)
  }
  const weeklyResults = played.filter(f => londonDate(f.fixture_date) >= start).sort((a,b) => a.fixture_date.localeCompare(b.fixture_date))
  const future = fixtures.filter(f => f.status === 'scheduled' && londonDate(f.fixture_date) > date).sort((a,b) => a.fixture_date.localeCompare(b.fixture_date))
  const nextDay = future[0] ? londonDate(future[0].fixture_date) : null
  const nextFixtures = future.filter(f => londonDate(f.fixture_date) === nextDay)
  const playedById = new Map(played.map(f => [f.id,f]))
  const scorers = new Map()
  for (const row of raw.fixture_scorers) {
    if (!playedById.has(row.fixture_id) || !row.player || Number(row.goals) <= 0) continue
    const name = `${row.player.first_name || ''} ${row.player.last_name || ''}`.trim()
    const canonical = /^(darron taylor|darron cairns|darran taylor)$/i.test(name) ? 'Darran Taylor' : name
    const key = canonical.toLocaleLowerCase('en-GB')
    const entry = scorers.get(key) || { name: canonical, playerId: row.player.id, teams: [], goals: 0, leagueGoals: 0, cupGoals: 0 }
    entry.goals += Number(row.goals)
    if (playedById.get(row.fixture_id).stage.competition.slug === 'appin-league') entry.leagueGoals += Number(row.goals)
    else entry.cupGoals += Number(row.goals)
    if (row.team && !entry.teams.some(t => t.id === row.team.id)) entry.teams.push(row.team)
    scorers.set(key, entry)
  }
  const topScorers = [...scorers.values()].sort((a,b) => b.goals-a.goals || a.name.localeCompare(b.name))
  // Include everyone tied for the final displayed place.
  const scorerCutoff = topScorers[9]?.goals || 0
  const eligibleRefs = raw.referees.filter(hasRefereeProfile).sort((a,b) => a.name.localeCompare(b.name))
  const weekIndex = Math.max(0, Math.floor((new Date(`${date}T12:00:00Z`) - new Date('2026-10-30T12:00:00Z')) / 604800000))
  const featured = eligibleRefs.length ? eligibleRefs[weekIndex % eligibleRefs.length] : null
  const forms = rows.map(row => {
    const matches = league.filter(f => f.home_team.id === row.teamId || f.away_team.id === row.teamId).sort((a,b) => b.fixture_date.localeCompare(a.fixture_date))
    const results = matches.map(f => { const home = f.home_team.id === row.teamId; const own = home ? f.home_score : f.away_score; const other = home ? f.away_score : f.home_score; return own > other ? 'W' : own === other ? 'D' : 'L' })
    const unbeaten = results.findIndex(r => r === 'L')
    return { ...row, form: results.slice(0,5).reverse(), unbeaten: unbeaten < 0 ? results.length : unbeaten, cleanSheets: matches.filter(f => (f.home_team.id === row.teamId ? f.away_score : f.home_score) === 0).length }
  })
  const totalGoals = played.reduce((sum,f) => sum + goals(f).reduce((a,b) => a+b,0),0)
  const bigGames = [...played].sort((a,b) => goals(b).reduce((x,y)=>x+y,0)-goals(a).reduce((x,y)=>x+y,0)).slice(0,3)
  return { date, start, season, generatedAt: new Date().toISOString(), issue: weekIndex+1, tables: tableSets, results: weeklyResults.map(fixtureSummary), nextDay, nextFixtures: nextFixtures.map(fixtureSummary), laterFixtures: future.filter(f => londonDate(f.fixture_date) !== nextDay && londonDate(f.fixture_date) <= shiftDay(date,28)).map(fixtureSummary), topScorers: topScorers.filter((s,i) => i < 10 || s.goals === scorerCutoff), referee: featured ? pick(featured,['id','name','photo_url','about','survey_answers']) : null, eligibleReferees: eligibleRefs.length, bestAttack: leaders('goalsFor'), bestDefence: leaders('goalsAgainst',true), mostWins: leaders('won'), forms, bigGames: bigGames.map(fixtureSummary), totals: { matches: played.length, goals: totalGoals, leagueMatches: league.length, leagueGoals: league.reduce((n,f) => n+Number(f.home_score)+Number(f.away_score),0), weeklyGoals: weeklyResults.reduce((n,f) => n+goals(f).reduce((a,b)=>a+b,0),0), recordedScorerGoals: topScorers.reduce((n,s)=>n+s.goals,0) }, news: raw.news_stories.filter(n => londonDate(n.published_at) <= date).slice(0,3).map(n => pick(n,['id','title','body','graphics','event_date'])), sponsors: raw.sponsors.map(s => pick(s,['id','name','logo_url','website_url'])) }
}
