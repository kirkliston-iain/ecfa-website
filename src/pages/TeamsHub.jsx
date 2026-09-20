import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { displayedScore, outcomeNote } from '../utils/fixtureOutcome'

function Badge({ logoUrl, name, size = 24 }) {
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt=""
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', background: '#fff', flexShrink: 0 }}
      />
    )
  }
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

const CURRENT_SEASON = '2026/27'

const HISTORIC_TEAM_ALIASES = {
  'AC Oxgangs FC': 'AC Oxgangs',
  'Barclay Viewforth FC': 'Barclay Viewforth Church',
  'Bingham FC': 'Hope Church',
  'Bristo Memorial FC': 'South East Saints',
  'Broxburn Baptist Church FC': 'Broxburn Baptist Church',
  Carrubbers: 'Carrubbers Church',
  'Carrubbers FC': 'Carrubbers Church',
  Central: 'Liberton Church',
  'Central FC': 'Liberton Church',
  'Charlotte Chapel FC': 'Charlotte Chapel',
  'Gorgie United': 'Gorgie United Salvation Army',
  'Gorgie United FC': 'Gorgie United Salvation Army',
  Ladywell: 'Ladywell Baptist Church',
  'Ladywell Baptist Church FC': 'Ladywell Baptist Church',
  Niddrie: 'The Mission',
  'Niddrie FC': 'The Mission',
  'Port Seton FC': 'Port Seton',
  'South East Saints FC': 'South East Saints',
  "St Columba's FC": 'St Columbas',
  "St Mary's Metropolitan FC": 'St Marys Metropolitan Church',
  'St Marys': 'St Marys Metropolitan Church',
  "St Marys Metropolitan Church's FC": 'St Marys Metropolitan Church',
  'The Mission FC': 'The Mission',
  'White Lightning': 'White Lightning Bruntsfield Church',
  'White Lightning FC': 'White Lightning Bruntsfield Church',
}

function canonicalTeamName(name, teamId, currentTeams) {
  const currentTeam = teamId ? currentTeams.find((entry) => entry.id === teamId) : null
  if (currentTeam) return currentTeam.name
  return HISTORIC_TEAM_ALIASES[name] || name
}

