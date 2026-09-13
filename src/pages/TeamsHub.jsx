import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

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

  useEffect(() => {
    supabase
      .from('teams')
      .select('id, name, logo_url')
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

    async function load() {
      setTeam(teams.find((t) => t.id === teamId) || null)

      const { data: cf } = await supabase
        .from('fixtures')
        .select(
          'id, fixture_date, venue, home_score, away_score, status, home_team:home_team_id(id, name, logo_url), away_team:away_team_id(id, name, logo_url), stage:stage_id(name, competition:competition_id(name))'
        )
        .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
        .eq('hidden_from_public', false)
        .order('fixture_date')
      setCurrentFixtures(cf || [])

      const { data: hf } = await supabase
        .from('historic_fixtures')
        .select('id, season, competition_name, fixture_date, home_team_name, home_goals, away_team_name, away_goals')
        .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
        .order('fixture_date', { ascending: false })
      setHistoricFixtures(hf || [])

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

  const currentPlayedForResults = played
  const historicForSeason = historicFixtures.filter((f) => f.season === resultsSeason)

  // Season-by-season scorers
  const historicScorerSeasons = Array.from(new Set(historicScorers.map((s) => s.season))).sort().reverse()
  const scorerSeasonOptions = [CURRENT_SEASON, ...historicScorerSeasons]

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
            <h2 style={{ fontSize: 22, margin: 0 }}>{team.name}</h2>
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
                  {lastResult.home_team?.name} {lastResult.home_score} - {lastResult.away_score} {lastResult.away_team?.name}
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
                    {f.home_team?.name} {f.home_score} - {f.away_score} {f.away_team?.name}
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
            {(scorersSeason === CURRENT_SEASON ? currentScorersList : historicScorersList).length === 0 ? (
              <p style={{ color: 'var(--muted)', fontSize: 14 }}>No scorers recorded for this season.</p>
            ) : (
              (scorersSeason === CURRENT_SEASON ? currentScorersList : historicScorersList).map(([name, goals]) => (
                <div key={name} style={resultRowStyle}>
                  <span>{name}</span>
                  <strong>{goals}</strong>
                </div>
              ))
            )}
          </div>
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
