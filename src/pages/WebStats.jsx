import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'

const PAGE_SIZE = 1000

async function fetchAll(table, select = '*') {
  let from = 0
  let rows = []
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    rows = rows.concat(data || [])
    if (!data || data.length < PAGE_SIZE) return rows
    from += PAGE_SIZE
  }
}

function sum(rows, value) {
  return rows.reduce((total, row) => total + Number(value(row) || 0), 0)
}

function rank(rows, key, value, limit = 10) {
  const totals = {}
  for (const row of rows) {
    const name = key(row)
    if (!name) continue
    totals[name] = (totals[name] || 0) + Number(value(row) || 0)
  }
  return Object.entries(totals)
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
    .slice(0, limit)
}

function StatCard({ label, value, detail }) {
  return (
    <div style={statCardStyle}>
      <div style={{ fontSize: 30, lineHeight: 1, fontWeight: 800, color: 'var(--ink)' }}>
        {Number(value || 0).toLocaleString()}
      </div>
      <div style={{ marginTop: 8, fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--brass)' }}>
        {label}
      </div>
      {detail && <div style={{ marginTop: 4, fontSize: 12, color: 'var(--muted)' }}>{detail}</div>}
    </div>
  )
}

function Ranking({ title, rows, suffix = '' }) {
  const maximum = rows[0]?.total || 1
  return (
    <section style={panelStyle}>
      <h2 style={sectionTitleStyle}>{title}</h2>
      {rows.length === 0 ? (
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>No data recorded yet.</p>
      ) : (
        rows.map((row, index) => (
          <div key={row.name} style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13, marginBottom: 4 }}>
              <span><strong>{index + 1}.</strong> {row.name}</span>
              <strong>{row.total.toLocaleString()}{suffix}</strong>
            </div>
            <div style={{ height: 7, borderRadius: 6, background: 'var(--line)', overflow: 'hidden' }}>
              <div style={{ width: `${Math.max(3, (row.total / maximum) * 100)}%`, height: '100%', background: 'var(--brass)' }} />
            </div>
          </div>
        ))
      )}
    </section>
  )
}

