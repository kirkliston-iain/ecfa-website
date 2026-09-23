import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'

const METRICS = [
  { value: 'goalsFor', label: 'Most Goals Scored', suffix: 'goals' },
  { value: 'goalsPerGame', label: 'Average Goals Per Game', suffix: 'per game', decimals: 2 },
  { value: 'cleanSheets', label: 'Most Clean Sheets', suffix: 'clean sheets' },
  { value: 'wins', label: 'Most Wins', suffix: 'wins' },
  { value: 'goalDifference', label: 'Best Goal Difference', suffix: 'goal difference', signed: true },
  { value: 'longestUnbeaten', label: 'Longest Unbeaten Streak', suffix: 'games' },
  { value: 'longestWinning', label: 'Longest Winning Streak', suffix: 'games' },
  { value: 'currentUnbeaten', label: 'Current Games Since a Defeat', suffix: 'games' },
  { value: 'currentWinning', label: 'Current Winning Streak', suffix: 'games' },
]

function Badge({ logoUrl, name }) {
  if (logoUrl) {
    return <img src={logoUrl} alt="" style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', background: '#fff', flexShrink: 0 }} />
  }
  const initials = String(name || '?').split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()
  return (
    <span style={{ width: 34, height: 34, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'var(--ink)', color: '#fff', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>
      {initials}
    </span>
  )
}

function finalScores(fixture) {
  if (fixture.went_to_extra_time && fixture.home_extra_time_score != null && fixture.away_extra_time_score != null) {
    return [Number(fixture.home_extra_time_score), Number(fixture.away_extra_time_score)]
  }
  return [Number(fixture.home_score), Number(fixture.away_score)]
}

function resultFor(fixture, teamId) {
  const isHome = fixture.home_team?.id === teamId
  if (fixture.decided_by_penalties && fixture.home_penalty_score != null && fixture.away_penalty_score != null) {
    const forPens = Number(isHome ? fixture.home_penalty_score : fixture.away_penalty_score)
    const againstPens = Number(isHome ? fixture.away_penalty_score : fixture.home_penalty_score)
    return forPens > againstPens ? 'W' : 'L'
  }
  const [home, away] = finalScores(fixture)
  const goalsFor = isHome ? home : away
  const goalsAgainst = isHome ? away : home
  return goalsFor > goalsAgainst ? 'W' : goalsFor < goalsAgainst ? 'L' : 'D'
}

function streaks(results) {
  let longestUnbeaten = 0
  let longestWinning = 0
  let unbeatenRun = 0
  let winningRun = 0

  for (const result of results) {
    unbeatenRun = result === 'L' ? 0 : unbeatenRun + 1
    winningRun = result === 'W' ? winningRun + 1 : 0
    longestUnbeaten = Math.max(longestUnbeaten, unbeatenRun)
    longestWinning = Math.max(longestWinning, winningRun)
  }

  let currentUnbeaten = 0
  let currentWinning = 0
  for (let index = results.length - 1; index >= 0; index -= 1) {
    if (results[index] === 'L') break
    currentUnbeaten += 1
  }
  for (let index = results.length - 1; index >= 0; index -= 1) {
    if (results[index] !== 'W') break
    currentWinning += 1
  }

  return { longestUnbeaten, longestWinning, currentUnbeaten, currentWinning }
}

function buildTeamStats(teams, fixtures) {
  const rows = new Map(teams.map((team) => [team.id, {
    id: team.id,
    name: team.name,
    logoUrl: team.logo_url,
    played: 0,
    wins: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    cleanSheets: 0,
    results: [],
  }]))

  for (const fixture of [...fixtures].sort((a, b) => new Date(a.fixture_date) - new Date(b.fixture_date))) {
    const home = rows.get(fixture.home_team?.id)
    const away = rows.get(fixture.away_team?.id)
    if (!home || !away) continue
    const [homeGoals, awayGoals] = finalScores(fixture)
    const homeResult = resultFor(fixture, home.id)
    const awayResult = resultFor(fixture, away.id)

    home.played += 1
    away.played += 1
    home.goalsFor += homeGoals
    home.goalsAgainst += awayGoals
    away.goalsFor += awayGoals
    away.goalsAgainst += homeGoals
    if (homeGoals === 0) away.cleanSheets += 1
    if (awayGoals === 0) home.cleanSheets += 1
    if (homeResult === 'W') home.wins += 1
    if (awayResult === 'W') away.wins += 1
    home.results.push(homeResult)
    away.results.push(awayResult)
  }

  return [...rows.values()]
    .filter((team) => team.played > 0)
    .map((team) => ({
      ...team,
      goalsPerGame: team.goalsFor / team.played,
      goalDifference: team.goalsFor - team.goalsAgainst,
      ...streaks(team.results),
    }))
}

function displayValue(value, metric) {
  if (metric.decimals != null) return Number(value).toFixed(metric.decimals)
  if (metric.signed && Number(value) > 0) return `+${value}`
  return Number(value).toLocaleString()
}

export default function StatsPage() {
  const [fixtures, setFixtures] = useState([])
  const [teams, setTeams] = useState([])
  const [scope, setScope] = useState('all')
  const [metricKey, setMetricKey] = useState('goalsFor')
  const [season, setSeason] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    let cancelled = false

    async function load() {
      const [{ data: fixtureRows, error: fixtureError }, { data: teamRows, error: teamError }] = await Promise.all([
        supabase
          .from('fixtures')
          .select('id, fixture_date, home_score, away_score, went_to_extra_time, home_extra_time_score, away_extra_time_score, decided_by_penalties, home_penalty_score, away_penalty_score, home_team:home_team_id(id), away_team:away_team_id(id), stage:stage_id(competition:competition_id(name, slug, season))')
          .eq('status', 'played')
          .eq('hidden_from_public', false)
          .order('fixture_date'),
        supabase.from('teams').select('id, name, logo_url').order('name'),
      ])

      if (cancelled) return
      if (fixtureError || teamError) {
        setError('Football statistics could not be loaded.')
      } else {
        setFixtures(fixtureRows || [])
        setTeams(teamRows || [])
        setSeason((fixtureRows || []).map((row) => row.stage?.competition?.season).find(Boolean) || '')
      }
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  const scopedFixtures = useMemo(
    () => fixtures.filter((fixture) => scope === 'all' || fixture.stage?.competition?.slug === 'appin-league'),
    [fixtures, scope]
  )
  const stats = useMemo(() => buildTeamStats(teams, scopedFixtures), [teams, scopedFixtures])
  const metric = METRICS.find((item) => item.value === metricKey) || METRICS[0]
  const rankings = useMemo(
    () => [...stats].sort((left, right) => right[metricKey] - left[metricKey] || right.goalsFor - left.goalsFor || left.name.localeCompare(right.name)),
    [stats, metricKey]
  )
  const totalGoals = scopedFixtures.reduce((sum, fixture) => {
    const [home, away] = finalScores(fixture)
    return sum + home + away
  }, 0)

  if (loading) return <div className="container" style={{ padding: 48 }}>Loading football statistics…</div>

  return (
    <div className="container" style={{ padding: '32px 20px 48px', maxWidth: 900 }}>
      <h1 style={{ fontSize: 30, marginBottom: 4 }}>Stats</h1>
      <p style={{ color: 'var(--muted)', marginBottom: 24 }}>
        Current-season ECFA team records{season ? ` — ${String(season).replace('-', '/')}` : ''}.
      </p>

      {error ? <p style={{ color: '#B3261E' }}>{error}</p> : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12, marginBottom: 22 }}>
            <label style={controlLabelStyle}>
              Competition scope
              <select value={scope} onChange={(event) => setScope(event.target.value)} style={selectStyle}>
                <option value="all">All competitions</option>
                <option value="league">League only</option>
              </select>
            </label>
            <label style={controlLabelStyle}>
              Statistic
              <select value={metricKey} onChange={(event) => setMetricKey(event.target.value)} style={selectStyle}>
                {METRICS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, marginBottom: 28 }}>
            <div style={summaryCardStyle}><strong style={summaryValueStyle}>{scopedFixtures.length}</strong><span style={summaryLabelStyle}>Played matches</span></div>
            <div style={summaryCardStyle}><strong style={summaryValueStyle}>{totalGoals}</strong><span style={summaryLabelStyle}>Goals</span></div>
            <div style={summaryCardStyle}><strong style={summaryValueStyle}>{scopedFixtures.length ? (totalGoals / scopedFixtures.length).toFixed(2) : '0.00'}</strong><span style={summaryLabelStyle}>Goals per match</span></div>
          </div>

          <section>
            <div style={{ borderBottom: '3px solid var(--brass)', paddingBottom: 9, marginBottom: 4 }}>
              <h2 style={{ fontSize: 21, margin: 0 }}>{metric.label}</h2>
              <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
                {scope === 'all' ? 'All current-season competitions' : 'Appin Sports League only'}
              </div>
            </div>

            {rankings.map((team, index) => {
              const previous = rankings[index - 1]
              const rank = previous && previous[metricKey] === team[metricKey]
                ? rankings.findIndex((row) => row[metricKey] === team[metricKey]) + 1
                : index + 1
              return (
                <Link key={team.id} to={`/teams/${team.id}`} style={rankingRowStyle}>
                  <span style={{ width: 30, fontSize: 18, fontWeight: 800, color: index < 3 ? 'var(--brass)' : 'var(--muted)' }}>{rank}</span>
                  <Badge logoUrl={team.logoUrl} name={team.name} />
                  <span style={{ flex: 1, minWidth: 0, fontWeight: 750 }}>{team.name}</span>
                  <span style={{ textAlign: 'right', flexShrink: 0 }}>
                    <strong style={{ display: 'block', fontSize: 22 }}>{displayValue(team[metricKey], metric)}</strong>
                    <span style={{ color: 'var(--muted)', fontSize: 10, textTransform: 'uppercase' }}>{metric.suffix}</span>
                  </span>
                </Link>
              )
            })}
          </section>
        </>
      )}

      <section style={{ marginTop: 38 }}>
        <h2 style={{ fontSize: 20, color: 'var(--brass)', borderBottom: '2px solid var(--line)', paddingBottom: 8 }}>More ECFA statistics</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }}>
          <Link to="/scorers" style={linkCardStyle}>
            <strong>Player scoring</strong>
            <span style={linkDescriptionStyle}>Season and all-time league goals. Cup scorers are not recorded.</span>
          </Link>
          <Link to="/referees" style={linkCardStyle}>
            <strong>Referee statistics</strong>
            <span style={linkDescriptionStyle}>Appointments, teams, venues and card rates.</span>
          </Link>
          <Link to="/standings" style={linkCardStyle}>
            <strong>Competition tables</strong>
            <span style={linkDescriptionStyle}>Played, wins, draws, losses, goal difference and points.</span>
          </Link>
          <Link to="/web-stats" style={linkCardStyle}>
            <strong>Website analytics</strong>
            <span style={linkDescriptionStyle}>ECFA website visits and most-viewed pages.</span>
          </Link>
        </div>
      </section>
    </div>
  )
}

