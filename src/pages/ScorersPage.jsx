import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'

const SEASON_OPTIONS = [
  { value: 'overall', label: 'Overall (All-time)' },
  { value: '2026/27', label: '2026/27 (current)' },
  { value: '2025/26', label: '2025/26' },
  { value: '2024/25', label: '2024/25' },
  { value: '2023/24', label: '2023/24' },
  { value: '2022/23', label: '2022/23' },
  { value: '2021/22', label: '2021/22' },
  { value: '2019/20', label: '2019/20' },
  { value: '2018/19', label: '2018/19' },
  { value: '2017/18', label: '2017/18' },
  { value: '2016/17', label: '2016/17' },
  { value: '2015/16', label: '2015/16' },
]

// Supabase/PostgREST caps a plain select at 1000 rows by default. historic_scorers
// has more rows than that, so a single query silently truncates the tail end of the
// table. Page through it in batches of 1000 so every row is loaded.
async function fetchAllHistoricScorers() {
  const pageSize = 1000
  let from = 0
  let all = []
  while (true) {
    const { data, error } = await supabase
      .from('historic_scorers')
      .select('player_name, team_name, goals, season')
      .range(from, from + pageSize - 1)

    if (error || !data) break
    all = all.concat(data)
    if (data.length < pageSize) break
    from += pageSize
  }
  return all
}

export default function ScorersPage() {
  const [season, setSeason] = useState('overall')
  const [loading, setLoading] = useState(true)
  const [historic, setHistoric] = useState([])
  const [current, setCurrent] = useState([])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)

      const hist = await fetchAllHistoricScorers()

      const { data: scorers } = await supabase
        .from('fixture_scorers')
        .select('goals, player:player_id(first_name, last_name), team:team_id(name)')

      if (!cancelled) {
        setHistoric(hist || [])
        setCurrent(
          (scorers || []).map((s) => ({
            player_name: `${s.player?.first_name || ''} ${s.player?.last_name || ''}`.trim(),
            team_name: s.team?.name || '',
            goals: Number(s.goals),
          }))
        )
        setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  const rows = useMemo(() => {
    if (season === 'overall') {
      const totals = {}
      for (const r of historic) {
        totals[r.player_name] = (totals[r.player_name] || 0) + Number(r.goals)
      }
      for (const r of current) {
        totals[r.player_name] = (totals[r.player_name] || 0) + r.goals
      }
      return Object.entries(totals)
        .map(([player_name, goals]) => ({ player_name, goals }))
        .sort((a, b) => b.goals - a.goals)
    }

    if (season === '2026/27') {
      const totals = {}
      const teamOf = {}
      for (const r of current) {
        totals[r.player_name] = (totals[r.player_name] || 0) + r.goals
        teamOf[r.player_name] = r.team_name
      }
      return Object.entries(totals)
        .map(([player_name, goals]) => ({ player_name, team_name: teamOf[player_name], goals }))
        .sort((a, b) => b.goals - a.goals)
    }

    const totals = {}
    const teamOf = {}
    for (const r of historic) {
      if (r.season !== season) continue
      totals[r.player_name] = (totals[r.player_name] || 0) + Number(r.goals)
      teamOf[r.player_name] = r.team_name
    }
    return Object.entries(totals)
      .map(([player_name, goals]) => ({ player_name, team_name: teamOf[player_name], goals }))
      .sort((a, b) => b.goals - a.goals)
  }, [season, historic, current])

  if (loading) return <div className="container" style={{ padding: 48 }}>Loading…</div>

  const seasonLabel =
    season === 'overall'
      ? 'All-time career goals across every ECFA season on record.'
      : season === '2026/27'
        ? 'Goals scored so far this season.'
        : `Goals scored in the ${season} season.`

  return (
    <div className="container" style={{ padding: '32px 20px 48px' }}>
      <h1 style={{ fontSize: 30, marginBottom: 4 }}>Scorers</h1>
      <p style={{ color: 'var(--muted)', marginBottom: 24 }}>{seasonLabel}</p>

      <select
        value={season}
        onChange={(e) => setSeason(e.target.value)}
        style={{
          marginBottom: 28,
          padding: '8px 12px',
          fontSize: 14,
          borderRadius: 6,
          border: '1px solid var(--line)',
          background: '#fff',
        }}
      >
        {SEASON_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ borderBottom: '3px solid var(--brass)' }}>
            <th style={thStyle('left')}>#</th>
            <th style={thStyle('left')}>Player</th>
            {season !== 'overall' && <th style={thStyle('left')}>Team</th>}
            <th style={thStyle()}>Goals</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 100).map((row, i) => (
            <tr key={row.player_name} style={{ borderBottom: '1px solid var(--line)' }}>
              <td style={{ padding: '10px 8px' }}>{i + 1}</td>
              <td style={{ padding: '10px 8px', fontWeight: 600 }}>{row.player_name}</td>
              {season !== 'overall' && (
                <td style={{ padding: '10px 8px', color: 'var(--muted)' }}>{row.team_name}</td>
              )}
              <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 800, color: 'var(--ink)' }}>
                {row.goals}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={season === 'overall' ? 3 : 4} style={{ padding: '24px 8px', textAlign: 'center', color: 'var(--muted)' }}>
                No scorers recorded for this season.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function thStyle(align = 'center') {
  return {
    textAlign: align,
    padding: '8px',
    fontWeight: 700,
    color: 'var(--ink)',
    textTransform: 'uppercase',
    fontSize: 12,
    letterSpacing: 0.4,
  }
}
