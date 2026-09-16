import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'

const MAX_FILE_SIZE = 25 * 1024 * 1024
const ACCEPTED_TYPES = '.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip,.jpg,.jpeg,.png'

function readableSize(bytes) {
  if (!bytes) return '0 KB'
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function safeFileName(name) {
  return name
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export default function DownloadsAdmin() {
  const [downloads, setDownloads] = useState([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState(null)
  const [published, setPublished] = useState(true)
  const [allowView, setAllowView] = useState(true)
  const [allowDownload, setAllowDownload] = useState(true)
  const [working, setWorking] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    loadDownloads()
  }, [])

  async function loadDownloads() {
    const { data, error: loadError } = await supabase
      .from('site_downloads')
      .select('*')
      .order('created_at', { ascending: false })
    if (loadError) setError(loadError.message)
    else setDownloads(data || [])
  }

  async function uploadDownload(event) {
    event.preventDefault()
    setError('')
    setMessage('')

    if (!title.trim() || !file) {
      setError('Add a clear title and choose a file.')
      return
    }
    if (!allowView && !allowDownload) {
      setError('Choose View, Download, or both.')
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      setError('The file is larger than the 25 MB limit.')
      return
    }

    setWorking(true)
    const { data: userData } = await supabase.auth.getUser()
    const storagePath = `${new Date().getFullYear()}/${crypto.randomUUID()}-${safeFileName(file.name)}`
    const { error: uploadError } = await supabase.storage
      .from('website-downloads')
      .upload(storagePath, file, { contentType: file.type || undefined, upsert: false })

    if (uploadError) {
      setError(uploadError.message)
      setWorking(false)
      return
    }

    const { error: rowError } = await supabase.from('site_downloads').insert({
      title: title.trim(),
      description: description.trim() || null,
      file_name: file.name,
      storage_path: storagePath,
      mime_type: file.type || null,
      file_size_bytes: file.size,
      is_published: published,
      allow_view: allowView,
      allow_download: allowDownload,
      uploaded_by: userData.user?.id,
    })

    if (rowError) {
      await supabase.storage.from('website-downloads').remove([storagePath])
      setError(rowError.message)
      setWorking(false)
      return
    }

    setTitle('')
    setDescription('')
    setFile(null)
    setPublished(true)
    setAllowView(true)
    setAllowDownload(true)
    event.currentTarget.reset()
    setMessage(published ? 'File uploaded and published.' : 'File uploaded as hidden.')
    setWorking(false)
    loadDownloads()
  }

  async function setDownloadPublished(item, nextValue) {
    setError('')
    const { error: updateError } = await supabase
      .from('site_downloads')
      .update({ is_published: nextValue })
      .eq('id', item.id)
    if (updateError) setError(updateError.message)
    else {
      setMessage(nextValue ? 'File published.' : 'File hidden from the public page.')
      loadDownloads()
    }
  }

  async function setAvailability(item, field, nextValue) {
    const nextView = field === 'allow_view' ? nextValue : item.allow_view
    const nextDownload = field === 'allow_download' ? nextValue : item.allow_download
    if (!nextView && !nextDownload) {
      setError('Each published file must offer View, Download, or both.')
      return
    }
    setError('')
    const { error: updateError } = await supabase
      .from('site_downloads')
      .update({ [field]: nextValue })
      .eq('id', item.id)
    if (updateError) setError(updateError.message)
    else {
      setMessage('File options saved.')
      loadDownloads()
    }
  }

  async function deleteDownload(item) {
    if (!window.confirm(`Delete “${item.title}”? This cannot be undone.`)) return
    setError('')
    setMessage('')
    if (item.is_system_managed) {
      setError('This guide is maintained with the website and cannot be deleted here. You can hide it instead.')
      return
    }
    if (item.storage_path) {
      const { error: storageError } = await supabase.storage
        .from('website-downloads')
        .remove([item.storage_path])
      if (storageError) {
        setError(storageError.message)
        return
      }
    }
    const { error: rowError } = await supabase.from('site_downloads').delete().eq('id', item.id)
    if (rowError) setError(rowError.message)
    else {
      setMessage('File deleted.')
      loadDownloads()
    }
  }

  return (
    <div className="container" style={{ padding: '32px 20px 56px', maxWidth: 760 }}>
      <Link to="/admin/dashboard" style={backStyle}>← Back to admin</Link>
      <h1 style={{ fontSize: 34, margin: '20px 0 8px' }}>Manage downloads</h1>
      <p style={{ color: 'var(--muted)', margin: '0 0 24px' }}>
        Upload a file once and it will appear on the public Downloads page.
      </p>

      {(error || message) && (
        <div style={{ ...noticeStyle, color: error ? '#B3261E' : '#176B3A', borderColor: error ? '#B3261E' : '#176B3A' }}>
          {error || message}
        </div>
      )}

      <form onSubmit={uploadDownload} style={panelStyle}>
        <h2 style={{ fontSize: 22, marginBottom: 18 }}>Upload a new file</h2>
        <label style={labelStyle}>
          Public title <span style={{ color: '#B3261E' }}>*</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} maxLength={120} required />
        </label>
        <label style={labelStyle}>
          Short description
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} style={{ ...inputStyle, minHeight: 96, resize: 'vertical' }} maxLength={500} />
        </label>
        <label style={labelStyle}>
          File <span style={{ color: '#B3261E' }}>*</span>
          <input type="file" accept={ACCEPTED_TYPES} onChange={(e) => setFile(e.target.files?.[0] || null)} style={fileInputStyle} required />
          <span style={{ color: 'var(--muted)', fontSize: 13, fontWeight: 400 }}>
            PDF, Word, Excel, CSV, text, ZIP, JPG or PNG. Maximum 25 MB.
          </span>
        </label>
        <label style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 20, fontWeight: 700 }}>
          <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} style={{ width: 22, height: 22 }} />
          Publish immediately
        </label>
        <fieldset style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 14, margin: '0 0 20px' }}>
          <legend style={{ fontWeight: 800, padding: '0 6px' }}>Public choices</legend>
          <label style={checkLabelStyle}>
            <input type="checkbox" checked={allowView} onChange={(e) => setAllowView(e.target.checked)} style={checkStyle} />
            Allow people to view online
          </label>
          <label style={{ ...checkLabelStyle, marginBottom: 0 }}>
            <input type="checkbox" checked={allowDownload} onChange={(e) => setAllowDownload(e.target.checked)} style={checkStyle} />
            Allow people to download a copy
          </label>
          <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 9 }}>
            Choose either option or both. PDFs, images and text open directly; Word and Excel files use an online viewer.
          </div>
        </fieldset>
        <button type="submit" disabled={working} style={{ ...buttonStyle, width: '100%' }}>
          {working ? 'Uploading…' : 'Upload file'}
        </button>
      </form>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 22, marginBottom: 14 }}>Uploaded files</h2>
        {!downloads.length ? (
          <div style={panelStyle}>No uploaded files yet.</div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {downloads.map((item) => {
              const publicUrl = item.public_url || supabase.storage.from('website-downloads').getPublicUrl(item.storage_path).data.publicUrl
              return (
                <article key={item.id} style={panelStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 800, fontSize: 18 }}>{item.title}</div>
                      <div style={{ color: 'var(--muted)', fontSize: 14, overflowWrap: 'anywhere' }}>
                        {item.file_name} · {readableSize(item.file_size_bytes)}
                      </div>
                      {item.description && <p style={{ margin: '8px 0 0' }}>{item.description}</p>}
                      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
                        <label style={checkLabelStyle}>
                          <input type="checkbox" checked={item.allow_view} onChange={(e) => setAvailability(item, 'allow_view', e.target.checked)} style={checkStyle} />
                          View
                        </label>
                        <label style={checkLabelStyle}>
                          <input type="checkbox" checked={item.allow_download} onChange={(e) => setAvailability(item, 'allow_download', e.target.checked)} style={checkStyle} />
                          Download
                        </label>
                      </div>
                    </div>
                    <span style={{ ...statusStyle, background: item.is_published ? '#E8F5EC' : '#F1F1F1', color: item.is_published ? '#176B3A' : '#555' }}>
                      {item.is_published ? 'Published' : 'Hidden'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
                    <a href={publicUrl} target="_blank" rel="noreferrer" style={{ ...outlineButtonStyle, textDecoration: 'none' }}>View file</a>
                    <button onClick={() => setDownloadPublished(item, !item.is_published)} style={outlineButtonStyle}>
                      {item.is_published ? 'Hide' : 'Publish'}
                    </button>
                    {!item.is_system_managed && <button onClick={() => deleteDownload(item)} style={{ ...outlineButtonStyle, color: '#B3261E', borderColor: '#B3261E' }}>Delete</button>}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}

const backStyle = { color: 'var(--brass)', fontWeight: 700, textDecoration: 'none' }
const panelStyle = { padding: 20, border: '1px solid var(--line)', borderRadius: 10, background: '#fff' }
const noticeStyle = { padding: 13, marginBottom: 18, border: '1px solid', borderRadius: 8, fontWeight: 700 }
const labelStyle = { display: 'grid', gap: 7, marginBottom: 16, fontWeight: 700 }
const inputStyle = { width: '100%', padding: '12px 13px', border: '1px solid var(--line)', borderRadius: 7, font: 'inherit' }
const fileInputStyle = { width: '100%', padding: 12, border: '1px dashed #999', borderRadius: 7, background: '#fafafa', font: 'inherit' }
const buttonStyle = { padding: '12px 16px', border: 'none', borderRadius: 7, background: 'var(--ink)', color: '#fff', fontWeight: 800, fontSize: 16, cursor: 'pointer' }
const outlineButtonStyle = { padding: '9px 13px', border: '1px solid var(--ink)', borderRadius: 6, background: '#fff', color: 'var(--ink)', fontWeight: 700, cursor: 'pointer' }
const statusStyle = { alignSelf: 'flex-start', padding: '5px 9px', borderRadius: 999, fontSize: 13, fontWeight: 800 }
const checkLabelStyle = { display: 'flex', gap: 8, alignItems: 'center', marginBottom: 9, fontWeight: 700 }
const checkStyle = { width: 20, height: 20 }
