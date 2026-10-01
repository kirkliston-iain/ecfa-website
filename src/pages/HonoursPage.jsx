import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { historicPenaltyWinnerName } from '../utils/historicFixtureOutcome'

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

const EARLY_CUP_FINALS = [
  { season: '2013/14', competition: 'League Cup', home: 'Bensons', away: 'South East Saints', score: '1–1', detail: 'Bensons won 4–2 on penalties' },
  { season: '2014/15', competition: 'League Cup', home: 'White Lightning', away: 'Bristo Memorial', score: '3–2', detail: 'After extra time (2–2 at full time)' },
  { season: '2015/16', competition: 'League Cup', home: 'White Lightning', away: 'Niddrie', score: '4–1' },
  { season: '2016/17', competition: 'League Cup', home: 'Broxburn', away: 'Gorgie', score: '2–2', detail: 'Broxburn won 4–3 on penalties' },
]

function finalCompetition(name) {
  const label = String(name || '').toLowerCase()
  if (label.includes('league cup')) return 'League Cup'
  if (label.includes('knockout cup')) return 'Knockout Cup'
  if (label.includes('brian latto') || label.includes('consolation cup')) return 'Brian Latto Cup'
  return ''
}

function archivedFinal(fixture) {
  const comment = fixture.comment || ''
  const winner = historicPenaltyWinnerName(fixture)
    || (/won on pens|won on penalties/i.test(comment)
      ? [fixture.home_team_name, fixture.away_team_name].find((name) => comment.toLowerCase().includes(name.toLowerCase()))
      : '')
  const penaltyScore = fixture.comment?.match(/\b(\d+)\s*[-–]\s*(\d+)\b/)
  return {
    season: fixture.season,
    competition: finalCompetition(fixture.competition_name),
    home: fixture.home_team_name,
    away: fixture.away_team_name,
    score: `${fixture.home_goals}–${fixture.away_goals}`,
    detail: winner ? `${winner} won${penaltyScore ? ` ${penaltyScore[1]}–${penaltyScore[2]}` : ''} on penalties` : '',
    archivedAsConsolation: fixture.competition_name.toLowerCase().includes('consolation cup'),
  }
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
  const [cupFinals, setCupFinals] = useState([])
  const [finalSeason, setFinalSeason] = useState('')
  const [finalCompetitionFilter, setFinalCompetitionFilter] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      const [{ data }, { data: historicFinals }] = await Promise.all([
        supabase.from('honours').select('season, competition, status, winner_name, team_id'),
        supabase.from('historic_fixtures')
          .select('season, competition_name, home_team_name, home_goals, away_team_name, away_goals, comment, penalty_winner_name')
          .ilike('competition_name', '%final%').range(0, 9999),
      ])

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
        (a, b) =>
          b.total - a.total ||
          b.League - a.League ||
          b['League Cup'] - a['League Cup'] ||
          b['Knockout Cup'] - a['Knockout Cup'] ||
          b['Brian Latto Cup'] - a['Brian Latto Cup'] ||
          a.name.localeCompare(b.name)
      )

      setGrid(g)
      setTotals(totalsList)
      const recorded = (historicFinals || [])
        .filter((fixture) => {
          const name = fixture.competition_name?.toLowerCase() || ''
          return name.endsWith('final') && !name.includes('semi') && !name.includes('quarter')
            && fixture.home_goals != null && fixture.away_goals != null && finalCompetition(name)
        })
        .map(archivedFinal)
      const recordedKeys = new Set(recorded.map((row) => `${row.season}|${row.competition}`))
      setCupFinals([...recorded, ...EARLY_CUP_FINALS.filter((row) => !recordedKeys.has(`${row.season}|${row.competition}`))]
        .sort((left, right) => right.season.localeCompare(left.season, undefined, { numeric: true })
          || COMPETITIONS.indexOf(left.competition) - COMPETITIONS.indexOf(right.competition)))
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) return <div className="container" style={{ padding: 48 }}>Loading…</div>

  const shownFinals = cupFinals.filter((final) =>
    (!finalSeason || final.season === finalSeason)
    && (!finalCompetitionFilter || final.competition === finalCompetitionFilter)
  )

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

      <section style={{ marginTop: 44 }}>
        <h2 style={{ fontSize: 22, margin: '0 0 6px' }}>Cup Final Results</h2>
        <p style={{ color: 'var(--muted)', fontSize: 14, margin: '0 0 18px' }}>
          Recorded scores and winners, including penalty shootouts and extra time.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'end', marginBottom: 18 }}>
          <label style={{ display: 'grid', gap: 5, flex: '1 1 150px', fontSize: 12, fontWeight: 700 }}>
            Season
            <select value={finalSeason} onChange={(e) => setFinalSeason(e.target.value)} style={finalSelectStyle}>
              <option value="">All seasons</option>
              {SEASONS.filter((season) => cupFinals.some((final) => final.season === season)).map((season) => <option key={season} value={season}>{season}</option>)}
            </select>
          </label>
          <label style={{ display: 'grid', gap: 5, flex: '1 1 170px', fontSize: 12, fontWeight: 700 }}>
            Competition
            <select value={finalCompetitionFilter} onChange={(e) => setFinalCompetitionFilter(e.target.value)} style={finalSelectStyle}>
              <option value="">All competitions</option>
              {COMPETITIONS.filter((competition) => competition !== 'League').map((competition) => <option key={competition} value={competition}>{competition}</option>)}
            </select>
          </label>
          <button type="button" onClick={() => { setFinalSeason(''); setFinalCompetitionFilter('') }} style={{ ...finalSelectStyle, fontWeight: 700, cursor: 'pointer' }}>View all</button>
        </div>
        <p style={{ color: 'var(--muted)', fontSize: 12 }}>{shownFinals.length} final{shownFinals.length === 1 ? '' : 's'} shown</p>
        {shownFinals.length === 0 && <p>No finals match those filters.</p>}
        <div style={{ display: 'grid', gap: 10 }}>
          {shownFinals.map((final) => (
            <div key={`${final.season}|${final.competition}`} style={{ border: '1px solid var(--line)', borderLeft: '4px solid var(--brass)', borderRadius: 8, padding: '12px 14px' }}>
              <div style={{ color: 'var(--brass)', fontSize: 12, fontWeight: 800, marginBottom: 5 }}>{final.season} · {final.competition}</div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{final.home} {final.score} {final.away}</div>
              {final.detail && <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>{final.detail}</div>}
              {final.archivedAsConsolation && <div style={{ color: 'var(--muted)', fontSize: 11, marginTop: 4 }}>Recorded in the fixture archive as Consolation Cup</div>}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

const tdStyle = { padding: '10px 8px', textAlign: 'center' }
const finalSelectStyle = { padding: '9px 11px', borderRadius: 6, border: '1px solid var(--line)', background: '#fff', color: 'var(--ink)', font: 'inherit' }

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
