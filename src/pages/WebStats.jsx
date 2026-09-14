import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'

function pageCategory(path) {
  if (path.startsWith('/fixtures/')) return 'Matches'
  if (path === '/competitions' || path === '/standings' || path.startsWith('/competitions/')) return 'Competitions'
  if (path === '/teams' || path.startsWith('/teams/')) return 'Teams'
  if (path === '/scorers') return 'Players'
  return 'Other pages'
}

function makeDailySeries(rows) {
  const byDate = Object.fromEntries((rows || []).map((row) => [String(row.date).slice(0, 10), Number(row.views)]))
  const series = []
  const today = new Date()
  for (let offset = 59; offset >= 0; offset -= 1) {
    const date = new Date(today)
    date.setDate(today.getDate() - offset)
    const key = date.toISOString().slice(0, 10)
    series.push({ date: key, views: byDate[key] || 0 })
  }
  return series
}

function DailyChart({ rows }) {
  const width = 720
  const height = 250
  const pad = { top: 18, right: 12, bottom: 42, left: 42 }
  const maximum = Math.max(5, ...rows.map((row) => row.views))
  const chartHeight = height - pad.top - pad.bottom
  const chartWidth = width - pad.left - pad.right
  const slot = chartWidth / rows.length
  const tickMaximum = Math.ceil(maximum / 5) * 5

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Daily page views over the last 60 days" style={{ width: '100%', minWidth: 620, display: 'block' }}>
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = pad.top + chartHeight * (1 - ratio)
          return (
            <g key={ratio}>
              <line x1={pad.left} x2={width - pad.right} y1={y} y2={y} stroke="#d8dee3" strokeWidth="1" />
              <text x={pad.left - 7} y={y + 4} textAnchor="end" fontSize="11" fill="#69747d">
                {Math.round(tickMaximum * ratio)}
              </text>
            </g>
          )
        })}
        {rows.map((row, index) => {
          const barHeight = (row.views / tickMaximum) * chartHeight
          return (
            <rect
              key={row.date}
              x={pad.left + index * slot + 1}
              y={pad.top + chartHeight - barHeight}
              width={Math.max(2, slot - 2)}
              height={barHeight}
              fill="var(--brass)"
              rx="1"
            >
              <title>{row.date}: {row.views} page views</title>
            </rect>
          )
        })}
        {rows.filter((_row, index) => index % 10 === 0 || index === rows.length - 1).map((row) => {
          const index = rows.findIndex((item) => item.date === row.date)
          return (
            <text
              key={row.date}
              x={pad.left + index * slot + slot / 2}
              y={height - 10}
              textAnchor="middle"
              fontSize="10"
              fill="#69747d"
            >
              {new Date(row.date + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' })}
            </text>
          )
        })}
      </svg>
    </div>
  )
}

function TotalCard({ title, value }) {
  return (
    <div style={totalCardStyle}>
      <div style={{ color: 'var(--brass)', fontWeight: 800, fontSize: 14 }}>{title}</div>
      <div style={{ fontSize: 38, lineHeight: 1.15, fontWeight: 900, marginTop: 8 }}>
        {Number(value || 0).toLocaleString()}
      </div>
      <div style={{ color: 'var(--muted)', fontSize: 14 }}>Page views</div>
    </div>
  )
}

