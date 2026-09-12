import { Link, NavLink } from 'react-router-dom'

const COMPETITIONS = [
  { slug: 'appin-league', label: 'Appin League' },
  { slug: 'knockout-cup', label: 'Knockout Cup' },
  { slug: 'league-cup', label: 'League Cup' },
  { slug: 'brian-latto-cup', label: 'Brian Latto Cup' },
]

export default function Header() {
  return (
    <header style={{ background: 'var(--pitch)', color: 'var(--paper)' }}>
      <div className="container" style={{ padding: '20px 20px 0' }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 28,
              fontWeight: 700,
              color: 'var(--brass-light)',
            }}
          >
            ECFA
          </span>
          <span style={{ fontSize: 14, opacity: 0.85 }}>
            Edinburgh Churches Football Association
          </span>
        </Link>

        <nav
          style={{
            display: 'flex',
            gap: 24,
            marginTop: 22,
            borderBottom: '1px solid rgba(246,244,239,0.2)',
            overflowX: 'auto',
          }}
        >
          {COMPETITIONS.map((c) => (
            <NavLink
              key={c.slug}
              to={`/competitions/${c.slug}`}
              style={({ isActive }) => ({
                padding: '0 0 12px',
                fontSize: 14,
                fontWeight: 500,
                whiteSpace: 'nowrap',
                borderBottom: isActive ? '2px solid var(--brass-light)' : '2px solid transparent',
                color: isActive ? 'var(--brass-light)' : 'var(--paper)',
              })}
            >
              {c.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  )
}
