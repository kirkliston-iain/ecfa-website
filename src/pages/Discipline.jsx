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
  const [playerRows, setPlayerRows] = useState([])
  const [seriousRows, setSeriousRows] = useState([])

  const [suspensions, setSuspensions] = useState([])
  const [teams, setTeams] = useState([])
  const [squadByTeam, setSquadByTeam] = useState({})
  const [savingSuspension, setSavingSuspension] = useState(null)

  const [form, setForm] = useState({
    teamId: '',
    playerId: '',
    reason: '',
    gamesBanned: 1,
    isLifetime: false,
    notes: '',
  })

  useEffect(() => {
    loadPointsOverview()
    loadSuspensions()
    supabase
      .from('teams')
      .select('id, name')
      .order('name')
      .then(({ data }) => setTeams(data || []))
  }, [])

  async function loadPointsOverview() {
    const { data } = await supabase
      .from('discipline_records')
      .select(
        'fixture_id, card_type, card_count, serious_offence, player:player_id(id, first_name, last_name), team:team_id(id, name)'
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

    const playerList = Array.from(totals.values())
      .map((row) => ({ ...row, ban: banForPoints(row.points) }))
      .filter((row) => row.points > 0)
      .sort((a, b) => b.points - a.points)

    const seriousCounts = new Map()
    for (const r of rows) {
      if (!r.serious_offence) continue
      const key = `${r.player.id}::${r.serious_offence}`
      if (!seriousCounts.has(key)) {
        seriousCounts.set(key, { player: r.player, team: r.team, type: r.serious_offence, count: 0 })
      }
      seriousCounts.get(key).count += 1
    }

    const seriousList = Array.from(seriousCounts.values())
      .map((row) => {
        const rule = SERIOUS_OFFENCE_RULES[row.type]
        const tierIndex = Math.min(row.count, rule.tiers.length) - 1
        return { ...row, label: rule.label, ban: rule.tiers[tierIndex], offenceNumber: row.count }
      })
      .sort((a, b) => b.count - a.count)

    setPlayerRows(playerList)
    setSeriousRows(seriousList)
    setLoading(false)
  }

  async function loadSuspensions() {
    const { data } = await supabase
      .from('suspensions')
      .select('id, reason, games_banned, is_lifetime, games_served, status, notes, player:player_id(id, first_name, last_name), team:team_id(id, name)')
      .order('created_at', { ascending: false })
    setSuspensions(data || [])
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

  async function addSuspension() {
    if (!form.playerId || !form.reason.trim()) return
    await supabase.from('suspensions').insert({
      player_id: form.playerId,
      team_id: form.teamId,
      reason: form.reason.trim(),
      games_banned: form.isLifetime ? null : Number(form.gamesBanned),
      is_lifetime: form.isLifetime,
      notes: form.notes.trim() || null,
    })
    setForm({ teamId: '', playerId: '', reason: '', gamesBanned: 1, isLifetime: false, notes: '' })
    loadSuspensions()
  }

  async function markServed(suspension) {
    setSavingSuspension(suspension.id)
    const newServed = suspension.games_served + 1
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

  async function removeSuspension(id) {
    await supabase.from('suspensions').delete().eq('id', id)
    loadSuspensions()
  }

  const activeSuspensions = suspensions.filter((s) => s.status === 'active')

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
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 28 }}>
        Private — not shown on the public site.
      </p>

      <h2 style={{ fontSize: 15, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--brass)', marginBottom: 12 }}>
        Current Bans
      </h2>
      <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14 }}>
        Manually recorded — includes points-triggered bans, referee-added games, and any lifetime
        or long bans (e.g. violent conduct) that aren't tied to the automatic points system below.
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
              <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 6 }}>{s.team.name}</div>
              <div style={{ fontSize: 14, marginBottom: 4 }}>{s.reason}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#B3261E', marginBottom: 8 }}>
                {s.is_lifetime ? 'Lifetime ban' : `${s.games_served} of ${s.games_banned} games served`}
              </div>
              {s.notes && <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>{s.notes}</div>}
              <div style={{ display: 'flex', gap: 8 }}>
                {!s.is_lifetime && (
                  <button
                    onClick={() => markServed(s)}
                    disabled={savingSuspension === s.id}
                    style={{ ...smallButtonStyle, flex: 1 }}
                  >
                    +1 game served
                  </button>
                )}
                <button onClick={() => markFullyServed(s)} style={{ ...smallOutlineStyle, flex: 1 }}>
                  Mark fully served
                </button>
                <button onClick={() => removeSuspension(s.id)} style={{ ...smallOutlineStyle, flex: 1 }}>
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ ...cardStyle, marginBottom: 40 }}>
        <div style={{ fontWeight: 600, marginBottom: 10, fontSize: 14 }}>Add a ban</div>

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

        <input
          placeholder="Reason (e.g. Points threshold — 18 pts, Violent conduct)"
          value={form.reason}
          onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))}
          style={{ ...fullSelectStyle, marginBottom: 8 }}
        />

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 8 }}>
          <input
            type="checkbox"
            checked={form.isLifetime}
            onChange={(e) => setForm((p) => ({ ...p, isLifetime: e.target.checked }))}
          />
          Lifetime ban
        </label>

        {!form.isLifetime && (
          <input
            type="number"
            min="1"
            placeholder="Games banned"
            value={form.gamesBanned}
            onChange={(e) => setForm((p) => ({ ...p, gamesBanned: e.target.value }))}
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
      </div>

      <h2 style={{ fontSize: 15, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--brass)', marginBottom: 6 }}>
        Points Tracker
      </h2>
      <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
        Calculated automatically from recorded cards this season. Crossing a threshold is a
        prompt to add a ban above — it isn't a ban by itself.
      </p>
      {playerRows.length === 0 ? (
        <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 32 }}>No cards recorded yet.</p>
      ) : (
        <div style={{ marginBottom: 32 }}>
          {playerRows.map((row) => (
            <div key={row.player.id} style={cardStyle}>
              <div style={{ fontWeight: 600 }}>
                {row.player.first_name} {row.player.last_name}
              </div>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 6 }}>{row.team.name}</div>
              <div style={{ fontSize: 14 }}>
                <strong>{row.points}</strong> points
              </div>
              {row.ban && (
                <div style={{ fontSize: 13, color: '#B3261E', fontWeight: 600, marginTop: 4 }}>
                  Threshold reached: {row.ban.ban} ({row.ban.points}+ pts)
                </div>
              )}
            </div>
          ))}
        </div>
      )}

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
