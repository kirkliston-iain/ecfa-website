import { Link, NavLink } from 'react-router-dom'

const COMPETITIONS = [
  { slug: 'appin-league', label: 'Appin League' },
  { slug: 'knockout-cup', label: 'Knockout Cup' },
  { slug: 'league-cup', label: 'League Cup' },
  { slug: 'brian-latto-cup', label: 'Brian Latto Cup' },
]

export default function Header() {
  return (
    <header style={{ background: 'var(--pitch)', color: '#fff' }}>
      <div className="container" style={{ padding: '20px 20px 0' }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: '#fff',
              color: 'var(--pitch)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 13,
              letterSpacing: 0.5,
              flexShrink: 0,
              border: '3px solid var(--pitch-dark)',
            }}
          >
            ECFA
          </span>
          <span style={{ fontSize: 14, opacity: 0.9 }}>
            Edinburgh Churches Football Association
          </span>
        </Link>

        <nav
          style={{
            display: 'flex',
            gap: 24,
            marginTop: 22,
            borderBottom: '1px solid rgba(255,255,255,0.25)',
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
                borderBottom: isActive ? '2px solid #fff' : '2px solid transparent',
                color: '#fff',
                opacity: isActive ? 1 : 0.75,
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
