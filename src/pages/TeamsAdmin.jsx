import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import * as XLSX from 'xlsx'

function displayDateOfBirth(value) {
  if (!value) return ''
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export default function TeamsAdmin() {
  const [teams, setTeams] = useState([])
  const [selectedTeamId, setSelectedTeamId] = useState('')
  const [squad, setSquad] = useState([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [newFirstName, setNewFirstName] = useState('')
  const [newLastName, setNewLastName] = useState('')
  const [newDateOfBirth, setNewDateOfBirth] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editFirstName, setEditFirstName] = useState('')
  const [editLastName, setEditLastName] = useState('')
  const [editDateOfBirth, setEditDateOfBirth] = useState('')
  const [privateMessage, setPrivateMessage] = useState('')
  const [privateError, setPrivateError] = useState('')
  const [exportTeamId, setExportTeamId] = useState('all')
  const [exporting, setExporting] = useState(false)
  const [exportMessage, setExportMessage] = useState('')
  const [exportError, setExportError] = useState('')

  useEffect(() => {
    supabase
      .from('teams')
      .select('id, name')
      .order('name')
      .then(({ data }) => setTeams(data || []))

    supabase
      .from('admin_profiles')
      .select('id')
      .maybeSingle()
      .then(({ data }) => setIsAdmin(!!data))
  }, [])

  useEffect(() => {
    if (selectedTeamId) loadSquad(selectedTeamId)
  }, [selectedTeamId, isAdmin])

  async function loadSquad(teamId) {
    const { data: players } = await supabase
      .from('players')
      .select('id, first_name, last_name')
      .eq('team_id', teamId)
      .order('last_name')

    const squadPlayers = players || []
    if (!isAdmin || squadPlayers.length === 0) {
      setSquad(squadPlayers)
      return
    }

    const { data: privateRows } = await supabase
      .from('player_private_details')
      .select('player_id, date_of_birth')
      .in('player_id', squadPlayers.map((player) => player.id))

    const birthDates = new Map((privateRows || []).map((row) => [row.player_id, row.date_of_birth]))
    setSquad(squadPlayers.map((player) => ({
      ...player,
      date_of_birth: birthDates.get(player.id) || '',
    })))
  }

  async function addPlayer() {
    if (!newFirstName.trim() || !newLastName.trim()) return
    setPrivateMessage('')
    setPrivateError('')

    const { data: player, error: playerError } = await supabase
      .from('players')
      .insert({
        first_name: newFirstName.trim(),
        last_name: newLastName.trim(),
        team_id: selectedTeamId,
      })
      .select('id')
      .single()

    if (playerError || !player) {
      setPrivateError('The player could not be added. Please try again.')
      return
    }

    let birthDateFailed = false
    if (newDateOfBirth) {
      const { error: birthDateError } = await supabase
        .from('player_private_details')
        .insert({ player_id: player.id, date_of_birth: newDateOfBirth })
      birthDateFailed = !!birthDateError
    }

    setNewFirstName('')
    setNewLastName('')
    setNewDateOfBirth('')
    if (birthDateFailed) {
      setPrivateError('The player was added, but the date of birth could not be saved.')
    } else {
      setPrivateMessage(newDateOfBirth ? 'Player and private date of birth saved.' : 'Player added.')
    }
    loadSquad(selectedTeamId)
  }

  function startEdit(p) {
    setEditingId(p.id)
    setEditFirstName(p.first_name)
    setEditLastName(p.last_name)
    setEditDateOfBirth(p.date_of_birth || '')
    setPrivateMessage('')
    setPrivateError('')
  }

  async function saveEdit() {
    setPrivateMessage('')
    setPrivateError('')

    const { error: playerError } = await supabase
      .from('players')
      .update({ first_name: editFirstName.trim(), last_name: editLastName.trim() })
      .eq('id', editingId)

    if (playerError) {
      setPrivateError('The player details could not be saved.')
      return
    }

    const privateResult = editDateOfBirth
      ? await supabase
          .from('player_private_details')
          .upsert({
            player_id: editingId,
            date_of_birth: editDateOfBirth,
            updated_at: new Date().toISOString(),
          })
      : await supabase
          .from('player_private_details')
          .delete()
          .eq('player_id', editingId)

    if (privateResult.error) {
      setPrivateError('The name was saved, but the private date of birth could not be updated.')
      return
    }

    setEditingId(null)
    setPrivateMessage('Player details saved.')
    loadSquad(selectedTeamId)
  }

  async function removeFromSquad(playerId) {
    // Removing from the squad — not deleting the player record, since they may
    // have historic goals/cards attached. Just detach from this team.
    await supabase.from('players').update({ team_id: null }).eq('id', playerId)
    loadSquad(selectedTeamId)
  }


  function safeSheetName(name, index) {
    const prefix = String(index + 1).padStart(2, '0')
    const cleaned = String(name || 'Team').replace(/[\\/?*\[\]:]/g, '').trim()
    return `${prefix} ${cleaned}`.slice(0, 31)
  }

  function fileSlug(name) {
    return String(name || 'squad')
      .toLocaleLowerCase('en-GB')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }

  function addSquadSheet(workbook, sheetName, players, teamName, includeTeam) {
    const header = includeTeam
      ? ['Team', 'First name', 'Surname', 'Full name']
      : ['First name', 'Surname', 'Full name']
    const rows = players.map((player) => {
      const fullName = [player.first_name, player.last_name].filter(Boolean).join(' ')
      return includeTeam
        ? [teamName, player.first_name, player.last_name, fullName]
        : [player.first_name, player.last_name, fullName]
    })
    const worksheet = XLSX.utils.aoa_to_sheet([header, ...rows])
    worksheet['!cols'] = includeTeam
      ? [{ wch: 36 }, { wch: 20 }, { wch: 24 }, { wch: 36 }]
      : [{ wch: 20 }, { wch: 24 }, { wch: 36 }]
    worksheet['!autofilter'] = { ref: worksheet['!ref'] || `A1:${includeTeam ? 'D' : 'C'}1` }
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
  }

  async function exportSquads() {
    setExporting(true)
    setExportMessage('')
    setExportError('')

    let query = supabase
      .from('players')
      .select('id, first_name, last_name, team_id')
      .not('team_id', 'is', null)
      .order('last_name')
      .order('first_name')

    if (exportTeamId !== 'all') query = query.eq('team_id', exportTeamId)

    const { data, error } = await query
    if (error) {
      setExportError('The squad list could not be loaded. Please try again.')
      setExporting(false)
      return
    }

    const players = data || []
    const workbook = XLSX.utils.book_new()
    workbook.Props = {
      Title: exportTeamId === 'all' ? 'ECFA squad lists' : 'ECFA squad list',
      Subject: 'Current team squad lists',
      Author: 'Edinburgh Churches Football Association',
      CreatedDate: new Date(),
    }

    if (exportTeamId === 'all') {
      const teamById = new Map(teams.map((team) => [team.id, team]))
      const combinedPlayers = players
        .map((player) => ({ ...player, team_name: teamById.get(player.team_id)?.name || 'Unknown team' }))
        .sort((a, b) =>
          a.team_name.localeCompare(b.team_name, 'en-GB')
          || a.last_name.localeCompare(b.last_name, 'en-GB')
          || a.first_name.localeCompare(b.first_name, 'en-GB')
        )

      const combinedRows = combinedPlayers.map((player) => ({
        first_name: player.first_name,
        last_name: player.last_name,
        team_name: player.team_name,
      }))
      addSquadSheet(
        workbook,
        'All squads',
        combinedRows,
        '',
        true
      )
      const allSheet = workbook.Sheets['All squads']
      XLSX.utils.sheet_add_aoa(
        allSheet,
        [['Team', 'First name', 'Surname', 'Full name'], ...combinedPlayers.map((player) => [
          player.team_name,
          player.first_name,
          player.last_name,
          [player.first_name, player.last_name].filter(Boolean).join(' '),
        ])],
        { origin: 'A1' }
      )

      teams.forEach((team, index) => {
        const teamPlayers = players
          .filter((player) => player.team_id === team.id)
          .sort((a, b) =>
            a.last_name.localeCompare(b.last_name, 'en-GB')
            || a.first_name.localeCompare(b.first_name, 'en-GB')
          )
        addSquadSheet(workbook, safeSheetName(team.name, index), teamPlayers, team.name, false)
      })

      XLSX.writeFile(workbook, 'ecfa-all-squad-lists.xlsx', { compression: true })
      setExportMessage(`Exported ${players.length} players across ${teams.length} teams.`)
    } else {
      const team = teams.find((item) => item.id === exportTeamId)
      const orderedPlayers = [...players].sort((a, b) =>
        a.last_name.localeCompare(b.last_name, 'en-GB')
        || a.first_name.localeCompare(b.first_name, 'en-GB')
      )
      addSquadSheet(workbook, 'Squad list', orderedPlayers, team?.name || 'Team', false)
      XLSX.writeFile(workbook, `ecfa-${fileSlug(team?.name)}-squad.xlsx`, { compression: true })
      setExportMessage(`Exported ${orderedPlayers.length} players for ${team?.name || 'the selected team'}.`)
    }

    setExporting(false)
  }

  return (
    <div className="container" style={{ padding: '24px 16px', maxWidth: 480 }}>
      <Link to="/admin/dashboard" style={{ fontSize: 13, color: 'var(--brass)', display: 'block', marginBottom: 16 }}>
        &larr; Back to admin
      </Link>
      <h1 style={{ fontSize: 22, color: 'var(--pitch)', marginBottom: 20 }}>Manage Squads</h1>

      <section style={{ ...cardStyle, marginBottom: 20, background: '#fafafa' }}>
        <div style={{ fontWeight: 800, marginBottom: 5 }}>Export squad lists</div>
        <p style={{ color: 'var(--muted)', fontSize: 13, margin: '0 0 12px' }}>
          Download an Excel workbook for every team or one selected team.
        </p>
        <select
          value={exportTeamId}
          onChange={(e) => {
            setExportTeamId(e.target.value)
            setExportMessage('')
            setExportError('')
          }}
          style={{ ...fullSelectStyle, marginBottom: 10 }}
        >
          <option value="all">All teams</option>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>{team.name}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={exportSquads}
          disabled={exporting || teams.length === 0}
          style={{ ...smallButtonStyle, width: '100%', opacity: exporting ? 0.65 : 1 }}
        >
          {exporting ? 'Preparing Excel file…' : 'Download Excel'}
        </button>
        {exportMessage && <div style={{ color: '#176B3A', fontSize: 13, fontWeight: 700, marginTop: 10 }}>{exportMessage}</div>}
        {exportError && <div style={{ color: '#B3261E', fontSize: 13, fontWeight: 700, marginTop: 10 }}>{exportError}</div>}
      </section>

      <select
        value={selectedTeamId}
        onChange={(e) => setSelectedTeamId(e.target.value)}
        style={{ ...fullSelectStyle, marginBottom: 20 }}
      >
        <option value="">Select team…</option>
        {teams.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>

      {selectedTeamId && (
        <>
          <div style={{ marginBottom: 20 }}>
            {squad.map((p) => (
              <div key={p.id} style={cardStyle}>
                {editingId === p.id ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <input
                      value={editFirstName}
                      onChange={(e) => setEditFirstName(e.target.value)}
                      style={fullSelectStyle}
                      placeholder="First name"
                    />
                    <input
                      value={editLastName}
                      onChange={(e) => setEditLastName(e.target.value)}
                      style={fullSelectStyle}
                      placeholder="Last name"
                    />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={saveEdit} style={{ ...smallButtonStyle, flex: 1 }}>
                        Save
                      </button>
                      <button onClick={() => setEditingId(null)} style={{ ...smallOutlineStyle, flex: 1 }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ flex: 1, fontWeight: 600 }}>
                      {p.first_name} {p.last_name}
                    </span>
                    {isAdmin && (
                      <>
                        <button onClick={() => startEdit(p)} style={{ ...smallOutlineStyle, padding: '6px 10px' }}>
                          Edit
                        </button>
                        <button
                          onClick={() => removeFromSquad(p.id)}
                          style={{ ...smallOutlineStyle, padding: '6px 10px' }}
                        >
                          Remove
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
            {squad.length === 0 && (
              <p style={{ color: 'var(--muted)', fontSize: 14 }}>No players in this squad yet.</p>
            )}
          </div>

          {isAdmin && (
            <div style={cardStyle}>
              <div style={{ fontWeight: 600, marginBottom: 10, fontSize: 14 }}>Add player</div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input
                  placeholder="First name"
                  value={newFirstName}
                  onChange={(e) => setNewFirstName(e.target.value)}
                  style={{ ...fullSelectStyle, flex: 1 }}
                />
                <input
                  placeholder="Last name"
                  value={newLastName}
                  onChange={(e) => setNewLastName(e.target.value)}
                  style={{ ...fullSelectStyle, flex: 1 }}
                />
              </div>
              <button onClick={addPlayer} style={{ ...smallButtonStyle, width: '100%' }}>
                Add to squad
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

const cardStyle = {
  border: '1px solid var(--line)',
  borderRadius: 8,
  padding: 14,
  marginBottom: 10,
}
const fullSelectStyle = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 10px',
  border: '1px solid var(--line)',
  fontSize: 14,
  borderRadius: 6,
}
const smallButtonStyle = {
  padding: '8px 10px',
  background: 'var(--ink)',
  color: '#fff',
  border: 'none',
  fontSize: 13,
  borderRadius: 6,
  cursor: 'pointer',
}
const smallOutlineStyle = {
  padding: '8px 10px',
  background: 'none',
  color: 'var(--ink)',
  border: '1px solid var(--line)',
  fontSize: 13,
  borderRadius: 6,
  cursor: 'pointer',
}
