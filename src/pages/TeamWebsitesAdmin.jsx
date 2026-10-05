import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { MAX_TEAM_LINKS, TEAM_LINK_TYPES, isValidTeamLinkUrl, websitesForTeam } from '../utils/teamWebsites'

const blankLink = () => ({ type: 'Own Website', url: '' })

export default function TeamWebsitesAdmin() {
  const [teams, setTeams] = useState([])
  const [teamId, setTeamId] = useState('')
  const [label, setLabel] = useState('')
  const [links, setLinks] = useState([])
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    supabase.from('teams').select('id, name, team_website_url, team_website_label, team_website_links').order('name')
      .then(({ data, error: loadError }) => {
        if (!active) return
        if (loadError) setError(loadError.message)
        else setTeams(data || [])
      })
      .catch(() => { if (active) setError('Teams could not be loaded. Check your connection and reload this page.') })
    return () => { active = false }
  }, [])

  function chooseTeam(id) {
    const team = teams.find((row) => row.id === id)
    const savedLinks = websitesForTeam(team).map(({ type, url }) => ({ type, url }))
    setTeamId(id)
    setLabel(team?.team_website_label || team?.name || '')
    setLinks(savedLinks.length ? savedLinks : [blankLink()])
    setMessage('')
    setError('')
  }

  function changeLinks(nextLinks) {
    setLinks(nextLinks)
    setMessage('')
    setError('')
  }

  async function saveWebsites(event) {
    event.preventDefault()
    const team = teams.find((row) => row.id === teamId)
    if (!team || saving) return
    const nextLinks = links.map(({ type, url }) => ({ type, url: url.trim() })).filter((link) => link.url)
    if (nextLinks.some((link) => !TEAM_LINK_TYPES.includes(link.type) || !isValidTeamLinkUrl(link.url))) {
      setError('Enter a full HTTPS address for each link, for example https://example.org/. Addresses cannot contain spaces or login details.')
      return
    }
    if (nextLinks.length > MAX_TEAM_LINKS) {
      setError(`A team can have a maximum of ${MAX_TEAM_LINKS} links.`)
      return
    }
    nextLinks.forEach((link) => { link.url = new URL(link.url).href })

    setSaving(true)
    setError('')
    setMessage('')
    const values = {
      team_website_links: nextLinks,
      team_website_url: nextLinks[0]?.url || null,
      team_website_label: nextLinks.length ? label.trim() || team.name : null,
    }
    try {
      const { data, error: saveError } = await supabase.from('teams').update(values).eq('id', teamId).select('id')
      if (saveError || !data?.length) {
        setError(saveError?.message || 'The links could not be saved. Check your admin access and try again.')
        return
      }
      setTeams((rows) => rows.map((row) => row.id === teamId ? { ...row, ...values } : row))
      setLinks(nextLinks.length ? nextLinks : [blankLink()])
      setMessage(nextLinks.length ? 'Team links saved.' : 'All team links removed.')
    } catch {
      setError('The links could not be saved. Check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  return <div className="container" style={{ padding: '32px 20px 48px', maxWidth: 720 }}>
    <Link to="/admin/dashboard" style={{ color: 'var(--brass)', fontWeight: 700 }}>← Back to admin</Link>
    <h1 style={{ fontSize: 27, margin: '20px 0 6px' }}>Manage team websites</h1>
    <p style={{ color: 'var(--muted)', lineHeight: 1.5 }}>Add up to five website or social media links per team. They appear in Team websites and on the club’s team page. Link clicks are recorded in the existing website audit.</p>

    <label style={labelStyle}>Team
      <select value={teamId} disabled={saving} onChange={(event) => chooseTeam(event.target.value)} style={fieldStyle}>
        <option value="">Select a team…</option>
        {teams.map((team) => {
          const count = websitesForTeam(team).length
          return <option key={team.id} value={team.id}>{team.name}{count ? ` — ${count} ${count === 1 ? 'link' : 'links'} added` : ''}</option>
        })}
      </select>
    </label>

    {teamId && <form onSubmit={saveWebsites} style={{ display: 'grid', gap: 16, marginTop: 20 }}>
      <fieldset disabled={saving} style={{ border: 0, padding: 0, margin: 0, minWidth: 0, display: 'grid', gap: 16 }}>
        <label style={labelStyle}>Name shown in Team websites
          <input value={label} onChange={(event) => { setLabel(event.target.value); setMessage('') }} style={fieldStyle} placeholder="Team name" />
        </label>
        <p style={{ margin: 0, color: 'var(--muted)', fontSize: 14 }}>{links.length} of {MAX_TEAM_LINKS} link slots in use. Empty addresses are not saved. Remove a link, then save to apply the removal.</p>
        {links.map((link, index) => <fieldset key={index} style={{ border: '1px solid var(--line)', borderRadius: 7, padding: 14, margin: 0, minWidth: 0, display: 'grid', gap: 12 }}>
          <legend style={{ fontWeight: 700, padding: '0 6px' }}>Link {index + 1}</legend>
          <label style={labelStyle}>Link heading
            <select value={link.type} onChange={(event) => changeLinks(links.map((row, i) => i === index ? { ...row, type: event.target.value } : row))} style={fieldStyle}>
              {TEAM_LINK_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </label>
          <label style={labelStyle}>Website address
            <input type="url" inputMode="url" value={link.url} onChange={(event) => changeLinks(links.map((row, i) => i === index ? { ...row, url: event.target.value } : row))} style={fieldStyle} placeholder="https://example.org/" />
          </label>
          <button type="button" aria-label={`Remove link ${index + 1}`} onClick={() => changeLinks(links.filter((_, i) => i !== index))} style={{ ...secondaryButtonStyle, justifySelf: 'start' }}>Remove link</button>
        </fieldset>)}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {links.length < MAX_TEAM_LINKS && <button type="button" onClick={() => changeLinks([...links, blankLink()])} style={secondaryButtonStyle}>Add another link</button>}
          <button type="submit" style={buttonStyle}>{saving ? 'Saving…' : 'Save team links'}</button>
        </div>
      </fieldset>
    </form>}

    {error && <p role="alert" style={{ color: '#b3261e', fontWeight: 700 }}>{error}</p>}
    {message && <p role="status" style={{ color: '#1b6e3c', fontWeight: 700 }}>{message}</p>}
  </div>
}

const labelStyle = { display: 'grid', gap: 6, fontSize: 14, fontWeight: 700 }
const fieldStyle = { width: '100%', boxSizing: 'border-box', padding: '12px 14px', border: '1px solid var(--line)', borderRadius: 7, background: '#fff', color: 'var(--ink)', fontSize: 15 }
const buttonStyle = { padding: '11px 18px', border: 0, borderRadius: 7, background: 'var(--ink)', color: '#fff', fontWeight: 700, cursor: 'pointer' }
const secondaryButtonStyle = { ...buttonStyle, background: '#fff', color: 'var(--ink)', border: '1px solid var(--line)' }
