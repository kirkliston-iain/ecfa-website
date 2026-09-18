import { useEffect, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { supabase } from '../supabaseClient'

const TABS = [
  { to: '/', label: 'Match Hub', end: true },
  { to: '/standings', label: 'Competitions' },
  { to: '/teams', label: 'Teams' },
  { to: '/scorers', label: 'Scorers' },
  { to: '/referees', label: 'Referees' },
  { to: '/honours', label: 'Honours' },
  { to: '/history', label: 'History' },
  { to: '/sponsors', label: 'Sponsors' },
  { to: '/charity', label: 'Charity' },
  { to: '/downloads', label: 'Downloads' },
  { to: '/search', label: 'Search' },
  { to: '/contact', label: 'Contact Us' },
  { to: '/web-stats', label: 'Web Stats' },
]

export default function Header() {
  const [signedIn, setSignedIn] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(!!session)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  const tabs = signedIn
    ? [...TABS.slice(0, 5), { to: '/discipline', label: 'Discipline' }, ...TABS.slice(5)]
    : TABS

  return (
    <header>
      <div style={{ background: 'var(--brass)' }}>
        <div
          className="container"
          style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 14 }}
        >
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <img
              src="/badges/ecfa-logo.png"
              alt="ECFA"
              style={{ width: 44, height: 44, objectFit: 'contain', flexShrink: 0 }}
            />
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>
              Edinburgh Churches Football Association
            </span>
          </Link>
        </div>
      </div>

      <div style={{ background: '#fff', borderBottom: '1px solid var(--line)' }}>
        <nav
          className="container hscroll site-navigation"
          style={{ display: 'flex', gap: 28, overflowX: 'auto' }}
        >
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
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
              {t.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  )
}
