import { Link, NavLink } from 'react-router-dom'

const TABS = [
  { to: '/', label: 'Match Hub', end: true },
  { to: '/competitions', label: 'Competitions' },
  { to: '/standings', label: 'Standings' },
  { to: '/scorers', label: 'Scorers' },
  { to: '/honours', label: 'Honours' },
]

export default function Header() {
  return (
    <header>
      <div style={{ background: 'var(--brass)' }}>
        <div
          className="container"
          style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 14 }}
        >
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span
              style={{
                width: 40,
                height: 40,
                borderRadius: 6,
                background: '#fff',
                color: 'var(--brass)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: 12,
                letterSpacing: 0.5,
                flexShrink: 0,
              }}
            >
              ECFA
            </span>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>
              Edinburgh Churches Football Association
            </span>
          </Link>
        </div>
      </div>

      <div style={{ background: '#fff', borderBottom: '1px solid var(--line)' }}>
        <nav
          className="container hscroll"
          style={{ display: 'flex', gap: 28, overflowX: 'auto' }}
        >
          {TABS.map((t) => (
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
