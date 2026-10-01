import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'

const emptyStory = { title: '', body: '', story_url: '', event_date: '', graphics: [], status: 'draft' }
const imageTypes = ['image/png', 'image/jpeg', 'image/webp']
const PAGE_SIZE = 50

function fileName(file) {
  return file.name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '')
}

export default function NewsAdmin() {
  const [stories, setStories] = useState([])
  const [form, setForm] = useState(emptyStory)
  const [editingId, setEditingId] = useState(null)
  const [files, setFiles] = useState([])
  const [working, setWorking] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function loadStories(offset = 0) {
    const { data, error: loadError } = await supabase.from('news_stories').select('*').order('created_at', { ascending: false }).order('id', { ascending: false }).range(offset, offset + PAGE_SIZE - 1)
    if (loadError) setError(loadError.message)
    else {
      setStories((current) => offset === 0 ? data || [] : [...current, ...(data || [])])
      setHasMore((data || []).length === PAGE_SIZE)
    }
    setLoading(false)
    setLoadingMore(false)
  }

  useEffect(() => { loadStories() }, [])

  function startNew() {
    setEditingId(null)
    setForm(emptyStory)
    setFiles([])
    setError('')
    setMessage('')
  }

  function edit(story) {
    setEditingId(story.id)
    setForm({ ...story, graphics: story.graphics || [] })
    setFiles([])
    setError('')
    setMessage('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function chooseFiles(event) {
    const selected = [...event.target.files]
    event.target.value = ''
    if (selected.some((file) => !imageTypes.includes(file.type) || file.size > 5 * 1024 * 1024)) {
      setError('Use PNG, JPG or WebP graphics, each no larger than 5 MB.')
      return
    }
    if (form.graphics.length + files.length + selected.length > 10) {
      setError('Each story can have up to 10 graphics.')
      return
    }
    setError('')
    setFiles((current) => [...current, ...selected])
  }

  async function removeUploads(paths) {
    if (!paths.length) return null
    const { error: removeError } = await supabase.storage.from('news-graphics').remove(paths)
    return removeError
  }

  async function save(event, nextStatus) {
    event.preventDefault()
    setError('')
    setMessage('')
    if (!form.title.trim() || !form.event_date || (!form.body.trim() && !form.story_url.trim())) {
      setError('Add a headline, date, and either the story text or a story link.')
      return
    }
    if (form.story_url.trim()) {
      try {
        const url = new URL(form.story_url.trim())
        if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Unsupported link')
      } catch {
        setError('Enter a complete http or https story link.')
        return
      }
    }
    setWorking(true)
    const uploaded = []
    for (const file of files) {
      const path = `${crypto.randomUUID()}-${fileName(file)}`
      const { error: uploadError } = await supabase.storage.from('news-graphics').upload(path, file, { contentType: file.type })
      if (uploadError) {
        await removeUploads(uploaded.map((item) => item.path))
        setError(`Could not upload ${file.name}: ${uploadError.message}`)
        setWorking(false)
        return
      }
      const { data } = supabase.storage.from('news-graphics').getPublicUrl(path)
      uploaded.push({ path, url: data.publicUrl })
    }

    const previous = stories.find((story) => story.id === editingId)
    const payload = {
      title: form.title.trim(),
      body: form.body.trim(),
      story_url: form.story_url.trim() || null,
      event_date: form.event_date,
      graphics: [...form.graphics, ...uploaded],
      status: nextStatus,
      published_at: nextStatus === 'published' ? previous?.published_at || new Date().toISOString() : previous?.published_at || null,
    }
    const result = editingId
      ? await supabase.from('news_stories').update(payload).eq('id', editingId)
      : await supabase.from('news_stories').insert(payload)
    if (result.error) {
      await removeUploads(uploaded.map((item) => item.path))
      setError(result.error.message)
    } else {
      const removed = (previous?.graphics || []).filter((graphic) => !form.graphics.some((item) => item.path === graphic.path)).map((graphic) => graphic.path)
      const removeError = await removeUploads(removed)
      startNew()
      setMessage(removeError ? `Story saved, but some removed graphics could not be deleted: ${removeError.message}` : nextStatus === 'published' ? 'Story published.' : 'Story saved.')
      await loadStories(0)
    }
    setWorking(false)
  }

  async function changeStatus(story, status) {
    setWorking(true)
    setError('')
    setMessage('')
    const { error: updateError } = await supabase.from('news_stories').update({
      status, published_at: status === 'published' ? story.published_at || new Date().toISOString() : story.published_at,
    }).eq('id', story.id)
    if (updateError) setError(updateError.message)
    else {
      setMessage(status === 'published' ? 'Story published.' : 'Story archived.')
      await loadStories(0)
      if (editingId === story.id) startNew()
    }
    setWorking(false)
  }

  async function deleteStory(story) {
    if (!window.confirm(`Permanently delete “${story.title}” and its graphics?`)) return
    setWorking(true)
    setError('')
    setMessage('')
    const { error: deleteError } = await supabase.from('news_stories').delete().eq('id', story.id)
    if (deleteError) setError(deleteError.message)
    else {
      const removeError = await removeUploads((story.graphics || []).map((graphic) => graphic.path))
      setMessage(removeError ? `Story deleted, but some graphics could not be removed: ${removeError.message}` : 'Story deleted.')
      if (editingId === story.id) startNew()
      await loadStories(0)
    }
    setWorking(false)
  }

  return (
    <div className="container" style={{ padding: '28px 20px 48px', maxWidth: 820 }}>
      <Link to="/admin/dashboard" style={{ color: 'var(--brass)', fontWeight: 700 }}>← Back to admin</Link>
      <h1 style={{ fontSize: 27, margin: '20px 0 6px' }}>Manage news</h1>
      <p style={{ color: 'var(--muted)', margin: '0 0 20px' }}>Publish stories to the News tab. Drafts and archived stories stay visible here only.</p>
      {error && <p role="alert" style={{ color: '#B3261E' }}>{error}</p>}
      {message && <p role="status" style={{ color: 'var(--win)' }}>{message}</p>}

      <form onSubmit={(event) => save(event, form.status === 'published' ? 'published' : 'draft')} style={panelStyle}>
        <h2 style={{ fontSize: 19, marginBottom: 16 }}>{editingId ? 'Edit story' : 'New story'}</h2>
        <label style={labelStyle}>Headline *<input required maxLength={180} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} style={inputStyle} /></label>
        <label style={labelStyle}>Date of event or story *<input type="date" required value={form.event_date} onChange={(event) => setForm({ ...form, event_date: event.target.value })} style={inputStyle} /></label>
        <label style={labelStyle}>Story text<textarea rows={9} value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} style={inputStyle} placeholder="Write the news story here…" /></label>
        <label style={labelStyle}>Link to a story (optional)<input type="url" value={form.story_url || ''} onChange={(event) => setForm({ ...form, story_url: event.target.value })} style={inputStyle} placeholder="https://…" /></label>
        <p style={{ fontSize: 13, color: 'var(--muted)', margin: '-5px 0 15px' }}>Add story text, a link, or both.</p>
        <label style={labelStyle}>Graphics ({form.graphics.length + files.length}/10)
          <input type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={chooseFiles} disabled={working || form.graphics.length + files.length >= 10} style={inputStyle} />
          <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 400 }}>Up to 10 PNG, JPG or WebP files per story, 5 MB each.</span>
        </label>
        {form.graphics.map((graphic, index) => (
          <div key={graphic.path} style={graphicRowStyle}>
            <img src={graphic.url} alt="" style={{ width: 54, height: 54, objectFit: 'contain' }} />
            <span style={{ flex: 1 }}>Graphic {index + 1}</span>
            <button type="button" disabled={working} onClick={() => setForm({ ...form, graphics: form.graphics.filter((item) => item.path !== graphic.path) })} style={smallButtonStyle}>Remove</button>
          </div>
        ))}
        {files.map((file, index) => (
          <div key={`${file.name}-${index}`} style={graphicRowStyle}>
            <span style={{ flex: 1, overflowWrap: 'anywhere' }}>{file.name} (ready to upload)</span>
            <button type="button" disabled={working} onClick={() => setFiles(files.filter((_, position) => position !== index))} style={smallButtonStyle}>Remove</button>
          </div>
        ))}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 18 }}>
          <button type="submit" disabled={working} style={primaryButtonStyle}>{working ? 'Saving…' : form.status === 'published' ? 'Save changes' : 'Save draft'}</button>
          {form.status !== 'published' && <button type="button" disabled={working} onClick={(event) => save(event, 'published')} style={primaryButtonStyle}>Publish</button>}
          {editingId && <button type="button" disabled={working} onClick={startNew} style={smallButtonStyle}>Cancel editing</button>}
        </div>
      </form>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 21, marginBottom: 12 }}>Stories</h2>
        {loading && <p>Loading stories…</p>}
        {!loading && stories.length === 0 && <p style={{ color: 'var(--muted)' }}>No stories yet.</p>}
        <div style={{ display: 'grid', gap: 10 }}>
          {stories.map((story) => (
            <article key={story.id} style={panelStyle}>
              <div style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 700 }}>{story.status} · {story.event_date} · {(story.graphics || []).length} graphics</div>
              <h3 style={{ fontSize: 17, margin: '5px 0 12px', overflowWrap: 'anywhere' }}>{story.title}</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <button type="button" disabled={working} onClick={() => edit(story)} style={smallButtonStyle}>Edit</button>
                {story.status !== 'published' && <button type="button" disabled={working} onClick={() => changeStatus(story, 'published')} style={smallButtonStyle}>Publish</button>}
                {story.status !== 'archived' && <button type="button" disabled={working} onClick={() => changeStatus(story, 'archived')} style={smallButtonStyle}>Archive</button>}
                <button type="button" disabled={working} onClick={() => deleteStory(story)} style={{ ...smallButtonStyle, color: '#B3261E' }}>Delete</button>
              </div>
            </article>
          ))}
        </div>
        {hasMore && <button type="button" disabled={loadingMore || working} onClick={() => { setLoadingMore(true); loadStories(stories.length) }} style={{ ...smallButtonStyle, marginTop: 14 }}>{loadingMore ? 'Loading…' : 'Load more stories'}</button>}
      </section>
    </div>
  )
}

const panelStyle = { padding: 18, border: '1px solid var(--line)', borderRadius: 8, background: '#fff' }
const labelStyle = { display: 'grid', gap: 6, fontWeight: 700, marginBottom: 16 }
const inputStyle = { width: '100%', boxSizing: 'border-box', padding: 11, border: '1px solid var(--line)', borderRadius: 6, background: '#fff', font: 'inherit', fontWeight: 400 }
const graphicRowStyle = { display: 'flex', gap: 10, alignItems: 'center', padding: 8, borderBottom: '1px solid var(--line)', fontSize: 13 }
const smallButtonStyle = { padding: '8px 12px', border: '1px solid var(--line)', borderRadius: 6, background: '#fff', color: 'var(--ink)', fontWeight: 700, cursor: 'pointer' }
const primaryButtonStyle = { ...smallButtonStyle, background: 'var(--ink)', color: '#fff' }
