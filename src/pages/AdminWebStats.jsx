import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Link } from 'react-router-dom'

function pageCategory(path) {
  if (path.startsWith('/fixtures/')) return 'Matches'
  if (path === '/competitions' || path === '/standings' || path.startsWith('/competitions/')) return 'Competitions'
  if (path === '/teams' || path.startsWith('/teams/')) return 'Teams'
  if (path === '/scorers' || path.startsWith('/players/')) return 'Players'
  return 'Other pages'
}

function makeDailySeries(rows) {
  const byDate = Object.fromEntries((rows || []).map((row) => [String(row.date).slice(0, 10), Number(row.views)]))
  const series = []
  const today = new Date()
  for (let offset = 6; offset >= 0; offset -= 1) {
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
  const pad = { top: 30, right: 12, bottom: 42, left: 42 }
  const maximum = Math.max(5, ...rows.map((row) => row.views))
  const chartHeight = height - pad.top - pad.bottom
  const chartWidth = width - pad.left - pad.right
  const slot = chartWidth / rows.length
  const tickMaximum = Math.ceil(maximum / 5) * 5

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Daily page views over the last 7 days" style={{ width: '100%', display: 'block' }}>
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
            <g key={row.date}>
              <rect
                x={pad.left + index * slot + 1}
                y={pad.top + chartHeight - barHeight}
                width={Math.max(2, slot - 2)}
                height={barHeight}
                fill="var(--brass)"
                rx="1"
              ><title>{row.date}: {row.views} page views</title></rect>
              <text x={pad.left + index * slot + slot / 2} y={pad.top + chartHeight - barHeight - 6} textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--ink)">{row.views.toLocaleString()}</text>
            </g>
          )
        })}
        {rows.map((row) => {
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

function TotalCard({ title, value, onClick }) {
  return (
    <button type="button" onClick={onClick} style={{ ...totalCardStyle, textAlign: 'left', cursor: 'pointer', font: 'inherit', color: 'var(--ink)' }}>
      <div style={{ color: 'var(--brass)', fontWeight: 800, fontSize: 14 }}>{title}</div>
      <div style={{ fontSize: 38, lineHeight: 1.15, fontWeight: 900, marginTop: 8 }}>
        {Number(value || 0).toLocaleString()}
      </div>
      <div style={{ color: 'var(--muted)', fontSize: 14 }}>Page views</div>
    </button>
  )
}

function formatDuration(seconds) {
  const value = Number(seconds || 0)
  return `${Math.floor(value / 60)}m ${String(value % 60).padStart(2, '0')}s`
}

function describePage(path, labels) {
  if (path === '/search') return 'Opened site search'
  if (path === '/teams') return 'Opened Teams'
  if (path.startsWith('/players/')) return `Viewed player: ${labels[path] || 'profile no longer available'}`
  if (path.startsWith('/teams/')) return `Viewed team: ${labels[path] || 'team no longer available'}`
  if (path.startsWith('/fixtures/')) return `Viewed match: ${labels[path] || 'match no longer available'}`
  if (path.startsWith('/competitions/')) return `Viewed competition: ${labels[path] || 'competition no longer available'}`
  return `Opened ${labels[path] || path.replace(/^\//, '').replaceAll('-', ' ') || 'Match Hub'}`
}

function visitTimeline(visit, labels) {
  const pages = (visit.pages || []).map((row) => ({ ...row, kind: 'page' }))
  const actions = (visit.actions || []).map((row) => ({ ...row, kind: 'action' }))
  return [...pages, ...actions].sort((a, b) => a.at.localeCompare(b.at)).flatMap((row) => {
    if (row.kind === 'page') {
      const matchingSearch = actions.some((action) => action.action === 'search_result'
        && action.item === labels[row.path]
        && Math.abs(new Date(action.at) - new Date(row.at)) < 4000)
      if (matchingSearch) return []
      return [{ at: row.at, text: describePage(row.path, labels) }]
    }
    const text = row.action === 'search_result' ? `Opened “${row.item}” from search`
      : row.action === 'team_selection' ? `Selected ${row.item} in Teams`
        : row.action === 'download' ? `Downloaded ${row.item}`
          : row.action === 'view' ? `Viewed ${row.item}`
            : row.action === 'sponsor_click' ? `Clicked sponsor link: ${row.item}` : `${row.action}: ${row.item}`
    return [{ at: row.at, text }]
  })
}

function visitGroup(dateValue, period) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(dateValue)).map((part) => [part.type, part.value]))
  const day = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)))
  if (period === 'week') day.setUTCDate(day.getUTCDate() - (day.getUTCDay() + 6) % 7)
  if (period === 'month') day.setUTCDate(1)
  const key = day.toISOString().slice(0, 10)
  const date = day.toLocaleDateString('en-GB', {
    timeZone: 'UTC', day: period === 'month' ? undefined : 'numeric', month: 'long', year: 'numeric',
  })
  return { key, label: period === 'week' ? `Week of ${date}` : date }
}

