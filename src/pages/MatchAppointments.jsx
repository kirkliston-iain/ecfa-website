import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { matchReferees } from '../utils/appointmentMatching'

const today = new Date().toISOString().slice(0, 10)
const emptyWeekRules = { unavailableReferees: [], refereeTeamBlocks: [], fixedAssignments: [], notes: '' }

function dateLabel(value) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

function slotKey(venue, start, pitch) {
  return `${venue}|${start}|${pitch}`
}

function fixtureStart(fixture) {
  return fixture.fixture_date?.slice(11, 16) || ''
}

function fixtureTeams(fixture) {
  return [fixture.home_team?.name, fixture.away_team?.name].filter(Boolean)
}

export default function MatchAppointments() {
  const [weekDate, setWeekDate] = useState(today)
  const [settings, setSettings] = useState(null)
  const [referees, setReferees] = useState([])
  const [fixtures, setFixtures] = useState([])
  const [history, setHistory] = useState([])
  const [availableSlots, setAvailableSlots] = useState([])
  const [availableReferees, setAvailableReferees] = useState([])
  const [allocations, setAllocations] = useState([])
  const [status, setStatus] = useState('draft')
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState('')
  const [message, setMessage] = useState('')
  const [settingsDirty, setSettingsDirty] = useState(false)
  const [savingRules, setSavingRules] = useState(false)
  const [weekRules, setWeekRules] = useState(emptyWeekRules)
  const [newBlockReferee, setNewBlockReferee] = useState('')
  const [newBlockTeam, setNewBlockTeam] = useState('')
  const [newVenueReferee, setNewVenueReferee] = useState('')
  const [newVenue, setNewVenue] = useState('')
  const [newWeekReferee, setNewWeekReferee] = useState('')
  const [newWeekTeam, setNewWeekTeam] = useState('')

  const teamNames = useMemo(() => [...new Set(history.flatMap(fixtureTeams))].sort(), [history])

  function editSettings(change) {
    setSettings((current) => ({ ...current, ...change }))
    setSettingsDirty(true)
  }

  function editWeekRules(change) {
    setWeekRules((current) => ({ ...current, ...change }))
    setStatus('draft')
  }

  async function saveCriteria() {
    setSavingRules(true)
    setMessage('')
    const { data, error: readError } = await supabase.from('appointment_settings').select('settings').eq('id', true).single()
    if (readError) {
      setMessage(readError.message)
      setSavingRules(false)
      return
    }
    const merged = {
      ...data.settings,
      refereePreferences: settings.refereePreferences || {},
      refereeTeamBlocks: settings.refereeTeamBlocks || [],
      refereeVenueOnly: settings.refereeVenueOnly || {},
      venues: settings.venues || [],
    }
    const { error } = await supabase.from('appointment_settings').update({ settings: merged, updated_at: new Date().toISOString() }).eq('id', true)
    setSavingRules(false)
    if (error) return setMessage(error.message)
    setSettings(merged)
    setSettingsDirty(false)
    setMessage('Standing criteria saved. They will be used for future generations.')
  }

  const configuredSlots = useMemo(() => {
    if (!settings) return []
    return settings.venues.flatMap((venue) => venue.slots.flatMap((slot) =>
      Array.from({ length: slot.pitches }, (_, index) => ({
        key: slotKey(venue.name, slot.start, index + 1),
        venue: venue.name,
        area: venue.area,
        start: slot.start,
        end: slot.end,
        pitch: index + 1,
        label: `${venue.name} · ${slot.start}–${slot.end}${slot.pitches > 1 ? ` · Pitch ${index + 1}` : ''}`,
      }))
    ))
  }, [settings])

  const assignedFixtureSlots = useMemo(() => {
    if (!settings) return { byFixture: new Map(), slots: [] }
    const counts = new Map()
    const byFixture = new Map()
    const fixtureSlots = []

    fixtures.forEach((fixture) => {
      const venue = fixture.venue?.trim()
      const start = fixtureStart(fixture)
      if (!venue || !start) return
      const groupKey = `${venue}|${start}`
      const pitch = (counts.get(groupKey) || 0) + 1
      counts.set(groupKey, pitch)
      const configuredVenue = settings.venues.find((item) => item.name === venue)
      const configuredSlot = configuredVenue?.slots.find((item) => item.start === start)
      const end = configuredSlot?.end || ''
      const slot = {
        key: slotKey(venue, start, pitch),
        venue,
        area: configuredVenue?.area || 'Any',
        start,
        end,
        pitch,
        label: `${venue} · ${start}${end ? `–${end}` : ''}${counts.get(groupKey) > 1 || configuredSlot?.pitches > 1 ? ` · Pitch ${pitch}` : ''}`,
        assigned: true,
      }
      byFixture.set(fixture.id, slot)
      fixtureSlots.push(slot)
    })

    // Once every fixture has been counted, show pitch labels consistently for
    // all simultaneous games at a multi-pitch venue (including Pitch 1).
    fixtureSlots.forEach((slot) => {
      const total = counts.get(`${slot.venue}|${slot.start}`) || 1
      if (total > 1 && !slot.label.includes(' · Pitch ')) slot.label += ` · Pitch ${slot.pitch}`
    })
    return { byFixture, slots: fixtureSlots }
  }, [fixtures, settings])

  const slots = useMemo(() => {
    const merged = new Map(configuredSlots.map((slot) => [slot.key, slot]))
    assignedFixtureSlots.slots.forEach((slot) => merged.set(slot.key, slot))
    return [...merged.values()]
  }, [configuredSlots, assignedFixtureSlots])

  useEffect(() => {
    async function loadBase() {
      const [{ data: settingsRows }, { data: refereeRows }, { data: historyRows }] = await Promise.all([
        supabase.from('appointment_settings').select('settings').eq('id', true).single(),
        supabase.from('referees').select('id, name').order('name'),
        supabase.from('fixtures').select('id, fixture_date, venue, referee_name, home_team:home_team_id(id, name), away_team:away_team_id(id, name)').not('fixture_date', 'is', null),
      ])
      setSettings(settingsRows?.settings || null)
      setReferees(refereeRows || [])
      setHistory(historyRows || [])
    }
    loadBase()
  }, [])

  useEffect(() => {
    if (!settings) return
    loadWeek()
  }, [weekDate, Boolean(settings)])

  async function loadWeek() {
    setLoading(true)
    setMessage('')
    const [{ data: fixtureRows, error: fixtureError }, { data: week, error: weekError }] = await Promise.all([
      supabase.from('fixtures')
        .select('id, fixture_date, venue, referee_name, status, home_team:home_team_id(id, name), away_team:away_team_id(id, name)')
        .in('status', ['scheduled', 'played']).order('fixture_date'),
      supabase.from('appointment_weeks').select('*').eq('week_date', weekDate).maybeSingle(),
    ])
    if (fixtureError || weekError) {
      setFixtures([])
      setMessage(fixtureError?.message || weekError?.message || 'This matchday could not be loaded.')
      setLoading(false)
      return
    }
    const matchdayFixtures = (fixtureRows || []).filter((fixture) => fixture.fixture_date?.slice(0, 10) === weekDate)
    setFixtures(matchdayFixtures)
    if (week) {
      // Fixture venue/time assignments are the source of truth. The slot list
      // is rebuilt below once React has derived pitch numbers from the fixtures.
      setAvailableSlots(week.available_slots || [])
      setAvailableReferees(week.available_referees || [])
      setAllocations(week.allocations || [])
      setStatus(week.status || 'draft')
      setWeekRules({ ...emptyWeekRules, ...(week.constraints || {}) })
    } else {
      const defaults = settings.venues.filter((venue) => !venue.additional).flatMap((venue) => venue.slots.flatMap((slot) =>
        Array.from({ length: slot.pitches }, (_, index) => slotKey(venue.name, slot.start, index + 1))
      ))
      setAvailableSlots(defaults)
      setAvailableReferees([])
      setAllocations([])
      setStatus('draft')
      setWeekRules(emptyWeekRules)
    }
    setLoading(false)
  }

  useEffect(() => {
    if (loading || !fixtures.length || !assignedFixtureSlots.slots.length) return
    const assignedKeys = assignedFixtureSlots.slots.map((slot) => slot.key)
    setAvailableSlots(assignedKeys)
    setAllocations((current) => fixtures.map((fixture) => {
      const slot = assignedFixtureSlots.byFixture.get(fixture.id)
      const previous = current.find((row) => row?.fixtureId === fixture.id)
      return {
        fixtureId: fixture.id,
        venue: slot?.venue || '',
        slotKey: slot?.key || '',
        start: slot?.start || '',
        end: slot?.end || '',
        referee: previous?.referee || fixture.referee_name || '',
        reason: 'Venue and kickoff pulled from the fixture',
      }
    }))
    setStatus((current) => current === 'confirmed' ? current : 'draft')
  }, [loading, fixtures, assignedFixtureSlots])

  function toggle(list, setList, value) {
    setList((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value])
    setStatus('draft')
  }

  function historyCount(referee, teams) {
    return history.filter((row) => row.fixture_date?.slice(0, 10) < weekDate && row.referee_name === referee && fixtureTeams(row).some((team) => teams.includes(team))).length
  }

  function venueHistoryCount(venue, teams) {
    return history.filter((row) => row.venue === venue && fixtureTeams(row).some((team) => teams.includes(team))).length
  }

  function slotAllowed(fixture, slot) {
    const teams = fixtureTeams(fixture)
    if (settings.teamSlotBlocks?.some((rule) => teams.includes(rule.team) && rule.venue === slot.venue && rule.start === slot.start)) return false
    const reserved = settings.venues.find((venue) => venue.name === slot.venue)?.reservedHomeTeam
    if (reserved && fixture.home_team?.name !== reserved) return false
    return true
  }

  function refereeAllowed(name, fixture, slot) {
    const teams = fixtureTeams(fixture)
    if (weekRules.unavailableReferees?.includes(name)) return false
    if (weekRules.refereeTeamBlocks?.some((rule) => rule.referee === name && teams.includes(rule.team))) return false
    if (settings.refereeTeamBlocks?.some((rule) => rule.referee === name && teams.includes(rule.team))) return false
    const only = settings.refereeVenueOnly?.[name]
    return !only || only.includes(slot.venue)
  }

  async function generate() {
    setMessage('')
    if (settingsDirty) return setMessage('Save the standing criteria before generating appointments.')
    if (!fixtures.length) return setMessage('There are no scheduled fixtures on this date.')
    if (assignedFixtureSlots.byFixture.size !== fixtures.length) return setMessage('Every fixture needs a venue and kickoff time before appointments can be generated.')
    if (!availableReferees.length) return setMessage('Select the referees who are available.')

    const fixed = new Map((weekRules.fixedAssignments || []).filter((rule) => rule.referee).map((rule) => [rule.fixtureId, rule.referee]))
    const fixedNames = [...fixed.values()]
    if (new Set(fixedNames).size !== fixedNames.length) return setMessage('A referee is fixed to more than one fixture. Change the weekly stipulations first.')
    for (const fixture of fixtures) {
      const name = fixed.get(fixture.id)
      if (!name) continue
      const slot = assignedFixtureSlots.byFixture.get(fixture.id)
      if (!referees.some((referee) => referee.name === name) || !availableReferees.includes(name) || !refereeAllowed(name, fixture, slot)) {
        return setMessage(`${name} cannot be fixed to ${fixture.home_team?.name} v ${fixture.away_team?.name}. Check availability and standing or weekly restrictions.`)
      }
    }
    const fixtureOrder = [...fixtures].sort((a, b) =>
      Number(b.home_team?.name === 'South East Saints') - Number(a.home_team?.name === 'South East Saints')
    )
    const candidatesByFixture = new Map()
    for (const fixture of fixtureOrder.filter((item) => !fixed.has(item.id))) {
      const teams = fixtureTeams(fixture)
      const chosenSlot = assignedFixtureSlots.byFixture.get(fixture.id)
      const refereeCandidates = referees
        .filter((referee) => availableReferees.includes(referee.name) && !fixedNames.includes(referee.name) && refereeAllowed(referee.name, fixture, chosenSlot))
        .map((referee) => {
          const preference = settings.refereePreferences?.[referee.name] || 'Any'
          const repeats = historyCount(referee.name, teams)
          let score = preference === 'Any' ? 12 : preference === chosenSlot.area ? 35 : 0
          score -= repeats * 24
          score -= history.filter((row) => row.fixture_date?.slice(0, 10) < weekDate && row.referee_name === referee.name).length
          return { referee, score, repeats, preference }
        }).sort((a, b) => b.score - a.score)
      candidatesByFixture.set(fixture.id, refereeCandidates)
    }

    // Reassign an earlier flexible choice when a later fixture has fewer
    // eligible referees. Fixed appointments remain reserved throughout.
    const selectedByFixture = matchReferees(fixtureOrder.filter((fixture) => !fixed.has(fixture.id)), candidatesByFixture)
    const generated = fixtureOrder.map((fixture) => {
      const chosenSlot = assignedFixtureSlots.byFixture.get(fixture.id)
      const chosenName = fixed.get(fixture.id) || selectedByFixture.get(fixture.id)
      const chosenReferee = candidatesByFixture.get(fixture.id)?.find((candidate) => candidate.referee.name === chosenName)
      const reasons = ['venue and kickoff pulled from the fixture']
      if (fixed.has(fixture.id)) reasons.push('fixed appointment for this week')
      else if (chosenReferee) reasons.push(`${chosenReferee.preference} preference`, chosenReferee.repeats ? `${chosenReferee.repeats} previous team appointment${chosenReferee.repeats === 1 ? '' : 's'}` : 'no previous appointment with either team')
      else reasons.push('No available referee fits all restrictions; review availability and stipulations')
      return {
        fixtureId: fixture.id, venue: chosenSlot.venue, slotKey: chosenSlot.key, start: chosenSlot.start, end: chosenSlot.end,
        referee: chosenName || '', reason: reasons.join(' · '),
      }
    })
    setAllocations(fixtures.map((fixture) => generated.find((row) => row.fixtureId === fixture.id)))
    setStatus('draft')
    await saveWeek(generated, 'draft')
  }

  async function saveWeek(nextAllocations = allocations, nextStatus = status) {
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('appointment_weeks').upsert({
      week_date: weekDate,
      available_slots: availableSlots,
      available_referees: availableReferees,
      constraints: weekRules,
      allocations: nextAllocations,
      status: nextStatus,
      updated_at: new Date().toISOString(),
      updated_by: user?.id || null,
      confirmed_at: nextStatus === 'confirmed' ? new Date().toISOString() : null,
    })
    if (error) setMessage(error.message)
    return !error
  }

  function updateAllocation(fixtureId, field, value) {
    setStatus('draft')
    setAllocations((current) => current.map((row) => {
      if (row.fixtureId !== fixtureId) return row
      if (field === 'slotKey') {
        const slot = slots.find((item) => item.key === value)
        return { ...row, slotKey: value, venue: slot?.venue || '', start: slot?.start || '', end: slot?.end || '', reason: 'Manually adjusted by admin' }
      }
      return { ...row, [field]: value, reason: 'Manually adjusted by admin' }
    }))
  }

  async function confirm() {
    if (allocations.some((row) => !row?.venue || !row?.referee || !row?.start)) return setMessage('Every fixture needs a venue, time and referee before confirmation.')
    const slotValues = allocations.map((row) => row.slotKey)
    const refereeValues = allocations.map((row) => row.referee)
    if (new Set(slotValues).size !== slotValues.length) return setMessage('A venue slot has been used more than once. Choose a different pitch or time.')
    if (new Set(refereeValues).size !== refereeValues.length) return setMessage('A referee has been assigned more than once this week.')
    for (const row of allocations) {
      const fixture = fixtures.find((item) => item.id === row.fixtureId)
      const slot = slots.find((item) => item.key === row.slotKey)
      if (!fixture || !slot || !availableReferees.includes(row.referee) || !refereeAllowed(row.referee, fixture, slot)) return setMessage(`The appointment for ${fixture?.home_team?.name || 'a fixture'} breaks the saved availability or referee restrictions.`)
      const fixed = weekRules.fixedAssignments?.find((rule) => rule.fixtureId === row.fixtureId)
      if (fixed && fixed.referee !== row.referee) return setMessage(`The fixed referee for ${fixture.home_team?.name} v ${fixture.away_team?.name} has changed. Update the weekly stipulation first.`)
    }
    setWorking('confirm')
    setMessage('')
    try {
      for (const row of allocations) {
        const { error } = await supabase.from('fixtures').update({
          venue: row.venue,
          referee_name: row.referee,
          fixture_date: `${weekDate}T${row.start}:00`,
        }).eq('id', row.fixtureId)
        if (error) throw error
      }
      await saveWeek(allocations, 'confirmed')
      setStatus('confirmed')
      setMessage('Appointments confirmed and the fixtures have been updated.')
    } catch (error) {
      setMessage(error.message || 'Appointments could not be confirmed.')
    } finally {
      setWorking('')
    }
  }

  return (
    <div className="container" style={{ padding: '24px 16px 48px', maxWidth: 720 }}>
      <Link to="/admin/dashboard" style={{ color: 'var(--brass)', fontSize: 13 }}>← Back to admin</Link>
      <h1 style={{ fontSize: 24, margin: '18px 0 4px' }}>Match Appointments</h1>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 22 }}>Choose a matchday, record what is available, generate suggestions, adjust them and confirm.</p>

      <label style={labelStyle}>Matchday</label>
      <input type="date" value={weekDate} onChange={(event) => setWeekDate(event.target.value)} style={{ ...inputStyle, marginBottom: 20 }} />
      <h2 style={headingStyle}>{dateLabel(weekDate)}</h2>
      {message && <div style={noticeStyle}>{message}</div>}
      {loading && <p style={{ color: 'var(--muted)' }}>Loading this week…</p>}

      {!loading && <>
        <section style={sectionStyle}>
          <h3 style={subheadingStyle}>Standing appointment criteria</h3>
          <p style={helpStyle}>These rules apply every week. Save changes before generating. Venue and kickoff are taken from each fixture; these rules select the referee.</p>
          <div style={{ ...helpStyle, padding: 10, borderRadius: 6, background: '#f5f8fa', color: 'var(--ink)' }}>
            {['East', 'West', 'Any'].map((area) => <div key={area} style={{ marginBottom: 5 }}><strong>{area}:</strong> {referees.filter((referee) => (settings.refereePreferences?.[referee.name] || 'Any') === area).map((referee) => referee.name).join(', ') || 'None'}</div>)}
            <div><strong>Cannot take:</strong> {(settings.refereeTeamBlocks || []).map((rule) => `${rule.referee} / ${rule.team}`).join('; ') || 'None'}</div>
            <div><strong>Venue limits:</strong> {Object.entries(settings.refereeVenueOnly || {}).map(([name, venues]) => `${name}: ${venues.join(', ')}`).join('; ') || 'None'}</div>
          </div>
          <details>
            <summary style={summaryStyle}>How the current suggestions are made</summary>
            <div style={{ ...helpStyle, marginTop: 8 }}>
              Each selected, eligible referee can receive one game. Matching the fixture's stored area gets 35 points, an “Any” preference gets 12, and a different area gets 0. Each previous appointment involving either team subtracts 24 points; previous overall appointments also lower the score slightly. South East Saints home games are assigned first. Permanent team and venue limits are hard exclusions.
            </div>
          </details>
          <details style={{ marginTop: 12 }}>
            <summary style={summaryStyle}>Preferred area by referee</summary>
            <p style={helpStyle}>The area labels come from the venue settings. Choose East, West or Any for each referee.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 9 }}>
              {referees.map((referee) => <label key={referee.id} style={labelStyle}>{referee.name}
                <select value={settings.refereePreferences?.[referee.name] || 'Any'} onChange={(event) => editSettings({ refereePreferences: { ...settings.refereePreferences, [referee.name]: event.target.value } })} style={inputStyle}>
                  <option>Any</option><option>East</option><option>West</option>
                </select>
              </label>)}
            </div>
          </details>
          <details style={{ marginTop: 12 }}>
            <summary style={summaryStyle}>Venue area labels</summary>
            <p style={helpStyle}>These East/West labels are compared with each referee's preferred area. Changing a label affects future suggestions, not a fixture's saved venue.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 9 }}>
              {settings.venues.map((venue, index) => <label key={venue.name} style={labelStyle}>{venue.name}
                <select value={venue.area || 'Any'} onChange={(event) => editSettings({ venues: settings.venues.map((item, i) => i === index ? { ...item, area: event.target.value } : item) })} style={inputStyle}>
                  <option>East</option><option>West</option><option>Any</option>
                </select>
              </label>)}
            </div>
          </details>
          <details style={{ marginTop: 12 }}>
            <summary style={summaryStyle}>Teams a referee cannot take ({settings.refereeTeamBlocks?.length || 0})</summary>
            <div style={{ display: 'grid', gap: 7, marginTop: 10 }}>
              {(settings.refereeTeamBlocks || []).map((rule, index) => <div key={`${rule.referee}-${rule.team}-${index}`} style={ruleRowStyle}><span>{rule.referee} cannot take {rule.team}</span><button type="button" onClick={() => editSettings({ refereeTeamBlocks: settings.refereeTeamBlocks.filter((_, i) => i !== index) })} style={smallButtonStyle}>Remove</button></div>)}
              <select aria-label="Referee for permanent team block" value={newBlockReferee} onChange={(event) => setNewBlockReferee(event.target.value)} style={inputStyle}><option value="">Select referee</option>{referees.map((referee) => <option key={referee.id}>{referee.name}</option>)}</select>
              <select aria-label="Team for permanent referee block" value={newBlockTeam} onChange={(event) => setNewBlockTeam(event.target.value)} style={inputStyle}><option value="">Select team</option>{teamNames.map((name) => <option key={name}>{name}</option>)}</select>
              <button type="button" disabled={!newBlockReferee || !newBlockTeam} onClick={() => {
                if (!(settings.refereeTeamBlocks || []).some((rule) => rule.referee === newBlockReferee && rule.team === newBlockTeam)) editSettings({ refereeTeamBlocks: [...(settings.refereeTeamBlocks || []), { referee: newBlockReferee, team: newBlockTeam }] })
                setNewBlockReferee(''); setNewBlockTeam('')
              }} style={outlineStyle}>Add permanent block</button>
            </div>
          </details>
          <details style={{ marginTop: 12 }}>
            <summary style={summaryStyle}>Venue-only limits</summary>
            <p style={helpStyle}>A referee listed here can only be assigned at the venues shown. Referees without a limit can take any venue.</p>
            {Object.entries(settings.refereeVenueOnly || {}).map(([name, venues]) => <div key={name} style={{ marginBottom: 10, fontSize: 13 }}><strong>{name}</strong>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 5 }}>{venues.map((venue) => <button type="button" key={venue} title={`Remove ${venue}`} onClick={() => {
                const next = { ...settings.refereeVenueOnly, [name]: venues.filter((item) => item !== venue) }
                if (!next[name].length) delete next[name]
                editSettings({ refereeVenueOnly: next })
              }} style={smallButtonStyle}>{venue} ×</button>)}</div>
            </div>)}
            <div style={{ display: 'grid', gap: 7 }}>
              <select aria-label="Referee for venue limit" value={newVenueReferee} onChange={(event) => setNewVenueReferee(event.target.value)} style={inputStyle}><option value="">Select referee</option>{referees.map((referee) => <option key={referee.id}>{referee.name}</option>)}</select>
              <select aria-label="Allowed venue" value={newVenue} onChange={(event) => setNewVenue(event.target.value)} style={inputStyle}><option value="">Select allowed venue</option>{settings.venues.map((venue) => <option key={venue.name}>{venue.name}</option>)}</select>
              <button type="button" disabled={!newVenueReferee || !newVenue} onClick={() => {
                const allowed = settings.refereeVenueOnly?.[newVenueReferee] || []
                if (!allowed.includes(newVenue)) editSettings({ refereeVenueOnly: { ...settings.refereeVenueOnly, [newVenueReferee]: [...allowed, newVenue] } })
                setNewVenue('')
              }} style={outlineStyle}>Add allowed venue</button>
            </div>
          </details>
          <button type="button" onClick={saveCriteria} disabled={!settingsDirty || savingRules} style={{ ...buttonStyle, marginTop: 15, width: '100%' }}>{savingRules ? 'Saving…' : settingsDirty ? 'Save standing criteria' : 'Standing criteria saved'}</button>
        </section>

        <section style={sectionStyle}>
          <h3 style={subheadingStyle}>Stipulations for {dateLabel(weekDate)}</h3>
          <p style={helpStyle}>These apply only to this matchday. Use the controls for rules the generator must follow, then save or generate again. Notes below are for your review and are not interpreted automatically.</p>
          <details open>
            <summary style={summaryStyle}>Unavailable elsewhere ({weekRules.unavailableReferees?.length || 0})</summary>
            <p style={helpStyle}>For example, a referee already assigned to a friendly that is not on this site. They will not be given an ECFA fixture, even if selected as available below.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 7 }}>
              {referees.map((referee) => <label key={referee.id} style={checkStyle}><input type="checkbox" checked={weekRules.unavailableReferees?.includes(referee.name) || false} onChange={() => editWeekRules({ unavailableReferees: weekRules.unavailableReferees.includes(referee.name) ? weekRules.unavailableReferees.filter((name) => name !== referee.name) : [...weekRules.unavailableReferees, referee.name] })} /> {referee.name}</label>)}
            </div>
          </details>
          <details style={{ marginTop: 14 }}>
            <summary style={summaryStyle}>Avoid a team this week ({weekRules.refereeTeamBlocks?.length || 0})</summary>
            <div style={{ display: 'grid', gap: 7, marginTop: 10 }}>
              {(weekRules.refereeTeamBlocks || []).map((rule, index) => <div key={`${rule.referee}-${rule.team}-${index}`} style={ruleRowStyle}><span>{rule.referee} cannot take {rule.team}</span><button type="button" onClick={() => editWeekRules({ refereeTeamBlocks: weekRules.refereeTeamBlocks.filter((_, i) => i !== index) })} style={smallButtonStyle}>Remove</button></div>)}
              <select aria-label="Referee for this week's team block" value={newWeekReferee} onChange={(event) => setNewWeekReferee(event.target.value)} style={inputStyle}><option value="">Select referee</option>{referees.map((referee) => <option key={referee.id}>{referee.name}</option>)}</select>
              <select aria-label="Team to avoid this week" value={newWeekTeam} onChange={(event) => setNewWeekTeam(event.target.value)} style={inputStyle}><option value="">Select team</option>{teamNames.map((name) => <option key={name}>{name}</option>)}</select>
              <button type="button" disabled={!newWeekReferee || !newWeekTeam} onClick={() => {
                if (!weekRules.refereeTeamBlocks.some((rule) => rule.referee === newWeekReferee && rule.team === newWeekTeam)) editWeekRules({ refereeTeamBlocks: [...weekRules.refereeTeamBlocks, { referee: newWeekReferee, team: newWeekTeam }] })
                setNewWeekReferee(''); setNewWeekTeam('')
              }} style={outlineStyle}>Add weekly block</button>
            </div>
          </details>
          <details style={{ marginTop: 14 }}>
            <summary style={summaryStyle}>Fix a referee to a fixture</summary>
            <p style={helpStyle}>Fixed referees are reserved first; the remaining fixtures are generated around them. Availability and hard exclusions still apply.</p>
            {fixtures.map((fixture) => <label key={fixture.id} style={{ ...labelStyle, marginBottom: 9 }}>{fixture.home_team?.name} v {fixture.away_team?.name}
              <select value={weekRules.fixedAssignments?.find((rule) => rule.fixtureId === fixture.id)?.referee || ''} onChange={(event) => editWeekRules({ fixedAssignments: [...weekRules.fixedAssignments.filter((rule) => rule.fixtureId !== fixture.id), ...(event.target.value ? [{ fixtureId: fixture.id, referee: event.target.value }] : [])] })} style={inputStyle}>
                <option value="">No fixed referee</option>{referees.map((referee) => <option key={referee.id}>{referee.name}</option>)}
              </select>
            </label>)}
          </details>
          <label style={{ ...labelStyle, marginTop: 14 }}>Other notes for this matchday
            <textarea value={weekRules.notes || ''} onChange={(event) => editWeekRules({ notes: event.target.value })} rows={3} placeholder="For your review; use the controls above for automatic rules" style={{ ...inputStyle, resize: 'vertical' }} />
          </label>
          <button type="button" onClick={async () => { if (await saveWeek()) setMessage('Weekly stipulations saved. Generate appointments to use them.') }} style={{ ...outlineStyle, width: '100%' }}>Save weekly stipulations</button>
        </section>

        <section style={sectionStyle}>
          <h3 style={subheadingStyle}>1. Assigned venue slots</h3>
          <p style={{ color: 'var(--muted)', fontSize: 12, margin: '0 0 10px' }}>Pulled automatically from the venues and kickoff times already assigned to these fixtures.</p>
          <div style={{ display: 'grid', gap: 7 }}>
            {assignedFixtureSlots.slots.length
              ? assignedFixtureSlots.slots.map((slot) => <div key={slot.key} style={checkStyle}><span aria-hidden="true">✓</span> {slot.label}</div>)
              : <p style={{ color: 'var(--muted)', fontSize: 13, margin: 0 }}>No assigned venues found for this matchday.</p>}
          </div>
        </section>

        <section style={sectionStyle}>
          <h3 style={subheadingStyle}>2. Available referees</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 7 }}>
            {referees.map((referee) => <label key={referee.id} style={checkStyle}><input type="checkbox" checked={availableReferees.includes(referee.name)} onChange={() => toggle(availableReferees, setAvailableReferees, referee.name)} /> {referee.name} <small style={{ color: 'var(--muted)' }}>({settings.refereePreferences?.[referee.name] || 'Any'})</small></label>)}
          </div>
        </section>

        <section style={sectionStyle}>
          <h3 style={subheadingStyle}>3. Fixtures ({fixtures.length})</h3>
          {fixtures.length ? fixtures.map((fixture) => <div key={fixture.id} style={{ padding: '7px 0', borderBottom: '1px solid var(--line)', fontSize: 14 }}>{fixture.home_team?.name} v {fixture.away_team?.name}</div>) : <p style={{ color: 'var(--muted)', fontSize: 13 }}>No fixtures are scheduled for this date.</p>}
        </section>

        <button onClick={generate} style={{ ...buttonStyle, width: '100%', marginBottom: 22 }}>Generate appointments</button>

        {allocations.length > 0 && <section>
          <h3 style={subheadingStyle}>4. Review appointments {status === 'confirmed' && <span style={{ color: '#18794e' }}>· Confirmed</span>}</h3>
          {allocations.map((allocation) => {
            const fixture = fixtures.find((item) => item.id === allocation?.fixtureId)
            if (!fixture || !allocation) return null
            return <article key={allocation.fixtureId} style={cardStyle}>
              <strong>{fixture.home_team?.name} v {fixture.away_team?.name}</strong>
              <label style={{ ...labelStyle, marginTop: 10 }}>Venue and time</label>
              <select value={allocation.slotKey || ''} onChange={(event) => updateAllocation(allocation.fixtureId, 'slotKey', event.target.value)} style={inputStyle}>
                <option value="">Unassigned</option>
                {slots.filter((slot) => availableSlots.includes(slot.key)).map((slot) => <option key={slot.key} value={slot.key}>{slot.label}</option>)}
              </select>
              <label style={{ ...labelStyle, marginTop: 9 }}>Referee</label>
              <select value={allocation.referee || ''} onChange={(event) => updateAllocation(allocation.fixtureId, 'referee', event.target.value)} style={inputStyle}>
                <option value="">Unassigned</option>
                {referees.filter((referee) => availableReferees.includes(referee.name)).map((referee) => <option key={referee.id} value={referee.name}>{referee.name}</option>)}
              </select>
              <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 9 }}>{allocation.reason}</div>
            </article>
          })}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => saveWeek()} style={{ ...outlineStyle, flex: 1 }}>Save draft</button>
            <button onClick={confirm} disabled={working === 'confirm'} style={{ ...buttonStyle, flex: 2 }}>{working === 'confirm' ? 'Confirming…' : 'Confirm and update fixtures'}</button>
          </div>
        </section>}
      </>}
    </div>
  )
}

