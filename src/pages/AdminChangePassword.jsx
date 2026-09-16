import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function AdminChangePassword() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPasswords, setShowPasswords] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [saving, setSaving] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setStatus('')

    if (password.length < 6) {
      setError('Use at least 6 characters.')
      return
    }
    const specialCharacterCount = (password.match(/[^A-Za-z0-9\\s]/g) || []).length
    if (specialCharacterCount < 2) {
      setError('Include at least 2 special characters, such as ! @ # $ %.')
      return
    }
    if (password !== confirmPassword) {
      setError('The passwords do not match. Please check both boxes.')
      return
    }

    setSaving(true)
    setStatus('Changing your password…')
    const { data: userData, error: userError } = await supabase.auth.updateUser({ password })
    if (userError || !userData.user) {
      const message = userError?.message?.toLowerCase().includes('different from the old password')
        ? 'Please choose a password different from your temporary password.'
        : userError?.message || 'The password could not be changed. Please try again.'
      setError(message)
      setStatus('')
      setSaving(false)
      return
    }

    setStatus('Password changed. Completing setup…')
    const { error: profileError } = await supabase
      .from('admin_profiles')
      .update({ must_change_password: false })
      .eq('id', userData.user.id)

    if (profileError) {
      setError('Your password changed, but setup could not be completed. Please contact Iain.')
      setStatus('')
      setSaving(false)
      return
    }

    setStatus('Password changed successfully. Returning you to sign in…')
    await supabase.auth.signOut({ scope: 'local' })
    navigate('/admin?passwordChanged=1', { replace: true })
  }

  return (
    <div className="container" style={{ padding: '48px 20px', maxWidth: 420 }}>
      <h1 style={{ fontSize: 26, marginBottom: 10, color: 'var(--pitch)' }}>Create your permanent password</h1>
      <div role="status" style={{ padding: 12, marginBottom: 16, border: '1px solid #1B6E3C', borderRadius: 6, background: '#EFFAF3', color: '#1B6E3C', fontWeight: 700, lineHeight: 1.45 }}>
        Your username and temporary password were correct. Complete this one-time step before entering the admin area.
      </div>
      <p style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.5, marginBottom: 24 }}>
        Enter a new password of at least 6 characters, including at least 2 special characters such as ! @ # $ %. It must be different from the temporary password you just used. After saving, you will return to the login screen and sign in with the new password.
      </p>
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 14 }}>
        <label style={labelStyle}>
          New password
          <input
            type={showPasswords ? 'text' : 'password'}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={saving}
            required
            style={inputStyle}
          />
        </label>
        <label style={labelStyle}>
          Confirm new password
          <input
            type={showPasswords ? 'text' : 'password'}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={saving}
            required
            style={inputStyle}
          />
        </label>
        <label style={showStyle}>
          <input
            type="checkbox"
            checked={showPasswords}
            onChange={(e) => setShowPasswords(e.target.checked)}
          />
          Show passwords
        </label>
        {error && <p role="alert" style={{ color: '#B3261E', margin: 0, fontWeight: 700 }}>{error}</p>}
        {status && <p role="status" style={{ color: '#1B6E3C', margin: 0, fontWeight: 700 }}>{status}</p>}
        <button type="submit" disabled={saving} style={{ ...buttonStyle, opacity: saving ? 0.7 : 1 }}>
          {saving ? 'Changing password…' : 'Save new password'}
        </button>
      </form>
    </div>
  )
}

const labelStyle = { display: 'grid', gap: 6, fontSize: 14, fontWeight: 700 }
const showStyle = { display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700 }
const inputStyle = { padding: '12px', border: '1px solid var(--line)', borderRadius: 6, fontSize: 16 }
const buttonStyle = { padding: '12px', border: 0, borderRadius: 6, background: 'var(--pitch)', color: 'var(--paper)', fontWeight: 700, fontSize: 15 }
