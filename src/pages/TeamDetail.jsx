import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'

function Badge({ logoUrl, name, size = 64 }) {
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt=""
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', background: '#fff', flexShrink: 0 }}
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
        flexShrink: 0,
      }}
    >
      {initials}
    </span>
  )
}

function resultFor(fixture, teamId) {
  const isHome = fixture.home_team?.id === teamId
  const gf = isHome ? fixture.home_score : fixture.away_score
  const ga = isHome ? fixture.away_score : fixture.home_score
  if (gf == null || ga == null) return null
  if (gf > ga) return 'W'
  if (gf < ga) return 'L'
  return 'D'
}

function FormPill({ result, fixtureId }) {
  const colors = { W: '#1B8A4A', D: '#8A8570', L: 'var(--red-card)' }
  return (
    <Link
      to={`/fixtures/${fixtureId}`}
      style={{
        width: 28,
        height: 28,
        borderRadius: '50%',
        background: colors[result] || '#ccc',
        color: '#fff',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 12,
        fontWeight: 700,
      }}
    >
      {result}
    </Link>
  )
}

export default function TeamDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [team, setTeam] = useState(null)
  const [playedFixtures, setPlayedFixtures] = useState([])
  const [upcomingFixtures, setUpcomingFixtures] = useState([])
  const [scorers, setScorers] = useState([])
  const [squad, setSquad] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      const { data: t, error: tErr } = await supabase
        .from('teams')
        .select('id, name, logo_url')
        .eq('id', id)
        .single()

      if (tErr || !t) {
        if (!cancelled) {
          setError('Team not found.')
          setLoading(false)
        }
        return
      }

      const { data: fixtures } = await supabase
        .from('fixtures')
        .select(
          'id, round_name, fixture_date, venue, home_score, away_score, status, home_team:home_team_id(id, name, logo_url), away_team:away_team_id(id, name, logo_url)'
        )
        .or(`home_team_id.eq.${id},away_team_id.eq.${id}`)
        .order('fixture_date', { ascending: true })

      const played = (fixtures || [])
        .filter((f) => f.status === 'played')
        .sort((a, b) => new Date(b.fixture_date) - new Date(a.fixture_date))
      const upcoming = (fixtures || []).filter((f) => f.status !== 'played')

      const { data: scorerRows } = await supabase
        .from('fixture_scorers')
        .select('goals, player:player_id(id, first_name, last_name)')
        .eq('team_id', id)

      const agg = {}
      for (const s of scorerRows || []) {
        const key = s.player?.id || `${s.player?.first_name}-${s.player?.last_name}`
        if (!agg[key]) {
          agg[key] = {
            name: `${s.player?.first_name || ''} ${s.player?.last_name || ''}`.trim(),
            goals: 0,
          }
        }
        agg[key].goals += Number(s.goals)
      }
      const scorerList = Object.values(agg).sort((a, b) => b.goals - a.goals)

      const { data: squadRows } = await supabase
        .from('players')
        .select('id, first_name, last_name')
        .eq('team_id', id)
        .order('last_name', { ascending: true })

      if (!cancelled) {
        setTeam(t)
        setPlayedFixtures(played)
        setUpcomingFixtures(upcoming)
        setScorers(scorerList)
        setSquad(squadRows || [])
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

  const form = playedFixtures.slice(0, 5)
  const nextFive = upcomingFixtures.slice(0, 5)
  const topScorers = scorers.slice(0, 5)

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

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
        <Badge logoUrl={team.logo_url} name={team.name} size={64} />
        <h1 style={{ fontSize: 28, color: 'var(--pitch)' }}>{team.name}</h1>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 40 }}>
        <span style={{ fontSize: 12, color: '#8A8570', textTransform: 'uppercase', letterSpacing: 0.5, marginRight: 4 }}>
          Form
        </span>
        {form.length === 0 && <span style={{ fontSize: 13, color: '#8A8570' }}>No results yet.</span>}
        {form
          .slice()
          .reverse()
          .map((f) => (
            <FormPill key={f.id} result={resultFor(f, team.id)} fixtureId={f.id} />
          ))}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 40,
          marginBottom: 48,
        }}
      >
        <section>
          <h2 style={{ fontSize: 18, marginBottom: 16, paddingBottom: 8, borderBottom: '1px solid var(--line)' }}>
            Next Fixtures
          </h2>
          {nextFive.length === 0 && <p style={{ color: '#8A8570', fontSize: 14 }}>No upcoming fixtures scheduled.</p>}
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {nextFive.map((f) => {
              const opponent = f.home_team?.id === team.id ? f.away_team : f.home_team
              return (
                <li key={f.id} style={{ borderBottom: '1px solid var(--line)' }}>
                  <Link
                    to={`/fixtures/${f.id}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 4px',
                      fontSize: 14,
                    }}
                  >
                    <Badge logoUrl={opponent?.logo_url} name={opponent?.name} size={22} />
                    <span style={{ flex: 1 }}>{opponent?.name}</span>
                    <span style={{ color: '#8A8570', fontSize: 12 }}>
                      {f.fixture_date
                        ? new Date(f.fixture_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                        : 'TBC'}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>

        <section>
          <h2 style={{ fontSize: 18, marginBottom: 16, paddingBottom: 8, borderBottom: '1px solid var(--line)' }}>
            Top Scorers
          </h2>
          {topScorers.length === 0 && <p style={{ color: '#8A8570', fontSize: 14 }}>No goals recorded yet.</p>}
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {topScorers.map((s, i) => (
              <li
                key={i}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '10px 4px',
                  borderBottom: '1px solid var(--line)',
                  fontSize: 14,
                }}
              >
                <span>{s.name}</span>
                <span style={{ fontWeight: 700, color: 'var(--pitch)' }}>{s.goals}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section style={{ marginBottom: 48 }}>
        <h2 style={{ fontSize: 18, marginBottom: 16, paddingBottom: 8, borderBottom: '1px solid var(--line)' }}>
          Results
        </h2>
        {playedFixtures.length === 0 && <p style={{ color: '#8A8570', fontSize: 14 }}>No results yet.</p>}
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {playedFixtures.map((f) => {
            const opponent = f.home_team?.id === team.id ? f.away_team : f.home_team
            const isHome = f.home_team?.id === team.id
            const result = resultFor(f, team.id)
            const colors = { W: '#1B8A4A', D: '#8A8570', L: 'var(--red-card)' }
            return (
              <li key={f.id} style={{ borderBottom: '1px solid var(--line)' }}>
                <Link
                  to={`/fixtures/${f.id}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 4px',
                    fontSize: 14,
                  }}
                >
                  <span
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      background: colors[result] || '#ccc',
                      color: '#fff',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 10,
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {result}
                  </span>
                  <Badge logoUrl={opponent?.logo_url} name={opponent?.name} size={20} />
                  <span style={{ flex: 1 }}>
                    {isHome ? 'vs' : '@'} {opponent?.name}
                  </span>
                  <span style={{ fontWeight: 700, color: 'var(--pitch)' }}>
                    {f.home_score} – {f.away_score}
                  </span>
                  <span style={{ color: '#8A8570', fontSize: 12, minWidth: 60, textAlign: 'right' }}>
                    {f.fixture_date
                      ? new Date(f.fixture_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                      : ''}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      </section>

      <section>
        <h2 style={{ fontSize: 18, marginBottom: 16, paddingBottom: 8, borderBottom: '1px solid var(--line)' }}>
          Squad
        </h2>
        {squad.length === 0 && <p style={{ color: '#8A8570', fontSize: 14 }}>Squad list not yet available.</p>}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: '6px 16px',
          }}
        >
          {squad.map((p) => (
            <div key={p.id} style={{ fontSize: 14, padding: '4px 0' }}>
              {p.first_name} {p.last_name}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
