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

  const [postponedFixtures, setPostponedFixtures] = useState([])
  const [allTeams, setAllTeams] = useState([])
  const [savingPostponed, setSavingPostponed] = useState(null)

  useEffect(() => {
    supabase
      .from('competitions')
      .select('id, name')
      .order('sort_order')
      .then(({ data }) => setCompetitions(data || []))

    supabase
      .from('teams')
      .select('id, name')
      .order('name')
      .then(({ data }) => setAllTeams(data || []))

    loadPostponed()
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
        'id, round_name, fixture_date, home_score, away_score, status, hidden_from_public, home_team:home_team_id(id, name), away_team:away_team_id(id, name)'
      )
      .eq('stage_id', stageId)
      .neq('status', 'postponed')
      .order('fixture_date')
    setFixtures(data || [])
  }

  async function loadPostponed() {
    const { data } = await supabase
      .from('fixtures')
      .select(
        'id, fixture_date, venue, status, hidden_from_public, week_off_requested, week_off_requested_team_id, home_team:home_team_id(id, name), away_team:away_team_id(id, name), stage:stage_id(name, competition:competition_id(name))'
      )
      .eq('status', 'postponed')
      .order('fixture_date')
    setPostponedFixtures(data || [])
  }

  function updateLocal(id, field, value) {
    setFixtures((prev) =>
      prev.map((f) => {
        if (f.id !== id) return f
        const updated = { ...f, [field]: value }
        // Marking a fixture postponed should hide it from the public site by default.
        if (field === 'status' && value === 'postponed') {
          updated.hidden_from_public = true
        }
        return updated
      })
    )
  }

  async function saveFixture(fixture) {
    setSaving(fixture.id)
    await supabase
      .from('fixtures')
      .update({
        home_score: fixture.home_score === '' ? null : Number(fixture.home_score),
        away_score: fixture.away_score === '' ? null : Number(fixture.away_score),
        status: fixture.status,
        hidden_from_public: fixture.hidden_from_public,
      })
      .eq('id', fixture.id)
    setSaving(null)

    if (fixture.status === 'postponed') {
      loadFixtures()
      loadPostponed()
    }
  }

  function updatePostponedLocal(id, field, value) {
    setPostponedFixtures((prev) =>
      prev.map((f) => {
        if (f.id !== id) return f
        const updated = { ...f, [field]: value }
        // Moving it back to Scheduled/Played should un-hide it, unless they
        // explicitly want it still hidden — they can re-tick the box.
        if (field === 'status' && value !== 'postponed') {
          updated.hidden_from_public = false
        }
        return updated
      })
    )
  }

  async function savePostponed(fixture) {
    setSavingPostponed(fixture.id)
    await supabase
      .from('fixtures')
      .update({
        fixture_date: fixture.fixture_date || null,
        status: fixture.status,
        hidden_from_public: fixture.hidden_from_public,
        week_off_requested: fixture.week_off_requested,
        week_off_requested_team_id: fixture.week_off_requested ? fixture.week_off_requested_team_id : null,
      })
      .eq('id', fixture.id)
    setSavingPostponed(null)
    loadPostponed()
    if (stageId) loadFixtures()
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
    <div className="container" style={{ padding: '24px 16px', maxWidth: 480 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, color: 'var(--pitch)', margin: 0 }}>Admin</h1>
        <button onClick={handleSignOut} style={linkButtonStyle}>
          Sign out
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
        <select value={competitionId} onChange={(e) => setCompetitionId(e.target.value)} style={fullSelectStyle}>
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
          style={fullSelectStyle}
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
        <div style={{ marginBottom: 40 }}>
          {fixtures.map((f) => (
            <div key={f.id} style={cardStyle}>
              <div style={{ fontWeight: 600, marginBottom: 10 }}>
                {f.home_team?.name} v {f.away_team?.name}
              </div>

              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <input
                  type="number"
                  placeholder="Home"
                  value={f.home_score ?? ''}
                  onChange={(e) => updateLocal(f.id, 'home_score', e.target.value)}
                  style={{ ...scoreInputStyle, flex: 1 }}
                />
                <span style={{ alignSelf: 'center', color: '#8A8570' }}>–</span>
                <input
                  type="number"
                  placeholder="Away"
                  value={f.away_score ?? ''}
                  onChange={(e) => updateLocal(f.id, 'away_score', e.target.value)}
                  style={{ ...scoreInputStyle, flex: 1 }}
                />
              </div>

              <select
                value={f.status}
                onChange={(e) => updateLocal(f.id, 'status', e.target.value)}
                style={{ ...fullSelectStyle, marginBottom: 10 }}
              >
                <option value="scheduled">Scheduled</option>
                <option value="played">Played</option>
                <option value="postponed">Postponed</option>
                <option value="cancelled">Cancelled</option>
              </select>

              <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <input
                  type="checkbox"
                  checked={!!f.hidden_from_public}
                  onChange={(e) => updateLocal(f.id, 'hidden_from_public', e.target.checked)}
                />
                Hide from public site
              </label>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => saveFixture(f)}
                  disabled={saving === f.id}
                  style={{ ...saveButtonStyle, flex: 1 }}
                >
                  {saving === f.id ? 'Saving…' : 'Save'}
                </button>
                <button
                  onClick={() => toggleScorers(f.id)}
                  style={{ ...outlineButtonStyle, flex: 1 }}
                >
                  {expandedFixture === f.id ? 'Hide scorers' : 'Scorers'}
                </button>
              </div>

              {expandedFixture === f.id && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
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
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        placeholder="First name"
                        value={scorerForm.firstName}
                        onChange={(e) => setScorerForm((p) => ({ ...p, firstName: e.target.value }))}
                        style={{ ...scoreInputStyle, flex: 1 }}
                      />
                      <input
                        placeholder="Last name"
                        value={scorerForm.lastName}
                        onChange={(e) => setScorerForm((p) => ({ ...p, lastName: e.target.value }))}
                        style={{ ...scoreInputStyle, flex: 1 }}
                      />
                    </div>
                    <select
                      value={scorerForm.side}
                      onChange={(e) => setScorerForm((p) => ({ ...p, side: e.target.value }))}
                      style={fullSelectStyle}
                    >
                      <option value="home">{f.home_team?.name} (home)</option>
                      <option value="away">{f.away_team?.name} (away)</option>
                    </select>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        type="number"
                        min="1"
                        value={scorerForm.goals}
                        onChange={(e) => setScorerForm((p) => ({ ...p, goals: e.target.value }))}
                        style={{ ...scoreInputStyle, width: 70 }}
                      />
                      <button onClick={() => addScorer(f)} style={{ ...saveButtonStyle, flex: 1 }}>
                        Add scorer
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
          {fixtures.length === 0 && (
            <p style={{ color: '#8A8570', fontSize: 14 }}>No fixtures in this stage yet.</p>
          )}
        </div>
      )}

      <div>
        <h2 style={{ fontSize: 18, color: 'var(--pitch)', marginBottom: 6 }}>Postponed Games</h2>
        <p style={{ fontSize: 13, color: '#8A8570', marginBottom: 16 }}>
          These don't show anywhere on the public site. Set the status back to Scheduled or Played
          once sorted, and it moves back to its normal fixture list.
        </p>

        {postponedFixtures.map((f) => (
          <div key={f.id} style={cardStyle}>
            <div style={{ fontWeight: 600, marginBottom: 2 }}>
              {f.home_team?.name} v {f.away_team?.name}
            </div>
            <div style={{ fontSize: 12, color: '#8A8570', marginBottom: 10 }}>
              {f.stage?.competition?.name} — {f.stage?.name}
            </div>

            <label style={labelStyle}>New date</label>
            <input
              type="datetime-local"
              value={f.fixture_date ? f.fixture_date.slice(0, 16) : ''}
              onChange={(e) => updatePostponedLocal(f.id, 'fixture_date', e.target.value)}
              style={{ ...fullSelectStyle, marginBottom: 10 }}
            />

            <label style={labelStyle}>Status</label>
            <select
              value={f.status}
              onChange={(e) => updatePostponedLocal(f.id, 'status', e.target.value)}
              style={{ ...fullSelectStyle, marginBottom: 10 }}
            >
              <option value="postponed">Postponed</option>
              <option value="scheduled">Scheduled</option>
              <option value="played">Played</option>
              <option value="cancelled">Cancelled</option>
            </select>

            <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <input
                type="checkbox"
                checked={!!f.hidden_from_public}
                onChange={(e) => updatePostponedLocal(f.id, 'hidden_from_public', e.target.checked)}
              />
              Hide from public site
            </label>

            <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={f.week_off_requested}
                onChange={(e) => updatePostponedLocal(f.id, 'week_off_requested', e.target.checked)}
              />
              Week off requested
            </label>

            {f.week_off_requested && (
              <select
                value={f.week_off_requested_team_id || ''}
                onChange={(e) => updatePostponedLocal(f.id, 'week_off_requested_team_id', e.target.value)}
                style={{ ...fullSelectStyle, marginTop: 8, marginBottom: 10 }}
              >
                <option value="">Which team asked?</option>
                {allTeams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            )}

            <button
              onClick={() => savePostponed(f)}
              disabled={savingPostponed === f.id}
              style={{ ...saveButtonStyle, width: '100%', marginTop: 10 }}
            >
              {savingPostponed === f.id ? 'Saving…' : 'Save'}
            </button>
          </div>
        ))}
        {postponedFixtures.length === 0 && (
          <p style={{ color: '#8A8570', fontSize: 14 }}>No postponed games right now.</p>
        )}
      </div>
    </div>
  )
}

const cardStyle = {
  border: '1px solid var(--line)',
  borderRadius: 8,
  padding: 14,
  marginBottom: 12,
}
const labelStyle = {
  display: 'block',
  fontSize: 12,
  color: '#8A8570',
  marginBottom: 4,
}
const fullSelectStyle = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 10px',
  border: '1px solid var(--line)',
  fontFamily: 'var(--font-body)',
  fontSize: 14,
  borderRadius: 6,
}
const scoreInputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '8px 10px',
  border: '1px solid var(--line)',
  borderRadius: 6,
  fontSize: 14,
}
const saveButtonStyle = {
  padding: '10px 12px',
  background: 'var(--pitch)',
  color: 'var(--paper)',
  border: 'none',
  fontSize: 14,
  borderRadius: 6,
  cursor: 'pointer',
}
const outlineButtonStyle = {
  padding: '10px 12px',
  background: 'none',
  color: 'var(--pitch)',
  border: '1px solid var(--pitch)',
  fontSize: 14,
  borderRadius: 6,
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
