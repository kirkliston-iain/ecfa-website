import { supabase } from '../supabaseClient'

async function allRows(table, select, configure = q => q) {
  const rows = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await configure(supabase.from(table).select(select)).order('id').range(from, from + 999)
    if (error) throw error
    rows.push(...data)
    if (data.length < 1000) return rows
  }
}
export async function loadPublicMatches() {
  const [live, historic] = await Promise.all([
    allRows('fixtures', '*, home_team:home_team_id(id,name,logo_url), away_team:away_team_id(id,name,logo_url), stage:stage_id(competition:competition_id(name,season))', q => q.eq('hidden_from_public', false)),
    allRows('historic_fixtures', '*, home_team:home_team_id(id,name,logo_url), away_team:away_team_id(id,name,logo_url)'),
  ])
  const rows = [...live.map(f => ({ ...f, competition_name: f.stage?.competition?.name, season: f.stage?.competition?.season })), ...historic.map(f => ({
    ...f, is_historic: true, status: 'played', home_score: f.home_goals, away_score: f.away_goals,
    home_team: { ...f.home_team, name: f.home_team_name }, away_team: { ...f.away_team, name: f.away_team_name }, venue: f.comment,
  }))]
  const seen = new Set()
  return rows.filter(f => {
    const key = [String(f.fixture_date).slice(0, 10), f.home_team?.name?.trim().toLowerCase(), f.away_team?.name?.trim().toLowerCase(), f.home_score, f.away_score].join('|')
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).sort((a,b) => String(b.fixture_date).localeCompare(String(a.fixture_date)))
}
export function londonToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}
export function anniversaryMatches(matches, date, today = londonToday()) {
  const day = date.slice(5,10)
  const eligible = matches.filter(f => f.status === 'played' && f.home_score != null && f.away_score != null && String(f.fixture_date).slice(0,10) < today && Number(String(f.fixture_date).slice(0,4)) < Number(date.slice(0,4)))
  const exact = eligible.filter(f => String(f.fixture_date).slice(5,10) === day)
  if (exact.length) return { exact: true, matches: exact }
  // Calendar week around the selected day, wrapping across New Year.
  const anchor = new Date(`2000-${day}T12:00:00Z`)
  const days = new Set(Array.from({length:7}, (_,i) => { const d = new Date(anchor); d.setUTCDate(d.getUTCDate()+i-3); return d.toISOString().slice(5,10) }))
  return { exact: false, matches: eligible.filter(f => days.has(String(f.fixture_date).slice(5,10))) }
}
