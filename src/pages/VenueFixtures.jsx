import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
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
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const suppliedName = searchParams.get('name') || ''
  const [matches, setMatches] = useState([])
  const [currentSeason, setCurrentSeason] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const decodedKey = useMemo(() => decodeURIComponent(venueKey), [venueKey])

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')

      const { data, error: fixturesError } = await supabase
        .from('fixtures')
        .select('id, fixture_date, venue, status, home_score, away_score, home_team:home_team_id(id, name), away_team:away_team_id(id, name), stage:stage_id(competition:competition_id(name, season))')
        .eq('hidden_from_public', false)
        .order('fixture_date', { ascending: false })

      if (fixturesError) {
        if (!cancelled) {
          setError('Unable to load the current-season matches at this venue.')
          setLoading(false)
        }
        return
      }

      const availableSeasons = (data || [])
        .map((match) => match.stage?.competition?.season)
        .filter(Boolean)
      const season = availableSeasons.sort((a, b) => seasonStart(b) - seasonStart(a))[0] || ''

      const venueMatches = (data || [])
        .filter((match) => match.stage?.competition?.season === season)
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

      if (!cancelled) {
        setCurrentSeason(season)
        setMatches(venueMatches)
        setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [decodedKey])

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
        Current season history{currentSeason ? ` — ${displaySeason(currentSeason)}` : ''}
      </p>
      <p style={{ color: 'var(--muted)' }}>
        Every match recorded at this exact venue during the current season, ordered by date. Kick-off time does not affect the venue grouping.
      </p>

      {error && <p>{error}</p>}
      {!error && matches.length === 0 && <p>No current-season matches were found at this venue.</p>}

      <div style={{ marginTop: 28 }}>
        {matches.map((match) => (
          <Link
            key={match.id}
            to={`/fixtures/${match.id}`}
            style={{ display: 'block', color: 'inherit', textDecoration: 'none', padding: '18px 0', borderBottom: '1px solid var(--line)' }}
          >
            <div style={{ color: 'var(--brass)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>
              {match.competition} — {displaySeason(match.season)}
            </div>
            <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 5 }}>
              {formatDate(match.fixtureDate)}
              {match.fixtureDate.slice(11, 16) !== '00:00' ? ` · ${match.fixtureDate.slice(11, 16)}` : ''}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
              <span style={{ flex: 1, textAlign: 'right', fontWeight: 700 }}>{match.homeTeam?.name}</span>
              <span style={{ minWidth: 64, textAlign: 'center', fontWeight: 800, fontSize: 18 }}>
                {match.played ? `${match.homeScore} - ${match.awayScore}` : 'v'}
              </span>
              <span style={{ flex: 1, fontWeight: 700 }}>{match.awayTeam?.name}</span>
            </div>
            <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 12, marginTop: 8 }}>
              {cleanVenueName(match.venue)}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
