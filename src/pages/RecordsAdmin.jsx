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
  const [lists, setLists] = useState({ teams: [], venues: [], players: [], historicalPlayers: [], managers: [], officials: [], competitions: [] })
  const [history, setHistory] = useState([])
  const [type, setType] = useState('team')
  const [playerAction, setPlayerAction] = useState('rename')
  const [playerSearch, setPlayerSearch] = useState('')
  const [secondPlayerSearch, setSecondPlayerSearch] = useState('')
  const [entityId, setEntityId] = useState('')
  const [mergePlayerId, setMergePlayerId] = useState('')
  const [keepPlayerId, setKeepPlayerId] = useState('')
  const [newName, setNewName] = useState('')
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().slice(0, 10))
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function loadAllPlayers() {
    const pageSize = 1000
    const allPlayers = []
    for (let from = 0; ; from += pageSize) {
      const result = await supabase
        .from('players')
        .select('id, first_name, last_name, team:team_id(name)')
        .order('last_name')
        .order('first_name')
        .range(from, from + pageSize - 1)
      if (result.error) return result
      allPlayers.push(...(result.data || []))
      if ((result.data || []).length < pageSize) break
    }
    return { data: allPlayers, error: null }
  }

  async function loadHistoricalPlayers() {
    const pageSize = 1000
    const rows = []
    for (const table of ['historic_scorers', 'historic_match_scorers']) {
      for (let from = 0; ; from += pageSize) {
        const result = await supabase
          .from(table)
          .select('player_name, team_name')
          .range(from, from + pageSize - 1)
        if (result.error) return result
        rows.push(...(result.data || []))
        if ((result.data || []).length < pageSize) break
      }
    }

    const byName = new Map()
    rows.forEach((row) => {
      const name = row.player_name?.trim()
      if (!name) return
      const key = name.toLocaleLowerCase()
      const existing = byName.get(key) || { name, teams: new Set() }
      if (row.team_name?.trim()) existing.teams.add(row.team_name.trim())
      byName.set(key, existing)
    })
    return {
      data: [...byName.values()].map((row) => ({ ...row, teams: [...row.teams].sort() })),
      error: null,
    }
  }

  async function load() {
    const [teams, venues, players, historicalPlayers, officials, competitions, changes] = await Promise.all([
      supabase.from('teams').select('id, name, manager_name').order('name'),
      supabase.from('venues').select('id, name').order('name'),
      loadAllPlayers(),
      loadHistoricalPlayers(),
      supabase.from('referees').select('id, name').order('name'),
      supabase.from('competitions').select('name').order('name'),
      supabase.from('record_name_changes').select('id, entity_type, old_name, new_name, effective_date, reason, changed_by_name, affected_rows, created_at').order('created_at', { ascending: false }).limit(50),
    ])
    const failed = [teams, venues, players, historicalPlayers, officials, competitions, changes].find((result) => result.error)
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
      historicalPlayers: historicalPlayers.data || [],
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
    const currentNames = new Set(lists.players.map((row) => `${row.first_name} ${row.last_name}`.trim().toLocaleLowerCase()))
    const current = lists.players.map((row) => ({
      id: `current:${row.id}`,
      playerId: row.id,
      kind: 'current',
      name: `${row.first_name} ${row.last_name}`.trim(),
      label: `${row.first_name} ${row.last_name}${row.team?.name ? ` — ${row.team.name}` : ' — No current team'}`,
    }))
    const historical = lists.historicalPlayers
      .filter((row) => !currentNames.has(row.name.toLocaleLowerCase()))
      .map((row) => ({
        id: `historical:${encodeURIComponent(row.name.toLocaleLowerCase())}`,
        playerId: null,
        kind: 'historical',
        name: row.name,
        label: `${row.name} — Historical${row.teams.length ? ` — ${row.teams.join(', ')}` : ''}`,
      }))
    return [...current, ...historical].sort((a, b) => a.name.localeCompare(b.name))
  }, [lists, type])

  const selected = options.find((option) => option.id === entityId)
  const mergePlayer = options.find((option) => option.id === mergePlayerId)
  const visibleOptions = type === 'player'
    ? options.filter((option) => option.label.toLowerCase().includes(playerSearch.trim().toLowerCase())).slice(0, 100)
    : options
  const secondPlayerOptions = options
    .filter((option) => option.id !== entityId && option.label.toLowerCase().includes(secondPlayerSearch.trim().toLowerCase()))
    .slice(0, 100)

  function changeType(nextType) {
    setType(nextType)
    setEntityId('')
    setMergePlayerId('')
    setKeepPlayerId('')
    setPlayerSearch('')
    setSecondPlayerSearch('')
    setPlayerAction('rename')
    setNewName('')
    setMessage('')
    setError('')
  }

  function changePlayerAction(action) {
    setPlayerAction(action)
    setEntityId('')
    setMergePlayerId('')
    setKeepPlayerId('')
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
    const request = type === 'player' && selected?.kind === 'historical'
      ? supabase.rpc('rename_historical_player_name', {
          p_old_name: selected.name,
          p_new_name: newName.trim(),
          p_effective_date: effectiveDate,
          p_reason: reason.trim(),
        })
      : supabase.rpc('apply_record_name_change', {
          p_entity_type: type,
          p_entity_id: type === 'player' ? selected?.playerId : entityId,
          p_new_name: newName.trim(),
          p_effective_date: effectiveDate,
          p_reason: reason.trim(),
        })
    const { data, error: saveError } = await request
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

  async function mergePlayers() {
    if (!entityId || !mergePlayerId || !keepPlayerId || !effectiveDate || !reason.trim()) {
      setError('Choose two players, select the name to keep, and complete the reference date and reason.')
      return
    }
    const keepPlayer = keepPlayerId === entityId ? selected : mergePlayer
    const removePlayer = keepPlayerId === entityId ? mergePlayer : selected
    const confirmed = window.confirm(
      `Combine “${removePlayer?.name}” into “${keepPlayer?.name}”? The retained name will be “${keepPlayer?.name}” and the other player record will be removed.`
    )
    if (!confirmed) return

    setSaving(true)
    setError('')
    setMessage('')
    const { data, error: mergeError } = await supabase.rpc('merge_player_entries', {
      p_first_player_id: selected.playerId,
      p_first_name: selected.name,
      p_second_player_id: mergePlayer.playerId,
      p_second_name: mergePlayer.name,
      p_keep_choice: keepPlayerId === entityId ? 1 : 2,
      p_effective_date: effectiveDate,
      p_reason: reason.trim(),
    })
    setSaving(false)
    if (mergeError) {
      setError(mergeError.message)
      return
    }
    setMessage(`Combined ${data.merged_name} into ${data.kept_name}. Linked current and historical records were retained.`)
    setEntityId('')
    setMergePlayerId('')
    setKeepPlayerId('')
    setPlayerSearch('')
    setSecondPlayerSearch('')
    setReason('')
    await load()
  }

  return (
    <div className="container" style={{ padding: '32px 20px 48px', maxWidth: 760 }}>
      <Link to="/admin/dashboard" style={backStyle}>← Back to admin</Link>
      <h1 style={{ fontSize: 26, marginBottom: 6 }}>Records management</h1>
      <p style={{ color: 'var(--muted)', marginTop: 0, lineHeight: 1.5 }}>
        Rename core records across the current site and historical archive. Historical-only players can also be searched, renamed or combined. Every change keeps the former name, reference date, reason and administrator below.
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

        {type === 'player' && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button type="button" onClick={() => changePlayerAction('rename')} style={{ ...tabStyle, ...(playerAction === 'rename' ? activeTabStyle : {}) }}>Rename one player</button>
            <button type="button" onClick={() => changePlayerAction('merge')} style={{ ...tabStyle, ...(playerAction === 'merge' ? activeTabStyle : {}) }}>Combine two players</button>
          </div>
        )}

        <label style={labelStyle} htmlFor="record-to-change">{type === 'player' && playerAction === 'merge' ? 'First player' : 'Existing record'}</label>
        {type === 'player' && (
          <input
            type="search"
            value={playerSearch}
            onChange={(event) => setPlayerSearch(event.target.value)}
            style={{ ...inputStyle, marginBottom: 8 }}
            placeholder="Search players by name or team…"
          />
        )}
        <select id="record-to-change" value={entityId} onChange={(event) => selectEntity(event.target.value)} style={inputStyle}>
          <option value="">Select…</option>
          {visibleOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
        </select>

        {type === 'player' && playerAction === 'merge' ? (
          <>
            <label style={labelStyle} htmlFor="second-player">Second player</label>
            <input
              type="search"
              value={secondPlayerSearch}
              onChange={(event) => setSecondPlayerSearch(event.target.value)}
              style={{ ...inputStyle, marginBottom: 8 }}
              placeholder="Search for the duplicate player…"
            />
            <select id="second-player" value={mergePlayerId} onChange={(event) => { setMergePlayerId(event.target.value); setKeepPlayerId('') }} style={inputStyle}>
              <option value="">Select…</option>
              {secondPlayerOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
            {selected && mergePlayer && (
              <fieldset style={{ border: '1px solid var(--line)', borderRadius: 7, padding: 12, margin: '0 0 15px' }}>
                <legend style={{ ...labelStyle, padding: '0 5px', marginBottom: 0 }}>Name and player record to keep</legend>
                {[selected, mergePlayer].map((option) => (
                  <label key={option.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '6px 0', fontSize: 14 }}>
                    <input type="radio" name="keep-player" checked={keepPlayerId === option.id} onChange={() => setKeepPlayerId(option.id)} />
                    <span><strong>{option.name}</strong><br /><span style={{ color: 'var(--muted)', fontSize: 12 }}>{option.label}</span></span>
                  </label>
                ))}
              </fieldset>
            )}
          </>
        ) : (
          <>
            <label style={labelStyle} htmlFor="new-record-name">New name</label>
            <input id="new-record-name" value={newName} onChange={(event) => setNewName(event.target.value)} style={inputStyle} />
          </>
        )}

        <label style={labelStyle} htmlFor="reference-date">Reference/effective date</label>
        <input id="reference-date" type="date" value={effectiveDate} onChange={(event) => setEffectiveDate(event.target.value)} style={inputStyle} />

        <label style={labelStyle} htmlFor="change-reason">Reason for change</label>
        <textarea id="change-reason" value={reason} onChange={(event) => setReason(event.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical' }} placeholder="For example: club requested an official name change" />

        <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.45 }}>
          Team and competition changes also update matching historical results. Venue history is not stored in the historical imports, so venue changes apply to the live fixture archive. Historical player changes update every exact match in both imported scoring archives.
        </p>
        {error && <p role="alert" style={{ color: '#B3261E', fontWeight: 700 }}>{error}</p>}
        {message && <p role="status" style={{ color: '#1B6E3C', fontWeight: 700 }}>{message}</p>}
        <button
          type="button"
          onClick={type === 'player' && playerAction === 'merge' ? mergePlayers : save}
          disabled={saving || !entityId || (type === 'player' && playerAction === 'merge' && (!mergePlayerId || !keepPlayerId))}
          style={{ ...saveStyle, opacity: saving || !entityId || (type === 'player' && playerAction === 'merge' && (!mergePlayerId || !keepPlayerId)) ? 0.55 : 1 }}
        >
          {saving ? 'Updating records…' : type === 'player' && playerAction === 'merge' ? 'Review and combine players' : 'Review and apply change'}
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
