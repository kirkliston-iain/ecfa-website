import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function TeamWebsitesAdmin() {
  const [teams, setTeams] = useState([])
  const [teamId, setTeamId] = useState('')
  const [label, setLabel] = useState('')
  const [url, setUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function loadTeams() {
    const { data, error: loadError } = await supabase.from('teams')
      .select('id, name, team_website_url, team_website_label').order('name')
    if (loadError) setError(loadError.message)
    else setTeams(data || [])
  }

  useEffect(() => { loadTeams() }, [])

  function chooseTeam(id) {
    const team = teams.find((row) => row.id === id)
    setTeamId(id)
    setLabel(team?.team_website_label || team?.name || '')
    setUrl(team?.team_website_url || '')
    setMessage('')
    setError('')
  }

  async function updateWebsite(nextUrl) {
    const team = teams.find((row) => row.id === teamId)
    if (!team || saving) return
    if (nextUrl) {
      try {
        const parsed = new URL(nextUrl)
        if (parsed.protocol !== 'https:' || !parsed.hostname) throw new Error()
      } catch {
        setError('Enter a full HTTPS website address, for example https://example.org/')
        return
      }
    }

    setSaving(true)
    setError('')
    setMessage('')
    const { data, error: saveError } = await supabase.from('teams').update({
      team_website_url: nextUrl || null,
      team_website_label: nextUrl ? label.trim() || team.name : null,
    }).eq('id', teamId).select('id')
    setSaving(false)
    if (saveError || !data?.length) {
      setError(saveError?.message || 'The website could not be saved. Check your admin access and try again.')
      return
    }
    setMessage(nextUrl ? 'Team website saved.' : 'Team website removed.')
    if (!nextUrl) {
      setUrl('')
      setLabel(team.name)
    }
    await loadTeams()
  }

  return <div className="container" style={{ padding: '32px 20px 48px', maxWidth: 720 }}>
    <Link to="/admin/dashboard" style={{ color: 'var(--brass)', fontWeight: 700 }}>← Back to admin</Link>
    <h1 style={{ fontSize: 27, margin: '20px 0 6px' }}>Manage team websites</h1>
    <p style={{ color: 'var(--muted)', lineHeight: 1.5 }}>Add a club’s website here to show it in Team websites and on the club’s team page. Link clicks are recorded in the existing website audit.</p>

    <label style={labelStyle}>Team
      <select value={teamId} onChange={(event) => chooseTeam(event.target.value)} style={fieldStyle}>
        <option value="">Select a team…</option>
        {teams.map((team) => <option key={team.id} value={team.id}>{team.name}{team.team_website_url ? ' — website added' : ''}</option>)}
      </select>
    </label>

    {teamId && <div style={{ display: 'grid', gap: 16, marginTop: 20 }}>
      <label style={labelStyle}>Name shown in Team websites
        <input value={label} onChange={(event) => setLabel(event.target.value)} style={fieldStyle} placeholder="Team name" />
      </label>
      <label style={labelStyle}>Website address
        <input type="url" inputMode="url" value={url} onChange={(event) => setUrl(event.target.value)} style={fieldStyle} placeholder="https://example.org/" />
      </label>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button type="button" disabled={saving} onClick={() => updateWebsite(url.trim())} style={buttonStyle}>{saving ? 'Saving…' : 'Save website'}</button>
        {teams.find((team) => team.id === teamId)?.team_website_url && <button type="button" disabled={saving} onClick={() => updateWebsite('')} style={{ ...buttonStyle, background: '#fff', color: 'var(--ink)', border: '1px solid var(--line)' }}>Remove website</button>}
      </div>
    </div>}

    {error && <p role="alert" style={{ color: '#b3261e', fontWeight: 700 }}>{error}</p>}
    {message && <p role="status" style={{ color: '#1b6e3c', fontWeight: 700 }}>{message}</p>}
  </div>
}

const labelStyle = { display: 'grid', gap: 6, fontSize: 14, fontWeight: 700 }
const fieldStyle = { width: '100%', boxSizing: 'border-box', padding: '12px 14px', border: '1px solid var(--line)', borderRadius: 7, background: '#fff', color: 'var(--ink)', fontSize: 15 }
const buttonStyle = { padding: '11px 18px', border: 0, borderRadius: 7, background: 'var(--ink)', color: '#fff', fontWeight: 700, cursor: 'pointer' }
