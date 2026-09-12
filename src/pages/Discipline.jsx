import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

// Points system: yellow = 2, red = 4. If a player has a red AND a yellow in
// the SAME fixture, only the red's points count (the second-yellow-to-red
// rule) — so we compute per player, per fixture, then sum across fixtures.
const YELLOW_POINTS = 2
const RED_POINTS = 4

// Ascending order matters — we report the highest threshold crossed.
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

  useEffect(() => {
    let cancelled = false

    async function load() {
      const { data } = await supabase
        .from('discipline_records')
        .select(
          'fixture_id, card_type, card_count, serious_offence, player:player_id(id, first_name, last_name), team:team_id(id, name)'
        )
        .order('created_at')

      if (cancelled) return

      const rows = data || []

      // --- Points totals (excludes anything tagged as a serious offence,
      // since those carry their own fixed bans instead) ---
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
        // Red present in this match → only the red's points count for it.
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

      // --- Serious offences, counted per player+type for 1st/2nd tier ---
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

      if (!cancelled) {
        setPlayerRows(playerList)
        setSeriousRows(seriousList)
        setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

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
        Private — not shown on the public site. Season points totals and any serious-offence bans.
        This doesn't yet track which matches of a ban have been served.
      </p>

      <h2 style={{ fontSize: 15, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--brass)', marginBottom: 12 }}>
        Points &amp; Suspensions
      </h2>
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
