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
  const [statusFilter, setStatusFilter] = useState('')
  const [fixtures, setFixtures] = useState([])
  const [weekOffRequests, setWeekOffRequests] = useState([])
  const [saving, setSaving] = useState(null)
  const [fixtureSaveStatus, setFixtureSaveStatus] = useState({})
  const [currentProfile, setCurrentProfile] = useState(null)
  const [expandedFixture, setExpandedFixture] = useState(null)
  const [contactEnquiries, setContactEnquiries] = useState([])
  const [showContactEnquiries, setShowContactEnquiries] = useState(false)
  const [expandedEnquiry, setExpandedEnquiry] = useState(null)
  const newContactCount = contactEnquiries.filter((enquiry) => enquiry.status === 'new').length

  const [squadsByFixture, setSquadsByFixture] = useState({})
  const [scorersByFixture, setScorersByFixture] = useState({})
  const [scorerChangesByFixture, setScorerChangesByFixture] = useState({})
  const [savingScorers, setSavingScorers] = useState(null)
  const [scorerSaveStatus, setScorerSaveStatus] = useState({})
  const [scorerForm, setScorerForm] = useState({ side: 'home', playerId: '', goals: 1 })

  const [disciplineByFixture, setDisciplineByFixture] = useState({})
  const [disciplineForm, setDisciplineForm] = useState({
    side: 'home',
    playerId: '',
    cardType: 'yellow',
    count: 1,
    seriousOffence: '',
  })

  const [allTeams, setAllTeams] = useState([])
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
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      const { data: profile } = await supabase
        .from('admin_profiles')
        .select('id, display_name, username')
        .eq('id', data.user.id)
        .maybeSingle()
      setCurrentProfile({ ...(profile || {}), id: data.user.id, role: data.user.app_metadata?.role })
    })

    supabase
      .from('competitions')
      .select('id, name, season')
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

    loadContactEnquiries()
    loadWeekOffRequests()
  }, [])

  async function loadWeekOffRequests() {
    const { data } = await supabase
      .from('team_week_off_requests')
      .select(
        'id, season, source_fixture_id, original_fixture_date, recorded_at, team:team_id(id, name), fixture:source_fixture_id(id, status, fixture_date, home_team:home_team_id(name), away_team:away_team_id(name))'
      )
      .order('season', { ascending: false })
      .order('recorded_at')
    setWeekOffRequests(data || [])
  }

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
    let cancelled = false
    setStageId('')
    setStages([])
    supabase
      .from('stages')
      .select('id, name')
      .eq('competition_id', competitionId)
      .order('sort_order')
      .then(({ data }) => {
        if (cancelled) return
        const nextStages = data || []
        setStages(nextStages)
        setStageId(nextStages[0]?.id || '')
      })
    return () => {
      cancelled = true
    }
  }, [competitionId])

  useEffect(() => {
    setTeamFilter('')
    setDateFilter('')
    setStatusFilter('')
    if (competitionId && !stageId) {
      setFixtures([])
      return
    }
    loadFixtures()
  }, [competitionId, stageId])

  async function loadFixtures() {
    let query = supabase
      .from('fixtures')
      .select(
        'id, round_name, fixture_date, home_score, away_score, status, hidden_from_public, venue, referee_name, week_off_requested, week_off_requested_team_id, updated_at, home_team:home_team_id(id, name), away_team:away_team_id(id, name), stage:stage_id(id, name, competition:competition_id(id, name))'
      )
      .order('fixture_date')
    if (stageId) query = query.eq('stage_id', stageId)
    const { data } = await query
    setFixtures(data || [])
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
        } else if (field === 'status' && f.status === 'postponed') {
          updated.hidden_from_public = false
        }
        return updated
      })
    )
  }

  async function saveFixture(fixture) {
    setSaving(fixture.id)
    setFixtureSaveStatus((current) => ({ ...current, [fixture.id]: '' }))
    const { data, error } = await supabase
      .from('fixtures')
      .update({
        home_score: fixture.home_score === '' ? null : Number(fixture.home_score),
        away_score: fixture.away_score === '' ? null : Number(fixture.away_score),
        status: fixture.status,
        hidden_from_public: fixture.hidden_from_public,
        venue: fixture.venue || null,
        referee_name: fixture.referee_name || null,
        fixture_date: fixture.fixture_date,
        week_off_requested: !!fixture.week_off_requested,
        week_off_requested_team_id: fixture.week_off_requested ? fixture.week_off_requested_team_id || null : null,
      })
      .eq('id', fixture.id)
      .eq('updated_at', fixture.updated_at)
      .select('updated_at')
      .maybeSingle()
    setSaving(null)

    if (error) {
      const message = error.message?.includes('already used its week-off request')
        ? 'This team has already used its one week-off request for this season.'
        : 'Could not save. Please try again.'
      setFixtureSaveStatus((current) => ({ ...current, [fixture.id]: message }))
      return
    }
    if (!data) {
      setFixtureSaveStatus((current) => ({
        ...current,
        [fixture.id]: 'Another administrator changed this fixture first. The latest version has been reloaded — review it before saving again.',
      }))
      await loadFixtures()
      return
    }

    setFixtures((current) => current.map((item) => item.id === fixture.id ? { ...item, updated_at: data.updated_at } : item))
    setFixtureSaveStatus((current) => ({ ...current, [fixture.id]: 'Saved.' }))
    await loadWeekOffRequests()

  }

  async function toggleExpanded(fixture) {
    if (!fixture.home_team || !fixture.away_team) return
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

  function updateLocalScorerGoals(fixtureId, scorerId, goals) {
    const value = Math.max(1, Number(goals) || 1)
    setScorersByFixture((prev) => ({
      ...prev,
      [fixtureId]: (prev[fixtureId] || []).map((scorer) =>
        scorer.id === scorerId ? { ...scorer, goals: value } : scorer
      ),
    }))
    setScorerChangesByFixture((prev) => ({ ...prev, [fixtureId]: true }))
    setScorerSaveStatus((prev) => ({ ...prev, [fixtureId]: '' }))
  }

  async function saveScorers(fixtureId) {
    const rows = scorersByFixture[fixtureId] || []
    setSavingScorers(fixtureId)
    setScorerSaveStatus((prev) => ({ ...prev, [fixtureId]: '' }))

    const results = await Promise.all(
      rows.map((scorer) =>
        supabase.from('fixture_scorers').update({ goals: Number(scorer.goals) }).eq('id', scorer.id)
      )
    )
    const failed = results.find((result) => result.error)

    if (failed) {
      setScorerSaveStatus((prev) => ({ ...prev, [fixtureId]: 'Scorers could not be saved. Please try again.' }))
    } else {
      setScorerChangesByFixture((prev) => ({ ...prev, [fixtureId]: false }))
      setScorerSaveStatus((prev) => ({ ...prev, [fixtureId]: 'Scorers saved.' }))
      await refreshScorers(fixtureId)
    }
    setSavingScorers(null)
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

  async function deleteContactEnquiry(enquiry) {
    const confirmed = window.confirm(
      `Delete the message from ${enquiry.name}? This cannot be undone.`
    )
    if (!confirmed) return

    const { error } = await supabase
      .from('contact_enquiries')
      .delete()
      .eq('id', enquiry.id)

    if (!error) {
      setContactEnquiries((current) => current.filter((item) => item.id !== enquiry.id))
      setExpandedEnquiry(null)
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

  const visibleFixtures = fixtures
    .filter((fixture) => !teamFilter || fixture.home_team?.id === teamFilter || fixture.away_team?.id === teamFilter)
    .filter((fixture) => !dateFilter || (fixture.fixture_date ? fixture.fixture_date.slice(0, 10) : 'tbc') === dateFilter)
    .filter((fixture) => !statusFilter || fixture.status === statusFilter)
  const currentSeason = competitions[0]?.season || ''
  const currentSeasonWeekOffRequests = weekOffRequests.filter((request) => request.season === currentSeason)

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
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {enquiry.status !== 'closed' && (
                          <button
                            onClick={() => closeContactEnquiry(enquiry.id)}
                            style={{ ...outlineButtonStyle, flex: 1 }}
                          >
                            Mark as closed
                          </button>
                        )}
                        <button
                          onClick={() => deleteContactEnquiry(enquiry)}
                          style={{
                            ...outlineButtonStyle,
                            flex: 1,
                            color: '#B3261E',
                            borderColor: '#B3261E',
                          }}
                        >
                          Delete message
                        </button>
                      </div>
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

      <Link to="/admin/appointments" style={{ ...linkButtonStyle, display: 'block', marginBottom: 8 }}>
        Match appointments &rarr;
      </Link>

      <Link to="/admin/fixture-tracker" style={{ ...linkButtonStyle, display: 'block', marginBottom: 8 }}>
        Fixture tracker &rarr;
      </Link>

      <Link to="/admin/downloads" style={{ ...linkButtonStyle, display: 'block', marginBottom: 8 }}>
        Manage downloads &rarr;
      </Link>

      {(currentProfile?.id === '28696bc6-2df2-4855-b259-3f156ad55748' || currentProfile?.role === 'owner') && (
        <>
          <Link to="/admin/accounts" style={{ ...linkButtonStyle, display: 'block', marginBottom: 8 }}>
            Administrator accounts &rarr;
          </Link>
          <Link to="/admin/audit" style={{ ...linkButtonStyle, display: 'block', marginBottom: 20 }}>
            Audit trail &rarr;
          </Link>
        </>
      )}

      <section style={{ ...cardStyle, marginTop: 20, marginBottom: 20 }}>
        <h2 style={{ fontSize: 17, color: 'var(--pitch)', margin: '0 0 4px' }}>Week-off request tracker</h2>
        <p style={{ fontSize: 13, color: '#8A8570', margin: '0 0 12px' }}>
          {currentSeason ? currentSeason.replace('-', '/') : 'Current season'} · one request allowed per team
        </p>
        {currentSeasonWeekOffRequests.length === 0 ? (
          <div style={{ color: '#8A8570', fontSize: 13 }}>No teams have used their request.</div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {currentSeasonWeekOffRequests.map((request) => (
              <div key={request.id} style={{ borderTop: '1px solid var(--line)', paddingTop: 10 }}>
                <div style={{ fontWeight: 700 }}>{request.team?.name}</div>
                <div style={{ color: '#8A8570', fontSize: 12, lineHeight: 1.45 }}>
                  Used for {request.fixture?.home_team?.name || 'Home team TBC'} v {request.fixture?.away_team?.name || 'Away team TBC'}
                  {request.original_fixture_date
                    ? ` · ${new Date(request.original_fixture_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
                    : ''}
                  {request.fixture?.status ? ` · Now ${request.fixture.status}` : ''}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
        <select
          value={competitionId}
          onChange={(e) => {
            setStageId('')
            setCompetitionId(e.target.value)
            setShowAddFixture(false)
          }}
          style={fullSelectStyle}
        >
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

      <div style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 18, color: 'var(--pitch)', margin: '0 0 6px' }}>Fixtures</h2>
          <p style={{ fontSize: 13, color: '#8A8570', margin: '0 0 16px' }}>
            {stageId ? 'Showing the selected competition and stage in date order.' : 'Showing all competitions in date order.'}
          </p>
          {fixtures.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)} style={fullSelectStyle}>
                <option value="">All teams</option>
                {Array.from(
                  new Map(
                    fixtures.flatMap((f) =>
                      [
                        f.home_team ? [f.home_team.id, f.home_team.name] : null,
                        f.away_team ? [f.away_team.id, f.away_team.name] : null,
                      ].filter(Boolean)
                    )
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
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={fullSelectStyle}>
                <option value="">All statuses</option>
                <option value="scheduled">Scheduled</option>
                <option value="played">Played</option>
                <option value="postponed">Postponed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          )}

          {stageId && (
            <button
              onClick={() => setShowAddFixture((v) => !v)}
              style={{ ...outlineButtonStyle, width: '100%', marginBottom: showAddFixture ? 12 : 20, padding: '10px' }}
            >
              {showAddFixture ? 'Cancel' : '+ Add fixture to this stage'}
            </button>
          )}

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

          {visibleFixtures.map((f) => {
            const squads = squadsByFixture[f.id]
            const sideSquad = scorerForm.side === 'home' ? squads?.home : squads?.away
            const disciplineSideSquad = disciplineForm.side === 'home' ? squads?.home : squads?.away

            return (
              <div key={f.id} style={cardStyle}>
                <div style={{ fontSize: 11, color: 'var(--brass)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>
                  {f.stage?.competition?.name || 'Competition'}{f.stage?.name ? ` — ${f.stage.name}` : ''}
                </div>
                <div style={{ fontWeight: 600, marginBottom: 2 }}>
                  {f.home_team?.name || 'Home team TBC'} v {f.away_team?.name || 'Away team TBC'}
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

                {f.status === 'postponed' && (
                  <div style={{ marginBottom: 10 }}>
                    <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type="checkbox"
                        checked={!!f.week_off_requested}
                        onChange={(e) => updateLocal(f.id, 'week_off_requested', e.target.checked)}
                      />
                      Week off requested
                    </label>
                    {f.week_off_requested && (
                      <select
                        value={f.week_off_requested_team_id || ''}
                        onChange={(e) => updateLocal(f.id, 'week_off_requested_team_id', e.target.value)}
                        style={{ ...fullSelectStyle, marginTop: 8 }}
                      >
                        <option value="">Which team asked?</option>
                        {allTeams.map((team) => {
                          const existingRequest = currentSeasonWeekOffRequests.find((request) => request.team?.id === team.id)
                          const alreadyUsedElsewhere = existingRequest && existingRequest.source_fixture_id !== f.id
                          return (
                            <option key={team.id} value={team.id} disabled={alreadyUsedElsewhere}>
                              {team.name}{alreadyUsedElsewhere ? ' — already used' : ''}
                            </option>
                          )
                        })}
                      </select>
                    )}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => saveFixture(f)}
                    disabled={saving === f.id}
                    style={{ ...saveButtonStyle, flex: 1 }}
                  >
                    {saving === f.id ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    onClick={() => toggleExpanded(f)}
                    disabled={!f.home_team || !f.away_team}
                    style={{ ...outlineButtonStyle, flex: 1, opacity: !f.home_team || !f.away_team ? 0.5 : 1 }}
                  >
                    {expandedFixture === f.id ? 'Hide details' : 'Scorers & cards'}
                  </button>
                </div>
                {fixtureSaveStatus[f.id] && (
                  <div
                    role="status"
                    style={{
                      marginTop: 8,
                      fontSize: 12,
                      fontWeight: 700,
                      color: fixtureSaveStatus[f.id] === 'Saved.' ? '#1B8A4A' : '#B3261E',
                    }}
                  >
                    {fixtureSaveStatus[f.id]}
                  </div>
                )}

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
                            value={s.goals}
                            onChange={(e) => updateLocalScorerGoals(f.id, s.id, e.target.value)}
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
                    <div style={{ marginBottom: 12 }}>
                      <button
                        onClick={() => saveScorers(f.id)}
                        disabled={savingScorers === f.id || (scorersByFixture[f.id] || []).length === 0}
                        style={{ ...saveButtonStyle, width: '100%', opacity: (scorersByFixture[f.id] || []).length === 0 ? 0.5 : 1 }}
                      >
                        {savingScorers === f.id
                          ? 'Saving scorers…'
                          : scorerChangesByFixture[f.id]
                            ? 'Save scorer changes'
                            : 'Save scorers'}
                      </button>
                      {scorerSaveStatus[f.id] && (
                        <div
                          role="status"
                          style={{
                            marginTop: 6,
                            fontSize: 12,
                            fontWeight: 700,
                            color: scorerSaveStatus[f.id].includes('could not') ? '#B3261E' : '#1B8A4A',
                          }}
                        >
                          {scorerSaveStatus[f.id]}
                        </div>
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
          {visibleFixtures.length === 0 && (
            <p style={{ color: '#8A8570', fontSize: 14 }}>
              {fixtures.length === 0 ? 'No fixtures found.' : 'No fixtures match these filters.'}
            </p>
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
