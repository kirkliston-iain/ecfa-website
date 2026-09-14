import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function AdminDashboard() {
  const [competitions, setCompetitions] = useState([])
  const [competitionId, setCompetitionId] = useState('')
  const [stages, setStages] = useState([])
  const [stageId, setStageId] = useState('')
  const [teamFilter, setTeamFilter] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [fixtures, setFixtures] = useState([])
  const [saving, setSaving] = useState(null)
  const [expandedFixture, setExpandedFixture] = useState(null)
  const [contactEnquiries, setContactEnquiries] = useState([])
  const [showContactEnquiries, setShowContactEnquiries] = useState(false)
  const [expandedEnquiry, setExpandedEnquiry] = useState(null)
  const newContactCount = contactEnquiries.filter((enquiry) => enquiry.status === 'new').length

  const [squadsByFixture, setSquadsByFixture] = useState({})
  const [scorersByFixture, setScorersByFixture] = useState({})
  const [scorerForm, setScorerForm] = useState({ side: 'home', playerId: '', goals: 1 })

  const [disciplineByFixture, setDisciplineByFixture] = useState({})
  const [disciplineForm, setDisciplineForm] = useState({
    side: 'home',
    playerId: '',
    cardType: 'yellow',
    count: 1,
    seriousOffence: '',
  })

  const [postponedFixtures, setPostponedFixtures] = useState([])
  const [allTeams, setAllTeams] = useState([])
  const [savingPostponed, setSavingPostponed] = useState(null)
  const [referees, setReferees] = useState([])
  const [venues, setVenues] = useState([])
  const [groups, setGroups] = useState([])
  const [showAddFixture, setShowAddFixture] = useState(false)
  const [newFixture, setNewFixture] = useState({
    homeTeamId: '',
    awayTeamId: '',
    groupId: '',
    date: '',
    time: '',
    venue: '',
    refereeName: '',
    roundName: '',
  })
  const [addingFixture, setAddingFixture] = useState(false)

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

    supabase
      .from('referees')
      .select('id, name')
      .order('name')
      .then(({ data }) => setReferees(data || []))

    supabase
      .from('venues')
      .select('id, name')
      .order('name')
      .then(({ data }) => setVenues(data || []))

    loadPostponed()
    loadContactEnquiries()
  }, [])

  useEffect(() => {
    if (!stageId) {
      setGroups([])
      return
    }
    supabase
      .from('groups')
      .select('id, name')
      .eq('stage_id', stageId)
      .order('sort_order')
      .then(({ data }) => {
        setGroups(data || [])
        setNewFixture((f) => ({ ...f, groupId: data && data.length === 1 ? data[0].id : '' }))
      })
  }, [stageId])

  async function addFixture() {
    if (!newFixture.homeTeamId || !newFixture.awayTeamId || !newFixture.date) return
    setAddingFixture(true)
    const fixture_date = newFixture.time
      ? `${newFixture.date}T${newFixture.time}:00`
      : `${newFixture.date}T00:00:00`
    await supabase.from('fixtures').insert({
      stage_id: stageId,
      group_id: newFixture.groupId || null,
      home_team_id: newFixture.homeTeamId,
      away_team_id: newFixture.awayTeamId,
      fixture_date,
      venue: newFixture.venue || null,
      referee_name: newFixture.refereeName || null,
      round_name: newFixture.roundName || null,
      status: 'scheduled',
    })
    setAddingFixture(false)
    setShowAddFixture(false)
    setNewFixture({
      homeTeamId: '',
      awayTeamId: '',
      groupId: groups.length === 1 ? groups[0].id : '',
      date: '',
      time: '',
      venue: '',
      refereeName: '',
      roundName: '',
    })
    loadFixtures()
  }

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
    setTeamFilter('')
    setDateFilter('')
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
        'id, round_name, fixture_date, home_score, away_score, status, hidden_from_public, venue, referee_name, home_team:home_team_id(id, name), away_team:away_team_id(id, name)'
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

  function dateOnly(iso) {
    if (!iso) return ''
    return iso.slice(0, 10)
  }
  function timeOnly(iso) {
    if (!iso) return ''
    return iso.slice(11, 16)
  }
  function updateFixtureDatePart(id, part, value) {
    setFixtures((prev) =>
      prev.map((f) => {
        if (f.id !== id) return f
        const d = part === 'date' ? value : dateOnly(f.fixture_date)
        const t = part === 'time' ? value : timeOnly(f.fixture_date) || '00:00'
        return { ...f, fixture_date: `${d}T${t}:00` }
      })
    )
  }

  function updateLocal(id, field, value) {
    setFixtures((prev) =>
      prev.map((f) => {
        if (f.id !== id) return f
        const updated = { ...f, [field]: value }
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
        venue: fixture.venue || null,
        referee_name: fixture.referee_name || null,
        fixture_date: fixture.fixture_date,
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

  async function toggleExpanded(fixture) {
    if (expandedFixture === fixture.id) {
      setExpandedFixture(null)
      return
    }
    setExpandedFixture(fixture.id)
    setScorerForm({ side: 'home', playerId: '', goals: 1 })
    setDisciplineForm({ side: 'home', playerId: '', cardType: 'yellow', count: 1, seriousOffence: '' })

    if (!squadsByFixture[fixture.id]) {
      const [{ data: homeSquad }, { data: awaySquad }] = await Promise.all([
        supabase.from('players').select('id, first_name, last_name').eq('team_id', fixture.home_team.id).order('last_name'),
        supabase.from('players').select('id, first_name, last_name').eq('team_id', fixture.away_team.id).order('last_name'),
      ])
      setSquadsByFixture((prev) => ({ ...prev, [fixture.id]: { home: homeSquad || [], away: awaySquad || [] } }))
    }

    await refreshScorers(fixture.id)
    await refreshDiscipline(fixture.id)
  }

  async function refreshScorers(fixtureId) {
    const { data } = await supabase
      .from('fixture_scorers')
      .select('id, goals, player:player_id(first_name, last_name), team:team_id(name)')
      .eq('fixture_id', fixtureId)
    setScorersByFixture((prev) => ({ ...prev, [fixtureId]: data || [] }))
  }

  async function refreshDiscipline(fixtureId) {
    const { data } = await supabase
      .from('discipline_records')
      .select('id, card_type, card_count, serious_offence, player:player_id(first_name, last_name), team:team_id(name)')
      .eq('fixture_id', fixtureId)
    setDisciplineByFixture((prev) => ({ ...prev, [fixtureId]: data || [] }))
  }

  async function addScorer(fixture) {
    const { side, playerId, goals } = scorerForm
    if (!playerId) return
    const teamId = side === 'home' ? fixture.home_team.id : fixture.away_team.id

    await supabase
      .from('fixture_scorers')
      .upsert(
        { fixture_id: fixture.id, player_id: playerId, team_id: teamId, goals: Number(goals) },
        { onConflict: 'fixture_id,player_id' }
      )

    setScorerForm({ side: 'home', playerId: '', goals: 1 })
    refreshScorers(fixture.id)
  }

  async function removeScorer(fixtureId, scorerId) {
    await supabase.from('fixture_scorers').delete().eq('id', scorerId)
    refreshScorers(fixtureId)
  }

  async function updateScorerGoals(fixtureId, scorerId, goals) {
    await supabase.from('fixture_scorers').update({ goals: Number(goals) }).eq('id', scorerId)
    refreshScorers(fixtureId)
  }

  async function addDiscipline(fixture) {
    const { side, playerId, cardType, count, seriousOffence } = disciplineForm
    if (!playerId) return
    const teamId = side === 'home' ? fixture.home_team.id : fixture.away_team.id

    await supabase.from('discipline_records').insert({
      fixture_id: fixture.id,
      player_id: playerId,
      team_id: teamId,
      card_type: cardType,
      card_count: Number(count),
      serious_offence: seriousOffence || null,
    })

    setDisciplineForm({ side: 'home', playerId: '', cardType: 'yellow', count: 1, seriousOffence: '' })
    refreshDiscipline(fixture.id)
  }

  async function removeDiscipline(fixtureId, recordId) {
    await supabase.from('discipline_records').delete().eq('id', recordId)
    refreshDiscipline(fixtureId)
  }

  async function loadContactEnquiries() {
    const { data, error } = await supabase
      .from('contact_enquiries')
      .select('id, enquiry_type, name, email, mobile, message, status, created_at')
      .order('created_at', { ascending: false })
    if (!error) setContactEnquiries(data || [])
  }

  async function viewContactEnquiry(enquiry) {
    setExpandedEnquiry((current) => (current === enquiry.id ? null : enquiry.id))
    if (enquiry.status !== 'new') return
    const { error } = await supabase
      .from('contact_enquiries')
      .update({ status: 'in_progress' })
      .eq('id', enquiry.id)
    if (!error) {
      setContactEnquiries((current) =>
        current.map((item) => item.id === enquiry.id ? { ...item, status: 'in_progress' } : item)
      )
    }
  }

  async function closeContactEnquiry(id) {
    const { error } = await supabase
      .from('contact_enquiries')
      .update({ status: 'closed' })
      .eq('id', id)
    if (!error) {
      setContactEnquiries((current) =>
        current.map((item) => item.id === id ? { ...item, status: 'closed' } : item)
      )
    }
  }

  function contactDate(value) {
    return new Date(value).toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
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

      {newContactCount > 0 && (
        <div
          role="alert"
          style={{
            padding: 14,
            marginBottom: 16,
            border: '2px solid var(--brass)',
            borderRadius: 8,
            background: '#FFF9E8',
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 8 }}>
            New contact {newContactCount === 1 ? 'message' : 'messages'}: {newContactCount}
          </div>
          <button
            onClick={() => setShowContactEnquiries(true)}
            style={{ ...saveButtonStyle, width: '100%' }}
          >
            View {newContactCount === 1 ? 'message' : 'messages'}
          </button>
        </div>
      )}

      <button
        onClick={() => setShowContactEnquiries((current) => !current)}
        style={{ ...linkButtonStyle, display: 'block', width: '100%', textAlign: 'left', marginBottom: 12 }}
      >
        Contact messages{newContactCount ? ` (${newContactCount} new)` : ''} &rarr;
      </button>

      {showContactEnquiries && (
        <section id="contact-messages" style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 17, margin: '0 0 10px' }}>Contact messages</h2>
          {contactEnquiries.length === 0 ? (
            <div style={{ color: 'var(--muted)', fontSize: 13 }}>No messages received.</div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {contactEnquiries.map((enquiry) => (
                <article
                  key={enquiry.id}
                  style={{
                    ...cardStyle,
                    borderLeft: enquiry.status === 'new' ? '5px solid var(--brass)' : '1px solid var(--line)',
                  }}
                >
                  <button
                    onClick={() => viewContactEnquiry(enquiry)}
                    style={{ border: 0, background: 'transparent', padding: 0, width: '100%', textAlign: 'left', cursor: 'pointer' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                      <strong>{enquiry.name}</strong>
                      {enquiry.status === 'new' && (
                        <span style={{ color: 'var(--brass)', fontSize: 12, fontWeight: 700 }}>NEW</span>
                      )}
                    </div>
                    <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 3 }}>
                      {enquiry.enquiry_type} · {contactDate(enquiry.created_at)}
                    </div>
                  </button>

                  {expandedEnquiry === enquiry.id && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
                      <div style={{ display: 'grid', gap: 5, fontSize: 13, marginBottom: 12 }}>
                        {enquiry.email && <a href={`mailto:${enquiry.email}`}>{enquiry.email}</a>}
                        {enquiry.mobile && <a href={`tel:${enquiry.mobile}`}>{enquiry.mobile}</a>}
                      </div>
                      <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5, marginBottom: 12 }}>
                        {enquiry.message}
                      </div>
                      {enquiry.status !== 'closed' && (
                        <button
                          onClick={() => closeContactEnquiry(enquiry.id)}
                          style={{ ...outlineButtonStyle, width: '100%' }}
                        >
                          Mark as closed
                        </button>
                      )}
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      <Link to="/admin/teams" style={{ ...linkButtonStyle, display: 'block', marginBottom: 8 }}>
        Manage squads &rarr;
      </Link>

      <Link to="/admin/lists" style={{ ...linkButtonStyle, display: 'block', marginBottom: 8 }}>
        Manage referees &amp; venues &rarr;
      </Link>

      <Link to="/admin/season" style={{ ...linkButtonStyle, display: 'block', marginBottom: 8 }}>
        Season management &rarr;
      </Link>

      <Link to="/admin/fixture-tracker" style={{ ...linkButtonStyle, display: 'block', marginBottom: 20 }}>
        Fixture tracker &rarr;
      </Link>

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
          {fixtures.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)} style={fullSelectStyle}>
                <option value="">All teams</option>
                {Array.from(
                  new Map(
                    fixtures.flatMap((f) => [
                      [f.home_team.id, f.home_team.name],
                      [f.away_team.id, f.away_team.name],
                    ])
                  ).entries()
                )
                  .sort((a, b) => a[1].localeCompare(b[1]))
                  .map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
              </select>
              <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} style={fullSelectStyle}>
                <option value="">All dates</option>
                {Array.from(new Set(fixtures.map((f) => (f.fixture_date ? f.fixture_date.slice(0, 10) : 'tbc'))))
                  .sort()
                  .map((d) => (
                    <option key={d} value={d}>
                      {d === 'tbc'
                        ? 'Date TBC'
                        : new Date(d + 'T00:00:00').toLocaleDateString('en-GB', {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                          })}
                    </option>
                  ))}
              </select>
            </div>
          )}

          <button
            onClick={() => setShowAddFixture((v) => !v)}
            style={{ ...outlineButtonStyle, width: '100%', marginBottom: showAddFixture ? 12 : 20, padding: '10px' }}
          >
            {showAddFixture ? 'Cancel' : '+ Add fixture to this stage'}
          </button>

          {showAddFixture && (
            <div style={{ ...cardStyle, marginBottom: 20 }}>
              <select
                value={newFixture.homeTeamId}
                onChange={(e) => setNewFixture((f) => ({ ...f, homeTeamId: e.target.value }))}
                style={{ ...fullSelectStyle, marginBottom: 8 }}
              >
                <option value="">Home team…</option>
                {allTeams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <select
                value={newFixture.awayTeamId}
                onChange={(e) => setNewFixture((f) => ({ ...f, awayTeamId: e.target.value }))}
                style={{ ...fullSelectStyle, marginBottom: 8 }}
              >
                <option value="">Away team…</option>
                {allTeams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              {groups.length > 1 && (
                <select
                  value={newFixture.groupId}
                  onChange={(e) => setNewFixture((f) => ({ ...f, groupId: e.target.value }))}
                  style={{ ...fullSelectStyle, marginBottom: 8 }}
                >
                  <option value="">Group…</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              )}
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input
                  type="date"
                  value={newFixture.date}
                  onChange={(e) => setNewFixture((f) => ({ ...f, date: e.target.value }))}
                  style={{ ...fullSelectStyle, flex: 1 }}
                />
                <input
                  type="time"
                  value={newFixture.time}
                  onChange={(e) => setNewFixture((f) => ({ ...f, time: e.target.value }))}
                  style={{ ...fullSelectStyle, flex: 1 }}
                />
              </div>
              <select
                value={newFixture.venue}
                onChange={(e) => setNewFixture((f) => ({ ...f, venue: e.target.value }))}
                style={{ ...fullSelectStyle, marginBottom: 8 }}
              >
                <option value="">Venue…</option>
                {venues.map((v) => (
                  <option key={v.id} value={v.name}>
                    {v.name}
                  </option>
                ))}
              </select>
              <select
                value={newFixture.refereeName}
                onChange={(e) => setNewFixture((f) => ({ ...f, refereeName: e.target.value }))}
                style={{ ...fullSelectStyle, marginBottom: 8 }}
              >
                <option value="">Referee…</option>
                {referees.map((r) => (
                  <option key={r.id} value={r.name}>
                    {r.name}
                  </option>
                ))}
              </select>
              <input
                placeholder="Round name (optional, e.g. Quarter Final)"
                value={newFixture.roundName}
                onChange={(e) => setNewFixture((f) => ({ ...f, roundName: e.target.value }))}
                style={{ ...fullSelectStyle, marginBottom: 12 }}
              />
              <button
                onClick={addFixture}
                disabled={addingFixture}
                style={{ ...saveButtonStyle, width: '100%' }}
              >
                {addingFixture ? 'Adding…' : 'Add fixture'}
              </button>
            </div>
          )}

          {fixtures
            .filter((f) => !teamFilter || f.home_team.id === teamFilter || f.away_team.id === teamFilter)
            .filter((f) => !dateFilter || (f.fixture_date ? f.fixture_date.slice(0, 10) : 'tbc') === dateFilter)
            .map((f) => {
            const squads = squadsByFixture[f.id]
            const sideSquad = scorerForm.side === 'home' ? squads?.home : squads?.away
            const disciplineSideSquad = disciplineForm.side === 'home' ? squads?.home : squads?.away

            return (
              <div key={f.id} style={cardStyle}>
                <div style={{ fontSize: 11, color: 'var(--brass)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>
                  {competitions.find((c) => c.id === competitionId)?.name}
                </div>
                <div style={{ fontWeight: 600, marginBottom: 2 }}>
                  {f.home_team?.name} v {f.away_team?.name}
                </div>
                <div style={{ fontSize: 12, color: '#8A8570', marginBottom: 10 }}>
                  {f.fixture_date
                    ? new Date(f.fixture_date).toLocaleDateString('en-GB', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })
                    : 'Date TBC'}
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

                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  <input
                    type="date"
                    value={dateOnly(f.fixture_date)}
                    onChange={(e) => updateFixtureDatePart(f.id, 'date', e.target.value)}
                    style={{ ...fullSelectStyle, flex: 1 }}
                  />
                  <input
                    type="time"
                    value={timeOnly(f.fixture_date)}
                    onChange={(e) => updateFixtureDatePart(f.id, 'time', e.target.value)}
                    style={{ ...fullSelectStyle, flex: 1 }}
                  />
                </div>

                <select
                  value={f.venue || ''}
                  onChange={(e) => updateLocal(f.id, 'venue', e.target.value)}
                  style={{ ...fullSelectStyle, marginBottom: 10 }}
                >
                  <option value="">Venue…</option>
                  {venues.map((v) => (
                    <option key={v.id} value={v.name}>
                      {v.name}
                    </option>
                  ))}
                </select>

                <select
                  value={f.referee_name || ''}
                  onChange={(e) => updateLocal(f.id, 'referee_name', e.target.value)}
                  style={{ ...fullSelectStyle, marginBottom: 10 }}
                >
                  <option value="">Referee…</option>
                  {referees.map((r) => (
                    <option key={r.id} value={r.name}>
                      {r.name}
                    </option>
                  ))}
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
                  <button onClick={() => toggleExpanded(f)} style={{ ...outlineButtonStyle, flex: 1 }}>
                    {expandedFixture === f.id ? 'Hide details' : 'Scorers & cards'}
                  </button>
                </div>

                {expandedFixture === f.id && (
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>Scorers</div>
                    <div style={{ marginBottom: 10 }}>
                      {(scorersByFixture[f.id] || []).map((s) => (
                        <div
                          key={s.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            fontSize: 13,
                            padding: '6px 0',
                          }}
                        >
                          <span style={{ flex: 1 }}>
                            {s.player.first_name} {s.player.last_name} ({s.team.name})
                          </span>
                          <input
                            type="number"
                            min="1"
                            defaultValue={s.goals}
                            onBlur={(e) => {
                              if (Number(e.target.value) !== s.goals) updateScorerGoals(f.id, s.id, e.target.value)
                            }}
                            style={{ ...scoreInputStyle, width: 50, padding: '4px 6px' }}
                          />
                          <button
                            onClick={() => removeScorer(f.id, s.id)}
                            style={{ ...outlineButtonStyle, padding: '4px 10px', fontSize: 12 }}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                      {(scorersByFixture[f.id] || []).length === 0 && (
                        <div style={{ fontSize: 13, color: '#8A8570' }}>No scorers recorded yet.</div>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                      <select
                        value={scorerForm.side}
                        onChange={(e) => setScorerForm((p) => ({ ...p, side: e.target.value, playerId: '' }))}
                        style={fullSelectStyle}
                      >
                        <option value="home">{f.home_team?.name} (home)</option>
                        <option value="away">{f.away_team?.name} (away)</option>
                      </select>
                      <select
                        value={scorerForm.playerId}
                        onChange={(e) => setScorerForm((p) => ({ ...p, playerId: e.target.value }))}
                        style={fullSelectStyle}
                      >
                        <option value="">Select player…</option>
                        {(sideSquad || []).map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.first_name} {p.last_name}
                          </option>
                        ))}
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

                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>Discipline</div>
                    <div style={{ marginBottom: 10 }}>
                      {(disciplineByFixture[f.id] || []).map((d) => (
                        <div
                          key={d.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            fontSize: 13,
                            padding: '6px 0',
                          }}
                        >
                          <span
                            style={{
                              display: 'inline-block',
                              width: 10,
                              height: 14,
                              background: d.card_type === 'red' ? '#B3261E' : '#F2C230',
                              borderRadius: 2,
                              flexShrink: 0,
                            }}
                          />
                          <span style={{ flex: 1 }}>
                            {d.player.first_name} {d.player.last_name} ({d.team.name})
                            {d.card_count > 1 ? ` — ${d.card_count}x` : ''}
                            {d.serious_offence ? ` — ${seriousOffenceLabel(d.serious_offence)}` : ''}
                          </span>
                          <button
                            onClick={() => removeDiscipline(f.id, d.id)}
                            style={{ ...outlineButtonStyle, padding: '4px 10px', fontSize: 12 }}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                      {(disciplineByFixture[f.id] || []).length === 0 && (
                        <div style={{ fontSize: 13, color: '#8A8570' }}>No cards recorded yet.</div>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <select
                        value={disciplineForm.side}
                        onChange={(e) => setDisciplineForm((p) => ({ ...p, side: e.target.value, playerId: '' }))}
                        style={fullSelectStyle}
                      >
                        <option value="home">{f.home_team?.name} (home)</option>
                        <option value="away">{f.away_team?.name} (away)</option>
                      </select>
                      <select
                        value={disciplineForm.playerId}
                        onChange={(e) => setDisciplineForm((p) => ({ ...p, playerId: e.target.value }))}
                        style={fullSelectStyle}
                      >
                        <option value="">Select player…</option>
                        {(disciplineSideSquad || []).map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.first_name} {p.last_name}
                          </option>
                        ))}
                      </select>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <select
                          value={disciplineForm.cardType}
                          onChange={(e) => setDisciplineForm((p) => ({ ...p, cardType: e.target.value }))}
                          style={{ ...fullSelectStyle, flex: 1 }}
                        >
                          <option value="yellow">Yellow</option>
                          <option value="red">Red</option>
                        </select>
                        <input
                          type="number"
                          min="1"
                          value={disciplineForm.count}
                          onChange={(e) => setDisciplineForm((p) => ({ ...p, count: e.target.value }))}
                          style={{ ...scoreInputStyle, width: 60 }}
                        />
                      </div>
                      <select
                        value={disciplineForm.seriousOffence}
                        onChange={(e) => setDisciplineForm((p) => ({ ...p, seriousOffence: e.target.value }))}
                        style={fullSelectStyle}
                      >
                        <option value="">Not a serious offence (standard card)</option>
                        <option value="opponent_abuse">Abusive language — towards opponent</option>
                        <option value="official_abuse">Abusive language — towards official</option>
                        <option value="discriminatory">Discriminatory language</option>
                        <option value="violent_conduct">Violent conduct</option>
                      </select>
                      <button onClick={() => addDiscipline(f)} style={saveButtonStyle}>
                        Add card
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
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

function seriousOffenceLabel(code) {
  const labels = {
    opponent_abuse: 'Abusive language (opponent)',
    official_abuse: 'Abusive language (official)',
    discriminatory: 'Discriminatory language',
    violent_conduct: 'Violent conduct',
  }
  return labels[code] || code
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
