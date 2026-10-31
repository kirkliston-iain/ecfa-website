import { supabase } from '../supabaseClient'
import { historicTeamName } from './historicTeams'

async function allRows(table, select, publicOnly = false) {
  const rows = []
  for (let from = 0; ; from += 1000) {
    let query = supabase.from(table).select(select).order('id').range(from, from + 999)
    if (publicOnly) query = query.eq('hidden_from_public', false)
    const { data, error } = await query
    if (error) throw error
    rows.push(...(data || []))
    if ((data || []).length < 1000) return rows
  }
}
export async function loadAskRecords() {
  const [live, historic] = await Promise.all([
    allRows('fixtures', 'id,fixture_date,status,home_score,away_score,went_to_extra_time,home_extra_time_score,away_extra_time_score,decided_by_penalties,home_penalty_score,away_penalty_score,home_team:home_team_id(name),away_team:away_team_id(name),stage:stage_id(competition:competition_id(name,season))', true),
    allRows('historic_fixtures', 'id,season,competition_name,fixture_date,home_team_name,away_team_name,home_goals,away_goals,comment,penalty_winner_name'),
  ])
  const records = [...live.map(m => ({ ...m, competition_name:m.stage?.competition?.name, season:m.stage?.competition?.season })), ...historic.map(m => ({ ...m, is_historic:true, status:'played', home_score:m.home_goals, away_score:m.away_goals, home_team:{name:m.home_team_name}, away_team:{name:m.away_team_name} }))]
  const seen = new Set()
  return records.filter(m => {
    const key = [String(m.fixture_date).slice(0,10), historicTeamName(m.home_team?.name), historicTeamName(m.away_team?.name), m.home_score, m.away_score].join('|').toLowerCase()
    if (seen.has(key)) return false
    seen.add(key); return true
  })
}