export default function WebStats() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [data, setData] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [
          siteStats,
          teams,
          players,
          fixtures,
          currentScorers,
          historicFixtures,
          historicScorers,
        ] = await Promise.all([
          fetchAll('site_stats', 'key, value'),
          fetchAll('teams', 'id, name'),
          fetchAll('players', 'id, first_name, last_name, team_id'),
          fetchAll('fixtures', 'id, fixture_date, venue, referee_name, home_score, away_score, status, home_team:home_team_id(name), away_team:away_team_id(name)'),
          fetchAll('fixture_scorers', 'goals, player:player_id(first_name, last_name), team:team_id(name)'),
          fetchAll('historic_fixtures', 'season, venue, referee_name, home_team_name, away_team_name, home_goals, away_goals'),
          fetchAll('historic_scorers', 'season, player_name, team_name, goals'),
        ])
        if (!cancelled) {
          setData({ siteStats, teams, players, fixtures, currentScorers, historicFixtures, historicScorers })
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Statistics could not be loaded.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const stats = useMemo(() => {
    if (!data) return null
    const playedCurrent = data.fixtures.filter(
      (fixture) => fixture.status === 'played' && fixture.home_score != null && fixture.away_score != null
    )
    const currentGoals = sum(playedCurrent, (fixture) => fixture.home_score + fixture.away_score)
    const historicGoals = sum(data.historicFixtures, (fixture) => fixture.home_goals + fixture.away_goals)
    const pageViews = data.siteStats.find((row) => row.key === 'page_views')?.value || 0
    const seasons = new Set(data.historicFixtures.map((fixture) => fixture.season).filter(Boolean))

    const allScorers = [
      ...data.historicScorers.map((row) => ({ name: row.player_name, goals: row.goals })),
      ...data.currentScorers.map((row) => ({
        name: `${row.player?.first_name || ''} ${row.player?.last_name || ''}`.trim(),
        goals: row.goals,
      })),
    ]

    const refereeRows = rank(
      playedCurrent.filter((fixture) => fixture.referee_name),
      (fixture) => fixture.referee_name,
      () => 1
    )
    const venueRows = rank(
      playedCurrent.filter((fixture) => fixture.venue && !['n/a', 'league decide'].includes(fixture.venue.toLowerCase())),
      (fixture) => fixture.venue,
      () => 1
    )
    const teamRows = rank(
      playedCurrent.flatMap((fixture) => [
        { team: fixture.home_team?.name },
        { team: fixture.away_team?.name },
      ]),
      (row) => row.team,
      () => 1
    )

    return {
      pageViews,
      currentMatches: playedCurrent.length,
      currentGoals,
      totalMatches: playedCurrent.length + data.historicFixtures.length,
      totalGoals: currentGoals + historicGoals,
      teams: data.teams.length,
      players: data.players.length,
      seasons: seasons.size + 1,
      topScorers: rank(allScorers, (row) => row.name, (row) => row.goals),
      referees: refereeRows,
      venues: venueRows,
      teamsPlayed: teamRows,
    }
  }, [data])

  if (loading) return <div className="container" style={{ padding: 48 }}>Loading web statistics…</div>
  if (error) return <div className="container" style={{ padding: 48, color: '#B3261E' }}>{error}</div>
  if (!stats) return null

  return (
    <div className="container" style={{ padding: '32px 20px 48px', maxWidth: 980 }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 12, color: 'var(--brass)', fontWeight: 800, letterSpacing: 0.7, textTransform: 'uppercase', marginBottom: 6 }}>
          ECFA by the numbers
        </div>
        <h1 style={{ fontSize: 32, marginBottom: 6 }}>Web Stats</h1>
        <p style={{ color: 'var(--muted)', margin: 0 }}>
          Live figures from the current season and the ECFA historical archive.
        </p>
      </div>

      <div style={heroStyle}>
        <div>
          <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.7, opacity: 0.75 }}>Website visits</div>
          <div style={{ fontSize: 48, lineHeight: 1.1, fontWeight: 900, marginTop: 6 }}>{Number(stats.pageViews).toLocaleString()}</div>
        </div>
        <div style={{ fontSize: 13, maxWidth: 320, opacity: 0.85 }}>
          A growing digital record of Edinburgh Churches Football Association football.
        </div>
      </div>

      <h2 style={groupTitleStyle}>All-time record</h2>
      <div style={gridStyle}>
        <StatCard label="Matches recorded" value={stats.totalMatches} />
        <StatCard label="Goals recorded" value={stats.totalGoals} />
        <StatCard label="Seasons covered" value={stats.seasons} />
        <StatCard label="Registered players" value={stats.players} />
      </div>

      <h2 style={groupTitleStyle}>Current season</h2>
      <div style={gridStyle}>
        <StatCard label="Matches played" value={stats.currentMatches} />
        <StatCard label="Goals scored" value={stats.currentGoals} />
        <StatCard label="Active teams" value={stats.teams} />
        <StatCard
          label="Goals per match"
          value={stats.currentMatches ? (stats.currentGoals / stats.currentMatches).toFixed(2) : 0}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginTop: 28 }}>
        <Ranking title="All-time leading scorers" rows={stats.topScorers} suffix=" goals" />
        <Ranking title="Referee appointments this season" rows={stats.referees} suffix=" games" />
        <Ranking title="Most-used venues this season" rows={stats.venues} suffix=" games" />
        <Ranking title="Team appearances this season" rows={stats.teamsPlayed} suffix=" games" />
      </div>

      <p style={{ marginTop: 24, color: 'var(--muted)', fontSize: 12 }}>
        Figures update automatically as fixtures, results, scorers, referees and historical records are added.
      </p>
    </div>
  )
}

const heroStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-end',
  gap: 20,
  flexWrap: 'wrap',
  padding: '24px',
  borderRadius: 10,
  color: '#fff',
  background: 'linear-gradient(135deg, var(--ink), #34495e)',
  borderBottom: '5px solid var(--brass)',
}

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
  gap: 12,
}

const statCardStyle = {
  padding: 18,
  background: '#fff',
  border: '1px solid var(--line)',
  borderRadius: 8,
}

const groupTitleStyle = {
  marginTop: 30,
  marginBottom: 12,
  fontSize: 14,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  color: 'var(--brass)',
}

const panelStyle = {
  padding: 18,
  background: '#fff',
  border: '1px solid var(--line)',
  borderRadius: 8,
}

const sectionTitleStyle = {
  fontSize: 14,
  marginTop: 0,
  marginBottom: 16,
  paddingBottom: 8,
  borderBottom: '2px solid var(--line)',
  textTransform: 'uppercase',
  letterSpacing: 0.4,
}