const controlLabelStyle = { display: 'grid', gap: 6, color: 'var(--muted)', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4 }
const selectStyle = { width: '100%', boxSizing: 'border-box', padding: '13px 14px', border: '1px solid var(--line)', borderRadius: 8, background: '#fff', color: 'var(--ink)', font: 'inherit', fontSize: 16, fontWeight: 650, textTransform: 'none', letterSpacing: 0 }
const summaryCardStyle = { padding: '13px 8px', border: '1px solid var(--line)', borderRadius: 8, background: '#f5f8fa', textAlign: 'center' }
const summaryValueStyle = { display: 'block', fontSize: 23 }
const summaryLabelStyle = { display: 'block', color: 'var(--muted)', fontSize: 10, textTransform: 'uppercase', marginTop: 3 }
const rankingRowStyle = { display: 'flex', alignItems: 'center', gap: 11, padding: '13px 8px', borderBottom: '1px solid var(--line)', color: 'inherit', textDecoration: 'none' }
const linkCardStyle = { display: 'grid', gap: 6, padding: 16, border: '1px solid var(--line)', borderRadius: 8, color: 'var(--ink)', textDecoration: 'none', background: '#f5f8fa' }
const linkDescriptionStyle = { color: 'var(--muted)', fontSize: 13, lineHeight: 1.45 }
