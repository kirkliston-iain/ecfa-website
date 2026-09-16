import { useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function AdminLogin() {
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const loginRef = useRef(null)
  const passwordRef = useRef(null)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const passwordChanged = searchParams.get('passwordChanged') === '1'

  async function handleSubmit() {
    setLoading(true)
    setError(null)

    const enteredLogin = loginRef.current?.value || login
    const enteredPassword = passwordRef.current?.value || password
    const cleanedLogin = enteredLogin.trim().toLowerCase()
    if (!cleanedLogin || !enteredPassword) {
      setError('Enter your username and password, then tap Sign in.')
      setLoading(false)
      return
    }
    const email = cleanedLogin.includes('@') ? cleanedLogin : `${cleanedLogin}@admin.ecfa.local`
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password: enteredPassword })

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
      {passwordChanged && (
        <div role="status" style={{ padding: 12, marginBottom: 16, border: '1px solid #1B6E3C', borderRadius: 6, background: '#EFFAF3', color: '#1B6E3C', fontWeight: 700 }}>
          Password changed successfully. Sign in again using your username and new password.
        </div>
      )}
      <form onSubmit={(event) => event.preventDefault()} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <label style={labelStyle}>
          Username or email
          <input
            ref={loginRef}
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
            ref={passwordRef}
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={inputStyle}
          />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
          <input type="checkbox" checked={showPassword} onChange={(e) => setShowPassword(e.target.checked)} />
          Show password
        </label>
        {error && <p style={{ color: 'var(--red-card)', fontSize: 14, margin: 0 }}>{error}</p>}
        <button type="button" onClick={handleSubmit} disabled={loading} style={buttonStyle}>
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
