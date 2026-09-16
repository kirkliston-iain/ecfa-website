import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function AdminLogin() {
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const cleanedLogin = login.trim().toLowerCase()
    const email = cleanedLogin.includes('@') ? cleanedLogin : `${cleanedLogin}@admin.ecfa.local`
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password })

    setLoading(false)
    if (signInError) {
      setError('Could not sign in — check your username or email and password.')
      return
    }
    const { data: profile } = await supabase
      .from('admin_profiles')
      .select('must_change_password')
      .eq('id', data.user.id)
      .maybeSingle()
    navigate(profile?.must_change_password ? '/admin/change-password' : '/admin/dashboard')
  }

  return (
    <div className="container" style={{ padding: '64px 20px', maxWidth: 380 }}>
      <h1 style={{ fontSize: 26, marginBottom: 24, color: 'var(--pitch)' }}>Admin sign in</h1>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <label style={labelStyle}>
          Username or email
          <input
            type="text"
            autoCapitalize="none"
            autoComplete="username"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            required
            style={inputStyle}
          />
        </label>
        <label style={labelStyle}>
          Password
          <input
            type="password"
            autoComplete="current-password"
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
