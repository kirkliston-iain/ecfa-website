import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'

const TYPES = [
  { value: 'team', label: 'Team names' },
  { value: 'venue', label: 'Venues' },
  { value: 'player', label: 'Players' },
  { value: 'manager', label: 'Managers' },
  { value: 'official', label: 'Officials' },
  { value: 'competition', label: 'Competition names' },
]

export default function RecordsAdmin() {
  const [lists, setLists] = useState({ teams: [], venues: [], players: [], managers: [], officials: [], competitions: [] })
  const [history, setHistory] = useState([])
  const [type, setType] = useState('team')
  const [entityId, setEntityId] = useState('')
  const [newName, setNewName] = useState('')
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().slice(0, 10))
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function load() {
    const [teams, venues, players, officials, competitions, changes] = await Promise.all([
      supabase.from('teams').select('id, name, manager_name').order('name'),
      supabase.from('venues').select('id, name').order('name'),
      supabase.from('players').select('id, first_name, last_name, team:team_id(name)').order('last_name'),
      supabase.from('referees').select('id, name').order('name'),
      supabase.from('competitions').select('name').order('name'),
      supabase.from('record_name_changes').select('id, entity_type, old_name, new_name, effective_date, reason, changed_by_name, affected_rows, created_at').order('created_at', { ascending: false }).limit(50),
    ])
    const failed = [teams, venues, players, officials, competitions, changes].find((result) => result.error)
    if (failed) {
      setError(failed.error.message)
      return
    }
    const managerNames = [...new Set((teams.data || []).map((team) => team.manager_name).filter(Boolean))].sort()
    const competitionNames = [...new Set((competitions.data || []).map((competition) => competition.name).filter(Boolean))].sort()
    setLists({
      teams: teams.data || [],
      venues: venues.data || [],
      players: players.data || [],
      managers: managerNames.map((name) => ({ id: name, name })),
      officials: officials.data || [],
      competitions: competitionNames.map((name) => ({ id: name, name })),
    })
    setHistory(changes.data || [])
  }

  useEffect(() => { load() }, [])

  const options = useMemo(() => {
    if (type === 'team') return lists.teams.map((row) => ({ id: row.id, label: row.name, name: row.name }))
    if (type === 'venue') return lists.venues.map((row) => ({ id: row.id, label: row.name, name: row.name }))
    if (type === 'official') return lists.officials.map((row) => ({ id: row.id, label: row.name, name: row.name }))
    if (type === 'manager') return lists.managers.map((row) => ({ id: row.id, label: row.name, name: row.name }))
    if (type === 'competition') return lists.competitions.map((row) => ({ id: row.id, label: row.name, name: row.name }))
    return lists.players.map((row) => ({
      id: row.id,
      name: `${row.first_name} ${row.last_name}`,
      label: `${row.first_name} ${row.last_name}${row.team?.name ? ` — ${row.team.name}` : ' — No current team'}`,
    }))
  }, [lists, type])

  const selected = options.find((option) => option.id === entityId)

  function changeType(nextType) {
    setType(nextType)
    setEntityId('')
    setNewName('')
    setMessage('')
    setError('')
  }

  function selectEntity(id) {
    setEntityId(id)
    const option = options.find((item) => item.id === id)
    setNewName(option?.name || '')
    setMessage('')
    setError('')
  }

  async function save() {
    if (!entityId || !newName.trim() || !effectiveDate || !reason.trim()) {
      setError('Choose a record and complete the new name, reference date and reason.')
      return
    }
    if (newName.trim() === selected?.name) {
      setError('Enter a different name before saving.')
      return
    }
    const confirmed = window.confirm(
      `Change “${selected?.name}” to “${newName.trim()}” everywhere, including matching historical records?`
    )
    if (!confirmed) return

    setSaving(true)
    setError('')
    setMessage('')
    const { data, error: saveError } = await supabase.rpc('apply_record_name_change', {
      p_entity_type: type,
      p_entity_id: entityId,
      p_new_name: newName.trim(),
      p_effective_date: effectiveDate,
      p_reason: reason.trim(),
    })
    setSaving(false)
    if (saveError) {
      setError(saveError.message)
      return
    }
    setMessage(`Changed ${data.old_name} to ${data.new_name}. Current and matching historical records were updated.`)
    setEntityId('')
    setNewName('')
    setReason('')
    await load()
  }

  return (
    <div className="container" style={{ padding: '32px 20px 48px', maxWidth: 760 }}>
      <Link to="/admin/dashboard" style={backStyle}>← Back to admin</Link>
      <h1 style={{ fontSize: 26, marginBottom: 6 }}>Records management</h1>
      <p style={{ color: 'var(--muted)', marginTop: 0, lineHeight: 1.5 }}>
        Rename core records across the current site and matching historical data. Every change keeps the former name, reference date, reason and administrator below.
      </p>

      <div style={cardStyle}>
        <label style={labelStyle}>Record type</label>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 16 }}>
          {TYPES.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => changeType(item.value)}
              style={{ ...tabStyle, ...(type === item.value ? activeTabStyle : {}) }}
            >
              {item.label}
            </button>
          ))}
        </div>

        <label style={labelStyle} htmlFor="record-to-change">Existing record</label>
        <select id="record-to-change" value={entityId} onChange={(event) => selectEntity(event.target.value)} style={inputStyle}>
          <option value="">Select…</option>
          {options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
        </select>

        <label style={labelStyle} htmlFor="new-record-name">New name</label>
        <input id="new-record-name" value={newName} onChange={(event) => setNewName(event.target.value)} style={inputStyle} />

        <label style={labelStyle} htmlFor="reference-date">Reference/effective date</label>
        <input id="reference-date" type="date" value={effectiveDate} onChange={(event) => setEffectiveDate(event.target.value)} style={inputStyle} />

        <label style={labelStyle} htmlFor="change-reason">Reason for change</label>
        <textarea id="change-reason" value={reason} onChange={(event) => setReason(event.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical' }} placeholder="For example: club requested an official name change" />

        <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.45 }}>
          Team and competition changes also update matching historical results. Venue history is not stored in the historical imports, so venue changes apply to the live fixture archive. Player-name matching in imported history uses the exact former name.
        </p>
        {error && <p role="alert" style={{ color: '#B3261E', fontWeight: 700 }}>{error}</p>}
        {message && <p role="status" style={{ color: '#1B6E3C', fontWeight: 700 }}>{message}</p>}
        <button type="button" onClick={save} disabled={saving || !entityId} style={{ ...saveStyle, opacity: saving || !entityId ? 0.55 : 1 }}>
          {saving ? 'Updating records…' : 'Review and apply change'}
        </button>
      </div>

      <h2 style={{ fontSize: 17, marginTop: 32, marginBottom: 6 }}>Name-change history</h2>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 0 }}>The latest 50 changes, newest first.</p>
      <div style={{ display: 'grid', gap: 10 }}>
        {history.map((row) => (
          <article key={row.id} style={historyStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <strong>{TYPES.find((item) => item.value === row.entity_type)?.label || row.entity_type}</strong>
              <time style={{ color: 'var(--muted)', fontSize: 12 }}>{new Date(`${row.effective_date}T00:00:00`).toLocaleDateString('en-GB')}</time>
            </div>
            <div><strong>{row.old_name}</strong> → <strong>{row.new_name}</strong></div>
            <div style={{ color: 'var(--muted)', fontSize: 13 }}>{row.reason}</div>
            <div style={{ color: 'var(--muted)', fontSize: 12 }}>Changed by {row.changed_by_name} · recorded {new Date(row.created_at).toLocaleString('en-GB')}</div>
          </article>
        ))}
        {history.length === 0 && <p style={{ color: 'var(--muted)' }}>No name changes recorded yet.</p>}
      </div>
    </div>
  )
}

const backStyle = { display: 'inline-block', color: 'var(--brass)', fontWeight: 700, marginBottom: 18 }
const cardStyle = { border: '1px solid var(--line)', borderRadius: 10, padding: 18, marginTop: 22 }
const historyStyle = { border: '1px solid var(--line)', borderRadius: 8, padding: 13, display: 'grid', gap: 6 }
const labelStyle = { display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6 }
const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '11px 12px', border: '1px solid var(--line)', borderRadius: 7, background: '#fff', fontSize: 15, marginBottom: 15, fontFamily: 'inherit' }
const tabStyle = { border: '1px solid var(--line)', borderRadius: 999, background: '#fff', color: 'var(--ink)', padding: '7px 11px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }
const activeTabStyle = { background: 'var(--ink)', borderColor: 'var(--ink)', color: '#fff' }
const saveStyle = { width: '100%', border: 0, borderRadius: 7, background: 'var(--ink)', color: '#fff', padding: '12px 14px', fontSize: 14, fontWeight: 800, cursor: 'pointer' }
