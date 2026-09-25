import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { historicDisplayedScore } from '../utils/historicFixtureOutcome'
import { historicTeamName } from '../utils/historicTeams'

const PAGE_SIZE = 1000

async function fetchAll(table, columns, orderColumn) {
  const rows = []
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = supabase.from(table).select(columns).range(from, from + PAGE_SIZE - 1)
    if (orderColumn) query = query.order(orderColumn, { ascending: false })
    const { data, error } = await query
    if (error) throw error
    rows.push(...(data || []))
    if ((data || []).length < PAGE_SIZE) return rows
  }
}

function belongsToTeam(value, teamName) {
  return historicTeamName(value) === teamName
}

export default function PreviousTeam() {
  const { teamName: encodedName } = useParams()
  const teamName = historicTeamName(decodeURIComponent(encodedName || ''))
  const [fixtures, setFixtures] = useState([])
  const [scorers, setScorers] = useState([])
  const [honours, setHonours] = useState([])
  const [season, setSeason] = useState('Overall')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError('')
      try {
        const [allFixtures, allScorers, allHonours] = await Promise.all([
          fetchAll('historic_fixtures', 'id, season, competition_name, fixture_date, home_team_name, home_goals, away_team_name, away_goals, comment, penalty_winner_name', 'fixture_date'),
          fetchAll('historic_scorers', 'season, player_name, team_name, goals'),
          fetchAll('honours', 'season, competition, status, winner_name'),
        ])
        if (cancelled) return
        setFixtures(allFixtures.filter((row) => belongsToTeam(row.home_team_name, teamName) || belongsToTeam(row.away_team_name, teamName)))
        setScorers(allScorers.filter((row) => belongsToTeam(row.team_name, teamName)))
        setHonours(allHonours.filter((row) => belongsToTeam(row.winner_name, teamName)))
      } catch (loadError) {
        if (!cancelled) setError(loadError.message || 'Unable to load this team history.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [teamName])

  const seasons = useMemo(() => [...new Set([
    ...fixtures.map((row) => row.season),
    ...scorers.map((row) => row.season),
    ...honours.map((row) => row.season),
  ].filter(Boolean))].sort().reverse(), [fixtures, scorers, honours])

  const shownFixtures = season === 'Overall' ? fixtures : fixtures.filter((row) => row.season === season)
  const scorerRows = season === 'Overall' ? scorers : scorers.filter((row) => row.season === season)
  const scorerTotals = Object.entries(scorerRows.reduce((totals, row) => {
    totals[row.player_name] = (totals[row.player_name] || 0) + Number(row.goals || 0)
    return totals
  }, {})).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'en-GB'))
  const shownHonours = season === 'Overall' ? honours : honours.filter((row) => row.season === season)

  let wins = 0
  let draws = 0
  let losses = 0
  for (const fixture of shownFixtures) {
    const isHome = belongsToTeam(fixture.home_team_name, teamName)
    const scored = Number(isHome ? fixture.home_goals : fixture.away_goals)
    const conceded = Number(isHome ? fixture.away_goals : fixture.home_goals)
    if (scored > conceded) wins += 1
    else if (scored < conceded) losses += 1
    else draws += 1
  }

  return (
    <div className="container" style={{ padding: '32px 20px 48px' }}>
      <Link to="/teams" style={{ color: 'var(--brass)', fontWeight: 700, textDecoration: 'none' }}>← Back to teams</Link>
      <h1 style={{ fontSize: 30, marginBottom: 4 }}>{teamName}</h1>
      <p style={{ color: 'var(--muted)', marginTop: 0, marginBottom: 22 }}>Previous team · complete records held on this website.</p>

      {loading && <p style={{ color: 'var(--muted)' }}>Loading team history…</p>}
      {error && <p role="alert" style={{ color: '#b3261e' }}>{error}</p>}

      {!loading && !error && (
        <>
          <label htmlFor="previous-team-season" style={labelStyle}>Season</label>
          <select id="previous-team-season" value={season} onChange={(event) => setSeason(event.target.value)} style={selectStyle}>
            <option value="Overall">Overall</option>
            {seasons.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8, margin: '18px 0 30px' }}>
            {[['Played', shownFixtures.length], ['Won', wins], ['Drawn', draws], ['Lost', losses]].map(([label, value]) => (
              <div key={label} style={summaryStyle}><strong style={{ fontSize: 22 }}>{value}</strong><span style={{ color: 'var(--muted)', fontSize: 12 }}>{label}</span></div>
            ))}
          </div>

          <h2 style={sectionHeaderStyle}>Honours</h2>
          {shownHonours.length === 0 ? <Empty>No honours recorded.</Empty> : shownHonours.map((row, index) => (
            <Link key={`${row.season}-${row.competition}-${index}`} to={`/archive?season=${encodeURIComponent(row.season)}`} style={rowLinkStyle}>
              <span>{row.competition} <span style={{ color: 'var(--muted)' }}>({row.season})</span></span>
              <strong style={{ textTransform: 'capitalize' }}>{row.status}</strong>
            </Link>
          ))}

          <h2 style={sectionHeaderStyle}>Scorers</h2>
          {scorerTotals.length === 0 ? <Empty>No scorers recorded for this selection.</Empty> : scorerTotals.map(([name, goals]) => (
            <Link key={name} to={`/scorers?player=${encodeURIComponent(name)}`} style={rowLinkStyle}>
              <span>{name}</span><strong>{goals}</strong>
            </Link>
          ))}

          <h2 style={sectionHeaderStyle}>Results</h2>
          {shownFixtures.length === 0 ? <Empty>No results recorded for this selection.</Empty> : shownFixtures.map((fixture) => (
            <Link key={fixture.id} to={`/fixtures/${fixture.id}`} style={rowLinkStyle}>
              <span>
                <strong>{fixture.home_team_name} {historicDisplayedScore(fixture)} {fixture.away_team_name}</strong>
                <span style={{ display: 'block', color: 'var(--muted)', fontSize: 12 }}>{fixture.competition_name} · {fixture.season}</span>
              </span>
              <span aria-hidden="true" style={{ color: 'var(--brass)' }}>→</span>
            </Link>
          ))}
        </>
      )}
    </div>
  )
}

function Empty({ children }) {
  return <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 28 }}>{children}</p>
}

const labelStyle = { display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 5 }
const selectStyle = { width: '100%', boxSizing: 'border-box', padding: '12px 14px', fontSize: 15, fontWeight: 600, borderRadius: 6, border: '1px solid var(--line)', background: '#fff' }
const summaryStyle = { border: '1px solid var(--line)', borderRadius: 8, padding: '12px 6px', display: 'flex', flexDirection: 'column', alignItems: 'center' }
const sectionHeaderStyle = { fontSize: 15, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--brass)', marginTop: 30, marginBottom: 10, paddingBottom: 8, borderBottom: '2px solid var(--line)' }
const rowLinkStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--line)', color: 'var(--ink)', textDecoration: 'none', fontSize: 14 }