function PageTable({ title, rows }) {
  if (rows.length === 0) return null
  return (
    <section style={panelStyle}>
      <h2 style={{ color: 'var(--brass)', fontSize: 18, margin: '0 0 14px' }}>{title}</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>
            <th style={thStyle}>Page</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Page views</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 10).map((row) => (
            <tr key={row.path}>
              <td style={tdStyle}>{row.label}</td>
              <td style={viewsCellStyle}>{Number(row.views).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

export default function WebStats() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [stats, setStats] = useState(null)
  const [labels, setLabels] = useState({})

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [{ data, error: statsError }, { data: fixtures }, { data: teams }, { data: competitions }] = await Promise.all([
          supabase.rpc('get_web_stats'),
          supabase.from('fixtures').select('id, fixture_date, home_score, away_score, home_team:home_team_id(name), away_team:away_team_id(name)'),
          supabase.from('teams').select('id, name'),
          supabase.from('competitions').select('slug, name'),
        ])
        if (statsError) throw statsError

        const pageLabels = {
          '/': 'Match Hub',
          '/standings': 'Competitions and standings',
          '/competitions': 'Competitions',
          '/scorers': 'Scorers',
          '/honours': 'Honours',
          '/history': 'History',
          '/teams': 'Teams',
          '/referees': 'Referees',
          '/downloads': 'Downloads',
          '/documents': 'Documents',
        }
        for (const fixture of fixtures || []) {
          const date = fixture.fixture_date
            ? new Date(fixture.fixture_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
            : 'Match'
          const score = fixture.home_score != null && fixture.away_score != null
            ? ` ${fixture.home_score}-${fixture.away_score}`
            : ''
          pageLabels[`/fixtures/${fixture.id}`] = `${date}: ${fixture.home_team?.name || 'TBC'}${score} ${fixture.away_team?.name || 'TBC'}`
        }
        for (const team of teams || []) pageLabels[`/teams/${team.id}`] = team.name
        for (const competition of competitions || []) pageLabels[`/competitions/${competition.slug}`] = competition.name

        if (!cancelled) {
          setStats(data)
          setLabels(pageLabels)
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Web statistics could not be loaded.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const daily = useMemo(() => makeDailySeries(stats?.daily || []), [stats])
  const pages = useMemo(
    () => (stats?.top_pages || []).map((row) => ({
      ...row,
      label: labels[row.path] || row.path,
      category: pageCategory(row.path),
    })),
    [stats, labels]
  )
  const groups = ['Matches', 'Competitions', 'Teams', 'Players', 'Other pages']

  if (loading) return <div className="container" style={{ padding: 48 }}>Loading web statistics…</div>
  if (error) return <div className="container" style={{ padding: 48, color: '#B3261E' }}>{error}</div>

  return (
    <div className="container" style={{ padding: '32px 20px 48px', maxWidth: 900 }}>
      <h1 style={{ fontSize: 30, marginBottom: 4 }}>Web Stats</h1>
      <p style={{ color: 'var(--muted)', marginBottom: 28 }}>
        Actual page views across the ECFA website.
      </p>

      <section style={panelStyle}>
        <h2 style={{ color: 'var(--brass)', fontSize: 20, margin: '0 0 8px' }}>Daily totals</h2>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>Page views over the last 60 days</div>
        <DailyChart rows={daily} />
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, margin: '16px 0 34px' }}>
        <TotalCard title="Last 30 days" value={stats?.last_30} />
        <TotalCard title="Last 60 days" value={stats?.last_60} />
        <TotalCard title="Last year" value={stats?.last_year} />
        <TotalCard title="All time" value={stats?.all_time} />
      </div>

      <h2 style={{ fontSize: 24, marginBottom: 4 }}>Top pages</h2>
      <p style={{ color: 'var(--muted)', marginTop: 0, marginBottom: 16 }}>
        Page views during the last 30 days
      </p>

      <PageTable title="All pages" rows={pages} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14, marginTop: 14 }}>
        {groups.map((group) => (
          <PageTable key={group} title={group} rows={pages.filter((page) => page.category === group)} />
        ))}
      </div>

      <p style={{ marginTop: 22, color: 'var(--muted)', fontSize: 12 }}>
        Tracking records only the page visited and the time of the visit. Admin and discipline pages are excluded.
      </p>
    </div>
  )
}

const panelStyle = {
  padding: 18,
  background: '#f5f8fa',
  border: '1px solid var(--line)',
  borderRadius: 8,
}

const totalCardStyle = {
  padding: 18,
  background: '#f5f8fa',
  border: '1px solid var(--line)',
  borderRadius: 8,
}

const thStyle = {
  padding: '7px 8px',
  color: 'var(--muted)',
  borderBottom: '1px solid var(--line)',
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: 0.4,
  textAlign: 'left',
}

const tdStyle = {
  padding: '8px',
  borderBottom: '1px solid var(--line)',
  verticalAlign: 'middle',
}

const viewsCellStyle = {
  ...tdStyle,
  width: 86,
  textAlign: 'right',
  fontWeight: 800,
  background: 'var(--brass)',
  color: '#fff',
}
