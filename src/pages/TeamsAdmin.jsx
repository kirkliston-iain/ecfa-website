import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function TeamsAdmin() {
  const [teams, setTeams] = useState([])
  const [selectedTeamId, setSelectedTeamId] = useState('')
  const [squad, setSquad] = useState([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [newFirstName, setNewFirstName] = useState('')
  const [newLastName, setNewLastName] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editFirstName, setEditFirstName] = useState('')
  const [editLastName, setEditLastName] = useState('')

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
  }, [selectedTeamId])

  async function loadSquad(teamId) {
    const { data } = await supabase
      .from('players')
      .select('id, first_name, last_name')
      .eq('team_id', teamId)
      .order('last_name')
    setSquad(data || [])
  }

  async function addPlayer() {
    if (!newFirstName.trim() || !newLastName.trim()) return
    await supabase.from('players').insert({
      first_name: newFirstName.trim(),
      last_name: newLastName.trim(),
      team_id: selectedTeamId,
    })
    setNewFirstName('')
    setNewLastName('')
    loadSquad(selectedTeamId)
  }

  function startEdit(p) {
    setEditingId(p.id)
    setEditFirstName(p.first_name)
    setEditLastName(p.last_name)
  }

  async function saveEdit() {
    await supabase
      .from('players')
      .update({ first_name: editFirstName.trim(), last_name: editLastName.trim() })
      .eq('id', editingId)
    setEditingId(null)
    loadSquad(selectedTeamId)
  }

  async function removeFromSquad(playerId) {
    // Removing from the squad — not deleting the player record, since they may
    // have historic goals/cards attached. Just detach from this team.
    await supabase.from('players').update({ team_id: null }).eq('id', playerId)
    loadSquad(selectedTeamId)
  }

  return (
    <div className="container" style={{ padding: '24px 16px', maxWidth: 480 }}>
      <Link to="/admin/dashboard" style={{ fontSize: 13, color: 'var(--brass)', display: 'block', marginBottom: 16 }}>
        &larr; Back to admin
      </Link>
      <h1 style={{ fontSize: 22, color: 'var(--pitch)', marginBottom: 20 }}>Manage Squads</h1>

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
