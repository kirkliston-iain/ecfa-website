import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'

const SEASONS = [
  '2013/14', '2014/15', '2015/16', '2016/17', '2017/18', '2018/19',
  '2019/20', '2020/21', '2021/22', '2022/23', '2023/24', '2024/25', '2025/26',
]
const COMPETITIONS = ['League', 'League Cup', 'Knockout Cup', 'Brian Latto Cup']
const SHORT_COMPETITIONS = {
  League: 'Lge',
  'League Cup': 'LC',
  'Knockout Cup': 'KC',
  'Brian Latto Cup': 'BLC',
}

function Cell({ row }) {
  if (!row || row.status === 'not_existing') return <span style={{ color: 'var(--line)' }}>**</span>
  if (row.status === 'void') return <span style={{ color: 'var(--line)' }}>*</span>
  if (row.team_id)
    return (
      <Link to={`/teams/${row.team_id}`} style={{ color: 'var(--brass)', textDecoration: 'underline' }}>
        {row.winner_name}
      </Link>
    )
  return <span>{row.winner_name}</span>
}

export default function HonoursPage() {
  const [loading, setLoading] = useState(true)
  const [grid, setGrid] = useState({})
  const [totals, setTotals] = useState([])

  useEffect(() => {
    let cancelled = false

    async function load() {
      const { data } = await supabase
        .from('honours')
        .select('season, competition, status, winner_name, team_id')

      if (cancelled) return

      const g = {}
      const totalsMap = {}

      for (const row of data || []) {
        g[`${row.season}|${row.competition}`] = row

        if (row.status !== 'winner') continue
        const key = row.team_id || `name:${row.winner_name}`
        if (!totalsMap[key]) {
          totalsMap[key] = {
            key,
            name: row.winner_name,
            teamId: row.team_id,
            League: 0,
            'League Cup': 0,
            'Knockout Cup': 0,
            'Brian Latto Cup': 0,
            total: 0,
          }
        }
        totalsMap[key][row.competition] = (totalsMap[key][row.competition] || 0) + 1
        totalsMap[key].total += 1
      }

      const totalsList = Object.values(totalsMap).sort(
        (a, b) => b.total - a.total || a.name.localeCompare(b.name)
      )

      setGrid(g)
      setTotals(totalsList)
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) return <div className="container" style={{ padding: 48 }}>Loading…</div>

  return (
    <div className="container" style={{ padding: '32px 20px 48px' }}>
      <h1 style={{ fontSize: 30, marginBottom: 4 }}>Major Honours</h1>
      <p style={{ color: 'var(--muted)', marginBottom: 32 }}>
        Season-by-season winners across every ECFA competition.
      </p>

      <h2 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 16 }}>
        Season by Season
      </h2>
      <div className="honours-season-scroll" style={{ overflowX: 'auto', marginBottom: 12 }}>
        <table className="honours-season-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
          <thead>
            <tr style={{ borderBottom: '3px solid var(--brass)' }}>
              <th style={thStyle('left')}>Season</th>
              {COMPETITIONS.map((c) => (
                <th key={c} style={thStyle('left')}>
                  <span className="honours-long-label">{c}</span>
                  <span className="honours-short-label">{SHORT_COMPETITIONS[c]}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SEASONS.map((season) => (
              <tr key={season} style={{ borderBottom: '1px solid var(--line)' }}>
                <td style={{ padding: '8px', fontWeight: 700, whiteSpace: 'nowrap' }}>{season}</td>
                {COMPETITIONS.map((c) => (
                  <td key={c} style={{ padding: '8px' }}>
                    <Cell row={grid[`${season}|${c}`]} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 40 }}>
        * Season void (Covid) &nbsp;&nbsp; ** Tournament did not exist yet
      </p>

      <h2 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 16 }}>
        Total Honours
      </h2>
      <div className="honours-total-scroll" style={{ overflowX: 'auto' }}>
        <table className="honours-total-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: '3px solid var(--brass)' }}>
              <th style={thStyle('left')}>#</th>
              <th style={thStyle('left')}>Team</th>
              <th style={thStyle()}><span className="honours-long-label">League</span><span className="honours-short-label">Lge</span></th>
              <th style={thStyle()}><span className="honours-long-label">League Cup</span><span className="honours-short-label">LC</span></th>
              <th style={thStyle()}><span className="honours-long-label">Knockout Cup</span><span className="honours-short-label">KC</span></th>
              <th style={thStyle()}><span className="honours-long-label">Brian Latto Cup</span><span className="honours-short-label">BLC</span></th>
              <th style={thStyle()}><span className="honours-long-label">Total</span><span className="honours-short-label">Tot</span></th>
            </tr>
          </thead>
          <tbody>
            {totals.map((t, i) => (
              <tr key={t.key} style={{ borderBottom: '1px solid var(--line)' }}>
                <td style={{ padding: '10px 8px' }}>{i + 1}</td>
                <td style={{ padding: '10px 8px', fontWeight: 600 }}>
                  {t.teamId ? (
                    <Link to={`/teams/${t.teamId}`} style={{ color: 'var(--brass)', textDecoration: 'underline' }}>
                      {t.name}
                    </Link>
                  ) : (
                    t.name
                  )}
                </td>
                <td style={tdStyle}>{t.League || ''}</td>
                <td style={tdStyle}>{t['League Cup'] || ''}</td>
                <td style={tdStyle}>{t['Knockout Cup'] || ''}</td>
                <td style={tdStyle}>{t['Brian Latto Cup'] || ''}</td>
                <td style={{ ...tdStyle, fontWeight: 800, color: 'var(--ink)' }}>{t.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const tdStyle = { padding: '10px 8px', textAlign: 'center' }

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
