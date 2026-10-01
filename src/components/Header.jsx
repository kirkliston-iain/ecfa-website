import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { supabase } from '../supabaseClient'

const TABS = [
  { to: '/', label: 'Match Hub', end: true },
  { to: '/news', label: 'News' },
  { to: '/standings', label: 'Competitions' },
  { to: '/teams', label: 'Teams' },
  { to: '/stats', label: 'Stats' },
  { to: '/honours', label: 'Honours' },
  { to: '/archive', label: 'Archive' },
  { to: '/sponsors', label: 'Sponsors' },
  { to: '/charity', label: 'Charity' },
  { to: '/downloads', label: 'Downloads' },
  { to: '/search', label: 'Search' },
  { to: '/contact', label: 'Contact Us' },
]

export default function Header() {
  const [signedIn, setSignedIn] = useState(false)
  const [shareStatus, setShareStatus] = useState('')
  const route = useLocation()

  useEffect(() => setShareStatus(''), [route.pathname, route.search, route.hash])

  async function sharePage() {
    const url = window.location.href
    if (navigator.share) {
      try {
        await navigator.share({ title: document.title, url })
        return
      } catch (error) {
        if (error.name === 'AbortError') return
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      setShareStatus('Link copied')
    } catch {
      window.prompt('Copy this page link', url)
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(!!session)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  const statsIndex = TABS.findIndex((tab) => tab.to === '/stats')
  const tabs = signedIn
    ? [...TABS.slice(0, statsIndex + 1), { to: '/discipline', label: 'Discipline' }, ...TABS.slice(statsIndex + 1)]
    : TABS

  return (
    <header>
      <div style={{ background: 'var(--brass)' }}>
        <div
          className="container"
          style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 14 }}
        >
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0, flex: 1 }}>
            <img
              src="/badges/ecfa-logo.png"
              alt="ECFA"
              style={{ width: 44, height: 44, objectFit: 'contain', flexShrink: 0 }}
            />
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 16, lineHeight: 1.25 }}>
              Edinburgh Churches Football Association
            </span>
          </Link>
          <button
            type="button"
            onClick={sharePage}
            title="Share this page"
            aria-label="Share this page"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0, border: '1px solid rgba(255,255,255,.7)', borderRadius: 6, padding: '8px 10px', background: 'transparent', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 16V3m0 0L7 8m5-5 5 5"/><path d="M4 14v5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5"/></svg>
            {shareStatus || 'Share'}
          </button>
        </div>
      </div>

      <div style={{ background: '#fff', borderBottom: '1px solid var(--line)' }}>
        <nav
          className="container hscroll site-navigation"
          style={{ display: 'flex', gap: 28, overflowX: 'auto' }}
        >
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              style={({ isActive }) => ({
                padding: '14px 0',
                fontSize: 13,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                whiteSpace: 'nowrap',
                borderBottom: isActive ? '3px solid var(--brass)' : '3px solid transparent',
                color: isActive ? 'var(--ink)' : 'var(--muted)',
              })}
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  )
}
