import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useRememberedState, useRememberedScroll } from '../hooks/usePageMemory'
import TransferHistory, { TRANSFER_SELECT } from '../components/TransferHistory'
import { londonDate, playerName } from '../lib/playerTransfers.mjs'

async function allRows(table, select, order) {
  const rows = []
  for (let offset = 0; ; offset += 1000) {
    const result = await supabase.from(table).select(select).order(order).order('id').range(offset, offset + 999)
    if (result.error) throw result.error
    rows.push(...result.data)
    if (result.data.length < 1000) return rows
  }
}

export default function TransfersAdmin() {
  const [params] = useSearchParams()
  const [players, setPlayers] = useState([])
  const [teams, setTeams] = useState([])
  const [history, setHistory] = useState([])
  const [playerId, setPlayerId] = useRememberedState('transferPlayer', params.get('player') || '')
  const [search, setSearch] = useRememberedState('transferSearch', '')
  const [newTeamId, setNewTeamId] = useState('')
  const [previousTeamId, setPreviousTeamId] = useState('')
  const [date, setDate] = useState(londonDate)
  const [historyOnly, setHistoryOnly] = useState(false)
  const [filter, setFilter] = useRememberedState('transferHistorySearch', '')
  const [clubFilter, setClubFilter] = useRememberedState('transferHistoryClub', '')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [page, setPage] = useRememberedState('transferHistoryPage', 0)
  useRememberedScroll(!loading)

  async function load() {
    const results = await Promise.all([
      allRows('players', 'id, first_name, last_name, team_id', 'last_name'),
      allRows('teams', 'id, name', 'name'),
      allRows('player_transfers', TRANSFER_SELECT, 'transfer_date'),
    ])
    setPlayers(results[0]); setTeams(results[1]); setHistory(results[2].reverse())
  }
  useEffect(() => {
    load().catch((err) => setError(`Could not load transfers: ${err.message}`)).finally(() => setLoading(false))
  }, [])

  const teamNames = useMemo(() => new Map(teams.map((team) => [team.id, team.name])), [teams])
  const player = players.find((row) => row.id === playerId)
  const fromTeamId = historyOnly ? previousTeamId : player?.team_id || ''
  const candidates = players.filter((row) => row.id === playerId || `${playerName(row)} ${teamNames.get(row.team_id) || ''}`.toLowerCase().includes(search.trim().toLowerCase()))
  const filteredHistory = history.filter((row) => playerName(row.player).toLowerCase().includes(filter.trim().toLowerCase()) && (!clubFilter || row.previous_team_id === clubFilter || row.new_team_id === clubFilter))

  async function save(event) {
    event.preventDefault()
    if (saving) return
    setError(''); setMessage('')
    if (!player || !fromTeamId || !newTeamId || fromTeamId === newTeamId || !date) {
      setError('Choose a player, two different clubs and a transfer date.'); return
    }
    setSaving(true)
    try {
      const result = await supabase.rpc('record_player_transfer', {
        p_player_id: playerId, p_previous_team_id: fromTeamId, p_new_team_id: newTeamId,
        p_transfer_date: date, p_history_only: historyOnly,
      })
      if (result.error) throw result.error
      setMessage(historyOnly ? `Historical transfer recorded for ${playerName(player)}. Current squad unchanged.` : `${playerName(player)} moved from ${teamNames.get(fromTeamId)} to ${teamNames.get(newTeamId)}. Transfer history saved.`)
      setNewTeamId(''); setPreviousTeamId('')
      try { await load() } catch (err) { setError(`The transfer was saved, but the list could not refresh: ${err.message}. Reload this page.`) }
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="container" style={{ padding: '32px 20px 48px', maxWidth: 900 }}>
      <Link to="/admin/dashboard">← Admin dashboard</Link>
      <h1 style={{ fontSize: 26 }}>Player transfers</h1>
      <p style={{ color: 'var(--muted)' }}>Move an existing player between ECFA clubs and retain their goals, cards and transfer history.</p>
      {error && <p role="alert" style={{ color: '#b3261e' }}>{error}</p>}
      {message && <p role="status" style={{ color: '#176b3a', fontWeight: 700 }}>{message}</p>}
      {loading ? <p>Loading transfers…</p> : <>
        <form onSubmit={save} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 20, marginBottom: 30 }}>
          <fieldset disabled={saving} style={{ border: 0, padding: 0, margin: 0 }}>
            <legend style={{ fontWeight: 800, marginBottom: 16 }}>Record a transfer</legend>
            <label style={label}><input type="checkbox" checked={historyOnly} onChange={(e) => { setHistoryOnly(e.target.checked); setNewTeamId(''); setPreviousTeamId('') }} /> Add a past transfer to history only</label>
            {historyOnly && <p style={{ fontSize: 13, color: 'var(--muted)' }}>Use this to backfill a known past move. It will not change the player’s current club.</p>}
            <label style={label} htmlFor="transfer-search">Search name or current club</label>
            <input id="transfer-search" value={search} onChange={(e) => setSearch(e.target.value)} style={input} placeholder="Start typing a player’s name…" />
            <label style={label} htmlFor="transfer-player">Player</label>
            <select id="transfer-player" required value={playerId} onChange={(e) => { setPlayerId(e.target.value); setNewTeamId(''); setPreviousTeamId('') }} style={input}>
              <option value="">Select a player</option>
              {candidates.map((row) => <option key={row.id} value={row.id}>{playerName(row)} — {teamNames.get(row.team_id) || 'No current club'}</option>)}
            </select>
            <label style={label} htmlFor="transfer-previous">Previous club</label>
            {historyOnly ? <select id="transfer-previous" required value={previousTeamId} onChange={(e) => setPreviousTeamId(e.target.value)} style={input}>
              <option value="">Select previous club</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
            </select> : <input id="transfer-previous" readOnly value={teamNames.get(player?.team_id) || (player ? 'No current club — use history-only for a past transfer' : 'Select a player first')} style={input} />}
            <label style={label} htmlFor="transfer-new">New club</label>
            <select id="transfer-new" required value={newTeamId} onChange={(e) => setNewTeamId(e.target.value)} style={input}>
              <option value="">Select new club</option>{teams.filter((team) => team.id !== fromTeamId).map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
            </select>
            <label style={label} htmlFor="transfer-date">Transfer date</label>
            <input id="transfer-date" type="date" required max={londonDate()} value={date} onChange={(e) => setDate(e.target.value)} style={input} />
            <p style={{ color: 'var(--muted)', fontSize: 13 }}>{historyOnly ? 'This records the past move in transfer history.' : 'Saving moves the player to the new squad immediately and records the transfer. Past match records stay with their original clubs.'}</p>
            <button type="submit" disabled={saving || !player || !fromTeamId || !newTeamId} style={button}>{saving ? 'Saving…' : historyOnly ? 'Save historical transfer' : 'Transfer player & save history'}</button>
          </fieldset>
        </form>
        <section>
          <h2 style={{ fontSize: 20 }}>Transfer history</h2>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <label style={{ flex: '1 1 200px' }}>Player name<input value={filter} onChange={(e) => { setFilter(e.target.value); setPage(0) }} style={input} placeholder="Filter history…" /></label>
            <label style={{ flex: '1 1 200px' }}>Club<select value={clubFilter} onChange={(e) => { setClubFilter(e.target.value); setPage(0) }} style={input}><option value="">All clubs</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>
          </div>
          <TransferHistory rows={filteredHistory.slice(page * 50, (page + 1) * 50)} showPlayer />
          {filteredHistory.length > 50 && <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
            <button disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page + 1} of {Math.ceil(filteredHistory.length / 50)}</span><button disabled={(page + 1) * 50 >= filteredHistory.length} onClick={() => setPage(page + 1)}>Next</button>
          </div>}
        </section>
      </>}
    </div>
  )
}
const label = { display: 'block', fontWeight: 700, fontSize: 13, marginBottom: 6 }
const input = { width: '100%', boxSizing: 'border-box', padding: '11px 12px', border: '1px solid var(--line)', borderRadius: 6, margin: '5px 0 16px', font: 'inherit', color: 'var(--ink)', background: '#fff' }
const button = { background: 'var(--pitch)', color: '#fff', padding: '12px 18px', border: 0, borderRadius: 6, fontWeight: 800, cursor: 'pointer' }
