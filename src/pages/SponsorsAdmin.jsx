import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'

const emptyForm = {
  name: '', summary: '', websiteUrl: '', competitionName: '', competitionPath: '', sortOrder: 50, published: true,
}

const emptyFundraiser = {
  teamName: '', title: '', summary: '', fundraiserUrl: '', season: '2026/27', amountRaisedText: '', sortOrder: 50, published: true,
}

function safeFileName(name) {
  return name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '')
}

export default function SponsorsAdmin() {
  const [sponsors, setSponsors] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [logo, setLogo] = useState(null)
  const [fundraisers, setFundraisers] = useState([])
  const [fundraiserForm, setFundraiserForm] = useState(emptyFundraiser)
  const [working, setWorking] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => { loadSponsors(); loadFundraisers() }, [])

  async function loadSponsors() {
    const { data, error: loadError } = await supabase.from('sponsors').select('*').order('sort_order').order('name')
    if (loadError) setError(loadError.message)
    else setSponsors(data || [])
  }

  async function loadFundraisers() {
    const { data, error: loadError } = await supabase.from('team_fundraisers').select('*').order('sort_order').order('team_name')
    if (loadError) setError(loadError.message)
    else setFundraisers(data || [])
  }

  async function addSponsor(event) {
    event.preventDefault()
    setError('')
    setMessage('')
    if (!form.name.trim() || !form.summary.trim()) {
      setError('Add the sponsor name and a short description.')
      return
    }
    if (!logo) {
      setError('Choose a sponsor logo.')
      return
    }
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'].includes(logo.type) || logo.size > 5 * 1024 * 1024) {
      setError('Use a PNG, JPG, WebP or SVG logo no larger than 5 MB.')
      return
    }

    setWorking(true)
    const logoPath = `${crypto.randomUUID()}-${safeFileName(logo.name)}`
    const { error: uploadError } = await supabase.storage.from('sponsor-logos').upload(logoPath, logo, { contentType: logo.type })
    if (uploadError) {
      setError(uploadError.message)
      setWorking(false)
      return
    }
    const { data: publicLogo } = supabase.storage.from('sponsor-logos').getPublicUrl(logoPath)
    const { error: rowError } = await supabase.from('sponsors').insert({
      name: form.name.trim(),
      summary: form.summary.trim(),
      website_url: form.websiteUrl.trim() || null,
      logo_url: publicLogo.publicUrl,
      logo_path: logoPath,
      competition_name: form.competitionName.trim() || null,
      competition_path: form.competitionName.trim() ? form.competitionPath.trim() || null : null,
      sort_order: Number(form.sortOrder) || 50,
      is_published: form.published,
    })
    if (rowError) {
      await supabase.storage.from('sponsor-logos').remove([logoPath])
      setError(rowError.message)
    } else {
      setForm(emptyForm)
      setLogo(null)
      event.currentTarget.reset()
      setMessage('Sponsor saved.')
      loadSponsors()
    }
    setWorking(false)
  }

  async function updateSponsor(id, values) {
    setError('')
    const { error: updateError } = await supabase.from('sponsors').update(values).eq('id', id)
    if (updateError) setError(updateError.message)
    else {
      setMessage('Sponsor updated.')
      loadSponsors()
    }
  }

  async function deleteSponsor(item) {
    if (!window.confirm(`Delete “${item.name}”?`)) return
    if (item.logo_path) await supabase.storage.from('sponsor-logos').remove([item.logo_path])
    const { error: deleteError } = await supabase.from('sponsors').delete().eq('id', item.id)
    if (deleteError) setError(deleteError.message)
    else {
      setMessage('Sponsor deleted.')
      loadSponsors()
    }
  }

  async function addFundraiser(event) {
    event.preventDefault()
    setError('')
    setMessage('')
    if (!fundraiserForm.teamName.trim() || !fundraiserForm.title.trim() || !fundraiserForm.summary.trim()) {
      setError('Add the team name, fundraiser title and a short description.')
      return
    }
    setWorking(true)
    const { error: rowError } = await supabase.from('team_fundraisers').insert({
      team_name: fundraiserForm.teamName.trim(),
      title: fundraiserForm.title.trim(),
      summary: fundraiserForm.summary.trim(),
      fundraiser_url: fundraiserForm.fundraiserUrl.trim() || null,
      season: fundraiserForm.season.trim(),
      amount_raised_text: fundraiserForm.amountRaisedText.trim() || null,
      sort_order: Number(fundraiserForm.sortOrder) || 50,
      is_published: fundraiserForm.published,
    })
    if (rowError) setError(rowError.message)
    else {
      setFundraiserForm(emptyFundraiser)
      setMessage('Team fundraiser saved.')
      event.currentTarget.reset()
      loadFundraisers()
    }
    setWorking(false)
  }

  async function updateFundraiser(id, values) {
    setError('')
    const { error: updateError } = await supabase.from('team_fundraisers').update(values).eq('id', id)
    if (updateError) setError(updateError.message)
    else {
      setMessage('Team fundraiser updated.')
      loadFundraisers()
    }
  }

  async function deleteFundraiser(item) {
    if (!window.confirm(`Delete “${item.title}”?`)) return
    const { error: deleteError } = await supabase.from('team_fundraisers').delete().eq('id', item.id)
    if (deleteError) setError(deleteError.message)
    else {
      setMessage('Team fundraiser deleted.')
      loadFundraisers()
    }
  }

  return (
    <div className="container" style={{ padding: '28px 20px 48px', maxWidth: 720 }}>
      <Link to="/admin/dashboard" style={backStyle}>&larr; Back to admin</Link>
      <h1 style={{ fontSize: 26, marginBottom: 6 }}>Manage sponsors</h1>
      <p style={{ color: 'var(--muted)', marginTop: 0 }}>Add competition sponsors or general sponsors of the league. Lower display numbers appear first.</p>
      {error && <div role="alert" style={errorStyle}>{error}</div>}
      {message && <div role="status" style={successStyle}>{message}</div>}

      <form onSubmit={addSponsor} style={cardStyle}>
        <h2 style={headingStyle}>Add sponsor</h2>
        <label style={labelStyle}>Sponsor name *<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={inputStyle} /></label>
        <label style={labelStyle}>Short description *<textarea required rows={4} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} style={inputStyle} /></label>
        <label style={labelStyle}>Website address<input type="url" value={form.websiteUrl} onChange={(e) => setForm({ ...form, websiteUrl: e.target.value })} placeholder="https://…" style={inputStyle} /></label>
        <label style={labelStyle}>Logo *<input type="file" required accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(e) => setLogo(e.target.files?.[0] || null)} style={inputStyle} /><span style={helpStyle}>PNG, JPG, WebP or SVG · maximum 5 MB</span></label>
        <fieldset style={fieldsetStyle}>
          <legend style={{ fontWeight: 700 }}>Competition link (optional)</legend>
          <p style={helpStyle}>Leave both blank for a general league sponsor.</p>
          <label style={labelStyle}>Competition name<input value={form.competitionName} onChange={(e) => setForm({ ...form, competitionName: e.target.value })} placeholder="e.g. ECFA League Cup" style={inputStyle} /></label>
          <label style={labelStyle}>Competition page<input value={form.competitionPath} onChange={(e) => setForm({ ...form, competitionPath: e.target.value })} placeholder="/competitions/league-cup" style={inputStyle} /></label>
        </fieldset>
        <label style={labelStyle}>Display order<input type="number" min="1" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} style={inputStyle} /><span style={helpStyle}>Appin is 10 and Kwik Fit is 90. Use 20–80 to place a sponsor between them.</span></label>
        <label style={checkStyle}><input type="checkbox" checked={form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })} /> Show on public sponsors page</label>
        <button disabled={working} style={buttonStyle}>{working ? 'Saving…' : 'Add sponsor'}</button>
      </form>

      <h2 style={{ ...headingStyle, marginTop: 30 }}>Current sponsors</h2>
      <div style={{ display: 'grid', gap: 12 }}>
        {sponsors.map((item) => (
          <article key={item.id} style={cardStyle}>
            <div style={{ display: 'grid', gridTemplateColumns: '56px 1fr', gap: 12, alignItems: 'center' }}>
              <img src={item.logo_url} alt="" style={{ width: 56, height: 56, objectFit: 'contain' }} />
              <div><strong>{item.name}</strong><div style={helpStyle}>{item.competition_name || 'General league sponsor'} · order {item.sort_order}</div></div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
              <button type="button" onClick={() => updateSponsor(item.id, { is_published: !item.is_published })} style={outlineButtonStyle}>{item.is_published ? 'Hide' : 'Publish'}</button>
              <button type="button" onClick={() => updateSponsor(item.id, { sort_order: Math.max(1, item.sort_order - 10) })} style={outlineButtonStyle}>Move up</button>
              <button type="button" onClick={() => updateSponsor(item.id, { sort_order: item.sort_order + 10 })} style={outlineButtonStyle}>Move down</button>
              <button type="button" onClick={() => deleteSponsor(item)} style={{ ...outlineButtonStyle, color: '#B3261E', borderColor: '#B3261E' }}>Delete</button>
            </div>
          </article>
        ))}
      </div>

      <hr style={{ border: 0, borderTop: '1px solid var(--line)', margin: '36px 0' }} />
      <h2 style={{ fontSize: 22, marginBottom: 6 }}>Teams’ own fundraisers</h2>
      <p style={{ color: 'var(--muted)', marginTop: 0 }}>Add fundraising organised by an individual ECFA team.</p>

      <form onSubmit={addFundraiser} style={cardStyle}>
        <h3 style={headingStyle}>Add team fundraiser</h3>
        <label style={labelStyle}>Team name *<input required value={fundraiserForm.teamName} onChange={(e) => setFundraiserForm({ ...fundraiserForm, teamName: e.target.value })} style={inputStyle} /></label>
        <label style={labelStyle}>Fundraiser title *<input required value={fundraiserForm.title} onChange={(e) => setFundraiserForm({ ...fundraiserForm, title: e.target.value })} style={inputStyle} /></label>
        <label style={labelStyle}>Short description *<textarea required rows={4} value={fundraiserForm.summary} onChange={(e) => setFundraiserForm({ ...fundraiserForm, summary: e.target.value })} style={inputStyle} /></label>
        <label style={labelStyle}>Fundraiser link<input type="url" value={fundraiserForm.fundraiserUrl} onChange={(e) => setFundraiserForm({ ...fundraiserForm, fundraiserUrl: e.target.value })} placeholder="https://…" style={inputStyle} /></label>
        <label style={labelStyle}>Season *<input required value={fundraiserForm.season} onChange={(e) => setFundraiserForm({ ...fundraiserForm, season: e.target.value })} placeholder="2026/27" style={inputStyle} /></label>
        <label style={labelStyle}>Amount raised<input value={fundraiserForm.amountRaisedText} onChange={(e) => setFundraiserForm({ ...fundraiserForm, amountRaisedText: e.target.value })} placeholder="e.g. Almost £2,000 raised" style={inputStyle} /></label>
        <label style={labelStyle}>Display order<input type="number" min="1" value={fundraiserForm.sortOrder} onChange={(e) => setFundraiserForm({ ...fundraiserForm, sortOrder: e.target.value })} style={inputStyle} /></label>
        <label style={checkStyle}><input type="checkbox" checked={fundraiserForm.published} onChange={(e) => setFundraiserForm({ ...fundraiserForm, published: e.target.checked })} /> Show on public sponsors page</label>
        <button disabled={working} style={buttonStyle}>{working ? 'Saving…' : 'Add team fundraiser'}</button>
      </form>

      <div style={{ display: 'grid', gap: 12, marginTop: 18 }}>
        {fundraisers.map((item) => (
          <article key={item.id} style={cardStyle}>
            <strong>{item.team_name}</strong>
            <div>{item.title}</div>
            <div style={helpStyle}>{item.season}{item.amount_raised_text ? ` · ${item.amount_raised_text}` : ''}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
              <button type="button" onClick={() => updateFundraiser(item.id, { is_published: !item.is_published })} style={outlineButtonStyle}>{item.is_published ? 'Hide' : 'Publish'}</button>
              <button type="button" onClick={() => updateFundraiser(item.id, { sort_order: Math.max(1, item.sort_order - 10) })} style={outlineButtonStyle}>Move up</button>
              <button type="button" onClick={() => updateFundraiser(item.id, { sort_order: item.sort_order + 10 })} style={outlineButtonStyle}>Move down</button>
              <button type="button" onClick={() => deleteFundraiser(item)} style={{ ...outlineButtonStyle, color: '#B3261E', borderColor: '#B3261E' }}>Delete</button>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}

const cardStyle = { border: '1px solid var(--line)', borderRadius: 10, padding: 18, background: '#fff', marginTop: 18 }
const headingStyle = { fontSize: 19, margin: '0 0 14px' }
const labelStyle = { display: 'grid', gap: 6, fontWeight: 700, marginBottom: 14 }
const inputStyle = { width: '100%', boxSizing: 'border-box', padding: 11, border: '1px solid var(--line)', borderRadius: 6, font: 'inherit', fontWeight: 400, background: '#fff' }
const fieldsetStyle = { border: '1px solid var(--line)', borderRadius: 8, padding: 14, margin: '0 0 14px' }
const helpStyle = { color: 'var(--muted)', fontSize: 12, fontWeight: 400, lineHeight: 1.4 }
const checkStyle = { display: 'flex', alignItems: 'center', gap: 9, marginBottom: 16, fontWeight: 700 }
const buttonStyle = { width: '100%', padding: 12, background: '#111', color: '#fff', border: 0, borderRadius: 6, fontWeight: 700, fontSize: 15 }
const outlineButtonStyle = { padding: '9px 12px', background: '#fff', border: '1px solid #111', borderRadius: 6, fontWeight: 700 }
const backStyle = { color: 'var(--brass)', fontWeight: 700 }
const errorStyle = { padding: 12, border: '1px solid #B3261E', color: '#B3261E', borderRadius: 6, marginBottom: 12 }
const successStyle = { padding: 12, border: '1px solid #287A45', color: '#287A45', borderRadius: 6, marginBottom: 12 }
