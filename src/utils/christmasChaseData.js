import { supabase } from '../supabaseClient'
import { buildGrinchLines } from './christmasChase.mjs'

let cache
let pending
const FRESH_FOR = 5 * 60 * 1000
async function allRows(table, select) {
  const rows = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select(select).order('id').range(from, from + 999)
    if (error) throw error
    rows.push(...data)
    if (data.length < 1000) return rows
  }
}
export function loadGrinchLines() {
  if (cache && Date.now() - cache.at < FRESH_FOR) return Promise.resolve(cache.lines)
  if (!pending) pending = Promise.all([
    allRows('fixtures', 'id,fixture_date,status,hidden_from_public,home_score,away_score,went_to_extra_time,home_extra_time_score,away_extra_time_score,home_team:home_team_id(id,name),away_team:away_team_id(id,name),stage:stage_id(competition:competition_id(season))'),
    allRows('fixture_scorers', 'id,fixture_id,goals,player:player_id(id,first_name,last_name)'),
  ]).then(([fixtures, scorers]) => {
    const lines = buildGrinchLines(fixtures, scorers)
    cache = { at: Date.now(), lines }
    return lines
  }).finally(() => { pending = undefined })
  return pending
}
