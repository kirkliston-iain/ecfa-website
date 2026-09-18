import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'

const initialForm = {
  enquiryType: 'General Query',
  name: '',
  email: '',
  mobile: '',
  message: '',
  website: '',
  teamName: '',
  churchName: '',
  ministerName: '',
  ministerEmail: '',
  ministerMobile: '',
  teamMission: '',
}

export default function Contact() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const requestedType = searchParams.get('type')
  const startingType = ['Website Error', 'Feature Request', 'Apply to Join the League'].includes(requestedType)
    ? requestedType
    : initialForm.enquiryType
  const [form, setForm] = useState({ ...initialForm, enquiryType: startingType })
  const [joinStep, setJoinStep] = useState('criteria')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [attachment, setAttachment] = useState(null)
  const [fileInputKey, setFileInputKey] = useState(0)

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
    setError('')
    setSent(false)
    if (field === 'enquiryType') setJoinStep('criteria')
  }

  async function submit(event) {
    event.preventDefault()
    setError('')
    setSent(false)

    if (form.website) return
    const isWebsiteReport = ['Website Error', 'Feature Request'].includes(form.enquiryType)
    const isLeagueApplication = form.enquiryType === 'Apply to Join the League'

    if (isLeagueApplication) {
      if (!form.name.trim() || !form.teamName.trim() || !form.churchName.trim() || !form.ministerName.trim() || !form.teamMission.trim()) {
        setError('Please complete your name, team name, nominated church, minister’s name and the team mission summary.')
        return
      }
      if (!form.email.trim() && !form.mobile.trim()) {
        setError('Please provide either your email address or mobile number.')
        return
      }
    } else {
      if (!form.message.trim() && !(isWebsiteReport && attachment)) {
        setError(isWebsiteReport ? 'Please enter a message or attach a file.' : 'Please enter your message.')
        return
      }
      if (!isWebsiteReport && !form.name.trim()) {
        setError('Please enter your name.')
        return
      }
      if (!isWebsiteReport && !form.email.trim() && !form.mobile.trim()) {
        setError('Please provide either an email address or mobile number.')
        return
      }
    }

    const message = isLeagueApplication
      ? [
          `TEAM: ${form.teamName.trim()}`,
          `NOMINATED CHURCH: ${form.churchName.trim()}`,
          `MINISTER: ${form.ministerName.trim()}`,
          `MINISTER EMAIL: ${form.ministerEmail.trim() || 'Not provided'}`,
          `MINISTER MOBILE: ${form.ministerMobile.trim() || 'Not provided'}`,
          '',
          'TEAM MISSION AND REASON FOR JOINING:',
          form.teamMission.trim(),
          form.message.trim() ? `\nADDITIONAL INFORMATION:\n${form.message.trim()}` : '',
        ].filter(Boolean).join('\n')
      : form.message.trim() || 'Attachment provided.'

    const allowedAttachmentTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/heic',
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ]
    if (attachment && (!allowedAttachmentTypes.includes(attachment.type) || attachment.size > 10 * 1024 * 1024)) {
      setError('Please attach a JPG, PNG, WebP, HEIC, PDF, text or Word file no larger than 10 MB.')
      return
    }

    setSubmitting(true)
    let attachmentDetails = {}
    if (attachment) {
      const safeName = attachment.name.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(-120)
      const attachmentPath = `enquiries/${crypto.randomUUID()}/${safeName}`
      const { error: uploadError } = await supabase.storage
        .from('contact-attachments')
        .upload(attachmentPath, attachment, { contentType: attachment.type, upsert: false })
      if (uploadError) {
        setSubmitting(false)
        setError('The attachment could not be uploaded. Please check its file type and size, then try again.')
        return
      }
      attachmentDetails = {
        attachment_path: attachmentPath,
        attachment_name: attachment.name,
        attachment_mime_type: attachment.type,
        attachment_size_bytes: attachment.size,
      }
    }

    const { error: submitError } = await supabase.from('contact_enquiries').insert({
      enquiry_type: isLeagueApplication ? 'League Application' : form.enquiryType,
      name: form.name.trim() || 'Anonymous website report',
      email: form.email.trim() || null,
      mobile: form.mobile.trim() || null,
      message,
      ...attachmentDetails,
    })
    setSubmitting(false)

    if (submitError) {
      setError('Your message could not be sent. Please check the details and try again.')
      return
    }

    setForm({ ...initialForm, enquiryType: startingType })
    setAttachment(null)
    setFileInputKey((current) => current + 1)
    setJoinStep('criteria')
    setSent(true)
  }

  const isWebsiteReport = ['Website Error', 'Feature Request'].includes(form.enquiryType)
  const isLeagueApplication = form.enquiryType === 'Apply to Join the League'

  return (
    <div className="container" style={{ padding: '32px 20px 48px', maxWidth: 760 }}>
      <h1 style={{ fontSize: 30, marginBottom: 4 }}>
        {isLeagueApplication ? 'Apply to Join the League' : isWebsiteReport ? 'Report a website issue' : 'Contact Us'}
      </h1>
      <p style={{ color: 'var(--muted)', marginBottom: 26 }}>
        {isLeagueApplication
          ? 'Read the ECFA criteria before starting a new-team application.'
          : isWebsiteReport
            ? 'Tell us what is wrong or suggest something you would like added. Your name and contact details are optional.'
            : 'Send the ECFA a general question, ask about sponsorship or apply to join the league.'}
      </p>

      {sent && <div role="status" style={successStyle}>
        {isLeagueApplication
          ? 'Thank you. Your league application has been sent to the ECFA administrators.'
          : 'Thank you. Your enquiry has been sent to the ECFA.'}
      </div>}
      {error && <div role="alert" style={errorStyle}>{error}</div>}

      {!sent && (
        <form onSubmit={submit} style={formStyle}>
          <fieldset style={fieldsetStyle}>
            <legend style={legendStyle}>What is your enquiry about?</legend>
            <div style={{ display: 'grid', gap: 10 }}>
              {['General Query', 'Sponsorship Enquiry', 'Apply to Join the League', 'Website Error', 'Feature Request'].map((type) => (
                <label key={type} style={optionStyle}>
                  <input type="radio" name="enquiryType" value={type} checked={form.enquiryType === type} onChange={(event) => update('enquiryType', event.target.value)} />
                  <span>{type}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {isLeagueApplication && joinStep === 'criteria' ? (
            <Criteria
              onApply={() => { setJoinStep('application'); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
              onExit={() => navigate('/')}
            />
          ) : isLeagueApplication ? (
            <LeagueApplicationFields form={form} update={update} submitting={submitting} onExit={() => navigate('/')} attachment={attachment} setAttachment={setAttachment} fileInputKey={fileInputKey} />
          ) : (
            <StandardFields form={form} update={update} isWebsiteReport={isWebsiteReport} submitting={submitting} attachment={attachment} setAttachment={setAttachment} fileInputKey={fileInputKey} />
          )}

          <label style={honeypotStyle} aria-hidden="true">
            Website
            <input value={form.website} onChange={(event) => update('website', event.target.value)} tabIndex={-1} autoComplete="off" />
          </label>
        </form>
      )}
    </div>
  )
}

function Criteria({ onApply, onExit }) {
  return (
    <section style={criteriaStyle}>
      <h2 style={criteriaHeadingStyle}>League Registration &amp; Criteria (New Applicants)</h2>
      <p>The <strong>Edinburgh Churches Football League (ECFA)</strong> is a church-led, Christian league committed to providing a competitive football environment that reflects Christian values.</p>
      <p>We welcome players from all backgrounds, regardless of faith. However, all individuals associated with a club are expected to be <strong>sympathetic to these values</strong> and agree to abide by the ECFA Code of Conduct.</p>
      <p>Management teams should strive to develop a settled, stable squad, promote positive relationships and foster an environment that <strong>encourages opportunities to witness</strong>.</p>

      <h3 style={criteriaSubheadingStyle}>New Team Application Process</h3>
      <p>Prospective teams must meet the following criteria:</p>
      <ol style={listStyle}>
        <li><strong>Church Connection Confirmation</strong><br />A letter of confirmation and support must be submitted from the church connected with the team, affirming the relationship and backing the application.</li>
        <li><strong>Initial Meeting with ECFA Leadership</strong><br />All managers must meet the ECFA Chairman or a designated representative before acceptance. The meeting will focus on the team’s ethos and purpose and its alignment with the league’s values and structure. The Chairman may recommend that the application is declined if the team is not a suitable fit.</li>
        <li><strong>Code of Conduct Agreement</strong><br />The team must formally agree to uphold and promote the behaviours outlined in the ECFA Code of Conduct.</li>
        <li><strong>Friendly Matches</strong><br />The team must play several existing member teams before the membership vote. Concerns may lead to the application being declined, or to an initial season participating only in cup competitions.</li>
        <li><strong>Membership Vote</strong><br />Existing member teams will vote on the application. Members may share relevant experiences or knowledge of the team or its management. A simple majority is required for approval.</li>
        <li><strong>Ongoing Support and Monitoring</strong>
          <ul style={nestedListStyle}>
            <li>Accepted teams enter a 12-month probationary period so both the league and team can assess whether the fit is right.</li>
            <li>A church representative must attend each match. They may be a current church member who plays, manages or watches.</li>
            <li>Teams must provide yearly proof of continuing church support.</li>
            <li>Team ministers should try to attend league meetings and are expected at the first meeting where the team is introduced. Failure to attend may lead to the application being declined.</li>
            <li>A change of manager may lead to a review of the team’s status. A new manager must be introduced at a league meeting before taking over.</li>
          </ul>
        </li>
      </ol>

      <div style={actionRowStyle}>
        <button type="button" onClick={onApply} style={buttonStyle}>Criteria met — apply</button>
        <button type="button" onClick={onExit} style={secondaryButtonStyle}>Criteria not met — don’t apply</button>
      </div>
    </section>
  )
}

function LeagueApplicationFields({ form, update, submitting, onExit, attachment, setAttachment, fileInputKey }) {
  return (
    <section style={{ display: 'grid', gap: 18 }}>
      <div style={{ padding: 12, borderRadius: 6, background: '#f5f8fa', color: 'var(--muted)', fontSize: 13 }}>
        Fields marked * are required. The minister’s contact details are helpful but optional.
      </div>
      <label style={labelStyle}>Your name *<input value={form.name} onChange={(e) => update('name', e.target.value)} maxLength={120} autoComplete="name" required style={inputStyle} /></label>
      <div style={contactGridStyle}>
        <label style={labelStyle}>Your email address<input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} maxLength={254} autoComplete="email" style={inputStyle} /></label>
        <label style={labelStyle}>Your mobile number<input type="tel" value={form.mobile} onChange={(e) => update('mobile', e.target.value)} maxLength={40} autoComplete="tel" style={inputStyle} /></label>
      </div>
      <p style={helpStyle}>Please provide at least one of your own contact methods.</p>
      <label style={labelStyle}>Team name *<input value={form.teamName} onChange={(e) => update('teamName', e.target.value)} maxLength={160} required style={inputStyle} /></label>
      <label style={labelStyle}>Nominated church *<input value={form.churchName} onChange={(e) => update('churchName', e.target.value)} maxLength={200} required style={inputStyle} /></label>
      <label style={labelStyle}>Minister’s name *<input value={form.ministerName} onChange={(e) => update('ministerName', e.target.value)} maxLength={160} required style={inputStyle} /></label>
      <div style={contactGridStyle}>
        <label style={labelStyle}>Minister’s email (optional)<input type="email" value={form.ministerEmail} onChange={(e) => update('ministerEmail', e.target.value)} maxLength={254} style={inputStyle} /></label>
        <label style={labelStyle}>Minister’s mobile (optional)<input type="tel" value={form.ministerMobile} onChange={(e) => update('ministerMobile', e.target.value)} maxLength={40} style={inputStyle} /></label>
      </div>
      <label style={labelStyle}>Summarise the team’s mission and why you want to join the ECFA *
        <textarea value={form.teamMission} onChange={(e) => update('teamMission', e.target.value)} rows={7} minLength={20} maxLength={5000} required style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
      </label>
      <label style={labelStyle}>Anything else you would like us to know (optional)
        <textarea value={form.message} onChange={(e) => update('message', e.target.value)} rows={4} maxLength={3000} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
      </label>
      <AttachmentField attachment={attachment} setAttachment={setAttachment} fileInputKey={fileInputKey} />
      <div style={actionRowStyle}>
        <button type="submit" disabled={submitting} style={buttonStyle}>{submitting ? 'Sending…' : 'Send application'}</button>
        <button type="button" onClick={onExit} style={secondaryButtonStyle}>Exit without sending</button>
      </div>
      <p style={{ color: 'var(--muted)', fontSize: 12, margin: 0 }}>Application details are visible only to authorised ECFA administrators.</p>
    </section>
  )
}

function StandardFields({ form, update, isWebsiteReport, submitting, attachment, setAttachment, fileInputKey }) {
  return (
    <>
      <label style={labelStyle}>Your name {!isWebsiteReport && '*'} {isWebsiteReport && <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(optional)</span>}
        <input value={form.name} onChange={(e) => update('name', e.target.value)} maxLength={120} autoComplete="name" required={!isWebsiteReport} style={inputStyle} />
      </label>
      <div style={contactGridStyle}>
        <label style={labelStyle}>Email address<input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} maxLength={254} autoComplete="email" style={inputStyle} /></label>
        <label style={labelStyle}>Mobile number<input type="tel" value={form.mobile} onChange={(e) => update('mobile', e.target.value)} maxLength={40} autoComplete="tel" style={inputStyle} /></label>
      </div>
      <p style={helpStyle}>{isWebsiteReport ? 'Email and mobile are optional.' : 'Please provide at least one: email address or mobile number.'}</p>
      <label style={labelStyle}>{isWebsiteReport ? 'What happened, or what would you like added?' : 'Message'} {isWebsiteReport ? '(or attach a file)' : '*'}
        <textarea value={form.message} onChange={(e) => update('message', e.target.value)} rows={7} minLength={attachment && isWebsiteReport ? undefined : 5} maxLength={5000} required={!isWebsiteReport} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
      </label>
      <AttachmentField attachment={attachment} setAttachment={setAttachment} fileInputKey={fileInputKey} />
      <button type="submit" disabled={submitting} style={buttonStyle}>{submitting ? 'Sending…' : isWebsiteReport ? 'Submit website report' : 'Send enquiry'}</button>
      <p style={{ color: 'var(--muted)', fontSize: 12, margin: 0 }}>Your details will only be used to respond to this enquiry.</p>
    </>
  )
}

function AttachmentField({ attachment, setAttachment, fileInputKey }) {
  return (
    <label style={labelStyle}>Attach an image or file <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(optional)</span>
      <input
        key={fileInputKey}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,.pdf,.txt,.doc,.docx"
        onChange={(event) => setAttachment(event.target.files?.[0] || null)}
        style={inputStyle}
      />
      <span style={{ color: 'var(--muted)', fontSize: 12, fontWeight: 400 }}>
        JPG, PNG, WebP, HEIC, PDF, text or Word · maximum 10 MB
        {attachment ? ` · Selected: ${attachment.name}` : ''}
      </span>
    </label>
  )
}

const formStyle = { display: 'grid', gap: 18, padding: 20, border: '1px solid var(--line)', borderRadius: 8, background: '#fff' }
const fieldsetStyle = { border: 0, padding: 0, margin: 0 }
const legendStyle = { fontWeight: 700, marginBottom: 10 }
const optionStyle = { display: 'flex', alignItems: 'center', gap: 9, padding: 12, border: '1px solid var(--line)', borderRadius: 6, cursor: 'pointer' }
const labelStyle = { display: 'grid', gap: 7, fontWeight: 700, fontSize: 14 }
const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '11px 12px', border: '1px solid var(--line)', borderRadius: 6, background: '#fff', color: 'var(--ink)', fontSize: 16, fontWeight: 400 }
const contactGridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }
const helpStyle = { margin: '-6px 0 4px', color: 'var(--muted)', fontSize: 13 }
const buttonStyle = { padding: '12px 18px', border: 0, borderRadius: 6, background: 'var(--ink)', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer' }
const secondaryButtonStyle = { ...buttonStyle, background: '#fff', color: 'var(--ink)', border: '1px solid var(--line)' }
const actionRowStyle = { display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }
const criteriaStyle = { paddingTop: 6, lineHeight: 1.6, color: 'var(--ink)' }
const criteriaHeadingStyle = { color: 'var(--brass)', fontSize: 22, margin: '4px 0 16px' }
const criteriaSubheadingStyle = { color: 'var(--brass)', fontSize: 19, margin: '26px 0 8px' }
const listStyle = { paddingLeft: 24, display: 'grid', gap: 16 }
const nestedListStyle = { paddingLeft: 20, marginTop: 8, display: 'grid', gap: 7 }
const successStyle = { padding: 14, marginBottom: 16, border: '1px solid #2E7D32', borderRadius: 6, background: '#F1F8F2', color: '#1B5E20' }
const errorStyle = { padding: 14, marginBottom: 16, border: '1px solid #B3261E', borderRadius: 6, background: '#FFF5F4', color: '#B3261E' }
const honeypotStyle = { position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }
