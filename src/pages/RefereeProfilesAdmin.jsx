import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import './RefereeProfiles.css'

export default function RefereeProfilesAdmin() {
  const [referees, setReferees] = useState([])
  const [id, setId] = useState('')
  const [draft, setDraft] = useState({ about: '', photo_url: '', survey_answers: [] })
  const [photo, setPhoto] = useState(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [code, setCode] = useState('')
  useEffect(() => {
    supabase.from('referees').select('id,name,about,photo_url,survey_answers').order('name').then(({ data, error }) => {
      if (error) setMessage(error.message)
      else setReferees(data || [])
    })
  }, [])
  function choose(value) {
    const ref = referees.find((r) => r.id === value)
    setId(value); setDraft({ about: ref?.about || '', photo_url: ref?.photo_url || '', survey_answers: ref?.survey_answers || [] })
    setPhoto(null); setCode(''); setMessage('')
  }
  async function save(event) {
    event.preventDefault(); setBusy(true); setMessage('')
    let path = null
    try {
      let photoUrl = draft.photo_url
      if (photo) {
        if (!['image/jpeg','image/png','image/webp'].includes(photo.type) || photo.size > 5 * 1024 * 1024) throw Error('Choose a JPG, PNG or WebP photo up to 5 MB.')
        path = `${id}/${crypto.randomUUID()}.${photo.type.split('/')[1]}`
        const upload = await supabase.storage.from('referee-photos').upload(path, photo, { contentType: photo.type })
        if (upload.error) throw upload.error
        photoUrl = supabase.storage.from('referee-photos').getPublicUrl(path).data.publicUrl
      }
      const fields = { about: draft.about.trim() || null, photo_url: photoUrl || null, survey_answers: draft.survey_answers.filter((a) => a.question.trim() || a.answer.trim()) }
      const { data, error } = await supabase.from('referees').update(fields).eq('id', id).select('id,name,about,photo_url,survey_answers').single()
      if (error) throw error
      setReferees((rows) => rows.map((r) => r.id === id ? data : r)); setDraft(fields); setPhoto(null); setMessage('Profile saved.')
    } catch (error) {
      if (path) await supabase.storage.from('referee-photos').remove([path])
      setMessage(`Could not save: ${error.message}`)
    } finally { setBusy(false) }
  }
  async function manageCode(revoke) {
    setBusy(true); setCode(''); setMessage('')
    const { data, error } = await supabase.rpc('issue_referee_access_code', { p_referee_id: id, p_revoke: revoke })
    if (error) setMessage(error.message)
    else { setCode(data || ''); setMessage(revoke ? 'Login access revoked.' : 'New code issued. Previous codes and sessions no longer work.') }
    setBusy(false)
  }
  function answer(index, field, value) {
    setDraft({ ...draft, survey_answers: draft.survey_answers.map((row, i) => i === index ? { ...row, [field]: value } : row) })
  }
  return <div className="container ref-area">
    <Link to="/admin/dashboard">← Back to admin</Link>
    <h1>Referee profiles</h1>
    <p className="ref-muted">Add public photos and profile details, and manage private referee access.</p>
    <label className="ref-field">Referee<select value={id} disabled={busy} onChange={(e) => choose(e.target.value)}><option value="">Select a referee…</option>{referees.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
    {id && <>
      <form onSubmit={save} className="ref-panel">
        <h2>Public profile</h2>
        {draft.photo_url && <img src={draft.photo_url} alt="Current referee" className="ref-portrait" />}
        <label className="ref-field">Photo<input key={id + draft.photo_url} type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(e) => setPhoto(e.target.files?.[0] || null)} /></label>
        {draft.photo_url && <button type="button" disabled={busy} onClick={() => { setDraft({ ...draft, photo_url: '' }); setPhoto(null) }}>Remove photo on save</button>}
        <label className="ref-field">About the referee<textarea rows={5} maxLength={5000} value={draft.about || ''} onChange={(e) => setDraft({ ...draft, about: e.target.value })} /></label>
        <h3>SurveyMonkey questions and answers</h3>
        <p className="ref-muted">Enter the answers you want displayed on their public profile.</p>
        {draft.survey_answers.map((row, i) => <div key={i} className="ref-answer-edit">
          <label className="ref-field">Question<input maxLength={300} value={row.question} onChange={(e) => answer(i, 'question', e.target.value)} /></label>
          <label className="ref-field">Answer<textarea rows={3} maxLength={3000} value={row.answer} onChange={(e) => answer(i, 'answer', e.target.value)} /></label>
          <button type="button" disabled={busy} onClick={() => setDraft({ ...draft, survey_answers: draft.survey_answers.filter((_, index) => index !== i) })}>Remove answer</button>
        </div>)}
        <div className="ref-actions"><button type="button" disabled={busy} onClick={() => setDraft({ ...draft, survey_answers: [...draft.survey_answers, { question: '', answer: '' }] })}>Add question and answer</button><button className="ref-primary" disabled={busy} type="submit">{busy ? 'Please wait…' : 'Save profile'}</button></div>
      </form>
      <section className="ref-panel"><h2>Private referee login</h2><p>Each referee uses their own code at <Link to="/referees/login">Referee login</Link> to see their card totals and average. Replacing a code signs out their existing sessions.</p>
        <div className="ref-actions"><button disabled={busy} onClick={() => manageCode(false)}>Issue / replace login code</button><button disabled={busy} onClick={() => manageCode(true)}>Revoke access</button></div>
        {code && <label className="ref-field">New login code — copy it now<input readOnly value={code} onFocus={(e) => e.target.select()} /><small>Only a hash is stored. Share this code privately with this referee.</small></label>}
      </section>
    </>}
    {message && <p role="status">{message}</p>}
  </div>
}
