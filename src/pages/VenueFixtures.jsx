import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { cleanVenueName, venueGroupKey } from '../utils/venueGrouping'

function formatDate(date) {
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function supportsFixtureLink(season) {
  const year = Number.parseInt(String(season || '').match(/^(\d{4})/)?.[1], 10)
  return Number.isFinite(year) && year >= 2025
}

export default function VenueFixtures() {
  const { venueKey = '' } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const date = searchParams.get('date') || ''
  const suppliedName = searchParams.get('name') || ''
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const decodedKey = useMemo(() => decodeURIComponent(venueKey), [venueKey])

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    let cancelled = false

    async function load() {
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        setError('A valid match date is required.')
        setLoading(false)
        return
      }

      setLoading(true)
      setError('')
      const nextDate = new Date(`${date}T12:00:00`)
      nextDate.setDate(nextDate.getDate() + 1)
      const followingDate = nextDate.toISOString().slice(0, 10)

      const [{ data: live, error: liveError }, { data: historic, error: historicError }] = await Promise.all([
        supabase
          .from('fixtures')
          .select('id, fixture_date, venue, status, home_score, away_score, home_team:home_team_id(id, name), away_team:away_team_id(id, name), stage:stage_id(competition:competition_id(name, season))')
          .gte('fixture_date', `${date}T00:00:00`)
          .lt('fixture_date', `${followingDate}T00:00:00`)
          .order('fixture_date', { ascending: true }),
        supabase
          .from('historic_fixtures')
          .select('id, competition_name, season, fixture_date, home_team_id, home_team_name, home_goals, away_team_id, away_team_name, away_goals, comment')
          .eq('fixture_date', date),
      ])

      if (liveError || historicError) {
        if (!cancelled) {
          setError('Unable to load the matches at this venue.')
          setLoading(false)
        }
        return
      }

      const liveMatches = (live || []).map((match) => ({
        id: match.id,
        fixtureId: match.id,
        fixtureDate: match.fixture_date,
        venue: match.venue,
        competition: match.stage?.competition?.name || 'ECFA',
        season: match.stage?.competition?.season || 'Current season',
        homeTeam: match.home_team,
        awayTeam: match.away_team,
        homeScore: match.home_score,
        awayScore: match.away_score,
        played: match.status === 'played',
      }))
      const historicMatches = (historic || []).map((match) => ({
        id: `historic-${match.id}`,
        fixtureId: supportsFixtureLink(match.season) ? match.id : null,
        fixtureDate: `${match.fixture_date}T00:00:00`,
        venue: match.comment,
        competition: match.competition_name,
        season: match.season,
        homeTeam: { id: match.home_team_id, name: match.home_team_name },
        awayTeam: { id: match.away_team_id, name: match.away_team_name },
        homeScore: match.home_goals,
        awayScore: match.away_goals,
        played: match.home_goals != null && match.away_goals != null,
      }))

      const grouped = [...liveMatches, ...historicMatches]
        .filter((match) => venueGroupKey(match.venue) === decodedKey)
        .filter((match, index, rows) => rows.findIndex((row) => row.fixtureId === match.fixtureId && row.homeTeam?.name === match.homeTeam?.name && row.awayTeam?.name === match.awayTeam?.name) === index)
        .sort((a, b) => String(a.fixtureDate).localeCompare(String(b.fixtureDate)))

      if (!cancelled) {
        setMatches(grouped)
        setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [date, decodedKey])

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
      {date && <p style={{ color: 'var(--muted)', marginTop: 0 }}>{formatDate(date)}</p>}
      <p style={{ color: 'var(--muted)' }}>
        All matches at this venue on this date. Separate pitches are combined and kick-off time is ignored.
      </p>

      {error && <p>{error}</p>}
      {!error && matches.length === 0 && <p>No matches were found at this venue on this date.</p>}

      <div style={{ marginTop: 28 }}>
        {matches.map((match) => {
          const content = (
            <>
              <div style={{ color: 'var(--brass)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>
                {match.competition} — {match.season}
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
                {match.fixtureDate.slice(11, 16) !== '00:00' ? ` · ${match.fixtureDate.slice(11, 16)}` : ''}
              </div>
            </>
          )

          return match.fixtureId ? (
            <Link
              key={match.id}
              to={`/fixtures/${match.fixtureId}`}
              style={{ display: 'block', color: 'inherit', textDecoration: 'none', padding: '18px 0', borderBottom: '1px solid var(--line)' }}
            >
              {content}
            </Link>
          ) : (
            <div key={match.id} style={{ padding: '18px 0', borderBottom: '1px solid var(--line)' }}>{content}</div>
          )
        })}
      </div>
    </div>
  )
}
