import { TeamHistoryLink, CompetitionHistoryLink } from '../components/HistoryLinks'
import { useRememberedState, useRememberedScroll } from '../hooks/usePageMemory'
import { useEffect, useMemo } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { historicDisplayedScore } from '../utils/historicFixtureOutcome'
import { cleanVenueName, venueGroupKey } from '../utils/venueGrouping'

function seasonStart(season) {
  const year = Number.parseInt(String(season || '').match(/^(\d{4})/)?.[1], 10)
  return Number.isFinite(year) ? year : 0
}

function displaySeason(season) {
  return String(season || '').replace('-', '/')
}

function formatDate(value) {
  return new Date(value).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default function VenueFixtures() {
  const { venueKey = '' } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const suppliedName = searchParams.get('name') || ''
  const [matches, setMatches] = useRememberedState('matches', [])
  const [currentSeason, setCurrentSeason] = useRememberedState('currentSeason', '')
  const [loading, setLoading] = useRememberedState('loading', true)
  const [error, setError] = useRememberedState('error', '')
  useRememberedScroll(!loading)

  const decodedKey = useMemo(() => decodeURIComponent(venueKey), [venueKey])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')

      const [fixturesResult, archiveResult] = await Promise.all([supabase
        .from('fixtures')
        .select('id, fixture_date, venue, status, home_score, away_score, home_team:home_team_id(id, name), away_team:away_team_id(id, name), stage:stage_id(competition:competition_id(name, season))')
        .eq('hidden_from_public', false)
        .order('fixture_date', { ascending: false }).order('id').range(0, 9999),
        supabase.from('historic_fixtures')
          .select('id, season, competition_name, fixture_date, comment, home_team_name, away_team_name, home_goals, away_goals, penalty_winner_name')
          .gte('season', '2025').order('fixture_date', { ascending: false }).order('id').range(0, 9999),
      ])
      const { data, error: fixturesError } = fixturesResult

      if (fixturesError || archiveResult.error) {
        if (!cancelled) {
          setError('Unable to load the match history at this venue.')
          setLoading(false)
        }
        return
      }

      const availableSeasons = (data || [])
        .map((match) => match.stage?.competition?.season)
        .filter(Boolean)
      const season = availableSeasons.sort((a, b) => seasonStart(b) - seasonStart(a))[0] || ''

      const venueMatches = (data || [])
        .filter((match) => venueGroupKey(match.venue) === decodedKey)
        .map((match) => ({
          id: match.id,
          fixtureDate: match.fixture_date,
          venue: match.venue,
          competition: match.stage?.competition?.name || 'ECFA',
          season: match.stage?.competition?.season || season,
          homeTeam: match.home_team,
          awayTeam: match.away_team,
          homeScore: match.home_score,
          awayScore: match.away_score,
          played: match.status === 'played',
        }))

      const archivedMatches = (archiveResult.data || [])
        .filter((match) => venueGroupKey(match.comment) === decodedKey)
        .map((match) => {
          const score = historicDisplayedScore(match)
          return {
            id: match.id, fixtureDate: match.fixture_date, venue: match.comment,
            competition: match.competition_name || 'ECFA', season: match.season,
            homeTeam: { name: match.home_team_name }, awayTeam: { name: match.away_team_name },
            score, played: true,
          }
        })

      if (!cancelled) {
        setCurrentSeason(season)
        setMatches([...venueMatches, ...archivedMatches].sort((a, b) => b.fixtureDate.localeCompare(a.fixtureDate)))
        setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [decodedKey])

  const seasons = [...new Set([currentSeason, ...matches.map((match) => match.season)].filter(Boolean))]
    .sort((a, b) => seasonStart(b) - seasonStart(a))
  const requestedSeason = searchParams.get('season') || currentSeason
  const selectedSeason = requestedSeason === 'all' || seasons.includes(requestedSeason) ? requestedSeason : currentSeason
  const visibleMatches = matches.filter((match) => selectedSeason === 'all' || match.season === selectedSeason)

  const venueName = suppliedName || cleanVenueName(matches[0]?.venue) || 'Venue'

  if (loading) return <div className="container" style={{ padding: 48 }}>Loading…</div>

  return (
    <div className="container" style={{ padding: '40px 20px' }}>
      <button
        onClick={() => navigate(-1)}
        style={{ border: 'none', background: 'none', color: 'var(--brass)', fontSize: 13, fontWeight: 700, marginBottom: 24, cursor: 'pointer', padding: 0 }}
      >
        &larr; Back
      </button>

      <h1 style={{ marginBottom: 6 }}>{venueName}</h1>
      <p style={{ color: 'var(--muted)', marginTop: 0 }}>
        Venue history{selectedSeason !== 'all' && selectedSeason ? ` — ${displaySeason(selectedSeason)}` : ' — All seasons'}
      </p>
      <p style={{ color: 'var(--muted)' }}>
        Matches recorded at this exact venue, ordered by date. Choose a season to see current or previous games. Kick-off time does not affect the venue grouping.
      </p>

      <label style={{ display: 'block', marginTop: 20 }}>
        <span style={{ display: 'block', fontWeight: 700, marginBottom: 8 }}>Season</span>
        <select value={selectedSeason} onChange={(event) => {
          const next = new URLSearchParams(searchParams)
          next.set('season', event.target.value)
          setSearchParams(next, { replace: true })
        }} style={{ padding: '10px 12px', maxWidth: '100%', font: 'inherit' }}>
          {seasons.map((season) => <option key={season} value={season}>{displaySeason(season)}{season === currentSeason ? ' (Current season)' : ''}</option>)}
          <option value="all">All seasons</option>
        </select>
      </label>

      {error && <p>{error}</p>}
      {!error && visibleMatches.length === 0 && <p>No matches were found at this venue for the selected season.</p>}

      <div style={{ marginTop: 28 }}>
        {visibleMatches.map((match) => (
          <article
            key={match.id}
            style={{ display: 'block', color: 'inherit', textDecoration: 'none', padding: '18px 0', borderBottom: '1px solid var(--line)' }}
          >
            <div style={{ color: 'var(--brass)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>
              <CompetitionHistoryLink name={match.competition} season={match.season} /> — {displaySeason(match.season)}
            </div>
            <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 5 }}>
              {formatDate(match.fixtureDate)}
              {match.fixtureDate.length > 10 && match.fixtureDate.slice(11, 16) !== '00:00' ? ` · ${match.fixtureDate.slice(11, 16)}` : ''}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
              <span style={{ flex: 1, textAlign: 'right', fontWeight: 700 }}><TeamHistoryLink name={match.homeTeam?.name} id={match.homeTeam?.id} /></span>
              <span style={{ minWidth: 64, textAlign: 'center', fontWeight: 800, fontSize: 18 }}>
                <Link to={`/fixtures/${match.id}`} aria-label={`View ${match.homeTeam?.name} versus ${match.awayTeam?.name}`} style={{ color: 'inherit' }}>{match.score || (match.played ? `${match.homeScore} - ${match.awayScore}` : 'v')}</Link>
              </span>
              <span style={{ flex: 1, fontWeight: 700 }}><TeamHistoryLink name={match.awayTeam?.name} id={match.awayTeam?.id} /></span>
            </div>
            <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 12, marginTop: 8 }}>
              {cleanVenueName(match.venue)}
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
