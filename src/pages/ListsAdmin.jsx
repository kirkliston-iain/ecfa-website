import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'

function ListSection({ title, table, isAdmin }) {
  const [items, setItems] = useState([])
  const [newName, setNewName] = useState('')

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const { data } = await supabase.from(table).select('id, name').order('name')
    setItems(data || [])
  }

  async function add() {
    if (!newName.trim()) return
    await supabase.from(table).insert({ name: newName.trim() })
    setNewName('')
    load()
  }

  async function remove(id) {
    await supabase.from(table).delete().eq('id', id)
    load()
  }

  return (
    <div style={{ marginBottom: 32 }}>
      <h2 style={{ fontSize: 15, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--brass)', marginBottom: 12 }}>
        {title}
      </h2>
      {items.map((item) => (
        <div
          key={item.id}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '10px 0',
            borderBottom: '1px solid var(--line)',
            fontSize: 14,
          }}
        >
          <span>{item.name}</span>
          {isAdmin && (
            <button onClick={() => remove(item.id)} style={smallOutlineStyle}>
              Remove
            </button>
          )}
        </div>
      ))}
      {isAdmin && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <input
            placeholder={`Add ${title.toLowerCase().slice(0, -1)}`}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            style={{ ...fullSelectStyle, flex: 1 }}
          />
          <button onClick={add} style={smallButtonStyle}>
            Add
          </button>
        </div>
      )}
    </div>
  )
}

export default function ListsAdmin() {
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    supabase
      .from('admin_profiles')
      .select('id')
      .maybeSingle()
      .then(({ data }) => setIsAdmin(!!data))
  }, [])

  return (
    <div className="container" style={{ padding: '24px 16px', maxWidth: 480 }}>
      <Link to="/admin/dashboard" style={{ fontSize: 13, color: 'var(--brass)', display: 'block', marginBottom: 16 }}>
        &larr; Back to admin
      </Link>
      <h1 style={{ fontSize: 22, color: 'var(--pitch)', marginBottom: 20 }}>Referees & Venues</h1>
      <ListSection title="Referees" table="referees" isAdmin={isAdmin} />
      <ListSection title="Venues" table="venues" isAdmin={isAdmin} />
    </div>
  )
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
  padding: '8px 14px',
  background: 'var(--ink)',
  color: '#fff',
  border: 'none',
  fontSize: 13,
  borderRadius: 6,
  cursor: 'pointer',
  flexShrink: 0,
}
const smallOutlineStyle = {
  padding: '6px 10px',
  background: 'none',
  color: 'var(--ink)',
  border: '1px solid var(--line)',
  fontSize: 12,
  borderRadius: 6,
  cursor: 'pointer',
}
