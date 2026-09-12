import { Link } from 'react-router-dom'

function Badge({ logoUrl, size = 18 }) {
  if (!logoUrl) return null
  return (
    <img
      src={logoUrl}
      alt=""
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        objectFit: 'cover',
        background: '#fff',
        flexShrink: 0,
      }}
    />
  )
}

export default function FixtureList({ fixtures }) {
  if (fixtures.length === 0) {
    return <p style={{ color: '#8A8570' }}>No fixtures scheduled yet.</p>
  }

  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
      {fixtures.map((f) => (
        <li key={f.id} style={{ borderBottom: '1px solid var(--line)' }}>
          <Link
            to={`/fixtures/${f.id}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 4px',
              fontSize: 14,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              {f.round_name && (
                <div style={{ fontSize: 12, color: 'var(--brass)', marginBottom: 2 }}>{f.round_name}</div>
              )}
              <div style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <Badge logoUrl={f.home_team?.logo_url} />
                {f.home_team?.name}
                <span style={{ color: '#8A8570' }}>v</span>
                <Badge logoUrl={f.away_team?.logo_url} />
                {f.away_team?.name}
              </div>
            </div>
            <div style={{ textAlign: 'right', paddingLeft: 12, flexShrink: 0 }}>
              {f.status === 'played' ? (
                <span style={{ fontWeight: 700, color: 'var(--pitch)' }}>
                  {f.home_score} – {f.away_score}
                </span>
              ) : (
                <span style={{ color: '#8A8570' }}>
                  {f.fixture_date
                    ? new Date(f.fixture_date).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                      })
                    : 'TBC'}
                </span>
              )}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  )
}
