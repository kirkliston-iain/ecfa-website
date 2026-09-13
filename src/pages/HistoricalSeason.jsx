import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

function Badge({ name, size = 20 }) {
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
        background: 'var(--ink)',
        color: '#fff',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.4,
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {initials}
    </span>
  )
}

export default function HistoricalSeason() {
  const [seasons, setSeasons] = useState([])
  const [season, setSeason] = useState('')
  const [loading, setLoading] = useState(false)
  const [fixtures, setFixtures] = useState([])

  useEffect(() => {
    supabase
      .from('historic_fixtures')
      .select('season')
      .then(({ data }) => {
        const unique = Array.from(new Set((data || []).map((r) => r.season))).sort().reverse()
        setSeasons(unique)
      })
  }, [])

  useEffect(() => {
    if (!season) {
      setFixtures([])
      return
    }
    setLoading(true)
    supabase
      .from('historic_fixtures')
      .select('id, competition_name, fixture_date, home_team_name, home_goals, away_team_name, away_goals, comment')
      .eq('season', season)
      .order('fixture_date')
      .then(({ data }) => {
        setFixtures(data || [])
        setLoading(false)
      })
  }, [season])

  const grouped = {}
  for (const f of fixtures) {
    if (!grouped[f.competition_name]) grouped[f.competition_name] = []
    grouped[f.competition_name].push(f)
  }

  return (
    <div className="container" style={{ padding: '32px 20px 48px' }}>
      <h1 style={{ fontSize: 30, marginBottom: 4 }}>Historical Season</h1>
      <p style={{ color: 'var(--muted)', marginBottom: 24 }}>
        Results from past ECFA seasons.
      </p>

      <select
        value={season}
        onChange={(e) => setSeason(e.target.value)}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          padding: '12px 14px',
          fontSize: 15,
          fontWeight: 600,
          borderRadius: 6,
          border: '1px solid var(--line)',
          background: '#fff',
          marginBottom: 24,
        }}
      >
        <option value="">Select a season…</option>
        {seasons.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>

      {loading && <p style={{ color: 'var(--muted)' }}>Loading…</p>}

      {!loading &&
        Object.entries(grouped).map(([compName, comps]) => (
          <section key={compName} style={{ marginBottom: 32 }}>
            <h2
              style={{
                fontSize: 13,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                color: 'var(--brass)',
                marginBottom: 12,
                paddingBottom: 8,
                borderBottom: '2px solid var(--line)',
              }}
            >
              {compName}
            </h2>
            {comps.map((f) => (
              <div
                key={f.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 0',
                  borderBottom: '1px solid var(--line)',
                  fontSize: 14,
                }}
              >
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <Badge name={f.home_team_name} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {f.home_team_name}
                  </span>
                </div>
                <div style={{ minWidth: 60, textAlign: 'center', fontWeight: 800 }}>
                  {f.home_goals != null && f.away_goals != null ? `${f.home_goals} - ${f.away_goals}` : 'v'}
                </div>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end', minWidth: 0 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {f.away_team_name}
                  </span>
                  <Badge name={f.away_team_name} />
                </div>
              </div>
            ))}
          </section>
        ))}

      {!loading && season && fixtures.length === 0 && (
        <p style={{ color: 'var(--muted)', fontSize: 14 }}>No results found for this season.</p>
      )}
    </div>
  )
}
