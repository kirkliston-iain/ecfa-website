import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function AdminLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

    setLoading(false)
    if (signInError) {
      setError('Could not sign in — check your email and password.')
      return
    }
    navigate('/admin/dashboard')
  }

  return (
    <div className="container" style={{ padding: '64px 20px', maxWidth: 380 }}>
      <h1 style={{ fontSize: 26, marginBottom: 24, color: 'var(--pitch)' }}>Admin sign in</h1>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <label style={labelStyle}>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={inputStyle}
          />
        </label>
        <label style={labelStyle}>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={inputStyle}
          />
        </label>
        {error && <p style={{ color: 'var(--red-card)', fontSize: 14, margin: 0 }}>{error}</p>}
        <button type="submit" disabled={loading} style={buttonStyle}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}

const labelStyle = { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14 }
const inputStyle = {
  padding: '10px 12px',
  border: '1px solid var(--line)',
  fontSize: 15,
  fontFamily: 'var(--font-body)',
}
const buttonStyle = {
  marginTop: 8,
  padding: '12px',
  background: 'var(--pitch)',
  color: 'var(--paper)',
  border: 'none',
  fontSize: 15,
  fontWeight: 500,
  cursor: 'pointer',
}
