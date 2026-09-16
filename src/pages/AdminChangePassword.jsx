import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function AdminChangePassword() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    if (password.length < 10) {
      setError('Use at least 10 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('The passwords do not match.')
      return
    }

    setSaving(true)
    const { data: userData, error: userError } = await supabase.auth.updateUser({ password })
    if (userError || !userData.user) {
      setError(userError?.message || 'The password could not be changed.')
      setSaving(false)
      return
    }

    const { error: profileError } = await supabase
      .from('admin_profiles')
      .update({ must_change_password: false })
      .eq('id', userData.user.id)

    setSaving(false)
    if (profileError) {
      setError('Password changed, but setup could not be completed. Please contact Iain.')
      return
    }
    navigate('/admin/dashboard', { replace: true })
  }

  return (
    <div className="container" style={{ padding: '48px 20px', maxWidth: 420 }}>
      <h1 style={{ fontSize: 26, marginBottom: 10, color: 'var(--pitch)' }}>Choose a new password</h1>
      <p style={{ color: 'var(--muted)', lineHeight: 1.5, marginBottom: 24 }}>
        This is required the first time you sign in with a temporary password.
      </p>
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 14 }}>
        <label style={labelStyle}>
          New password
          <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required style={inputStyle} />
        </label>
        <label style={labelStyle}>
          Confirm new password
          <input type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required style={inputStyle} />
        </label>
        {error && <p role="alert" style={{ color: '#B3261E', margin: 0 }}>{error}</p>}
        <button type="submit" disabled={saving} style={buttonStyle}>
          {saving ? 'Saving…' : 'Save new password'}
        </button>
      </form>
    </div>
  )
}

const labelStyle = { display: 'grid', gap: 6, fontSize: 14, fontWeight: 700 }
const inputStyle = { padding: '12px', border: '1px solid var(--line)', borderRadius: 6, fontSize: 16 }
const buttonStyle = { padding: '12px', border: 0, borderRadius: 6, background: 'var(--pitch)', color: 'var(--paper)', fontWeight: 700, fontSize: 15 }
