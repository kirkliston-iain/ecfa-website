import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'

const LEGACY_SEASON = '2026-27'
const copyPreferences = (value) => Object.fromEntries(
  Object.entries(value || {}).map(([team, rows]) => [team, (rows || []).map((row) => ({ ...row }))])
)

function preferencesForSeason(settings, season) {
  const saved = settings?.teamPreferencesBySeason || {}
  if (Object.hasOwn(saved, season)) return { rows: copyPreferences(saved[season]), inherited: false }
  if (season === LEGACY_SEASON) return { rows: copyPreferences(settings?.teamPreferences), inherited: false }
  const prior = Object.keys(saved)
    .concat(settings?.teamPreferences ? [LEGACY_SEASON] : [])
    .filter((item) => Number(item.slice(0, 4)) < Number(season.slice(0, 4)))
    .sort((a, b) => b.localeCompare(a))[0]
  return {
    rows: copyPreferences(prior ? saved[prior] || settings.teamPreferences : {}),
    inherited: Boolean(prior),
  }
}

export default function TeamPreferencesAdmin() {
  const [settings, setSettings] = useState(null)
  const [teams, setTeams] = useState([])
  const [currentSeason, setCurrentSeason] = useState('')
  const [selectedSeason, setSelectedSeason] = useState('')
  const [draft, setDraft] = useState({})
  const [inherited, setInherited] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    Promise.all([
      supabase.from('appointment_settings').select('settings').eq('id', true).single(),
      supabase.from('teams').select('name').order('name'),
      supabase.from('competitions').select('season').limit(1).single(),
    ]).then(([settingResult, teamResult, seasonResult]) => {
      if (cancelled) return
      if (settingResult.error || teamResult.error || seasonResult.error) {
        setError('Could not load the team preferences. Please try again.')
      } else {
        const season = seasonResult.data.season
        const loaded = settingResult.data.settings || {}
        const initial = preferencesForSeason(loaded, season)
        setSettings(loaded)
        setTeams(teamResult.data || [])
        setCurrentSeason(season)
        setSelectedSeason(season)
        setDraft(initial.rows)
        setInherited(initial.inherited)
      }
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [])

  const seasons = useMemo(() => [...new Set([
    currentSeason,
    ...Object.keys(settings?.teamPreferencesBySeason || {}),
    ...(settings?.teamPreferences ? [LEGACY_SEASON] : []),
  ].filter(Boolean))].sort((a, b) => b.localeCompare(a)), [currentSeason, settings])
  const teamNames = useMemo(() => [...new Set([
    ...(selectedSeason === currentSeason ? teams.map((team) => team.name) : []),
    ...Object.keys(draft),
  ])].sort((a, b) => a.localeCompare(b)), [teams, draft, currentSeason, selectedSeason])

  function chooseSeason(season) {
    const initial = preferencesForSeason(settings, season)
    setSelectedSeason(season)
    setDraft(initial.rows)
    setInherited(initial.inherited)
    setDirty(false)
    setMessage('')
    setError('')
  }

  function changeRows(team, rows) {
    setDraft((old) => ({ ...old, [team]: rows }))
    setDirty(true)
    setMessage('')
  }

  function addRow(team) {
    const venue = settings.venues?.[0]
    if (!venue) return
    changeRows(team, [...(draft[team] || []), { venue: venue.name, start: venue.slots?.[0]?.start || '10:00' }])
  }

  function updateRow(team, index, field, value) {
    const rows = [...(draft[team] || [])]
    const next = { ...rows[index], [field]: value }
    if (field === 'venue') {
      next.start = settings.venues.find((venue) => venue.name === value)?.slots?.[0]?.start || '10:00'
    }
    rows[index] = next
    changeRows(team, rows)
  }

  function moveRow(team, index, direction) {
    const rows = [...(draft[team] || [])]
    const next = index + direction
    if (next < 0 || next >= rows.length) return
    ;[rows[index], rows[next]] = [rows[next], rows[index]]
    changeRows(team, rows)
  }

  async function save() {
    setError('')
    setMessage('')
    for (const [team, rows] of Object.entries(draft)) {
      if (rows.some((row) => !row.venue || !row.start)) {
        setError(`Choose a venue and time for every ${team} entry.`)
        return
      }
      if (new Set(rows.map((row) => `${row.venue}|${row.start}`)).size !== rows.length) {
        setError(`Remove the duplicate venue and time for ${team}.`)
        return
      }
    }
    setSaving(true)
    const { data: latest, error: readError } = await supabase
      .from('appointment_settings').select('settings').eq('id', true).single()
    if (readError) {
      setError('Could not refresh appointment settings. Nothing was saved.')
      setSaving(false)
      return
    }
    const bySeason = { ...(latest.settings.teamPreferencesBySeason || {}) }
    if (!Object.hasOwn(bySeason, LEGACY_SEASON) && latest.settings.teamPreferences) {
      bySeason[LEGACY_SEASON] = copyPreferences(latest.settings.teamPreferences)
    }
    bySeason[selectedSeason] = draft
    const nextSettings = {
      ...latest.settings,
      teamPreferencesBySeason: bySeason,
      ...(selectedSeason === currentSeason ? { teamPreferences: draft } : {}),
    }
    const { data: saved, error: saveError } = await supabase
      .from('appointment_settings').update({ settings: nextSettings }).eq('id', true)
      .select('settings').single()
    setSaving(false)
    if (saveError || !saved) {
      setError('Could not save the team preferences. Please try again.')
      return
    }
    setSettings(saved.settings)
    setDirty(false)
    setInherited(false)
    setMessage(`Preferences saved for ${selectedSeason}.`)
  }

  if (loading) return <div className="container" style={{ padding: 32 }}>Loading team preferences…</div>
  if (!settings) return <div className="container" style={{ padding: 32 }}>{error}</div>

  return (
    <div className="container team-pref-page" style={{ padding: '24px 16px 48px', maxWidth: 920 }}>
      <Link to="/admin/dashboard" style={{ color: 'var(--brass)', fontSize: 14 }}>← Admin dashboard</Link>
      <h1 style={{ margin: '10px 0 4px', fontSize: 20, lineHeight: 1.2 }}>Team venue &amp; time preferences</h1>
      <p style={{ color: 'var(--muted)', margin: '0 0 12px', fontSize: 12, lineHeight: 1.35 }}>
        Weekend venue slots; published kick-off times may differ.
      </p>
      <label style={{ display: 'block', fontWeight: 700, fontSize: 14, marginBottom: 12 }}>
        Season
        <select
          value={selectedSeason}
          onChange={(event) => chooseSeason(event.target.value)}
          disabled={dirty}
          style={{ ...inputStyle, display: 'block', maxWidth: 220, marginTop: 6 }}
        >
          {seasons.map((season) => <option key={season} value={season}>{season}</option>)}
        </select>
      </label>
      {inherited && <p style={noticeStyle}>This season starts with a copy of the previous preferences. Save to keep a separate list for {selectedSeason}.</p>}
      {dirty && <p style={noticeStyle}>Save or discard your changes before switching seasons.</p>}
      {teamNames.map((team) => (
        <section key={team} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 10, marginBottom: 10 }}>
          <h2 style={{ fontSize: 15, lineHeight: 1.25, margin: '0 0 8px' }}>{team}</h2>
          {(draft[team] || []).map((row, index) => {
            const venue = settings.venues.find((item) => item.name === row.venue)
            const times = [...new Set([row.start, ...(venue?.slots || []).map((slot) => slot.start)].filter(Boolean))].sort()
            return (
              <div key={`${team}-${index}`} className="team-pref-entry">
                <select aria-label={`${team} preference ${index + 1} venue`} value={row.venue} onChange={(event) => updateRow(team, index, 'venue', event.target.value)} style={inputStyle}>
                  {settings.venues.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}
                </select>
                <select aria-label={`${team} preference ${index + 1} time`} value={row.start} onChange={(event) => updateRow(team, index, 'start', event.target.value)} style={inputStyle}>
                  {times.map((time) => <option key={time} value={time}>{time}</option>)}
                </select>
                <div className="team-pref-actions">
                  <button type="button" aria-label={`Move ${team} preference ${index + 1} up`} disabled={index === 0} onClick={() => moveRow(team, index, -1)} style={smallButton}>↑</button>
                  <button type="button" aria-label={`Move ${team} preference ${index + 1} down`} disabled={index === (draft[team] || []).length - 1} onClick={() => moveRow(team, index, 1)} style={smallButton}>↓</button>
                  <button type="button" onClick={() => changeRows(team, (draft[team] || []).filter((_, i) => i !== index))} style={smallButton}>Remove</button>
                </div>
              </div>
            )
          })}
          <button type="button" onClick={() => addRow(team)} style={smallButton}>+ Add preference</button>
        </section>
      ))}
      {error && <p role="alert" style={{ color: '#B3261E' }}>{error}</p>}
      {message && <p role="status" style={{ color: '#1B6E3C' }}>{message}</p>}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button type="button" onClick={save} disabled={saving || (!dirty && !inherited)} style={saveButton}>
          {saving ? 'Saving…' : `Save ${selectedSeason} preferences`}
        </button>
        {dirty && <button type="button" onClick={() => chooseSeason(selectedSeason)} style={smallButton}>Discard changes</button>}
      </div>
    </div>
  )
}

const inputStyle = { padding: '6px', border: '1px solid var(--line)', borderRadius: 6, background: '#fff', color: 'var(--ink)', font: 'inherit', fontSize: 13, minHeight: 36, minWidth: 0, maxWidth: '100%' }
const smallButton = { padding: '6px 8px', border: '1px solid var(--line)', borderRadius: 6, background: '#fff', color: 'var(--ink)', font: 'inherit', fontSize: 13, cursor: 'pointer', minHeight: 36 }
const saveButton = { ...smallButton, background: 'var(--ink)', color: '#fff', fontWeight: 700 }
const noticeStyle = { padding: 12, border: '1px solid var(--brass)', borderRadius: 6, background: '#fff8df', fontSize: 14 }
