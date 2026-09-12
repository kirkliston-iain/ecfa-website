import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

export default function AdminDashboard() {
  const [competitions, setCompetitions] = useState([])
  const [competitionId, setCompetitionId] = useState('')
  const [stages, setStages] = useState([])
  const [stageId, setStageId] = useState('')
  const [fixtures, setFixtures] = useState([])
  const [saving, setSaving] = useState(null)
  const [expandedFixture, setExpandedFixture] = useState(null)
  const [scorersByFixture, setScorersByFixture] = useState({})
  const [scorerForm, setScorerForm] = useState({ firstName: '', lastName: '', side: 'home', goals: 1 })

  useEffect(() => {
    supabase
      .from('competitions')
      .select('id, name')
      .order('sort_order')
      .then(({ data }) => setCompetitions(data || []))
  }, [])

  useEffect(() => {
    if (!competitionId) {
      setStages([])
      setStageId('')
      return
    }
    supabase
      .from('stages')
      .select('id, name')
      .eq('competition_id', competitionId)
      .order('sort_order')
      .then(({ data }) => setStages(data || []))
  }, [competitionId])

  useEffect(() => {
    if (!stageId) {
      setFixtures([])
      return
    }
    loadFixtures()
  }, [stageId])

  async function loadFixtures() {
    const { data } = await supabase
      .from('fixtures')
      .select(
        'id, round_name, fixture_date, home_score, away_score, status, home_team:home_team_id(id, name), away_team:away_team_id(id, name)'
      )
      .eq('stage_id', stageId)
      .order('fixture_date')
    setFixtures(data || [])
  }

  function updateLocal(id, field, value) {
    setFixtures((prev) => prev.map((f) => (f.id === id ? { ...f, [field]: value } : f)))
  }

  async function saveFixture(fixture) {
    setSaving(fixture.id)
    await supabase
      .from('fixtures')
      .update({
        home_score: fixture.home_score === '' ? null : Number(fixture.home_score),
        away_score: fixture.away_score === '' ? null : Number(fixture.away_score),
        status: fixture.status,
      })
      .eq('id', fixture.id)
    setSaving(null)
  }

  async function toggleScorers(fixtureId) {
    if (expandedFixture === fixtureId) {
      setExpandedFixture(null)
      return
    }
    setExpandedFixture(fixtureId)
    const { data } = await supabase
      .from('fixture_scorers')
      .select('id, goals, player:player_id(first_name, last_name), team:team_id(name)')
      .eq('fixture_id', fixtureId)
    setScorersByFixture((prev) => ({ ...prev, [fixtureId]: data || [] }))
  }

  async function addScorer(fixture) {
    const { firstName, lastName, side, goals } = scorerForm
    if (!firstName.trim() || !lastName.trim()) return

    const teamId = side === 'home' ? fixture.home_team?.id : fixture.away_team?.id

    // Find or create the player by name
    let { data: existing } = await supabase
      .from('players')
      .select('id')
      .eq('first_name', firstName.trim())
      .eq('last_name', lastName.trim())
      .maybeSingle()

    let playerId = existing?.id
    if (!playerId) {
      const { data: created, error: createErr } = await supabase
        .from('players')
        .insert({ first_name: firstName.trim(), last_name: lastName.trim() })
        .select('id')
        .single()
      if (createErr) return
      playerId = created.id
    }

    await supabase
      .from('fixture_scorers')
      .upsert(
        { fixture_id: fixture.id, player_id: playerId, team_id: teamId, goals: Number(goals) },
        { onConflict: 'fixture_id,player_id' }
      )

    setScorerForm({ firstName: '', lastName: '', side: 'home', goals: 1 })

    const { data } = await supabase
      .from('fixture_scorers')
      .select('id, goals, player:player_id(first_name, last_name), team:team_id(name)')
      .eq('fixture_id', fixture.id)
    setScorersByFixture((prev) => ({ ...prev, [fixture.id]: data || [] }))
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    window.location.href = '/admin'
  }

  return (
    <div className="container" style={{ padding: '40px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h1 style={{ fontSize: 26, color: 'var(--pitch)' }}>Admin — Fixtures &amp; Results</h1>
        <button onClick={handleSignOut} style={linkButtonStyle}>
          Sign out
        </button>
      </div>

      <div style={{ display: 'flex', gap: 16, margin: '24px 0' }}>
        <select value={competitionId} onChange={(e) => setCompetitionId(e.target.value)} style={selectStyle}>
          <option value="">Select competition…</option>
          {competitions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          value={stageId}
          onChange={(e) => setStageId(e.target.value)}
          disabled={!competitionId}
          style={selectStyle}
        >
          <option value="">Select stage…</option>
          {stages.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {stageId && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--pitch)', textAlign: 'left' }}>
              <th style={{ padding: 8 }}>Fixture</th>
              <th style={{ padding: 8, width: 70 }}>Home</th>
              <th style={{ padding: 8, width: 70 }}>Away</th>
              <th style={{ padding: 8, width: 130 }}>Status</th>
              <th style={{ padding: 8, width: 90 }}></th>
              <th style={{ padding: 8, width: 90 }}></th>
            </tr>
          </thead>
          <tbody>
            {fixtures.map((f) => (
              <tr key={f.id} style={{ borderBottom: '1px solid var(--line)' }}>
                <td style={{ padding: 8 }}>
                  {f.home_team?.name} v {f.away_team?.name}
                </td>
                <td style={{ padding: 8 }}>
                  <input
                    type="number"
                    value={f.home_score ?? ''}
                    onChange={(e) => updateLocal(f.id, 'home_score', e.target.value)}
                    style={scoreInputStyle}
                  />
                </td>
                <td style={{ padding: 8 }}>
                  <input
                    type="number"
                    value={f.away_score ?? ''}
                    onChange={(e) => updateLocal(f.id, 'away_score', e.target.value)}
                    style={scoreInputStyle}
                  />
                </td>
                <td style={{ padding: 8 }}>
                  <select
                    value={f.status}
                    onChange={(e) => updateLocal(f.id, 'status', e.target.value)}
                    style={selectStyle}
                  >
                    <option value="scheduled">Scheduled</option>
                    <option value="played">Played</option>
                    <option value="postponed">Postponed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </td>
                <td style={{ padding: 8 }}>
                  <button onClick={() => saveFixture(f)} disabled={saving === f.id} style={saveButtonStyle}>
                    {saving === f.id ? 'Saving…' : 'Save'}
                  </button>
                </td>
                <td style={{ padding: 8 }}>
                  <button onClick={() => toggleScorers(f.id)} style={linkButtonStyle}>
                    {expandedFixture === f.id ? 'Hide scorers' : 'Scorers'}
                  </button>
                </td>
              </tr>
            ))}
            {fixtures.map(
              (f) =>
                expandedFixture === f.id && (
                  <tr key={`${f.id}-scorers`}>
                    <td colSpan={6} style={{ padding: '8px 8px 20px', background: '#FBFAF6' }}>
                      <div style={{ marginBottom: 10 }}>
                        {(scorersByFixture[f.id] || []).map((s) => (
                          <div key={s.id} style={{ fontSize: 13, padding: '4px 0' }}>
                            {s.player.first_name} {s.player.last_name} ({s.team.name}) — {s.goals} goal
                            {s.goals === 1 ? '' : 's'}
                          </div>
                        ))}
                        {(scorersByFixture[f.id] || []).length === 0 && (
                          <div style={{ fontSize: 13, color: '#8A8570' }}>No scorers recorded yet.</div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <input
                          placeholder="First name"
                          value={scorerForm.firstName}
                          onChange={(e) => setScorerForm((p) => ({ ...p, firstName: e.target.value }))}
                          style={{ ...scoreInputStyle, width: 110 }}
                        />
                        <input
                          placeholder="Last name"
                          value={scorerForm.lastName}
                          onChange={(e) => setScorerForm((p) => ({ ...p, lastName: e.target.value }))}
                          style={{ ...scoreInputStyle, width: 110 }}
                        />
                        <select
                          value={scorerForm.side}
                          onChange={(e) => setScorerForm((p) => ({ ...p, side: e.target.value }))}
                          style={selectStyle}
                        >
                          <option value="home">{f.home_team?.name} (home)</option>
                          <option value="away">{f.away_team?.name} (away)</option>
                        </select>
                        <input
                          type="number"
                          min="1"
                          value={scorerForm.goals}
                          onChange={(e) => setScorerForm((p) => ({ ...p, goals: e.target.value }))}
                          style={{ ...scoreInputStyle, width: 60 }}
                        />
                        <button onClick={() => addScorer(f)} style={saveButtonStyle}>
                          Add scorer
                        </button>
                      </div>
                    </td>
                  </tr>
                )
            )}
            {fixtures.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: 16, color: '#8A8570' }}>
                  No fixtures in this stage yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  )
}

const selectStyle = {
  padding: '8px 10px',
  border: '1px solid var(--line)',
  fontFamily: 'var(--font-body)',
  fontSize: 14,
}
const scoreInputStyle = { width: 50, padding: '6px 8px', border: '1px solid var(--line)' }
const saveButtonStyle = {
  padding: '6px 12px',
  background: 'var(--pitch)',
  color: 'var(--paper)',
  border: 'none',
  fontSize: 13,
  cursor: 'pointer',
}
const linkButtonStyle = {
  background: 'none',
  border: 'none',
  color: 'var(--brass)',
  fontSize: 14,
  cursor: 'pointer',
  textDecoration: 'underline',
}
