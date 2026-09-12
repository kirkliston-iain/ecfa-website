import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'

const SEASONS = [
  '2013/14', '2014/15', '2015/16', '2016/17', '2017/18', '2018/19',
  '2019/20', '2020/21', '2021/22', '2022/23', '2023/24', '2024/25', '2025/26',
]

const COMPETITIONS = ['League', 'League Cup', 'Knockout Cup', 'Brian Latto Cup']

function Cell({ row }) {
  if (!row || row.status === 'not_existing') {
    return <span style={{ color: '#C7C2B0' }}>**</span>
  }
  if (row.status === 'void') {
    return <span style={{ color: '#C7C2B0' }}>*</span>
  }
  if (row.team_id) {
    return (
      <Link to={`/teams/${row.team_id}`} style={{ color: 'var(--brass)', textDecoration: 'underline' }}>
        {row.winner_name}
      </Link>
    )
  }
  return <span>{row.winner_name}</span>
}

export default function HonoursPage() {
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState([])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('honours')
        .select('season, competition, status, winner_name, team_id')
      if (!cancelled) {
        setRows(data || [])
        setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) return <div className="container" style={{ padding: 48 }}>Loading…</div>

  const grid = {}
  for (const r of rows) {
    grid[`${r.season}|${r.competition}`] = r
  }

  const totals = {}
  for (const r of rows) {
    if (r.status !== 'winner') continue
    const key = r.team_id || `name:${r.winner_name}`
    if (!totals[key]) {
      totals[key] = {
        name: r.winner_name,
        team_id: r.team_id,
        League: 0,
        'League Cup': 0,
        'Knockout Cup': 0,
        'Brian Latto Cup': 0,
      }
    }
    totals[key][r.competition] += 1
  }
  const totalRows = Object.values(totals)
    .map((t) => ({
      ...t,
      total: t.League + t['League Cup'] + t['Knockout Cup'] + t['Brian Latto Cup'],
    }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))

  return (
    <div className="container" style={{ padding: '40px 20px' }}>
      <h1 style={{ fontSize: 32, marginBottom: 8, color: 'var(--pitch)' }}>Major Honours</h1>
      <p style={{ color: '#8A8570', marginBottom: 40 }}>
        Season-by-season winners across every ECFA competition.
      </p>

      <h2 style={{ fontSize: 20, marginBottom: 16, paddingBottom: 8, borderBottom: '1px solid var(--line)' }}>
        Season by Season
      </h2>
      <div style={{ overflowX: 'auto', marginBottom: 16 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, minWidth: 640 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--pitch)' }}>
              <th style={{ textAlign: 'left', padding: '8px', fontFamily: 'var(--font-display)', color: 'var(--pitch)' }}>
                Season
              </th>
              {COMPETITIONS.map((c) => (
                <th key={c} style={{ textAlign: 'left', padding: '8px', fontFamily: 'var(--font-display)', color: 'var(--pitch)' }}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SEASONS.map((season, i) => (
              <tr
                key={season}
                style={{ borderBottom: '1px solid var(--line)', background: i % 2 === 0 ? 'rgba(0,0,0,0.02)' : 'transparent' }}
              >
                <td style={{ padding: '10px 8px', fontWeight: 600 }}>{season}</td>
                {COMPETITIONS.map((c) => (
                  <td key={c} style={{ padding: '10px 8px' }}>
                    <Cell row={grid[`${season}|${c}`]} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 12, color: '#8A8570', marginBottom: 48 }}>
        * Season void (Covid) &nbsp;&nbsp; ** Tournament did not exist yet
      </p>

      <h2 style={{ fontSize: 20, marginBottom: 16, paddingBottom: 8, borderBottom: '1px solid var(--line)' }}>
        Total Honours
      </h2>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, minWidth: 640 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--pitch)' }}>
              <th style={{ textAlign: 'left', padding: '8px', fontFamily: 'var(--font-display)', color: 'var(--pitch)' }}>#</th>
              <th style={{ textAlign: 'left', padding: '8px', fontFamily: 'var(--font-display)', color: 'var(--pitch)' }}>Team</th>
              {COMPETITIONS.map((c) => (
                <th key={c} style={{ textAlign: 'center', padding: '8px', fontFamily: 'var(--font-display)', color: 'var(--pitch)' }}>
                  {c}
                </th>
              ))}
              <th style={{ textAlign: 'center', padding: '8px', fontFamily: 'var(--font-display)', color: 'var(--pitch)' }}>
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {totalRows.map((t, i) => (
              <tr key={t.team_id || t.name} style={{ borderBottom: '1px solid var(--line)' }}>
                <td style={{ padding: '10px 8px' }}>{i + 1}</td>
                <td style={{ padding: '10px 8px', fontWeight: 500 }}>
                  {t.team_id ? (
                    <Link to={`/teams/${t.team_id}`} style={{ color: 'var(--brass)', textDecoration: 'underline' }}>
                      {t.name}
                    </Link>
                  ) : (
                    t.name
                  )}
                </td>
                {COMPETITIONS.map((c) => (
                  <td key={c} style={{ padding: '10px 8px', textAlign: 'center' }}>
                    {t[c] || ''}
                  </td>
                ))}
                <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700, color: 'var(--pitch)' }}>
                  {t.total}
                </td>
              </tr>
            ))}
            {totalRows.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: '24px 8px', textAlign: 'center', color: '#8A8570' }}>
                  No honours recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
