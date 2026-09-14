import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

const YELLOW_POINTS = 2
const RED_POINTS = 4

const THRESHOLDS = [
  { points: 10, ban: '1-match suspension' },
  { points: 18, ban: '3-match suspension' },
  { points: 24, ban: '5-match suspension' },
  { points: 28, ban: '7-match suspension' },
  { points: 30, ban: '10-match suspension' },
]

const SERIOUS_OFFENCE_RULES = {
  opponent_abuse: { label: 'Abusive language (opponent)', tiers: ['3-match ban'] },
  official_abuse: { label: 'Abusive language (official)', tiers: ['5-match ban', '1-year ban (review required)'] },
  discriminatory: { label: 'Discriminatory language', tiers: ['3-match ban', '1-year ban (review required)'] },
  violent_conduct: { label: 'Violent conduct', tiers: ['Minimum 12-month ban (review required)', 'Lifetime ban'] },
}

function banForPoints(points) {
  let result = null
  for (const t of THRESHOLDS) {
    if (points >= t.points) result = t
  }
  return result
}

export default function Discipline() {
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [playerRows, setPlayerRows] = useState([])
  const [teamRows, setTeamRows] = useState([])
  const [seriousRows, setSeriousRows] = useState([])
  const [playedFixtures, setPlayedFixtures] = useState([])

  const [suspensions, setSuspensions] = useState([])
  const [teams, setTeams] = useState([])
  const [teamFilter, setTeamFilter] = useState('')
  const [squadByTeam, setSquadByTeam] = useState({})
  const [savingSuspension, setSavingSuspension] = useState(null)
  const [teamOverrides, setTeamOverrides] = useState({})
  const [editingTeamOverride, setEditingTeamOverride] = useState(null)
  const [editTeamOverrideValue, setEditTeamOverrideValue] = useState('')
  const [editingSuspensionTeam, setEditingSuspensionTeam] = useState(null)
  const [editSuspensionTeamValue, setEditSuspensionTeamValue] = useState('')
  const [playerPoints, setPlayerPoints] = useState([])
  const [editingPlayerPoint, setEditingPlayerPoint] = useState(null)
  const [editPlayerPointValue, setEditPlayerPointValue] = useState('')
  const [newPlayerPoint, setNewPlayerPoint] = useState({ teamId: '', playerName: '', points: '' })
  const [newOverrideTeamId, setNewOverrideTeamId] = useState('')
  const [newOverridePoints, setNewOverridePoints] = useState('')

  const [form, setForm] = useState({
    teamId: '',
    playerId: '',
    noTeam: false,
    firstName: '',
    lastName: '',
    reason: '',
    banType: 'games',
    gamesBanned: 1,
    availableFrom: '',
    notes: '',
  })

  const [pointForm, setPointForm] = useState({ teamId: '', playerId: '', points: '', reason: '' })

  useEffect(() => {
    loadPointsOverview()
    loadSuspensions()
    loadPlayedFixtures()
    loadTeamOverrides()
    loadPlayerPoints()
    checkAdmin()
    supabase
      .from('teams')
      .select('id, name')
      .order('name')
      .then(({ data }) => setTeams(data || []))
  }, [])

  async function loadTeamOverrides() {
    const { data } = await supabase.from('team_points_override').select('team_id, points')
    const map = {}
    for (const row of data || []) map[row.team_id] = row.points
    setTeamOverrides(map)
  }

  async function saveTeamOverride(teamId) {
    const points = Number(editTeamOverrideValue)
    if (Number.isNaN(points)) return
    await supabase.from('team_points_override').upsert({ team_id: teamId, points })
    setEditingTeamOverride(null)
    loadTeamOverrides()
  }

  async function clearTeamOverride(teamId) {
    await supabase.from('team_points_override').delete().eq('team_id', teamId)
    loadTeamOverrides()
  }

  async function saveNewTeamOverride() {
    if (!newOverrideTeamId || newOverridePoints === '') return
    await supabase
      .from('team_points_override')
      .upsert({ team_id: newOverrideTeamId, points: Number(newOverridePoints) })
    setNewOverrideTeamId('')
    setNewOverridePoints('')
    loadTeamOverrides()
  }

  async function loadPlayerPoints() {
    const { data } = await supabase
      .from('player_discipline_points')
      .select('id, team_id, team_name_raw, player_name, points, team:team_id(id, name)')
      .eq('season', '2026/27')
      .order('points', { ascending: false })
    setPlayerPoints(data || [])
  }

  async function savePlayerPoint(id) {
    const points = Number(editPlayerPointValue)
    if (Number.isNaN(points)) return
    await supabase.from('player_discipline_points').update({ points }).eq('id', id)
    setEditingPlayerPoint(null)
    loadPlayerPoints()
  }

  async function removePlayerPoint(id) {
    await supabase.from('player_discipline_points').delete().eq('id', id)
    loadPlayerPoints()
  }

  async function addPlayerPoint() {
    if (!newPlayerPoint.teamId || !newPlayerPoint.playerName.trim() || newPlayerPoint.points === '') return
    const team = teams.find((t) => t.id === newPlayerPoint.teamId)
    await supabase.from('player_discipline_points').insert({
      team_id: newPlayerPoint.teamId,
      team_name_raw: team?.name || '',
      player_name: newPlayerPoint.playerName.trim(),
      points: Number(newPlayerPoint.points),
      season: '2026/27',
    })
    setNewPlayerPoint({ teamId: '', playerName: '', points: '' })
    loadPlayerPoints()
  }

  async function checkAdmin() {
    const { data: adminRow } = await supabase.from('admin_profiles').select('id').maybeSingle()
    setIsAdmin(!!adminRow)
  }

  async function loadPointsOverview() {
    const { data } = await supabase
      .from('discipline_records')
      .select(
        'fixture_id, card_type, card_count, serious_offence, player:player_id(id, first_name, last_name), team:team_id(id, name), fixture:fixture_id(id, fixture_date)'
      )
      .order('created_at')

    const rows = data || []

    const byPlayerFixture = new Map()
    for (const r of rows) {
      if (r.serious_offence) continue
      const key = `${r.player.id}::${r.fixture_id}`
      if (!byPlayerFixture.has(key)) {
        byPlayerFixture.set(key, { player: r.player, team: r.team, yellow: 0, red: 0 })
      }
      const entry = byPlayerFixture.get(key)
      if (r.card_type === 'red') entry.red += r.card_count
      else entry.yellow += r.card_count
    }

    const totals = new Map()
    for (const { player, team, yellow, red } of byPlayerFixture.values()) {
      const matchPoints = red > 0 ? red * RED_POINTS : yellow * YELLOW_POINTS
      if (!totals.has(player.id)) {
        totals.set(player.id, { player, team, points: 0 })
      }
      totals.get(player.id).points += matchPoints
    }

    const { data: adjustments } = await supabase
      .from('point_adjustments')
      .select('points, player:player_id(id, first_name, last_name), team:team_id(id, name)')

    for (const adj of adjustments || []) {
      if (!totals.has(adj.player.id)) {
        totals.set(adj.player.id, { player: adj.player, team: adj.team, points: 0 })
      }
      totals.get(adj.player.id).points += adj.points
    }

    const playerList = Array.from(totals.values())
      .map((row) => ({ ...row, ban: banForPoints(row.points) }))
      .filter((row) => row.points > 0)
      .sort((a, b) => b.points - a.points)

    const teamTotals = new Map()
    for (const row of totals.values()) {
      if (!teamTotals.has(row.team.id)) {
        teamTotals.set(row.team.id, { team: row.team, points: 0 })
      }
      teamTotals.get(row.team.id).points += row.points
    }
    const teamList = Array.from(teamTotals.values()).sort((a, b) => b.points - a.points)

    const seriousCounts = new Map()
    for (const r of rows) {
      if (!r.serious_offence) continue
      const key = `${r.player.id}::${r.serious_offence}`
      if (!seriousCounts.has(key)) {
        seriousCounts.set(key, { player: r.player, team: r.team, type: r.serious_offence, count: 0, offenceDates: [] })
      }
      const entry = seriousCounts.get(key)
      entry.count += 1
      if (r.fixture?.fixture_date) entry.offenceDates.push(r.fixture.fixture_date)
    }

    const seriousList = Array.from(seriousCounts.values())
      .map((row) => {
        const rule = SERIOUS_OFFENCE_RULES[row.type]
        const tierIndex = Math.min(row.count, rule.tiers.length) - 1
        const ban = rule.tiers[tierIndex]
        const matchBan = ban.match(/(\d+)-match/)
        const startDate = [...row.offenceDates].sort().at(-1) || null
        let availableFrom = null
        if (startDate && (ban.includes('1-year') || ban.includes('12-month'))) {
          const date = new Date(`${startDate}T00:00:00`)
          date.setFullYear(date.getFullYear() + 1)
          availableFrom = date.toISOString().slice(0, 10)
        }
        return {
          ...row,
          label: rule.label,
          ban,
          offenceNumber: row.count,
          startDate,
          gamesBanned: matchBan ? Number(matchBan[1]) : null,
          availableFrom,
          isLifetime: ban === 'Lifetime ban',
        }
      })
      .sort((a, b) => b.count - a.count)

    setPlayerRows(playerList)
    setTeamRows(teamList)
    setSeriousRows(seriousList)
    setLoading(false)
  }

  async function loadSuspensions() {
    const { data } = await supabase
      .from('suspensions')
      .select('id, reason, games_banned, is_lifetime, games_served, status, notes, available_from, created_at, player:player_id(id, first_name, last_name), team:team_id(id, name)')
      .order('created_at', { ascending: false })
    setSuspensions(data || [])
  }

  async function loadPlayedFixtures() {
    const { data } = await supabase
      .from('fixtures')
      .select('id, fixture_date, status, home_team_id, away_team_id')
      .eq('status', 'played')
      .order('fixture_date')
    setPlayedFixtures(data || [])
  }

  function gamesPlayedSince(teamId, startDate) {
    if (!teamId || !startDate) return 0
    const start = String(startDate).slice(0, 10)
    return playedFixtures.filter(
      (fixture) =>
        fixture.fixture_date > start &&
        (fixture.home_team_id === teamId || fixture.away_team_id === teamId)
    ).length
  }

  async function loadSquad(teamId) {
    if (squadByTeam[teamId]) return
    const { data } = await supabase
      .from('players')
      .select('id, first_name, last_name')
      .eq('team_id', teamId)
      .order('last_name')
    setSquadByTeam((prev) => ({ ...prev, [teamId]: data || [] }))
  }

  async function addPointAdjustment() {
    if (!pointForm.playerId || !pointForm.points) return
    await supabase.from('point_adjustments').insert({
      player_id: pointForm.playerId,
      team_id: pointForm.teamId,
      points: Number(pointForm.points),
      reason: pointForm.reason.trim() || null,
    })
    setPointForm({ teamId: '', playerId: '', points: '', reason: '' })
    loadPointsOverview()
  }

  async function addSuspension() {
    if (!form.reason.trim()) return

    let playerId = form.playerId
    let teamId = form.teamId || null

    if (form.noTeam) {
      if (!form.firstName.trim() || !form.lastName.trim()) return
      let { data: existing } = await supabase
        .from('players')
        .select('id')
        .eq('first_name', form.firstName.trim())
        .eq('last_name', form.lastName.trim())
        .maybeSingle()

      if (existing) {
        playerId = existing.id
      } else {
        const { data: created, error } = await supabase
          .from('players')
          .insert({ first_name: form.firstName.trim(), last_name: form.lastName.trim() })
          .select('id')
          .single()
        if (error) return
        playerId = created.id
      }
      teamId = null
    }

    if (!playerId) return

    await supabase.from('suspensions').insert({
      player_id: playerId,
      team_id: teamId,
      reason: form.reason.trim(),
      games_banned: form.banType === 'games' ? Number(form.gamesBanned) : null,
      is_lifetime: form.banType === 'indefinite',
      available_from: form.banType === 'date' ? form.availableFrom || null : null,
      notes: form.notes.trim() || null,
    })
    setForm({
      teamId: '',
      playerId: '',
      noTeam: false,
      firstName: '',
      lastName: '',
      reason: '',
      banType: 'games',
      gamesBanned: 1,
      availableFrom: '',
      notes: '',
    })
    loadSuspensions()
  }

  async function markServed(suspension, delta) {
    setSavingSuspension(suspension.id)
    const newServed = Math.max(0, suspension.games_served + delta)
    const isNowServed = !suspension.is_lifetime && suspension.games_banned && newServed >= suspension.games_banned
    await supabase
      .from('suspensions')
      .update({ games_served: newServed, status: isNowServed ? 'served' : 'active' })
      .eq('id', suspension.id)
    setSavingSuspension(null)
    loadSuspensions()
  }

  async function markFullyServed(suspension) {
    setSavingSuspension(suspension.id)
    await supabase.from('suspensions').update({ status: 'served' }).eq('id', suspension.id)
    setSavingSuspension(null)
    loadSuspensions()
  }

  async function updateSuspensionTeam(suspensionId, newTeamId) {
    await supabase
      .from('suspensions')
      .update({ team_id: newTeamId || null })
      .eq('id', suspensionId)
    setEditingSuspensionTeam(null)
    loadSuspensions()
  }

  async function removeSuspension(id) {
    await supabase.from('suspensions').delete().eq('id', id)
    loadSuspensions()
  }

  // Merge computed team totals with manual overrides. A team with an override
  // but no cards logged this season yet still needs to show up.
  const teamRowIds = new Set(teamRows.map((r) => r.team.id))
  const overrideOnlyTeams = teams
    .filter((t) => teamOverrides[t.id] !== undefined && !teamRowIds.has(t.id))
    .map((t) => ({ team: t, points: teamOverrides[t.id] }))
  const displayTeamRows = [...teamRows, ...overrideOnlyTeams].sort(
    (a, b) => (teamOverrides[b.team.id] ?? b.points) - (teamOverrides[a.team.id] ?? a.points)
  )

  const manualSuspensions = suspensions.map((s) => ({
    ...s,
    automaticGamesServed: s.team?.id
      ? gamesPlayedSince(s.team.id, s.created_at)
      : Number(s.games_served || 0),
  }))
  const manuallyCoveredPlayers = new Set(
    manualSuspensions.filter((s) => s.status === 'active').map((s) => s.player?.id)
  )

  const automaticSeriousSuspensions = seriousRows
    .filter((row) => {
      const served = gamesPlayedSince(row.team?.id, row.startDate)
      const dateBanActive = row.availableFrom && new Date(`${row.availableFrom}T23:59:59`) >= new Date()
      return (
        !manuallyCoveredPlayers.has(row.player?.id) &&
        (row.isLifetime || dateBanActive || (row.gamesBanned && served < row.gamesBanned))
      )
    })
    .map((row) => ({
      id: `serious-${row.player.id}-${row.type}`,
      player: row.player,
      team: row.team,
      reason: row.label,
      games_banned: row.gamesBanned,
      is_lifetime: row.isLifetime,
      available_from: row.availableFrom,
      automaticGamesServed: gamesPlayedSince(row.team?.id, row.startDate),
      isAutomatic: true,
    }))

  const activeSuspensions = [...manualSuspensions, ...automaticSeriousSuspensions]
    .filter((s) => {
      if (s.status && s.status !== 'active') return false
      if (s.is_lifetime) return true
      if (s.available_from) return new Date(`${s.available_from}T23:59:59`) >= new Date()
      return !s.games_banned || s.automaticGamesServed < s.games_banned
    })
    .filter((s) => !teamFilter || s.team?.id === teamFilter)
  const filteredPlayerRows = playerRows.filter((row) => !teamFilter || row.team.id === teamFilter)

  const completedSeriousBans = seriousRows
    .filter((row) => {
      const served = gamesPlayedSince(row.team?.id, row.startDate)
      const dateBanFinished = row.availableFrom && new Date(`${row.availableFrom}T23:59:59`) < new Date()
      return dateBanFinished || (row.gamesBanned && served >= row.gamesBanned)
    })
    .map((row) => ({
      id: `history-serious-${row.player.id}-${row.type}`,
      player: row.player,
      team: row.team,
      reason: row.label,
      summary: row.gamesBanned
        ? `${row.gamesBanned}-match ban — served`
        : `Ban ended ${new Date(`${row.availableFrom}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`,
      completedOn: row.availableFrom || row.startDate,
    }))

  const completedManualBans = manualSuspensions
    .filter((s) => {
      const reason = String(s.reason || '')
      const isThresholdBan = /points?|threshold/i.test(reason)
      const isSerious = /abusive|discriminatory|violent|serious/i.test(reason)
      const isFinished =
        s.status === 'served' ||
        (!s.is_lifetime && s.available_from && new Date(`${s.available_from}T23:59:59`) < new Date()) ||
        (!s.is_lifetime && !s.available_from && s.games_banned && s.automaticGamesServed >= s.games_banned)
      return isFinished && !isThresholdBan && (isSerious || Number(s.games_banned || 0) >= 3)
    })
    .map((s) => ({
      id: `history-manual-${s.id}`,
      player: s.player,
      team: s.team,
      reason: s.reason,
      summary: s.games_banned
        ? `${s.games_banned}-match ban — served`
        : s.available_from
          ? `Ban ended ${new Date(`${s.available_from}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
          : 'Ban served',
      completedOn: s.available_from || s.created_at,
    }))

  const banHistory = [...completedSeriousBans, ...completedManualBans]
    .filter((s) => !teamFilter || s.team?.id === teamFilter)
    .sort((a, b) => new Date(b.completedOn || 0) - new Date(a.completedOn || 0))

  if (loading) {
    return (
      <div className="container" style={{ padding: '32px 20px' }}>
        <p style={{ color: 'var(--muted)' }}>Loading…</p>
      </div>
    )
  }

  return (
    <div className="container" style={{ padding: '32px 20px 48px', maxWidth: 480 }}>
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>Discipline Overview</h1>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 20 }}>
        Private — not shown on the public site.
      </p>

      <select
        value={teamFilter}
        onChange={(e) => setTeamFilter(e.target.value)}
        style={{ ...fullSelectStyle, marginBottom: 28 }}
      >
        <option value="">All teams</option>
        {teams.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>

      <h2 style={{ fontSize: 15, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--brass)', marginBottom: 12 }}>
        Current Bans
      </h2>
      <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14 }}>
        Includes serious-offence and manually added bans. Games served are counted automatically
        from the team's played fixtures after the ban began.
      </p>

      {activeSuspensions.length === 0 ? (
        <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 24 }}>No active bans right now.</p>
      ) : (
        <div style={{ marginBottom: 24 }}>
          {activeSuspensions.map((s) => (
            <div key={s.id} style={cardStyle}>
              <div style={{ fontWeight: 600 }}>
                {s.player.first_name} {s.player.last_name}
              </div>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 6 }}>
                {editingSuspensionTeam === s.id ? (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <select
                      value={editSuspensionTeamValue}
                      onChange={(e) => setEditSuspensionTeamValue(e.target.value)}
                      style={{ ...fullSelectStyle, flex: 1 }}
                    >
                      <option value="">No team</option>
                      {teams.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => updateSuspensionTeam(s.id, editSuspensionTeamValue)}
                      style={{ ...smallButtonStyle, flexShrink: 0 }}
                    >
                      Save
                    </button>
                  </div>
                ) : (
                  <span>
                    {s.team?.name || 'No team'}
                    {isAdmin && (
                      <button
                        onClick={() => {
                          setEditingSuspensionTeam(s.id)
                          setEditSuspensionTeamValue(s.team?.id || '')
                        }}
                        style={{ ...smallOutlineStyle, padding: '2px 8px', fontSize: 11, marginLeft: 8 }}
                      >
                        Change team
                      </button>
                    )}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 14, marginBottom: 4 }}>{s.reason}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#B3261E', marginBottom: 8 }}>
                {s.is_lifetime
                  ? 'Indefinite / lifetime ban'
                  : s.available_from
                    ? `Available from ${new Date(s.available_from + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
                    : `${s.automaticGamesServed} of ${s.games_banned} games served — ${Math.max(0, s.games_banned - s.automaticGamesServed)} remaining`}
              </div>
              {s.notes && <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>{s.notes}</div>}
              {isAdmin && !s.isAutomatic && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button onClick={() => markFullyServed(s)} style={{ ...smallOutlineStyle, flex: 1 }}>
                    Mark fully served
                  </button>
                  <button onClick={() => removeSuspension(s.id)} style={{ ...smallOutlineStyle, flex: 1 }}>
                    Remove
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div style={{ ...cardStyle, marginBottom: 40 }}>
        <div style={{ fontWeight: 600, marginBottom: 10, fontSize: 14 }}>
          {isAdmin ? 'Add a ban' : 'Bans'}
        </div>
        {isAdmin ? (
          <>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 8 }}>
          <input
            type="checkbox"
            checked={form.noTeam}
            onChange={(e) => setForm((p) => ({ ...p, noTeam: e.target.checked, teamId: '', playerId: '' }))}
          />
          Player has no current team (or isn't in a squad)
        </label>

        {form.noTeam ? (
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input
              placeholder="First name"
              value={form.firstName}
              onChange={(e) => setForm((p) => ({ ...p, firstName: e.target.value }))}
              style={{ ...fullSelectStyle, flex: 1 }}
            />
            <input
              placeholder="Last name"
              value={form.lastName}
              onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))}
              style={{ ...fullSelectStyle, flex: 1 }}
            />
          </div>
        ) : (
          <>
            <select
              value={form.teamId}
              onChange={(e) => {
                setForm((p) => ({ ...p, teamId: e.target.value, playerId: '' }))
                if (e.target.value) loadSquad(e.target.value)
              }}
              style={{ ...fullSelectStyle, marginBottom: 8 }}
            >
              <option value="">Select team…</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>

            <select
              value={form.playerId}
              onChange={(e) => setForm((p) => ({ ...p, playerId: e.target.value }))}
              disabled={!form.teamId}
              style={{ ...fullSelectStyle, marginBottom: 8 }}
            >
              <option value="">Select player…</option>
              {(squadByTeam[form.teamId] || []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.first_name} {p.last_name}
                </option>
              ))}
            </select>
          </>
        )}

        <input
          placeholder="Reason (e.g. Points threshold — 18 pts, Violent conduct)"
          value={form.reason}
          onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))}
          style={{ ...fullSelectStyle, marginBottom: 8 }}
        />

        <select
          value={form.banType}
          onChange={(e) => setForm((p) => ({ ...p, banType: e.target.value }))}
          style={{ ...fullSelectStyle, marginBottom: 8 }}
        >
          <option value="games">Fixed number of games</option>
          <option value="date">Available again from a date</option>
          <option value="indefinite">Indefinite / lifetime</option>
        </select>

        {form.banType === 'games' && (
          <input
            type="number"
            min="1"
            placeholder="Games banned"
            value={form.gamesBanned}
            onChange={(e) => setForm((p) => ({ ...p, gamesBanned: e.target.value }))}
            style={{ ...fullSelectStyle, marginBottom: 8 }}
          />
        )}

        {form.banType === 'date' && (
          <input
            type="date"
            value={form.availableFrom}
            onChange={(e) => setForm((p) => ({ ...p, availableFrom: e.target.value }))}
            style={{ ...fullSelectStyle, marginBottom: 8 }}
          />
        )}

        <input
          placeholder="Notes (optional)"
          value={form.notes}
          onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
          style={{ ...fullSelectStyle, marginBottom: 10 }}
        />

        <button onClick={addSuspension} style={{ ...smallButtonStyle, width: '100%' }}>
          Add ban
        </button>
          </>
        ) : (
          <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>
            Only admins can add or change bans. Contact Iain if one needs updating.
          </p>
        )}
      </div>

      <h2 style={{ fontSize: 15, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--brass)', marginBottom: 12 }}>
        Total Points by Team
      </h2>

      {isAdmin && (
        <div style={{ ...cardStyle, marginBottom: 20 }}>
          <div style={{ fontWeight: 600, marginBottom: 10, fontSize: 14 }}>
            Set points for a team (including ones with none yet)
          </div>
          <select
            value={newOverrideTeamId}
            onChange={(e) => setNewOverrideTeamId(e.target.value)}
            style={{ ...fullSelectStyle, marginBottom: 8 }}
          >
            <option value="">Select team…</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="number"
              placeholder="Points"
              value={newOverridePoints}
              onChange={(e) => setNewOverridePoints(e.target.value)}
              style={{ ...fullSelectStyle, flex: 1 }}
            />
            <button onClick={saveNewTeamOverride} style={{ ...smallButtonStyle, flex: 1 }}>
              Save
            </button>
          </div>
        </div>
      )}

      {displayTeamRows.length === 0 ? (
        <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 32 }}>No cards recorded yet.</p>
      ) : (
        <div style={{ marginBottom: 32 }}>
          {displayTeamRows.map((row) => {
            const hasOverride = teamOverrides[row.team.id] !== undefined
            const displayPoints = hasOverride ? teamOverrides[row.team.id] : row.points
            const isEditing = editingTeamOverride === row.team.id
            return (
              <div key={row.team.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14 }}>
                  <span>
                    {row.team.name}
                    {hasOverride && (
                      <span style={{ fontSize: 11, color: 'var(--muted)' }}> (manually set)</span>
                    )}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <strong>{displayPoints}</strong>
                    {isAdmin && !isEditing && (
                      <button
                        onClick={() => {
                          setEditingTeamOverride(row.team.id)
                          setEditTeamOverrideValue(String(displayPoints))
                        }}
                        style={{ ...smallOutlineStyle, padding: '4px 8px', fontSize: 12 }}
                      >
                        Edit
                      </button>
                    )}
                  </div>
                </div>
                {isAdmin && isEditing && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <input
                      type="number"
                      value={editTeamOverrideValue}
                      onChange={(e) => setEditTeamOverrideValue(e.target.value)}
                      style={{ ...fullSelectStyle, flex: 1 }}
                    />
                    <button onClick={() => saveTeamOverride(row.team.id)} style={{ ...smallButtonStyle, flex: 1 }}>
                      Save
                    </button>
                    {hasOverride && (
                      <button
                        onClick={() => clearTeamOverride(row.team.id)}
                        style={{ ...smallOutlineStyle, flex: 1 }}
                      >
                        Reset to calculated
                      </button>
                    )}
                    <button onClick={() => setEditingTeamOverride(null)} style={{ ...smallOutlineStyle, flex: 1 }}>
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <h2 style={{ fontSize: 15, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--brass)', marginBottom: 6 }}>
        Individual Player Points (2026/27)
      </h2>
      <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
        All recorded players are shown. Use the team filter below to narrow the list.
      </p>
      <select
        value={teamFilter}
        onChange={(e) => setTeamFilter(e.target.value)}
        style={{ ...fullSelectStyle, marginBottom: 16 }}
        aria-label="Filter individual player points by team"
      >
        <option value="">All teams</option>
        {teams.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      {isAdmin && (
        <div style={{ ...cardStyle, marginBottom: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 10, fontSize: 14 }}>Add / correct a player</div>
          <select
            value={newPlayerPoint.teamId}
            onChange={(e) => setNewPlayerPoint((p) => ({ ...p, teamId: e.target.value }))}
            style={{ ...fullSelectStyle, marginBottom: 8 }}
          >
            <option value="">Select team…</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <input
            placeholder="Player name"
            value={newPlayerPoint.playerName}
            onChange={(e) => setNewPlayerPoint((p) => ({ ...p, playerName: e.target.value }))}
            style={{ ...fullSelectStyle, marginBottom: 8 }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="number"
              placeholder="Points"
              value={newPlayerPoint.points}
              onChange={(e) => setNewPlayerPoint((p) => ({ ...p, points: e.target.value }))}
              style={{ ...fullSelectStyle, flex: 1 }}
            />
            <button onClick={addPlayerPoint} style={{ ...smallButtonStyle, flex: 1 }}>
              Add
            </button>
          </div>
        </div>
      )}
      {playerPoints.filter((p) => !teamFilter || p.team_id === teamFilter).length === 0 ? (
        <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 32 }}>No player points recorded yet.</p>
      ) : (
        <div style={{ marginBottom: 32 }}>
          {playerPoints
            .filter((p) => !teamFilter || p.team_id === teamFilter)
            .map((p) => {
              const isEditing = editingPlayerPoint === p.id
              return (
                <div key={p.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14 }}>
                    <span>
                      {p.player_name}
                      <span style={{ fontSize: 11, color: 'var(--muted)' }}> — {p.team?.name || p.team_name_raw}</span>
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <strong>{p.points}</strong>
                      {isAdmin && !isEditing && (
                        <button
                          onClick={() => {
                            setEditingPlayerPoint(p.id)
                            setEditPlayerPointValue(String(p.points))
                          }}
                          style={{ ...smallOutlineStyle, padding: '4px 8px', fontSize: 12 }}
                        >
                          Edit
                        </button>
                      )}
                    </div>
                  </div>
                  {isAdmin && isEditing && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <input
                        type="number"
                        value={editPlayerPointValue}
                        onChange={(e) => setEditPlayerPointValue(e.target.value)}
                        style={{ ...fullSelectStyle, flex: 1 }}
                      />
                      <button onClick={() => savePlayerPoint(p.id)} style={{ ...smallButtonStyle, flex: 1 }}>
                        Save
                      </button>
                      <button onClick={() => removePlayerPoint(p.id)} style={{ ...smallOutlineStyle, flex: 1 }}>
                        Remove
                      </button>
                      <button onClick={() => setEditingPlayerPoint(null)} style={{ ...smallOutlineStyle, flex: 1 }}>
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
        </div>
      )}

      <h2 style={{ fontSize: 15, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--brass)', marginBottom: 6 }}>
        Ban Thresholds
      </h2>
      <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
        Reference guide only. Crossing a threshold is a prompt to add a ban above — it isn't a
        ban by itself. Yellow = 2 pts, red = 4 pts (two yellows in the same match that make a red
        only count as 4, not 8).
      </p>

      <div style={{ ...cardStyle, marginBottom: 32 }}>
        {THRESHOLDS.map((t) => (
          <div
            key={t.points}
            style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '3px 0' }}
          >
            <span>{t.points}+ points</span>
            <span style={{ fontWeight: 600 }}>{t.ban}</span>
          </div>
        ))}
      </div>

      <h2 style={{ fontSize: 15, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--brass)', marginBottom: 12 }}>
        Serious Offences
      </h2>
      {seriousRows.length === 0 ? (
        <p style={{ color: 'var(--muted)', fontSize: 14 }}>None recorded.</p>
      ) : (
        seriousRows.map((row) => (
          <div key={`${row.player.id}-${row.type}`} style={cardStyle}>
            <div style={{ fontWeight: 600 }}>
              {row.player.first_name} {row.player.last_name}
            </div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 6 }}>{row.team.name}</div>
            <div style={{ fontSize: 14 }}>
              {row.label} — offence #{row.offenceNumber}
            </div>
            <div style={{ fontSize: 13, color: '#B3261E', fontWeight: 600, marginTop: 4 }}>{row.ban}</div>
          </div>
        ))
      )}

      <h2 style={{ fontSize: 15, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--brass)', marginTop: 36, marginBottom: 6 }}>
        Served Ban History
      </h2>
      <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
        Completed serious bans and other suspensions of three matches or more. Points-threshold bans are excluded.
      </p>
      {banHistory.length === 0 ? (
        <p style={{ color: 'var(--muted)', fontSize: 14 }}>No completed qualifying bans.</p>
      ) : (
        banHistory.map((ban) => (
          <div key={ban.id} style={cardStyle}>
            <div style={{ fontWeight: 600 }}>
              {ban.player.first_name} {ban.player.last_name}
            </div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 6 }}>
              {ban.team?.name || 'No team'}
            </div>
            <div style={{ fontSize: 14 }}>{ban.reason}</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600, marginTop: 4 }}>
              {ban.summary}
            </div>
          </div>
        ))
      )}
    </div>
  )
}

const cardStyle = {
  border: '1px solid var(--line)',
  borderRadius: 8,
  padding: 14,
  marginBottom: 10,
}
const fullSelectStyle = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 10px',
  border: '1px solid var(--line)',
  fontSize: 14,
  borderRadius: 6,
}
const smallButtonStyle = {
  padding: '8px 10px',
  background: 'var(--ink)',
  color: '#fff',
  border: 'none',
  fontSize: 13,
  borderRadius: 6,
  cursor: 'pointer',
}
const smallOutlineStyle = {
  padding: '8px 10px',
  background: 'none',
  color: 'var(--ink)',
  border: '1px solid var(--line)',
  fontSize: 13,
  borderRadius: 6,
  cursor: 'pointer',
}
