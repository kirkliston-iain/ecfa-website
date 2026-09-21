import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'

const today = new Date().toISOString().slice(0, 10)

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
  }, [weekDate, settings])

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
    } else {
      const defaults = settings.venues.filter((venue) => !venue.additional).flatMap((venue) => venue.slots.flatMap((slot) =>
        Array.from({ length: slot.pitches }, (_, index) => slotKey(venue.name, slot.start, index + 1))
      ))
      setAvailableSlots(defaults)
      setAvailableReferees([])
      setAllocations([])
      setStatus('draft')
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
    return history.filter((row) => row.referee_name === referee && fixtureTeams(row).some((team) => teams.includes(team))).length
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
    if (settings.refereeTeamBlocks?.some((rule) => rule.referee === name && teams.includes(rule.team))) return false
    const only = settings.refereeVenueOnly?.[name]
    return !only || only.includes(slot.venue)
  }

  function generate() {
    setMessage('')
    if (!fixtures.length) return setMessage('There are no scheduled fixtures on this date.')
    if (assignedFixtureSlots.byFixture.size !== fixtures.length) return setMessage('Every fixture needs a venue and kickoff time before appointments can be generated.')
    if (!availableReferees.length) return setMessage('Select the referees who are available.')

    const usedRefs = new Set()
    const generated = []
    const fixtureOrder = [...fixtures].sort((a, b) =>
      Number(b.home_team?.name === 'South East Saints') - Number(a.home_team?.name === 'South East Saints')
    )

    for (const fixture of fixtureOrder) {
      const teams = fixtureTeams(fixture)
      const chosenSlot = assignedFixtureSlots.byFixture.get(fixture.id)
      if (!chosenSlot) {
        generated.push({ fixtureId: fixture.id, venue: '', slotKey: '', start: '', end: '', referee: '', reason: 'Assign a venue and kickoff to this fixture first' })
        continue
      }

      const refereeCandidates = referees
        .filter((referee) => availableReferees.includes(referee.name) && !usedRefs.has(referee.name) && refereeAllowed(referee.name, fixture, chosenSlot))
        .map((referee) => {
          const preference = settings.refereePreferences?.[referee.name] || 'Any'
          const repeats = historyCount(referee.name, teams)
          let score = preference === 'Any' ? 12 : preference === chosenSlot.area ? 35 : 0
          score -= repeats * 24
          score -= history.filter((row) => row.referee_name === referee.name).length
          return { referee, score, repeats, preference }
        }).sort((a, b) => b.score - a.score)
      const chosenReferee = refereeCandidates[0]
      if (chosenReferee) usedRefs.add(chosenReferee.referee.name)
      const reasons = ['venue and kickoff pulled from the fixture']
      if (chosenReferee) reasons.push(`${chosenReferee.preference} preference`, chosenReferee.repeats ? `${chosenReferee.repeats} previous team appointment${chosenReferee.repeats === 1 ? '' : 's'}` : 'no previous appointment with either team')
      generated.push({
        fixtureId: fixture.id, venue: chosenSlot.venue, slotKey: chosenSlot.key, start: chosenSlot.start, end: chosenSlot.end,
        referee: chosenReferee?.referee.name || '', reason: reasons.join(' · ') || 'Best available fit',
      })
    }
    setAllocations(fixtures.map((fixture) => generated.find((row) => row.fixtureId === fixture.id)))
    setStatus('draft')
    saveWeek(generated, 'draft')
  }

  async function saveWeek(nextAllocations = allocations, nextStatus = status) {
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('appointment_weeks').upsert({
      week_date: weekDate,
      available_slots: availableSlots,
      available_referees: availableReferees,
      allocations: nextAllocations,
      status: nextStatus,
      updated_at: new Date().toISOString(),
      updated_by: user?.id || null,
      confirmed_at: nextStatus === 'confirmed' ? new Date().toISOString() : null,
    })
    if (error) setMessage(error.message)
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
