import { selectStreakMatches } from '../utils/historyLinks'
import { useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { historicTeamName } from '../utils/historicTeams'
import { venueGroupKey } from '../utils/venueGrouping'
import { displayedScore, outcomeNote } from '../utils/fixtureOutcome'
import { historicDisplayedScore, historicPenaltyWinnerName } from '../utils/historicFixtureOutcome'
import { HistoryBack, TeamHistoryLink, VenueHistoryLink, CompetitionHistoryLink } from '../components/HistoryLinks'
import { useRememberedState, useRememberedScroll } from '../hooks/usePageMemory'

async function fetchAll(table, select, publicOnly = false) {
  const rows = []
  for (let from = 0; ; from += 1000) {
    let query = supabase.from(table).select(select).order('id').range(from, from + 999)
    if (publicOnly) query = query.eq('hidden_from_public', false)
    const result = await query
    if (result.error) throw result.error
    rows.push(...(result.data || []))
    if ((result.data || []).length < 1000) return rows
  }
}

export default function MatchHistory() {
  const [params] = useSearchParams()
  const [matches, setMatches] = useRememberedState('matches', [])
  const [loading, setLoading] = useRememberedState('loading', true)
  const [error, setError] = useRememberedState('error', '')
  useRememberedScroll(!loading)
  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const [live, archive] = await Promise.all([
          fetchAll('fixtures', 'id, group_id, fixture_date, venue, referee_name, status, home_score, away_score, went_to_extra_time, home_extra_time_score, away_extra_time_score, decided_by_penalties, home_penalty_score, away_penalty_score, home_team:home_team_id(id, name), away_team:away_team_id(id, name), stage:stage_id(competition:competition_id(id, name, slug, season))', true),
          fetchAll('historic_fixtures', 'id, season, competition_name, fixture_date, home_team_id, home_team_name, home_goals, away_team_id, away_team_name, away_goals, comment, penalty_winner_name, referee_name'),
        ])
        if (!cancelled) setMatches([
          ...live.map((row) => ({ ...row, home: row.home_team?.name, away: row.away_team?.name, homeId: row.home_team?.id, awayId: row.away_team?.id, season: row.stage?.competition?.season, competition: row.stage?.competition?.name, competitionId: row.stage?.competition?.id, competitionSlug: row.stage?.competition?.slug })),
          ...archive.map((row) => ({ ...row, archived: true, home: row.home_team_name, away: row.away_team_name, homeId: row.home_team_id, awayId: row.away_team_id, season: row.season, competition: row.competition_name, venue: row.comment, status: 'played', home_score: row.home_goals, away_score: row.away_goals })),
        ].sort((a, b) => String(b.fixture_date).localeCompare(String(a.fixture_date))))
      } catch { if (!cancelled) setError('Unable to load match history. Please try again.') }
      finally { if (!cancelled) setLoading(false) }
    }
    load()
    return () => { cancelled = true }
  }, [])
  const team = params.get('team') || ''
  const opponent = params.get('opponent') || ''
  const season = params.get('season') || ''
  const scope = params.get('scope') || ''
  const result = params.get('result') || ''
  const referee = params.get('referee') || ''
  const venue = params.get('venue') || ''
  const competition = params.get('competition') || ''
  const stat = params.get('stat') || ''
  function sameTeam(name, id, requested) { return requested === id || historicTeamName(name) === historicTeamName(requested) }
  const filtered = matches.filter((match) => {
    if (params.get('group') && match.group_id !== params.get('group')) return false
    if (params.get('through') && String(match.fixture_date).slice(0, 10) > params.get('through')) return false
    if (params.get('status') === 'played' && match.status !== 'played') return false
    if (team && !sameTeam(match.home, match.homeId, team) && !sameTeam(match.away, match.awayId, team)) return false
    if (opponent && !sameTeam(match.home, match.homeId, opponent) && !sameTeam(match.away, match.awayId, opponent)) return false
    if (season && match.season?.replace('-', '/') !== season.replace('-', '/')) return false
    if (referee && match.referee_name !== referee) return false
    if (venue && venueGroupKey(match.venue) !== venueGroupKey(venue)) return false
    if (competition && competition !== match.competitionId && competition !== match.competitionSlug && !match.competition?.toLowerCase().replace('brian latto', 'consolation').includes(competition.toLowerCase().replace('brian latto', 'consolation'))) return false
    if (scope === 'league' && (!/league/i.test(match.competition || '') || /cup/i.test(match.competition || ''))) return false
    if (scope === 'cup' && !/cup/i.test(match.competition || '')) return false
    if (result || stat === 'cleanSheets') {
      if (match.status !== 'played' || match.home_score == null || match.away_score == null) return false
      const isHome = sameTeam(match.home, match.homeId, team)
      const home = match.went_to_extra_time ? match.home_extra_time_score ?? match.home_score : match.home_score
      const away = match.went_to_extra_time ? match.away_extra_time_score ?? match.away_score : match.away_score
      if (stat === 'cleanSheets' && (isHome ? away : home) !== 0) return false
      let outcome = home > away ? 'W' : home < away ? 'L' : 'D'
      if (match.decided_by_penalties) outcome = match.home_penalty_score > match.away_penalty_score ? 'W' : 'L'
      const historicWinner = match.archived && historicPenaltyWinnerName(match)
      if (historicWinner) outcome = historicTeamName(historicWinner) === historicTeamName(match.home) ? 'W' : 'L'
      if (!isHome && outcome !== 'D') outcome = outcome === 'W' ? 'L' : 'W'
      if (result && outcome !== result) return false
    }
    return true
  })
  const visible = selectStreakMatches(filtered, stat, (match) => {
    const isHome = sameTeam(match.home, match.homeId, team)
    const home = match.went_to_extra_time ? match.home_extra_time_score ?? match.home_score : match.home_score
    const away = match.went_to_extra_time ? match.away_extra_time_score ?? match.away_score : match.away_score
    let outcome = home > away ? 'W' : home < away ? 'L' : 'D'
    if (match.decided_by_penalties && match.home_penalty_score != null && match.away_penalty_score != null) outcome = match.home_penalty_score > match.away_penalty_score ? 'W' : 'L'
    return isHome || outcome === 'D' ? outcome : outcome === 'W' ? 'L' : 'W'
  })
  const teamLabel = matches.flatMap((match) => [{ id: match.homeId, name: match.home }, { id: match.awayId, name: match.away }]).find((row) => row.id === team)?.name || team
  return <div className="container" style={{ padding: '32px 20px 48px' }}>
    <HistoryBack />
    <h1>Match history</h1>
    <p style={{ color: 'var(--muted)' }}>{[teamLabel, opponent ? `against ${historicTeamName(opponent)}` : '', season, referee ? `Referee: ${referee}` : '', venue, scope ? `${scope} matches` : '', result ? ({ W: 'Wins', L: 'Losses', D: 'Draws' }[result]) : '', stat === 'cleanSheets' ? 'Clean sheets' : /^(longest|current)/.test(stat) ? stat.replace(/([A-Z])/g, ' $1') : ''].filter(Boolean).join(' · ') || 'All recorded ECFA matches'}</p>
    {loading ? <p>Loading…</p> : error ? <p role="alert">{error}</p> : <>
      <p>{visible.length} {visible.length === 1 ? 'match' : 'matches'}</p>
      {visible.length === 0 && <p>No recorded matches match this selection.</p>}
      {visible.map((match) => <article key={`${match.archived ? 'archive' : 'live'}-${match.id}`} style={{ padding: '15px 0', borderBottom: '1px solid var(--line)' }}>
        <div style={{ color: 'var(--muted)', fontSize: 12 }}>{new Date(match.fixture_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} · {match.season} · <CompetitionHistoryLink name={match.competition} season={match.season} /></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
          <TeamHistoryLink name={match.home} id={match.homeId} style={{ flex: 1, textAlign: 'right' }} />
          <Link to={`/fixtures/${match.id}`} aria-label={`View ${match.home} versus ${match.away}`} style={{ fontWeight: 800, color: 'var(--brass)', padding: '8px' }}>{match.status === 'played' ? match.archived ? historicDisplayedScore(match) : displayedScore(match) : 'v'}</Link>
          <TeamHistoryLink name={match.away} id={match.awayId} style={{ flex: 1 }} />
        </div>
        {!match.archived && outcomeNote(match) && <p style={{ fontSize: 12 }}>{outcomeNote(match)}</p>}
        <div style={{ fontSize: 12, textAlign: 'center', marginTop: 6 }}>{match.venue && <VenueHistoryLink name={match.venue} />}{match.referee_name && <> · <Link to={`/referees?ref=${encodeURIComponent(match.referee_name)}`}>{match.referee_name}</Link></>}</div>
      </article>)}
    </>}
  </div>
}
