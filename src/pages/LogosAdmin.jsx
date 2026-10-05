import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { LOGO_BUCKET, logoUploadPath, notifyLogosChanged, validateLogoFile } from '../utils/siteLogos'

const categoryNames = { league: 'League logo', team: 'Team badges', sponsor: 'Sponsor logos', charity: 'Charity logos' }

export default function LogosAdmin() {
  const [targets, setTargets] = useState([])
  const [category, setCategory] = useState('league')
  const [selectedKey, setSelectedKey] = useState('')
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState('')
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const fileInput = useRef(null)

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const results = await Promise.all([
          supabase.from('site_logos').select('id, name, category, logo_url').order('name'),
          supabase.from('teams').select('id, name, logo_url').order('name'),
          supabase.from('sponsors').select('id, name, logo_url').order('name'),
        ])
        if (!active) return
        const failure = results.find((result) => result.error)
        if (failure) throw failure.error
        const rows = [
          ...(results[0].data || []).map((row) => ({ ...row, table: 'site_logos' })),
          ...(results[1].data || []).map((row) => ({ ...row, category: 'team', table: 'teams' })),
          ...(results[2].data || []).map((row) => ({ ...row, category: 'sponsor', table: 'sponsors' })),
        ].map((row) => ({ ...row, key: `${row.table}:${row.id}` }))
        setTargets(rows)
        setSelectedKey(rows.find((row) => row.category === 'league')?.key || '')
      } catch (loadError) {
        if (active) setError(loadError.message || 'Logos could not be loaded. Reload the page and try again.')
      } finally { if (active) setLoading(false) }
    }
    load()
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!file) { setPreview(''); return undefined }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  function resetFile() {
    setFile(null)
    if (fileInput.current) fileInput.current.value = ''
  }
  function chooseCategory(value) {
    setCategory(value)
    setSelectedKey(targets.find((row) => row.category === value)?.key || '')
    resetFile(); setError(''); setMessage('')
  }
  function chooseTarget(value) {
    setSelectedKey(value); resetFile(); setError(''); setMessage('')
  }
  function chooseFile(nextFile) {
    setMessage('')
    const validation = nextFile ? validateLogoFile(nextFile) : ''
    setError(validation)
    setFile(validation ? null : nextFile)
    if (validation && fileInput.current) fileInput.current.value = ''
  }

  const target = targets.find((row) => row.key === selectedKey)

  async function saveLogo(remove = false) {
    if (!target || working) return
    const validation = remove ? '' : validateLogoFile(file)
    if (validation) { setError(validation); return }
    setWorking(true); setError(''); setMessage('')
    let uploadedPath = null
    let assigned = false
    try {
      let url = null
      if (!remove) {
        // Decode before uploading so corrupt or disguised files are rejected.
        const image = new Image()
        image.src = preview
        await image.decode()
        uploadedPath = logoUploadPath(target, file)
        const { error: uploadError } = await supabase.storage.from(LOGO_BUCKET).upload(uploadedPath, file, { contentType: file.type, cacheControl: '31536000', upsert: false })
        if (uploadError) throw uploadError
        url = supabase.storage.from(LOGO_BUCKET).getPublicUrl(uploadedPath).data.publicUrl
      }
      const values = { logo_url: url, logo_path: uploadedPath }
      if (target.table !== 'site_logos') values.logo_bucket = uploadedPath ? LOGO_BUCKET : null
      const { data, error: saveError } = await supabase.from(target.table).update(values).eq('id', target.id).select('id')
      if (saveError || !data?.length) throw saveError || new Error('The logo could not be saved. Check your administrator access and try again.')
      assigned = true
      setTargets((rows) => rows.map((row) => row.key === target.key ? { ...row, logo_url: url } : row))
      resetFile()
      setMessage(`${target.name}: logo ${remove ? 'removed' : 'saved'}.`)
      notifyLogosChanged()
    } catch (saveError) {
      if (uploadedPath && !assigned) {
        // Only discard this new, unassigned upload; existing logos are kept.
        try { await supabase.storage.from(LOGO_BUCKET).remove([uploadedPath]) } catch { /* The original logo remains assigned. */ }
      }
      setError(saveError.message || 'The image could not be saved. Use a valid PNG, JPG or WebP and try again.')
    } finally { setWorking(false) }
  }

  return <div className="container" style={{ padding: '32px 20px 48px', maxWidth: 760 }}>
    <Link to="/admin/dashboard" style={{ color: 'var(--brass)', fontWeight: 700 }}>← Back to admin</Link>
    <h1 style={{ fontSize: 27, margin: '20px 0 6px' }}>Manage logos</h1>
    <p style={{ color: 'var(--muted)', lineHeight: 1.5 }}>Upload, replace or remove the league logo, team badges, sponsor logos and charity logos. Changes appear wherever that logo is used on the website.</p>
    {loading ? <p role="status">Loading logos…</p> : <fieldset disabled={working} style={{ border: 0, padding: 0, margin: 0, minWidth: 0, display: 'grid', gap: 18 }}>
      <label style={labelStyle}>Logo group
        <select value={category} onChange={(event) => chooseCategory(event.target.value)} style={fieldStyle}>
          {Object.entries(categoryNames).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label style={labelStyle}>Choose logo
        <select value={selectedKey} onChange={(event) => chooseTarget(event.target.value)} style={fieldStyle}>
          {!selectedKey && <option value="">Select a logo…</option>}
          {targets.filter((row) => row.category === category).map((row) => <option key={row.key} value={row.key}>{row.name}{row.logo_url ? '' : ' — no logo'}</option>)}
        </select>
      </label>
      {target && <>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          <div><strong>Current logo</strong><div style={previewStyle}>{target.logo_url ? <img src={target.logo_url} alt={`${target.name} current logo`} style={imageStyle} /> : <span style={{ color: 'var(--muted)' }}>No logo</span>}</div></div>
          {preview && <div><strong>New logo preview</strong><div style={previewStyle}><img src={preview} alt={`${target.name} new logo preview`} style={imageStyle} /></div></div>}
        </div>
        {category === 'league' && <p style={{ margin: 0, color: 'var(--muted)', fontSize: 14 }}>The ECFA logo is also used for the browser icon and new home-screen shortcuts. Existing shortcuts may need to be added again to show a replacement.</p>}
        <label style={labelStyle}>Upload a new logo
          <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => chooseFile(event.target.files?.[0] || null)} style={fieldStyle} />
          <span style={{ color: 'var(--muted)', fontSize: 13, fontWeight: 400 }}>PNG, JPG or WebP · maximum 5 MB. Square images work best for team badges and the league logo.</span>
        </label>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" disabled={!file || working} onClick={() => saveLogo()} style={buttonStyle}>{working ? 'Saving…' : target.logo_url ? 'Replace logo' : 'Upload logo'}</button>
          {target.logo_url && <button type="button" onClick={() => saveLogo(true)} style={{ ...buttonStyle, background: '#fff', color: '#b3261e', border: '1px solid #b3261e' }}>Remove logo</button>}
        </div>
        <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13 }}>Removing a logo only removes its image from the site. The team, sponsor or charity information remains.</p>
      </>}
    </fieldset>}
    {error && <p role="alert" style={{ color: '#b3261e', fontWeight: 700 }}>{error}</p>}
    {message && <p role="status" style={{ color: '#1b6e3c', fontWeight: 700 }}>{message}</p>}
  </div>
}

const labelStyle = { display: 'grid', gap: 6, fontSize: 14, fontWeight: 700 }
const fieldStyle = { width: '100%', boxSizing: 'border-box', padding: '12px 14px', border: '1px solid var(--line)', borderRadius: 7, background: '#fff', color: 'var(--ink)', fontSize: 15 }
const buttonStyle = { padding: '11px 18px', border: 0, borderRadius: 7, background: 'var(--ink)', color: '#fff', fontWeight: 700, cursor: 'pointer' }
const previewStyle = { width: 160, height: 160, marginTop: 8, padding: 12, border: '1px solid var(--line)', borderRadius: 8, background: '#f4f4f4', display: 'flex', alignItems: 'center', justifyContent: 'center' }
const imageStyle = { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }
