import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
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

function displayFixtureDate(value) {
  if (!value) return ''
  return new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default function HistoricalSeason() {
  const [params, setParams] = useSearchParams()
  const [seasons, setSeasons] = useState([])
  const [seasonSummaries, setSeasonSummaries] = useState([])
  const [season, setSeason] = useState(params.get('season') || '')
  const [teams, setTeams] = useState([])
  const [teamId, setTeamId] = useState('')
  const [loading, setLoading] = useState(false)
  const [fixtures, setFixtures] = useState([])
  const [seasonFixtures, setSeasonFixtures] = useState([]) // unfiltered by team, for table/honours
  const [storedLeagueTable, setStoredLeagueTable] = useState([])

  useEffect(() => {
    let cancelled = false

    async function loadArchiveIndex() {
      const [fixtureResult, scorerResult, honourResult, teamResult] = await Promise.all([
        supabase
          .from('historic_fixtures')
          .select('season, competition_name, home_goals, away_goals'),
        supabase.from('historic_scorers').select('season'),
        supabase.from('honours').select('season, status'),
        supabase.from('teams').select('id, name').order('name'),
      ])

      if (cancelled) return

      const index = new Map()
      const getSeason = (label) => {
        if (!index.has(label)) {
          index.set(label, {
            season: label,
            fixtures: 0,
            results: 0,
            competitions: new Set(),
            hasScorers: false,
            honours: 0,
          })
        }
        return index.get(label)
      }

      for (const fixture of fixtureResult.data || []) {
        if (!fixture.season) continue
        const entry = getSeason(fixture.season)
        entry.fixtures += 1
        if (fixture.home_goals != null && fixture.away_goals != null) entry.results += 1
        if (fixture.competition_name) entry.competitions.add(fixture.competition_name)
      }
      for (const scorer of scorerResult.data || []) {
        if (scorer.season) getSeason(scorer.season).hasScorers = true
      }
      for (const honour of honourResult.data || []) {
        if (!honour.season) continue
        const entry = getSeason(honour.season)
        if (honour.status === 'winner') entry.honours += 1
      }

      const summaries = [...index.values()]
        .map((entry) => ({ ...entry, competitions: entry.competitions.size }))
        .sort((left, right) => right.season.localeCompare(left.season, undefined, { numeric: true }))

      setSeasonSummaries(summaries)
      setSeasons(summaries.filter((entry) => entry.fixtures > 0).map((entry) => entry.season))
      setTeams(teamResult.data || [])
    }

    loadArchiveIndex()
    return () => {
      cancelled = true
    }
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
      <h1 style={{ fontSize: 30, marginBottom: 4 }}>Archive</h1>
      <p style={{ color: 'var(--muted)', marginBottom: 24 }}>
        Explore past ECFA seasons, results, final tables and competition winners.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12, marginBottom: 30 }}>
        <Link to="/honours" style={archiveLinkStyle}>
          <strong>Honours archive</strong>
          <span style={archiveLinkDescriptionStyle}>Season-by-season winners and all-time team totals.</span>
        </Link>
        <Link to="/scorers" style={archiveLinkStyle}>
          <strong>Historical scorers</strong>
          <span style={archiveLinkDescriptionStyle}>Recorded season totals. Match-level links are only available where the underlying data supports them.</span>
        </Link>
        <Link to="/stats" style={archiveLinkStyle}>
          <strong>Current-season stats</strong>
          <span style={archiveLinkDescriptionStyle}>Team records, streaks, scorers and referee statistics.</span>
        </Link>
      </div>

      {!season && (
        <section style={{ marginBottom: 30 }}>
          <h2 style={sectionHeadingStyle}>Seasons</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }}>
            {seasonSummaries.filter((entry) => entry.fixtures > 0).map((entry) => (
              <button
                key={entry.season}
                type="button"
                onClick={() => {
                  setSeason(entry.season)
                  setTeamId('')
                  setParams({ season: entry.season })
                  window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
                }}
                style={seasonCardStyle}
              >
                <strong style={{ fontSize: 21 }}>{entry.season}</strong>
                <span style={{ color: 'var(--muted)', fontSize: 13 }}>
                  {entry.results > 0
                    ? `${entry.results} result${entry.results === 1 ? '' : 's'} · ${entry.competitions} competition${entry.competitions === 1 ? '' : 's'}`
                    : 'Scoring or honours records available'}
                </span>
                <span style={{ color: 'var(--brass)', fontSize: 12, fontWeight: 800 }}>
                  {entry.fixtures > 0 ? 'Open season →' : 'Use scorer or honours archive above'}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {season && (
        <button
          type="button"
          onClick={() => {
            setSeason('')
            setTeamId('')
            setParams({})
            window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
          }}
          style={backButtonStyle}
        >
          ← All archived seasons
        </button>
      )}

      <label style={selectLabelStyle}>
        {season ? 'Change season' : 'Jump to a season'}
      <select
        value={season}
        onChange={(e) => {
          const nextSeason = e.target.value
          setSeason(nextSeason)
          setTeamId('')
          setParams(nextSeason ? { season: nextSeason } : {})
          window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
        }}
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
      </label>

      {season && (
        <div style={{ margin: '0 0 24px' }}>
          <h2 style={{ fontSize: 25, margin: '0 0 8px' }}>{season} season</h2>
          {(() => {
            const summary = seasonSummaries.find((entry) => entry.season === season)
            if (!summary) return null
            return (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <span style={summaryPillStyle}>{summary.results} recorded results</span>
                <span style={summaryPillStyle}>{summary.competitions} competitions</span>
                {summary.hasScorers && <span style={summaryPillStyle}>Scoring totals held</span>}
                {summary.honours > 0 && <span style={summaryPillStyle}>{summary.honours} winners recorded</span>}
              </div>
            )
          })()}
        </div>
      )}

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
                  padding: '10px 0',
                  borderBottom: '1px solid var(--line)',
                  fontSize: 14,
                }}
              >
                {f.fixture_date && (
                  <div style={{ color: 'var(--muted)', fontSize: 11, marginBottom: 5 }}>
                    {displayFixtureDate(f.fixture_date)}
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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


const archiveLinkStyle = {
  display: 'grid',
  gap: 6,
  padding: 16,
  border: '1px solid var(--line)',
  borderRadius: 8,
  color: 'var(--ink)',
  textDecoration: 'none',
  background: '#f5f8fa',
}

const archiveLinkDescriptionStyle = {
  color: 'var(--muted)',
  fontSize: 13,
  lineHeight: 1.45,
}

const sectionHeadingStyle = {
  color: 'var(--brass)',
  fontSize: 15,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  paddingBottom: 9,
  borderBottom: '2px solid var(--line)',
}

const seasonCardStyle = {
  display: 'grid',
  gap: 8,
  padding: 16,
  border: '1px solid var(--line)',
  borderRadius: 8,
  background: '#fff',
  color: 'var(--ink)',
  textAlign: 'left',
  cursor: 'pointer',
  font: 'inherit',
}

const backButtonStyle = {
  border: 0,
  background: 'transparent',
  color: 'var(--brass)',
  fontWeight: 800,
  padding: '0 0 14px',
  cursor: 'pointer',
}

const selectLabelStyle = {
  display: 'grid',
  gap: 6,
  color: 'var(--muted)',
  fontSize: 12,
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: 0.4,
  marginBottom: 24,
}

const summaryPillStyle = {
  padding: '6px 9px',
  borderRadius: 999,
  background: '#f5f8fa',
  border: '1px solid var(--line)',
  color: 'var(--muted)',
  fontSize: 12,
  fontWeight: 700,
}
