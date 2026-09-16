import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'

const IAIN_ID = '28696bc6-2df2-4855-b259-3f156ad55748'

export default function AdminAccounts() {
  const [allowed, setAllowed] = useState(null)
  const [credentials, setCredentials] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setAllowed(data.user?.id === IAIN_ID))
  }, [])

  async function generateAccounts() {
    if (!window.confirm('Generate or reset the four administrator accounts? Existing temporary passwords will stop working.')) return
    setLoading(true)
    setError('')
    setCredentials([])
    setCopied(false)
    const { data, error: invokeError } = await supabase.functions.invoke('provision-admin-accounts')
    setLoading(false)
    if (invokeError || data?.error) {
      setError(data?.error || invokeError?.message || 'Accounts could not be generated.')
      return
    }
    setCredentials(data?.credentials || [])
  }

  async function copyAll() {
    const text = credentials
      .map((item) => `${item.displayName}\nUsername: ${item.username}\nTemporary password: ${item.temporaryPassword}`)
      .join('\n\n')
    await navigator.clipboard.writeText(text)
    setCopied(true)
  }

  if (allowed === null) return null
  if (!allowed) {
    return (
      <div className="container" style={{ padding: '32px 20px', maxWidth: 620 }}>
        <Link to="/admin/dashboard" style={linkStyle}>← Back to admin</Link>
        <h1>Administrator accounts</h1>
        <p>You do not have permission to manage administrator accounts.</p>
      </div>
    )
  }

  return (
    <div className="container" style={{ padding: '32px 20px', maxWidth: 720 }}>
      <Link to="/admin/dashboard" style={linkStyle}>← Back to admin</Link>
      <h1 style={{ marginBottom: 8 }}>Administrator accounts</h1>
      <p style={{ color: 'var(--muted)', lineHeight: 1.5 }}>
        Create or reset the website-only logins for Ian, Craig, Liam and Jake. They must choose a new password when they first sign in.
      </p>
      <button onClick={generateAccounts} disabled={loading} style={buttonStyle}>
        {loading ? 'Generating…' : 'Generate / reset administrator accounts'}
      </button>
      {error && <p role="alert" style={{ color: '#B3261E', fontWeight: 700 }}>{error}</p>}

      {credentials.length > 0 && (
        <section style={{ marginTop: 24 }}>
          <div role="alert" style={{ background: '#FFF9E8', border: '2px solid var(--brass)', borderRadius: 8, padding: 14, marginBottom: 14 }}>
            Copy these details now and send each person only their own login. The temporary passwords are shown on this screen only.
          </div>
          <button onClick={copyAll} style={{ ...buttonStyle, background: 'var(--brass)', marginBottom: 14 }}>
            {copied ? 'Copied' : 'Copy all login details'}
          </button>
          <div style={{ display: 'grid', gap: 10 }}>
            {credentials.map((item) => (
              <article key={item.username} style={cardStyle}>
                <strong>{item.displayName}</strong>
                <div><span style={mutedStyle}>Username:</span> <code>{item.username}</code></div>
                <div><span style={mutedStyle}>Temporary password:</span> <code style={{ wordBreak: 'break-all' }}>{item.temporaryPassword}</code></div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

const buttonStyle = { padding: '12px 16px', border: 0, borderRadius: 6, background: 'var(--pitch)', color: 'var(--paper)', fontWeight: 700, fontSize: 15, cursor: 'pointer' }
const cardStyle = { border: '1px solid var(--line)', borderRadius: 8, padding: 14, display: 'grid', gap: 8 }
const mutedStyle = { color: 'var(--muted)' }
const linkStyle = { color: 'var(--brass)', fontWeight: 700, textDecoration: 'none' }