function InteractionTable({ title, rows, empty, onSelect }) {
  return <section style={panelStyle}>
    <h2 style={{ color: 'var(--brass)', fontSize: 18, margin: '0 0 10px' }}>{title}</h2>
    {!rows.length ? <p style={{ color: 'var(--muted)', fontSize: 13, margin: 0 }}>{empty}</p> : (
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead><tr><th style={thStyle}>Item</th><th style={{ ...thStyle, textAlign: 'right' }}>Actions</th></tr></thead>
        <tbody>{rows.slice(0, 15).map((row) => <tr key={`${row.action}-${row.item}`}>
          <td style={tdStyle}><button type="button" onClick={() => onSelect(row)} style={tableButtonStyle}>{row.item}</button></td><td style={viewsCellStyle}>{Number(row.count).toLocaleString()}</td>
        </tr>)}</tbody>
      </table>
    )}
  </section>
}

function PageTable({ title, rows, onSelect }) {
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
              <td style={tdStyle}><button type="button" onClick={() => onSelect(row)} style={tableButtonStyle}>{row.label}</button></td>
              <td style={viewsCellStyle}>{Number(row.views).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

export default function AdminWebStats() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [stats, setStats] = useState(null)
  const [engagement, setEngagement] = useState(null)
  const [labels, setLabels] = useState({})
  const [selection, setSelection] = useState(null)
  const [history, setHistory] = useState(null)
  const [historyOffset, setHistoryOffset] = useState(0)
  const [expandedVisit, setExpandedVisit] = useState(null)
  const [visitGrouping, setVisitGrouping] = useState('day')
  const [expandedGroup, setExpandedGroup] = useState(null)
  const [historyError, setHistoryError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [{ data, error: statsError }, { data: engagementData }, { data: fixtures }, { data: teams }, { data: competitions }, { data: players }] = await Promise.all([
          supabase.rpc('get_admin_web_stats'),
          supabase.rpc('get_admin_web_engagement_stats'),
          supabase.from('fixtures').select('id, fixture_date, home_score, away_score, home_team:home_team_id(name), away_team:away_team_id(name)'),
          supabase.from('teams').select('id, name'),
          supabase.from('competitions').select('slug, name'),
          supabase.from('players').select('id, first_name, last_name').limit(1000),
        ])
        if (statsError) throw statsError

        const pageLabels = {
          '/': 'Match Hub',
          '/standings': 'Competitions and standings',
          '/competitions': 'Competitions',
          '/stats': 'Football statistics',
          '/scorers': 'Scorers',
          '/honours': 'Honours',
          '/archive': 'Archive',
          '/history': 'Archive (legacy link)',
          '/teams': 'Teams',
          '/search': 'Site search',
          '/downloads/player-report': 'Player scoring report',
          '/downloads/referee-report': 'Referee report',
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
        for (const player of players || []) pageLabels[`/players/${player.id}`] = `${player.first_name || ''} ${player.last_name || ''}`.trim()
        for (const competition of competitions || []) pageLabels[`/competitions/${competition.slug}`] = competition.name

        if (!cancelled) {
          setStats(data)
          setEngagement(engagementData)
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

  useEffect(() => {
    if (!selection) return undefined
    let cancelled = false
    setHistory(null)
    setHistoryError('')
    supabase.rpc('get_admin_visit_history', {
      p_days: selection.days || 30,
      p_action: selection.action || null,
      p_path: selection.path || null,
      p_item: selection.item || null,
      p_offset: historyOffset,
    }).then(({ data, error: loadError }) => {
      if (cancelled) return
      if (loadError) setHistoryError('Could not load visit history.')
      else setHistory(data)
    })
    return () => { cancelled = true }
  }, [selection, historyOffset])

  function selectHistory(next) {
    setSelection(next)
    setHistoryOffset(0)
    setExpandedVisit(null)
    setExpandedGroup(null)
    window.setTimeout(() => document.getElementById('visit-history')?.scrollIntoView({ behavior: 'smooth' }), 50)
  }

  const daily = useMemo(() => makeDailySeries(stats?.daily || []), [stats])
  const groupedVisits = useMemo(() => {
    const groupsByDate = new Map()
    const visits = history?.visits || []
    visits.forEach((visit, index) => {
      const group = visitGroup(visit.started_at, visitGrouping)
      if (!groupsByDate.has(group.key)) groupsByDate.set(group.key, { ...group, visits: [] })
      groupsByDate.get(group.key).visits.push({ ...visit, displayNumber: historyOffset + index + 1 })
    })
    return Array.from(groupsByDate.values())
  }, [history, historyOffset, visitGrouping])
  const pages = useMemo(
    () => (stats?.top_pages || []).map((row) => ({
      ...row,
      label: labels[row.path] || row.path,
      category: pageCategory(row.path),
    })),
    [stats, labels]
  )
  const groups = ['Matches', 'Competitions', 'Teams', 'Players', 'Other pages']
  const interactions = engagement?.top_interactions || []

  if (loading) return <div className="container" style={{ padding: 48 }}>Loading web statistics…</div>
  if (error) return <div className="container" style={{ padding: 48, color: '#B3261E' }}>{error}</div>

  return (
    <div className="container" style={{ padding: '32px 20px 48px', maxWidth: 900 }}>
      <Link to="/admin/dashboard" style={{ color: 'var(--brass)', fontSize: 13 }}>← Admin dashboard</Link>
      <h1 style={{ fontSize: 30, margin: '12px 0 4px' }}>Web Stats — Admin</h1>
      <p style={{ color: 'var(--muted)', marginBottom: 28 }}>
        Actual page views across the ECFA website.
      </p>

      <section style={{ ...panelStyle, marginBottom: 16 }}>
        <h2 style={{ color: 'var(--brass)', fontSize: 20, margin: '0 0 8px' }}>Individual visits</h2>
        <p style={{ color: 'var(--muted)', fontSize: 13, margin: '0 0 14px' }}>One visit when someone enters ECFA from another site or directly. Moving between ECFA pages does not add another. Someone returning later can count again. Tracking starts with this update.</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, marginBottom: 14 }}>
          <div><strong style={{ fontSize: 27 }}>{Number(stats?.arrivals_today || 0).toLocaleString()}</strong><div>Today</div></div>
          <div><strong style={{ fontSize: 27 }}>{Number(stats?.arrivals_7 || 0).toLocaleString()}</strong><div>Last 7 days</div></div>
          <div><strong style={{ fontSize: 27 }}>{Number(stats?.arrivals_30 || 0).toLocaleString()}</strong><div>Last 30 days</div></div>
        </div>
        <details><summary style={{ cursor: 'pointer', fontWeight: 700 }}>Visits by day</summary>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(105px, 1fr))', gap: 8, marginTop: 12, fontSize: 13 }}>
            {(stats?.daily_arrivals || []).map((day) => <div key={day.date} style={{ borderBottom: '1px solid var(--line)', padding: '5px 0' }}>
              {new Date(`${day.date}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}: <strong>{Number(day.arrivals).toLocaleString()}</strong>
            </div>)}
          </div>
        </details>
      </section>

      <section style={panelStyle}>
        <h2 style={{ color: 'var(--brass)', fontSize: 20, margin: '0 0 8px' }}>Daily totals</h2>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>Page views over the last 7 days</div>
        <DailyChart rows={daily} />
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, margin: '16px 0 34px' }}>
        <TotalCard title="Last 7 days" value={stats?.page_views_7} onClick={() => selectHistory({ title: 'Last 7 days', days: 7 })} />
        <TotalCard title="Last 30 days" value={stats?.last_30} onClick={() => selectHistory({ title: 'Last 30 days', days: 30 })} />
        <section style={totalCardStyle}><div style={{ color: 'var(--brass)', fontWeight: 800, fontSize: 14 }}>Daily average · 30 days</div><div style={{ fontSize: 38, lineHeight: 1.15, fontWeight: 900, marginTop: 8 }}>{Math.round(Number(stats?.last_30 || 0) / 30).toLocaleString()}</div><div style={{ color: 'var(--muted)', fontSize: 14 }}>Page views per day</div></section>
        <TotalCard title="Last 60 days" value={stats?.last_60} onClick={() => selectHistory({ title: 'Last 60 days', days: 60 })} />
        <TotalCard title="Last year" value={stats?.last_year} onClick={() => selectHistory({ title: 'Last year', days: 365 })} />
        <TotalCard title="All time" value={stats?.all_time} onClick={() => selectHistory({ title: 'Tracked visit history', days: 365 })} />
      </div>

      <h2 style={{ fontSize: 24, marginBottom: 4 }}>Visits and activity</h2>
      <p style={{ color: 'var(--muted)', marginTop: 0, fontSize: 13 }}>New tracking, covering the last 30 days from when this feature was added. Time is an estimate while the tab is active; old page views cannot be used to calculate visit length.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, margin: '16px 0 20px' }}>
        <button type="button" onClick={() => selectHistory({ title: 'Sponsor link clicks', days: 30, action: 'sponsor_click' })} style={metricButtonStyle}><strong>Sponsor link clicks</strong><span>{Number(engagement?.sponsor_clicks_30 || 0).toLocaleString()}</span><small>Last 30 days · {Number(engagement?.sponsor_clicks_all_time || 0).toLocaleString()} since tracking began</small></button>
        <button type="button" onClick={() => selectHistory({ title: 'Visits by active time', days: 30 })} style={metricButtonStyle}><strong>Average time per visit</strong><span>{formatDuration(engagement?.average_seconds_30)}</span><small>{Number(engagement?.visits_30 || 0).toLocaleString()} tracked visits</small></button>
        <button type="button" onClick={() => selectHistory({ title: 'Visits with downloads', days: 30, action: 'download' })} style={metricButtonStyle}><strong>Downloads</strong><span>{Number(engagement?.downloads_30 || 0).toLocaleString()}</span><small>Last 30 days</small></button>
        <button type="button" onClick={() => selectHistory({ title: 'Visits with views', days: 30, action: 'view' })} style={metricButtonStyle}><strong>Document/report views</strong><span>{Number(engagement?.views_30 || 0).toLocaleString()}</span><small>Last 30 days</small></button>
        <button type="button" onClick={() => selectHistory({ title: 'Visits from Search', days: 30, action: 'search_result' })} style={metricButtonStyle}><strong>Search result opens</strong><span>{Number(engagement?.search_clicks_30 || 0).toLocaleString()}</span><small>Last 30 days</small></button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14, marginBottom: 34 }}>
        <InteractionTable title="Sponsor links clicked" rows={interactions.filter((row) => row.action === 'sponsor_click')} empty="No sponsor link clicks yet." onSelect={(row) => selectHistory({ title: row.item, days: 30, action: row.action, item: row.item })} />
        <InteractionTable title="What was downloaded" rows={interactions.filter((row) => row.action === 'download')} empty="No tracked downloads yet." onSelect={(row) => selectHistory({ title: row.item, days: 30, action: row.action, item: row.item })} />
        <InteractionTable title="What was viewed" rows={interactions.filter((row) => row.action === 'view')} empty="No tracked document or report views yet." onSelect={(row) => selectHistory({ title: row.item, days: 30, action: row.action, item: row.item })} />
        <InteractionTable title="Pages opened from Search" rows={interactions.filter((row) => row.action === 'search_result')} empty="No search result opens yet." onSelect={(row) => selectHistory({ title: row.item, days: 30, action: row.action, item: row.item })} />
      </div>

      <h2 style={{ fontSize: 24, marginBottom: 4 }}>Top pages</h2>
      <p style={{ color: 'var(--muted)', marginTop: 0, marginBottom: 16 }}>
        Page views during the last 30 days
      </p>

      <PageTable title="All pages" rows={pages} onSelect={(row) => selectHistory({ title: row.label, days: 30, path: row.path })} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14, marginTop: 14 }}>
        {groups.map((group) => (
          <PageTable key={group} title={group} rows={pages.filter((page) => page.category === group)} onSelect={(row) => selectHistory({ title: row.label, days: 30, path: row.path })} />
        ))}
      </div>

      <section id="visit-history" style={{ ...panelStyle, marginTop: 24 }}>
        <h2 style={{ fontSize: 22, margin: '0 0 8px' }}>{selection ? `Visit history: ${selection.title}` : 'Visit history'}</h2>
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>Select any total or row above to inspect anonymous visits. Historical views before visit linking cannot be attributed to a visit. Names and identities are not collected.</p>
        {!selection && <p style={{ fontSize: 14 }}>Choose a figure above.</p>}
        {historyError && <p role="alert" style={{ color: '#B3261E' }}>{historyError}</p>}
        {selection && !history && !historyError && <p>Loading visits…</p>}
        {history && <>
          <p style={{ fontSize: 13, fontWeight: 700 }}>{Number(history.total || 0).toLocaleString()} linked visits</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', margin: '12px 0' }}>
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>Group by</span>
            {['day', 'week', 'month'].map((period) => <button key={period} type="button" aria-pressed={visitGrouping === period} onClick={() => { setVisitGrouping(period); setExpandedGroup(null); setExpandedVisit(null) }} style={{ padding: '7px 12px', border: '1px solid var(--line)', borderRadius: 6, background: visitGrouping === period ? 'var(--ink)' : '#fff', color: visitGrouping === period ? '#fff' : 'var(--ink)', fontWeight: 700, cursor: 'pointer' }}>{period[0].toUpperCase() + period.slice(1)}</button>)}
          </div>
          <p style={{ color: 'var(--muted)', fontSize: 12, margin: '0 0 10px' }}>Groups show the visits loaded on this page, up to 50 at a time.</p>
          {groupedVisits.map((group) => <div key={group.key} style={{ borderTop: '1px solid var(--line)' }}>
            <button type="button" aria-expanded={expandedGroup === group.key} onClick={() => { setExpandedGroup((current) => current === group.key ? null : group.key); setExpandedVisit(null) }} style={{ width: '100%', padding: '12px 0', display: 'flex', justifyContent: 'space-between', gap: 12, border: 0, background: 'transparent', color: 'var(--ink)', font: 'inherit', fontWeight: 800, textAlign: 'left', cursor: 'pointer' }}>
              <span>{expandedGroup === group.key ? '▾' : '▸'} {group.label}</span>
              <span>{group.visits.length} shown</span>
            </button>
            {expandedGroup === group.key && <div style={{ paddingLeft: 12 }}>
              {group.visits.map((visit) => <div key={visit.id} style={{ borderTop: '1px solid var(--line)', padding: '8px 0' }}>
                <button type="button" aria-expanded={expandedVisit === visit.id} onClick={() => setExpandedVisit((current) => current === visit.id ? null : visit.id)} style={{ ...tableButtonStyle, width: '100%', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span>Anonymous visit {visit.displayNumber} · {new Date(visit.started_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Europe/London' })}</span>
                  <strong>{formatDuration(visit.active_seconds)}</strong>
                </button>
                {expandedVisit === visit.id && <ul style={{ listStyle: 'none', margin: '8px 0', padding: 0, fontSize: 13 }}>
                  {visitTimeline(visit, labels).map((row, i) => <li key={i} style={{ display: 'grid', gridTemplateColumns: '62px minmax(0, 1fr)', gap: 8, padding: '7px 0', borderTop: '1px solid var(--line)', lineHeight: 1.35 }}>
                    <time style={{ color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>{new Date(row.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Europe/London' })}</time>
                    <span style={{ overflowWrap: 'anywhere' }}>{row.text}</span>
                  </li>)}
                  {!(visit.pages?.length || visit.actions?.length) && <li>No linked actions recorded for this visit.</li>}
                </ul>}
              </div>)}
            </div>}
          </div>)}
          {Number(history.total) > 50 && <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
            <button type="button" disabled={historyOffset === 0} onClick={() => { setHistoryOffset((n) => Math.max(0, n - 50)); setExpandedGroup(null); setExpandedVisit(null) }}>Previous</button>
            <button type="button" disabled={historyOffset + 50 >= Number(history.total)} onClick={() => { setHistoryOffset((n) => n + 50); setExpandedGroup(null); setExpandedVisit(null) }}>Next</button>
          </div>}
        </>}
      </section>

      <p style={{ marginTop: 22, color: 'var(--muted)', fontSize: 12 }}>
        Page-view totals are separate from tracked visits. Engagement counts are anonymous aggregates; admin and discipline pages are excluded from visit timing.
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

const tableButtonStyle = { border: 0, padding: 0, background: 'transparent', color: 'var(--ink)', font: 'inherit', textAlign: 'left', cursor: 'pointer', textDecoration: 'underline' }
const metricButtonStyle = { ...totalCardStyle, display: 'grid', gap: 5, textAlign: 'left', cursor: 'pointer', color: 'var(--ink)', font: 'inherit' }

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
