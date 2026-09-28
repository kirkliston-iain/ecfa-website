import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { getVisitId, recordVisit } from '../utils/webAnalytics'

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
      if (!location.pathname.startsWith('/admin') && !location.pathname.startsWith('/discipline')) {
        await supabase.rpc('record_page_view', { view_path: location.pathname, p_visit_id: getVisitId() })
      }
      const { data } = await supabase.rpc('get_public_web_summary')
      if (!cancelled && data?.all_time != null) setViews(Number(data.all_time))
    }

    track()
    return () => {
      cancelled = true
    }
  }, [location.pathname])

  useEffect(() => {
    if (location.pathname.startsWith('/admin') || location.pathname.startsWith('/discipline')) return undefined
    let lastPulse = Date.now()
    let lastActivity = lastPulse
    recordVisit()
    const activity = () => { lastActivity = Date.now() }
    const pulse = (leaving = false) => {
      const now = Date.now()
      const seconds = Math.floor(Math.max(0, Math.min(now, lastActivity + 60000) - lastPulse) / 1000)
      if ((leaving || !document.hidden) && seconds > 0) recordVisit(seconds)
      lastPulse = now
    }
    const visibility = () => { if (document.hidden) pulse(true); else { lastPulse = Date.now(); activity() } }
    window.addEventListener('pointerdown', activity, { passive: true })
    window.addEventListener('keydown', activity)
    window.addEventListener('scroll', activity, { passive: true })
    document.addEventListener('visibilitychange', visibility)
    const timer = window.setInterval(() => pulse(), 15000)
    return () => {
      pulse(true)
      clearInterval(timer)
      window.removeEventListener('pointerdown', activity)
      window.removeEventListener('keydown', activity)
      window.removeEventListener('scroll', activity)
      document.removeEventListener('visibilitychange', visibility)
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
        {views != null && <Link to="/web-stats">{views.toLocaleString()} page views · View stats</Link>}
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
