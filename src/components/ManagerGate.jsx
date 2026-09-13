import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

const MANAGER_EMAIL = 'managers@ecfa-website.org'

export default function ManagerGate() {
  const [visible, setVisible] = useState(false)
  const [code, setCode] = useState('')
  const [error, setError] = useState(false)
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    function handleOpen() {
      setCode('')
      setError(false)
      setVisible(true)
    }
    window.addEventListener('open-manager-gate', handleOpen)
    return () => window.removeEventListener('open-manager-gate', handleOpen)
  }, [])

  function dismiss() {
    setVisible(false)
  }

  async function submitCode() {
    if (!code.trim()) return
    setChecking(true)
    setError(false)
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: MANAGER_EMAIL,
      password: code.trim(),
    })
    setChecking(false)
    if (signInError) {
      setError(true)
      return
    }
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: '#fff',
          width: '100%',
          maxWidth: 480,
          borderRadius: '12px 12px 0 0',
          padding: '24px 20px 28px',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Enter manager code</div>
        <input
          type="password"
          inputMode="numeric"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoFocus
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '12px 14px',
            fontSize: 16,
            border: '1px solid var(--line)',
            borderRadius: 8,
            marginBottom: 10,
          }}
        />
        {error && (
          <div style={{ color: '#B3261E', fontSize: 13, marginBottom: 10 }}>
            That code wasn't recognised.
          </div>
        )}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={submitCode} disabled={checking} style={primaryButtonStyle}>
            {checking ? 'Checking…' : 'Submit'}
          </button>
          <button onClick={dismiss} style={secondaryButtonStyle}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

const primaryButtonStyle = {
  flex: 1,
  padding: '12px',
  background: 'var(--ink)',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  fontSize: 15,
  fontWeight: 600,
  cursor: 'pointer',
}
const secondaryButtonStyle = {
  flex: 1,
  padding: '12px',
  background: 'none',
  color: 'var(--ink)',
  border: '1px solid var(--line)',
  borderRadius: 8,
  fontSize: 15,
  cursor: 'pointer',
}
