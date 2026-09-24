import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

export default function Footer() {
  const location = useLocation()
  const navigate = useNavigate()
  const [views, setViews] = useState(null)
  const [signedIn, setSignedIn] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(!!session)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    let cancelled = false

    async function track() {
      await supabase.rpc('record_page_view', { view_path: location.pathname })
      const { data } = await supabase.rpc('get_web_stats')
      if (!cancelled && data?.all_time != null) setViews(Number(data.all_time))
    }

    track()
    return () => {
      cancelled = true
    }
  }, [location.pathname])

  async function signOut() {
    setSigningOut(true)
    setSignOutError('')
    const { error } = await supabase.auth.signOut({ scope: 'local' })
    setSigningOut(false)

    if (error) {
      setSignOutError('Sign out failed. Please try again.')
      return
    }

    setSignedIn(false)
    navigate('/')
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }

  return (
    <footer style={{ borderTop: '1px solid var(--line)', marginTop: 60 }}>
      <div
        className="container"
        style={{
          padding: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 13,
          color: 'var(--muted)',
          gap: 12,
        }}
      >
        <span>Edinburgh Churches Football Association</span>
        {views != null && <Link to="/web-stats">{views.toLocaleString()} site visits · View stats</Link>}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          {signedIn ? (
            <button onClick={signOut} disabled={signingOut} style={footerButtonStyle}>
              {signingOut ? 'Signing out…' : 'Manager sign out'}
            </button>
          ) : (
            <button
              onClick={() => window.dispatchEvent(new Event('open-manager-gate'))}
              style={footerButtonStyle}
            >
              Manager sign in
            </button>
          )}
          <Link to="/admin">Admin</Link>
          {signOutError && <span role="alert" style={{ color: '#B3261E' }}>{signOutError}</span>}
        </div>
      </div>
    </footer>
  )
}

const footerButtonStyle = {
  background: 'none',
  border: 'none',
  padding: 0,
  font: 'inherit',
  color: 'var(--muted)',
  cursor: 'pointer',
  textDecoration: 'underline',
}
