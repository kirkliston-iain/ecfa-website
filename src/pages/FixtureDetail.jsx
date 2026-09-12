import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'

function Badge({ logoUrl, name, size = 56 }) {
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt=""
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', background: '#fff' }}
      />
    )
  }
  const initials = (name || '?')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'var(--pitch)',
        color: '#fff',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.35,
        fontWeight: 700,
      }}
    >
      {initials}
    </span>
  )
}

export default function FixtureDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [fixture, setFixture] = useState(null)
  const [scorers, setScorers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      const { data: f, error: fErr } = await supabase
        .from('fixtures')
        .select(
          'id, round_name, fixture_date, venue, home_score, away_score, status, home_team:home_team_id(id, name, logo_url), away_team:away_team_id(id, name, logo_url)'
        )
        .eq('id', id)
        .single()

      if (fErr || !f) {
        if (!cancelled) {
          setError('Fixture not found.')
          setLoading(false)
        }
        return
      }

      const { data: s } = await supabase
        .from('fixture_scorers')
        .select('goals, team_id, player:player_id(first_name, last_name)')
        .eq('fixture_id', id)

      if (!cancelled) {
        setFixture(f)
        setScorers(s || [])
        setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [id])

  if (loading) return <div className="container" style={{ padding: 48 }}>Loading…</div>
  if (error) return <div className="container" style={{ padding: 48 }}>{error}</div>

  const homeScorers = scorers.filter((s) => s.team_id === fixture.home_team?.id)
  const awayScorers = scorers.filter((s) => s.team_id === fixture.away_team?.id)
  const played = fixture.status === 'played'

  return (
    <div className="container" style={{ padding: '40px 20px' }}>
      <button
        onClick={() => navigate(-1)}
        style={{
          border: 'none',
          background: 'none',
          color: 'var(--brass)',
          fontSize: 13,
          fontWeight: 600,
          marginBottom: 24,
          cursor: 'pointer',
          padding: 0,
        }}
      >
        &larr; Back
      </button>

      {fixture.round_name && (
        <div style={{ fontSize: 13, color: 'var(--brass)', marginBottom: 8, fontWeight: 600 }}>
          {fixture.round_name}
        </div>
      )}

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 24,
          padding: '28px 0',
          borderBottom: '1px solid var(--line)',
          marginBottom: 24,
        }}
      >
        <Link
          to={`/teams/${fixture.home_team?.id}`}
          style={{ textAlign: 'center', flex: 1, color: 'inherit' }}
        >
          <Badge logoUrl={fixture.home_team?.logo_url} name={fixture.home_team?.name} />
          <div style={{ marginTop: 8, fontWeight: 600, fontSize: 15 }}>{fixture.home_team?.name}</div>
        </Link>

        <div style={{ textAlign: 'center', minWidth: 100 }}>
          {played ? (
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 36, fontWeight: 700, color: 'var(--pitch)' }}>
              {fixture.home_score} – {fixture.away_score}
            </div>
          ) : (
            <div style={{ fontSize: 18, fontWeight: 600, color: '#8A8570' }}>vs</div>
          )}
          <div style={{ fontSize: 13, color: '#8A8570', marginTop: 6 }}>
            {fixture.fixture_date
              ? new Date(fixture.fixture_date).toLocaleDateString('en-GB', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })
              : 'Date TBC'}
          </div>
          {fixture.venue && <div style={{ fontSize: 12, color: '#8A8570' }}>{fixture.venue}</div>}
        </div>

        <Link
          to={`/teams/${fixture.away_team?.id}`}
          style={{ textAlign: 'center', flex: 1, color: 'inherit' }}
        >
          <Badge logoUrl={fixture.away_team?.logo_url} name={fixture.away_team?.name} />
          <div style={{ marginTop: 8, fontWeight: 600, fontSize: 15 }}>{fixture.away_team?.name}</div>
        </Link>
      </div>

      {played && (
        <div style={{ display: 'flex', gap: 32 }}>
          <ScorerColumn title={fixture.home_team?.name} scorers={homeScorers} />
          <ScorerColumn title={fixture.away_team?.name} scorers={awayScorers} />
        </div>
      )}

      {!played && (
        <p style={{ color: '#8A8570', textAlign: 'center' }}>This fixture hasn't been played yet.</p>
      )}
    </div>
  )
}

function ScorerColumn({ title, scorers }) {
  return (
    <div style={{ flex: 1 }}>
      <h3 style={{ fontSize: 14, color: '#5A6B85', marginBottom: 10, fontWeight: 600 }}>{title} scorers</h3>
      {scorers.length === 0 ? (
        <p style={{ color: '#8A8570', fontSize: 13 }}>No goals recorded.</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {scorers.map((s, i) => (
            <li
              key={i}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '6px 0',
                borderBottom: '1px solid var(--line)',
                fontSize: 14,
              }}
            >
              <span>
                {s.player?.first_name} {s.player?.last_name}
              </span>
              <span style={{ fontWeight: 700, color: 'var(--pitch)' }}>{s.goals}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
