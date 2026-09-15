import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'

const initialForm = {
  enquiryType: 'General Query',
  name: '',
  email: '',
  mobile: '',
  message: '',
  website: '',
}

export default function Contact() {
  const [searchParams] = useSearchParams()
  const requestedType = searchParams.get('type')
  const startingType = ['Website Error', 'Feature Request'].includes(requestedType) ? requestedType : initialForm.enquiryType
  const [form, setForm] = useState({ ...initialForm, enquiryType: startingType })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
    setError('')
  }

  async function submit(event) {
    event.preventDefault()
    setError('')
    setSent(false)

    if (form.website) return
    const isWebsiteReport = ['Website Error', 'Feature Request'].includes(form.enquiryType)
    if (!form.message.trim()) {
      setError('Please describe the problem or feature request.')
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

    setSubmitting(true)
    const { error: submitError } = await supabase.from('contact_enquiries').insert({
      enquiry_type: form.enquiryType,
      name: form.name.trim() || 'Anonymous website report',
      email: form.email.trim() || null,
      mobile: form.mobile.trim() || null,
      message: form.message.trim(),
    })
    setSubmitting(false)

    if (submitError) {
      setError('Your message could not be sent. Please check the details and try again.')
      return
    }

    setForm({ ...initialForm, enquiryType: startingType })
    setSent(true)
  }

  const isWebsiteReport = ['Website Error', 'Feature Request'].includes(form.enquiryType)

  return (
    <div className="container" style={{ padding: '32px 20px 48px', maxWidth: 720 }}>
      <h1 style={{ fontSize: 30, marginBottom: 4 }}>{isWebsiteReport ? 'Report a website issue' : 'Contact Us'}</h1>
      <p style={{ color: 'var(--muted)', marginBottom: 26 }}>
        {isWebsiteReport
          ? 'Tell us what is wrong or suggest something you would like added. Your name and contact details are optional.'
          : 'Send the ECFA a general question or ask about sponsorship opportunities.'}
      </p>

      {sent && (
        <div role="status" style={successStyle}>
          Thank you. Your enquiry has been sent to the ECFA.
        </div>
      )}
      {error && (
        <div role="alert" style={errorStyle}>{error}</div>
      )}

      <form onSubmit={submit} style={formStyle}>
        <fieldset style={fieldsetStyle}>
          <legend style={legendStyle}>What is your enquiry about?</legend>
          <div style={{ display: 'grid', gap: 10 }}>
            {['General Query', 'Sponsorship Enquiry', 'Website Error', 'Feature Request'].map((type) => (
              <label key={type} style={optionStyle}>
                <input
                  type="radio"
                  name="enquiryType"
                  value={type}
                  checked={form.enquiryType === type}
                  onChange={(event) => update('enquiryType', event.target.value)}
                />
                <span>{type}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <label style={labelStyle}>
          Your name {!isWebsiteReport && <span aria-hidden="true">*</span>} {isWebsiteReport && <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(optional)</span>}
          <input
            value={form.name}
            onChange={(event) => update('name', event.target.value)}
            maxLength={120}
            autoComplete="name"
            required={!isWebsiteReport}
            style={inputStyle}
          />
        </label>

        <div style={contactGridStyle}>
          <label style={labelStyle}>
            Email address
            <input
              type="email"
              value={form.email}
              onChange={(event) => update('email', event.target.value)}
              maxLength={254}
              autoComplete="email"
              inputMode="email"
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            Mobile number
            <input
              type="tel"
              value={form.mobile}
              onChange={(event) => update('mobile', event.target.value)}
              maxLength={40}
              autoComplete="tel"
              inputMode="tel"
              style={inputStyle}
            />
          </label>
        </div>
        <p style={{ margin: '-6px 0 4px', color: 'var(--muted)', fontSize: 13 }}>
          {isWebsiteReport ? 'Email and mobile are optional.' : 'Please provide at least one: email address or mobile number.'}
        </p>

        <label style={labelStyle}>
          {isWebsiteReport ? 'What happened, or what would you like added?' : 'Message'} <span aria-hidden="true">*</span>
          <textarea
            value={form.message}
            onChange={(event) => update('message', event.target.value)}
            rows={7}
            minLength={5}
            maxLength={5000}
            required
            style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
          />
        </label>

        <label style={honeypotStyle} aria-hidden="true">
          Website
          <input
            value={form.website}
            onChange={(event) => update('website', event.target.value)}
            tabIndex={-1}
            autoComplete="off"
          />
        </label>

        <button type="submit" disabled={submitting} style={buttonStyle}>
          {submitting ? 'Sending…' : isWebsiteReport ? 'Submit website report' : 'Send enquiry'}
        </button>
        <p style={{ color: 'var(--muted)', fontSize: 12, margin: 0 }}>
          Your details will only be used to respond to this enquiry.
        </p>
      </form>
    </div>
  )
}

const formStyle = {
  display: 'grid',
  gap: 18,
  padding: 20,
  border: '1px solid var(--line)',
  borderRadius: 8,
  background: '#fff',
}

const fieldsetStyle = {
  border: 0,
  padding: 0,
  margin: 0,
}

const legendStyle = {
  fontWeight: 700,
  marginBottom: 10,
}

const optionStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 9,
  padding: 12,
  border: '1px solid var(--line)',
  borderRadius: 6,
  cursor: 'pointer',
}

const labelStyle = {
  display: 'grid',
  gap: 7,
  fontWeight: 700,
  fontSize: 14,
}

const inputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '11px 12px',
  border: '1px solid var(--line)',
  borderRadius: 6,
  background: '#fff',
  color: 'var(--ink)',
  fontSize: 16,
  fontWeight: 400,
}

const contactGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 14,
}

const buttonStyle = {
  padding: '12px 18px',
  border: 0,
  borderRadius: 6,
  background: 'var(--ink)',
  color: '#fff',
  fontWeight: 700,
  fontSize: 15,
  cursor: 'pointer',
}

const successStyle = {
  padding: 14,
  marginBottom: 16,
  border: '1px solid #2E7D32',
  borderRadius: 6,
  background: '#F1F8F2',
  color: '#1B5E20',
}

const errorStyle = {
  padding: 14,
  marginBottom: 16,
  border: '1px solid #B3261E',
  borderRadius: 6,
  background: '#FFF5F4',
  color: '#B3261E',
}

const honeypotStyle = {
  position: 'absolute',
  left: '-10000px',
  width: 1,
  height: 1,
  overflow: 'hidden',
}
