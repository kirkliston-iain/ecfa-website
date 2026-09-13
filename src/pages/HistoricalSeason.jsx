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
  const [teams, setTeams] = useState([])
  const [teamId, setTeamId] = useState('')
  const [loading, setLoading] = useState(false)
  const [fixtures, setFixtures] = useState([])
  const [seasonFixtures, setSeasonFixtures] = useState([]) // unfiltered by team, for table/honours
  const [storedLeagueTable, setStoredLeagueTable] = useState([])

  useEffect(() => {
    supabase
      .from('historic_fixture_seasons')
      .select('season')
      .then(({ data }) => {
        setSeasons((data || []).map((r) => r.season))
      })

    supabase
      .from('teams')
      .select('id, name')
      .order('name')
      .then(({ data }) => setTeams(data || []))
  }, [])

  useEffect(() => {
    if (!season) {
      setFixtures([])
      setSeasonFixtures([])
      setStoredLeagueTable([])
      return
    }
    setLoading(true)

    supabase
      .from('historic_fixtures')
      .select('id, competition_name, fixture_date, home_team_name, home_goals, away_team_name, away_goals, comment')
      .eq('season', season)
      .then(({ data }) => setSeasonFixtures(data || []))

    supabase
      .from('historic_league_tables')
      .select('position, team_name, played, won, drawn, lost, goal_difference, points')
      .eq('season', season)
      .order('position')
      .then(({ data }) => setStoredLeagueTable(data || []))

    let query = supabase
      .from('historic_fixtures')
      .select('id, competition_name, fixture_date, home_team_name, home_goals, away_team_name, away_goals, comment')
      .eq('season', season)

    if (teamId) {
      query = query.or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
    }

    query.order('fixture_date').then(({ data }) => {
      setFixtures(data || [])
      setLoading(false)
    })
  }, [season, teamId])

  const grouped = {}
  for (const f of fixtures) {
    if (!grouped[f.competition_name]) grouped[f.competition_name] = []
    grouped[f.competition_name].push(f)
  }

  // ---- Cup winners / runners-up ----
  function isFinal(name) {
    return name.endsWith('Final') && !name.includes('Semi') && !name.includes('Quarter')
  }
  function decideWinner(f) {
    if (f.home_goals != null && f.away_goals != null && f.home_goals !== f.away_goals) {
      return f.home_goals > f.away_goals
        ? { winner: f.home_team_name, runnerUp: f.away_team_name }
        : { winner: f.away_team_name, runnerUp: f.home_team_name }
    }
    // Draw, or a missing score (decided on penalties) — try to read the comment
    const comment = (f.comment || '').toLowerCase()
    if (comment.includes(f.home_team_name.toLowerCase() + ' won')) {
      return { winner: f.home_team_name, runnerUp: f.away_team_name }
    }
    if (comment.includes(f.away_team_name.toLowerCase() + ' won')) {
      return { winner: f.away_team_name, runnerUp: f.home_team_name }
    }
    return null
  }
  const cupResults = seasonFixtures
    .filter((f) => isFinal(f.competition_name))
    .map((f) => ({ competition: f.competition_name.replace(/\s*Final$/, ''), ...decideWinner(f), fixture: f }))
    .filter((r) => r.winner)

  // Seasons/competitions where cup rounds weren't labelled (e.g. 2025/26) won't
  // produce a detected final even though a winner exists in reality.
  const cupCompetitionsThisSeason = Array.from(
    new Set(
      seasonFixtures
        .map((f) => f.competition_name)
        .filter((n) => n.toLowerCase().includes('cup') && !isFinal(n))
    )
  ).filter((n) => !cupResults.some((r) => n.startsWith(r.competition)))

  // ---- League table ----
  function isLeagueFixture(name) {
    const n = name.toLowerCase()
    return n.includes('league') && !n.includes('cup')
  }
  const leagueFixtures = seasonFixtures.filter((f) => isLeagueFixture(f.competition_name) && f.home_goals != null && f.away_goals != null)
  const table = {}
  function row(name) {
    if (!table[name]) table[name] = { name, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }
    return table[name]
  }
  for (const f of leagueFixtures) {
    const home = row(f.home_team_name)
    const away = row(f.away_team_name)
    home.p++
    away.p++
    home.gf += f.home_goals
    home.ga += f.away_goals
    away.gf += f.away_goals
    away.ga += f.home_goals
    if (f.home_goals > f.away_goals) {
      home.w++
      away.l++
      home.pts += 3
    } else if (f.home_goals < f.away_goals) {
      away.w++
      home.l++
      away.pts += 3
    } else {
      home.d++
      away.d++
      home.pts++
      away.pts++
    }
  }
  const leagueTable = Object.values(table).sort(
    (a, b) => b.pts - a.pts || b.gf - b.ga - (a.gf - a.ga) || b.gf - a.gf
  )

  // Prefer the officially-recorded final table when we have one on file — computing
  // from match data alone can't reflect points deductions or fill in missing fixtures.
  const displayTable = storedLeagueTable.length > 0
    ? storedLeagueTable.map((t) => ({ name: t.team_name, p: t.played, w: t.won, d: t.drawn, l: t.lost, gd: t.goal_difference, pts: t.points }))
    : leagueTable.map((t) => ({ name: t.name, p: t.p, w: t.w, d: t.d, l: t.l, gd: t.gf - t.ga, pts: t.pts }))

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

      {season && (
        <select
          value={teamId}
          onChange={(e) => setTeamId(e.target.value)}
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
          <option value="">All teams</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      )}

      {loading && <p style={{ color: 'var(--muted)' }}>Loading…</p>}

      {!loading && season && cupResults.length > 0 && (
        <section style={{ marginBottom: 32 }}>
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
            Cup Winners
          </h2>
          {cupResults.map((r, i) => (
            <div key={i} style={{ padding: '10px 0', borderBottom: '1px solid var(--line)', fontSize: 14 }}>
              <div style={{ fontWeight: 700 }}>{r.competition}</div>
              <div>
                🏆 <strong>{r.winner}</strong>
                <span style={{ color: 'var(--muted)' }}> beat {r.runnerUp}</span>
                {r.fixture.home_goals != null && r.fixture.away_goals != null && (
                  <span style={{ color: 'var(--muted)' }}>
                    {' '}
                    ({r.fixture.home_team_name} {r.fixture.home_goals}-{r.fixture.away_goals} {r.fixture.away_team_name})
                  </span>
                )}
              </div>
            </div>
          ))}
          {cupCompetitionsThisSeason.length > 0 && (
            <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
              {cupCompetitionsThisSeason.join(', ')} {cupCompetitionsThisSeason.length > 1 ? "don't" : "doesn't"} have
              round-by-round data for this season, so the final result can't be picked out automatically.
            </p>
          )}
        </section>
      )}

      {!loading && season && displayTable.length > 0 && (
        <section style={{ marginBottom: 32 }}>
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
            League Table {storedLeagueTable.length === 0 && <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: 11 }}>(computed from recorded results — may be incomplete)</span>}
          </h2>
          <div style={{ display: 'flex', fontSize: 11, color: 'var(--muted)', padding: '4px 0', fontWeight: 700 }}>
            <div style={{ flex: 1 }}>Team</div>
            <div style={{ width: 28, textAlign: 'center' }}>P</div>
            <div style={{ width: 28, textAlign: 'center' }}>W</div>
            <div style={{ width: 28, textAlign: 'center' }}>D</div>
            <div style={{ width: 28, textAlign: 'center' }}>L</div>
            <div style={{ width: 36, textAlign: 'center' }}>GD</div>
            <div style={{ width: 32, textAlign: 'center' }}>Pts</div>
          </div>
          {displayTable.map((t, i) => (
            <div
              key={t.name}
              style={{
                display: 'flex',
                alignItems: 'center',
                fontSize: 13,
                padding: '6px 0',
                borderBottom: '1px solid var(--line)',
              }}
            >
              <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {i + 1}. {t.name}
              </div>
              <div style={{ width: 28, textAlign: 'center' }}>{t.p}</div>
              <div style={{ width: 28, textAlign: 'center' }}>{t.w}</div>
              <div style={{ width: 28, textAlign: 'center' }}>{t.d}</div>
              <div style={{ width: 28, textAlign: 'center' }}>{t.l}</div>
              <div style={{ width: 36, textAlign: 'center' }}>{t.gd}</div>
              <div style={{ width: 32, textAlign: 'center', fontWeight: 700 }}>{t.pts}</div>
            </div>
          ))}
        </section>
      )}

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