export default function TeamsHub() {
  const [teams, setTeams] = useState([])
  const [teamId, setTeamId] = useState('')
  const [team, setTeam] = useState(null)
  const [loading, setLoading] = useState(false)

  const [currentFixtures, setCurrentFixtures] = useState([])
  const [historicFixtures, setHistoricFixtures] = useState([])
  const [currentScorers, setCurrentScorers] = useState([])
  const [historicScorers, setHistoricScorers] = useState([])
  const [honours, setHonours] = useState([])
  const [squad, setSquad] = useState([])

  const [resultsSeason, setResultsSeason] = useState(CURRENT_SEASON)
  const [scorersSeason, setScorersSeason] = useState(CURRENT_SEASON)
  const [headToHeadSeason, setHeadToHeadSeason] = useState(CURRENT_SEASON)

  useEffect(() => {
    supabase
      .from('teams')
      .select('id, name, logo_url, manager_name')
      .order('name')
      .then(({ data }) => setTeams(data || []))
  }, [])

  useEffect(() => {
    if (!teamId) {
      setTeam(null)
      return
    }
    setLoading(true)
    setResultsSeason(CURRENT_SEASON)
    setScorersSeason(CURRENT_SEASON)
    setHeadToHeadSeason(CURRENT_SEASON)

    async function load() {
      setTeam(teams.find((t) => t.id === teamId) || null)

      const { data: cf } = await supabase
        .from('fixtures')
        .select(
          'id, fixture_date, venue, home_score, away_score, went_to_extra_time, home_extra_time_score, away_extra_time_score, decided_by_penalties, home_penalty_score, away_penalty_score, status, home_team:home_team_id(id, name, logo_url), away_team:away_team_id(id, name, logo_url), stage:stage_id(name, competition:competition_id(name))'
        )
        .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
        .eq('hidden_from_public', false)
        .order('fixture_date')
      setCurrentFixtures(cf || [])

      const { data: hf } = await supabase
        .from('historic_fixtures')
        .select('id, season, competition_name, fixture_date, home_team_id, home_team_name, home_goals, away_team_id, away_team_name, away_goals')
        .order('fixture_date', { ascending: false })
      const selectedTeamName = teams.find((entry) => entry.id === teamId)?.name
      setHistoricFixtures((hf || []).filter((fixture) => {
        const homeName = canonicalTeamName(fixture.home_team_name, fixture.home_team_id, teams)
        const awayName = canonicalTeamName(fixture.away_team_name, fixture.away_team_id, teams)
        return fixture.home_team_id === teamId || fixture.away_team_id === teamId || homeName === selectedTeamName || awayName === selectedTeamName
      }))

      const { data: cs } = await supabase
        .from('fixture_scorers')
        .select('goals, player:player_id(id, first_name, last_name)')
        .eq('team_id', teamId)
      setCurrentScorers(cs || [])

      const { data: hs } = await supabase
        .from('historic_scorers')
        .select('player_name, goals, season')
        .eq('team_id', teamId)
      setHistoricScorers(hs || [])

      const { data: ho } = await supabase
        .from('honours')
        .select('season, competition, status, winner_name')
        .eq('team_id', teamId)
        .order('season', { ascending: false })
      setHonours(ho || [])

      const { data: sq } = await supabase
        .from('players')
        .select('id, first_name, last_name')
        .eq('team_id', teamId)
        .order('last_name')
      setSquad(sq || [])

      setLoading(false)
    }
    load()
  }, [teamId, teams])

  const played = currentFixtures.filter((f) => f.status === 'played').sort((a, b) => new Date(b.fixture_date) - new Date(a.fixture_date))
  const upcoming = currentFixtures
    .filter((f) => f.status === 'scheduled')
    .sort((a, b) => new Date(a.fixture_date) - new Date(b.fixture_date))[0]
  const lastResult = played[0]
  const form = played.slice(0, 5)

  function resultFor(f) {
    const isHome = f.home_team?.id === teamId
    const us = isHome ? f.home_score : f.away_score
    const them = isHome ? f.away_score : f.home_score
    if (us == null || them == null) return null
    if (us > them) return 'W'
    if (us < them) return 'L'
    return 'D'
  }

  // Season-by-season results: current season (from live fixtures) + historic seasons
  const historicSeasons = Array.from(new Set(historicFixtures.map((f) => f.season))).sort().reverse()
  const resultSeasonOptions = [CURRENT_SEASON, ...historicSeasons]
  const headToHeadSeasonOptions = ['Overall', ...new Set([CURRENT_SEASON, ...historicSeasons])]

  const currentPlayedForResults = played
  const historicForSeason = historicFixtures.filter((f) => f.season === resultsSeason)

  // Season-by-season scorers
  const historicScorerSeasons = Array.from(new Set(historicScorers.map((s) => s.season))).sort().reverse()
  const scorerSeasonOptions = ['Overall', CURRENT_SEASON, ...historicScorerSeasons]

  const currentScorersAgg = {}
  for (const s of currentScorers) {
    const name = s.player ? `${s.player.first_name} ${s.player.last_name}` : 'Unknown'
    currentScorersAgg[name] = (currentScorersAgg[name] || 0) + Number(s.goals || 0)
  }
  const currentScorersList = Object.entries(currentScorersAgg).sort((a, b) => b[1] - a[1])

  const historicScorersAgg = {}
  for (const s of historicScorers.filter((s) => s.season === scorersSeason)) {
    historicScorersAgg[s.player_name] = (historicScorersAgg[s.player_name] || 0) + Number(s.goals || 0)
  }
  const historicScorersList = Object.entries(historicScorersAgg).sort((a, b) => b[1] - a[1])

  const overallScorersAgg = { ...currentScorersAgg }
  for (const s of historicScorers) {
    overallScorersAgg[s.player_name] = (overallScorersAgg[s.player_name] || 0) + Number(s.goals || 0)
  }
  const overallScorersList = Object.entries(overallScorersAgg).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))

  const headToHeadMap = {}
  function addHeadToHead(opponentName, goalsFor, goalsAgainst, outcome) {
    if (!opponentName || goalsFor == null || goalsAgainst == null) return
    if (!headToHeadMap[opponentName]) {
      headToHeadMap[opponentName] = { opponent: opponentName, played: 0, wins: 0, losses: 0, draws: 0, goalsFor: 0, goalsAgainst: 0 }
    }
    const row = headToHeadMap[opponentName]
    row.played += 1
    row.goalsFor += Number(goalsFor)
    row.goalsAgainst += Number(goalsAgainst)
    if (outcome === 'W') row.wins += 1
    else if (outcome === 'L') row.losses += 1
    else row.draws += 1
  }

  for (const f of played) {
    if (headToHeadSeason !== 'Overall' && headToHeadSeason !== CURRENT_SEASON) continue
    const isHome = f.home_team?.id === teamId
    const opponentName = isHome ? f.away_team?.name : f.home_team?.name
    const homeGoals = f.went_to_extra_time && f.home_extra_time_score != null ? f.home_extra_time_score : f.home_score
    const awayGoals = f.went_to_extra_time && f.away_extra_time_score != null ? f.away_extra_time_score : f.away_score
    const goalsFor = isHome ? homeGoals : awayGoals
    const goalsAgainst = isHome ? awayGoals : homeGoals
    let outcome = goalsFor > goalsAgainst ? 'W' : goalsFor < goalsAgainst ? 'L' : 'D'
    if (f.decided_by_penalties && f.home_penalty_score != null && f.away_penalty_score != null) {
      const homeWon = f.home_penalty_score > f.away_penalty_score
      outcome = (isHome === homeWon) ? 'W' : 'L'
    }
    addHeadToHead(opponentName, goalsFor, goalsAgainst, outcome)
  }

  for (const f of historicFixtures) {
    if (headToHeadSeason !== 'Overall' && f.season !== headToHeadSeason) continue
    const selectedTeamName = canonicalTeamName(team?.name, teamId, teams)
    const homeName = canonicalTeamName(f.home_team_name, f.home_team_id, teams)
    const awayName = canonicalTeamName(f.away_team_name, f.away_team_id, teams)
    const isHome = f.home_team_id === teamId || homeName === selectedTeamName
    const opponentName = isHome ? awayName : homeName
    if (opponentName === selectedTeamName) continue
    const goalsFor = isHome ? f.home_goals : f.away_goals
    const goalsAgainst = isHome ? f.away_goals : f.home_goals
    const outcome = goalsFor > goalsAgainst ? 'W' : goalsFor < goalsAgainst ? 'L' : 'D'
    addHeadToHead(opponentName, goalsFor, goalsAgainst, outcome)
  }
  const headToHead = Object.values(headToHeadMap).sort((a, b) => b.played - a.played || a.opponent.localeCompare(b.opponent))

  const displayedScorers = scorersSeason === 'Overall'
    ? overallScorersList
    : scorersSeason === CURRENT_SEASON
      ? currentScorersList
      : historicScorersList

  return (
    <div className="container" style={{ padding: '32px 20px 48px' }}>
      <h1 style={{ fontSize: 30, marginBottom: 4 }}>Teams</h1>
      <p style={{ color: 'var(--muted)', marginBottom: 24 }}>
        Everything about one club in one place — badge, honours, results, scorers, squad.
      </p>

      <select
        value={teamId}
        onChange={(e) => setTeamId(e.target.value)}
        style={{ ...selectStyle, marginBottom: 24 }}
      >
        <option value="">Select a team…</option>
        {teams.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>

      {loading && <p style={{ color: 'var(--muted)' }}>Loading…</p>}

      {!loading && team && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
            <Badge logoUrl={team.logo_url} name={team.name} size={56} />
            <div>
              <h2 style={{ fontSize: 22, margin: 0 }}>{team.name}</h2>
              {team.manager_name && (
                <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
                  Manager: <strong style={{ color: 'var(--ink)' }}>{team.manager_name}</strong>
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginBottom: 28, flexWrap: 'wrap' }}>
            {upcoming && (
              <div style={{ ...cardStyle, flex: '1 1 200px' }}>
                <div style={sectionLabelStyle}>Upcoming</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>
                  {upcoming.home_team?.id === teamId ? upcoming.away_team?.name : upcoming.home_team?.name}
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                  {new Date(upcoming.fixture_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  {upcoming.venue ? ` · ${upcoming.venue}` : ''}
                </div>
              </div>
            )}
            {lastResult && (
              <div style={{ ...cardStyle, flex: '1 1 200px' }}>
                <div style={sectionLabelStyle}>Last result</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>
                  {lastResult.home_team?.name} {displayedScore(lastResult)} {lastResult.away_team?.name}
                  {outcomeNote(lastResult) && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{outcomeNote(lastResult)}</div>}
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                  {new Date(lastResult.fixture_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </div>
              </div>
            )}
            {form.length > 0 && (
              <div style={{ ...cardStyle, flex: '1 1 200px' }}>
                <div style={sectionLabelStyle}>Form (last {form.length})</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {form.map((f, i) => {
                    const r = resultFor(f)
                    const color = r === 'W' ? '#1a7a3c' : r === 'L' ? '#B3261E' : '#8a7a00'
                    return (
                      <span
                        key={i}
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: '50%',
                          background: color,
                          color: '#fff',
                          fontSize: 11,
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {r}
                      </span>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          <h2 style={sectionHeaderStyle}>Squad</h2>
          {squad.length === 0 ? (
            <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 32 }}>No squad recorded.</p>
          ) : (
            <div style={{ marginBottom: 32, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {squad.map((p) => (
                <span
                  key={p.id}
                  style={{
                    fontSize: 13,
                    padding: '6px 12px',
                    border: '1px solid var(--line)',
                    borderRadius: 20,
                  }}
                >
                  {p.first_name} {p.last_name}
                </span>
              ))}
            </div>
          )}

          <h2 style={sectionHeaderStyle}>Honours</h2>
          {honours.length === 0 ? (
            <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 32 }}>No honours recorded.</p>
          ) : (
            <div style={{ marginBottom: 32 }}>
              {honours.map((h, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '8px 0',
                    borderBottom: '1px solid var(--line)',
                    fontSize: 14,
                  }}
                >
                  <span>
                    {h.competition} <span style={{ color: 'var(--muted)' }}>({h.season})</span>
                  </span>
                  <strong style={{ textTransform: 'capitalize' }}>{h.status}</strong>
                </div>
              ))}
            </div>
          )}

          <h2 style={sectionHeaderStyle}>Season by Season — Results</h2>
          <select
            value={resultsSeason}
            onChange={(e) => setResultsSeason(e.target.value)}
            style={{ ...selectStyle, marginBottom: 12 }}
          >
            {resultSeasonOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <div style={{ marginBottom: 32 }}>
            {(resultsSeason === CURRENT_SEASON ? currentPlayedForResults : historicForSeason).length === 0 ? (
              <p style={{ color: 'var(--muted)', fontSize: 14 }}>No results for this season.</p>
            ) : resultsSeason === CURRENT_SEASON ? (
              currentPlayedForResults.map((f) => (
                <div key={f.id} style={resultRowStyle}>
                  <span>
                    {f.home_team?.name} {displayedScore(f)} {f.away_team?.name}
                    {outcomeNote(f) && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{outcomeNote(f)}</div>}
                  </span>
                  <span style={{ color: 'var(--muted)', fontSize: 12 }}>
                    {new Date(f.fixture_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
              ))
            ) : (
              historicForSeason.map((f) => (
                <div key={f.id} style={resultRowStyle}>
                  <span>
                    {f.home_team_name} {f.home_goals ?? '?'} - {f.away_goals ?? '?'} {f.away_team_name}
                  </span>
                  <span style={{ color: 'var(--muted)', fontSize: 12 }}>{f.competition_name}</span>
                </div>
              ))
            )}
          </div>

          <h2 style={sectionHeaderStyle}>Season by Season — Scorers</h2>
          <select
            value={scorersSeason}
            onChange={(e) => setScorersSeason(e.target.value)}
            style={{ ...selectStyle, marginBottom: 12 }}
          >
            {scorerSeasonOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <div style={{ marginBottom: 12 }}>
            {displayedScorers.length === 0 ? (
              <p style={{ color: 'var(--muted)', fontSize: 14 }}>No scorers recorded for this season.</p>
            ) : (
              displayedScorers.map(([name, goals]) => (
                <div key={name} style={resultRowStyle}>
                  <span>{name}</span>
                  <strong>{goals}</strong>
                </div>
              ))
            )}
          </div>

          <h2 style={{ ...sectionHeaderStyle, marginTop: 36 }}>Overall Head-to-Head Record</h2>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: -4, marginBottom: 12 }}>
            Complete record from the results currently held on this website. Penalty shootout victories count as wins; shootout kicks are not included in goals.
          </p>
          <label htmlFor="head-to-head-season" style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 5 }}>Season</label>
          <select
            id="head-to-head-season"
            value={headToHeadSeason}
            onChange={(event) => setHeadToHeadSeason(event.target.value)}
            style={{ ...selectStyle, marginBottom: 12 }}
          >
            {headToHeadSeasonOptions.map((season) => <option key={season} value={season}>{season}</option>)}
          </select>
          {headToHead.length === 0 ? (
            <p style={{ color: 'var(--muted)', fontSize: 14 }}>No head-to-head results recorded.</p>
          ) : (
            <div>
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: 11 }}>
                <colgroup>
                  <col style={{ width: '41%' }} />
                  <col style={{ width: '7%' }} />
                  <col style={{ width: '7%' }} />
                  <col style={{ width: '7%' }} />
                  <col style={{ width: '7%' }} />
                  <col style={{ width: '8%' }} />
                  <col style={{ width: '8%' }} />
                  <col style={{ width: '15%' }} />
                </colgroup>
                <thead>
                  <tr style={{ borderBottom: '3px solid var(--brass)' }}>
                    <th style={{ ...headToHeadHeaderStyle, textAlign: 'left' }}>Team</th>
                    <th style={headToHeadHeaderStyle}>P</th>
                    <th style={headToHeadHeaderStyle}>W</th>
                    <th style={headToHeadHeaderStyle}>L</th>
                    <th style={headToHeadHeaderStyle}>D</th>
                    <th style={headToHeadHeaderStyle}>GF</th>
                    <th style={headToHeadHeaderStyle}>GA</th>
                    <th style={headToHeadHeaderStyle}>Win %</th>
                  </tr>
                </thead>
                <tbody>
                  {headToHead.map((row) => (
                    <tr key={row.opponent} style={{ borderBottom: '1px solid var(--line)' }}>
                      <td style={{ padding: '8px 3px', fontWeight: 600, fontSize: 12, lineHeight: 1.25 }}>{row.opponent}</td>
                      <td style={headToHeadCellStyle}>{row.played}</td>
                      <td style={headToHeadCellStyle}>{row.wins}</td>
                      <td style={headToHeadCellStyle}>{row.losses}</td>
                      <td style={headToHeadCellStyle}>{row.draws}</td>
                      <td style={headToHeadCellStyle}>{row.goalsFor}</td>
                      <td style={headToHeadCellStyle}>{row.goalsAgainst}</td>
                      <td style={{ ...headToHeadCellStyle, fontWeight: 700 }}>{((row.wins / row.played) * 100).toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}

const selectStyle = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '12px 14px',
  fontSize: 15,
  fontWeight: 600,
  borderRadius: 6,
  border: '1px solid var(--line)',
  background: '#fff',
}
const cardStyle = {
  border: '1px solid var(--line)',
  borderRadius: 8,
  padding: 12,
}
const sectionLabelStyle = {
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: 0.4,
  color: 'var(--brass)',
  fontWeight: 700,
  marginBottom: 4,
}
const sectionHeaderStyle = {
  fontSize: 15,
  textTransform: 'uppercase',
  letterSpacing: 0.4,
  color: 'var(--brass)',
  marginBottom: 12,
  paddingBottom: 8,
  borderBottom: '2px solid var(--line)',
}
const resultRowStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  padding: '8px 0',
  borderBottom: '1px solid var(--line)',
  fontSize: 14,
}
const headToHeadHeaderStyle = { padding: '7px 2px', textAlign: 'center', fontSize: 9, textTransform: 'uppercase', whiteSpace: 'nowrap' }
const headToHeadCellStyle = { padding: '8px 2px', textAlign: 'center', whiteSpace: 'nowrap' }
