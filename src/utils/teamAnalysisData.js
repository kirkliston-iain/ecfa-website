import { supabase } from '../supabaseClient'
import { normaliseMatches, reportSeasons, seasonLabel } from './teamAnalysis.js'

export async function canDownloadTeamPacks() {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) return false
  if (data.user.email?.toLowerCase() === 'managers@ecfa-website.org') return true
  const { data: profile } = await supabase.from('admin_profiles').select('id').eq('id', data.user.id).maybeSingle()
  return !!profile?.id
}
async function all(table, select = '*', configure = q => q) {
  const rows = []
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await configure(supabase.from(table).select(select)).order('id').range(offset, offset + 999)
    if (error) throw new Error(`${table}: ${error.message}`)
    rows.push(...data)
    if (data.length < 1000) return rows
  }
}
export async function loadTeamAnalysisData(today) {
  if (!await canDownloadTeamPacks()) throw new Error('Please log in as a manager to create a team pack.')
  const seasons = reportSeasons(today).flatMap(s => [s, s.replace('/', '-')])
  const [teams, live, historic, scorers, archivedScorers, historicScorers, cardResult] = await Promise.all([
    all('teams', 'id,name,logo_url'),
    all('fixtures', '*,home_team:home_team_id(name),away_team:away_team_id(name),stage:stage_id(competition:competition_id(name,season))', q => q.eq('status','played').eq('hidden_from_public',false)),
    all('historic_fixtures', '*', q => q.in('season',seasons)),
    all('fixture_scorers', 'id,fixture_id,goals,player:player_id(first_name,last_name),team:team_id(name)'),
    all('historic_match_scorers', '*', q => q.in('season',seasons)),
    all('historic_scorers','id,season,team_name,player_name,goals',q => q.in('season',seasons)),
    all('discipline_records','id,fixture_id,card_type,card_count,player:player_id(first_name,last_name),team:team_id(name)').then(data => ({ data }), error => ({ error })),
  ])
  const playerName = p => `${p?.first_name || ''} ${p?.last_name || ''}`.trim()
  return { teams, historicScorers, matches: normaliseMatches(live,historic).filter(f => reportSeasons(today).includes(f.season)),
    scorers: [
      ...scorers.map(s => ({ fixtureId:`live:${s.fixture_id}`, team:s.team?.name || '', player:playerName(s.player) || 'Unnamed player', goals:s.goals })),
      ...archivedScorers.map(s => ({ fixtureId: s.historic_fixture_id ? `historic:${s.historic_fixture_id}` : null, season:seasonLabel(s.season), date:String(s.fixture_date || '').slice(0,10), home:s.home_team_name, away:s.away_team_name, team:s.team_name, player:s.player_name, goals:s.goals })),
    ], cards: (cardResult.data || []).map(c => ({ ...c, team:c.team?.name || '', player:playerName(c.player) || 'Unnamed player' })),
    warnings: cardResult.error ? ['Discipline records could not be loaded for this session; card figures are unavailable.'] : [],
    cardsAvailable: !cardResult.error,
  }
}