const headingStyle = { fontSize: 15, color: 'var(--brass)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 12 }
const subheadingStyle = { fontSize: 15, margin: '0 0 10px' }
const sectionStyle = { border: '1px solid var(--line)', borderRadius: 8, padding: 14, marginBottom: 16 }
const cardStyle = { ...sectionStyle, background: '#fff' }
const labelStyle = { display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 5 }
const checkStyle = { fontSize: 13, display: 'flex', alignItems: 'center', gap: 7 }
const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '10px', border: '1px solid var(--line)', borderRadius: 6, background: '#fff', fontSize: 14 }
const buttonStyle = { padding: '11px 14px', border: 0, borderRadius: 6, background: 'var(--pitch)', color: '#fff', fontWeight: 700, cursor: 'pointer' }
const outlineStyle = { ...buttonStyle, background: '#fff', color: 'var(--pitch)', border: '1px solid var(--pitch)' }
const noticeStyle = { padding: 11, borderRadius: 6, background: '#fff8df', border: '1px solid var(--brass)', fontSize: 13, marginBottom: 14 }
const helpStyle = { color: 'var(--muted)', fontSize: 12, margin: '6px 0 12px', lineHeight: 1.5 }
const summaryStyle = { fontWeight: 700, fontSize: 13, cursor: 'pointer' }
const ruleRowStyle = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 13, borderBottom: '1px solid var(--line)', paddingBottom: 6 }
const smallButtonStyle = { border: '1px solid var(--line)', borderRadius: 5, background: '#fff', padding: '5px 7px', fontSize: 12, cursor: 'pointer' }
