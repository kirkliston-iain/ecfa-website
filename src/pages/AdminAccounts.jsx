import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'

const BOOTSTRAP_IAIN_ID = '28696bc6-2df2-4855-b259-3f156ad55748'
const ACCOUNTS = [
  { username: 'iain.mccalman', displayName: 'Iain McCalman' },
  { username: 'ian.midwinter', displayName: 'Ian Midwinter' },
  { username: 'craig.mitchell', displayName: 'Craig Mitchell' },
  { username: 'liam.burns', displayName: 'Liam Burns' },
  { username: 'jake.morris', displayName: 'Jake Morris' },
]

export default function AdminAccounts() {
  const [allowed, setAllowed] = useState(null)
  const [credentials, setCredentials] = useState([])
  const [loading, setLoading] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setAllowed(data.user?.id === BOOTSTRAP_IAIN_ID || data.user?.app_metadata?.role === 'owner')
    })
  }, [])

  async function generateAccounts(username = '') {
    const label = username ? `reset ${username}` : 'generate or reset all five administrator accounts'
    if (!window.confirm(`Are you sure you want to ${label}? Any existing temporary password affected by this will stop working.`)) return
    setLoading(username || 'all')
    setError('')
    setCredentials([])
    setCopied(false)
    const { data, error: invokeError } = await supabase.functions.invoke('provision-admin-accounts', {
      body: username ? { username } : {},
    })
    setLoading('')
    if (invokeError || data?.error) {
      setError(data?.error || invokeError?.message || 'The account could not be generated.')
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
        Generate website-only usernames for all five administrators, or reset one person’s password. Every temporary password must be changed at the next login.
      </p>
      <button onClick={() => generateAccounts()} disabled={!!loading} style={buttonStyle}>
        {loading === 'all' ? 'Generating…' : 'Generate / reset all accounts'}
      </button>

      <div style={{ display: 'grid', gap: 10, marginTop: 18 }}>
        {ACCOUNTS.map((account) => (
          <article key={account.username} style={cardStyle}>
            <div style={{ flex: 1 }}>
              <strong>{account.displayName}</strong>
              <div><span style={mutedStyle}>Username:</span> <code>{account.username}</code></div>
            </div>
            <button
              onClick={() => generateAccounts(account.username)}
              disabled={!!loading}
              style={outlineButtonStyle}
            >
              {loading === account.username ? 'Resetting…' : 'Reset password'}
            </button>
          </article>
        ))}
      </div>

      {error && <p role="alert" style={{ color: '#B3261E', fontWeight: 700 }}>{error}</p>}

      {credentials.length > 0 && (
        <section style={{ marginTop: 24 }}>
          <div role="alert" style={{ background: '#FFF9E8', border: '2px solid var(--brass)', borderRadius: 8, padding: 14, marginBottom: 14 }}>
            Copy these details now. Temporary passwords are shown on this screen only.
          </div>
          <button onClick={copyAll} style={{ ...buttonStyle, background: 'var(--brass)', marginBottom: 14 }}>
            {copied ? 'Copied' : 'Copy login details'}
          </button>
          <div style={{ display: 'grid', gap: 10 }}>
            {credentials.map((item) => (
              <article key={item.username} style={{ ...cardStyle, display: 'grid' }}>
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
const outlineButtonStyle = { padding: '9px 12px', border: '1px solid var(--pitch)', borderRadius: 6, background: 'white', color: 'var(--pitch)', fontWeight: 700, cursor: 'pointer' }
const cardStyle = { border: '1px solid var(--line)', borderRadius: 8, padding: 14, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }
const mutedStyle = { color: 'var(--muted)' }
const linkStyle = { color: 'var(--brass)', fontWeight: 700, textDecoration: 'none' }
