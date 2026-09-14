function Badge({ logoUrl, name, size = 20 }) {
  if (logoUrl) {
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
  const initials = (name || '?')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'var(--ink)',
        color: '#fff',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.4,
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {initials}
    </span>
  )
}

export default function FixtureList({ fixtures }) {
  if (fixtures.length === 0) {
    return <p style={{ color: 'var(--muted)' }}>No fixtures scheduled yet.</p>
  }

  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
      {fixtures.map((f) => (
        <li
          key={f.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 0',
            borderBottom: '1px solid var(--line)',
            fontSize: 14,
          }}
        >
          <div style={{ flex: 1 }}>
            {f.round_name && (
              <div style={{ fontSize: 12, color: 'var(--brass)', marginBottom: 2, fontWeight: 600 }}>{f.round_name}</div>
            )}
            <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <Badge
                logoUrl={f.home_team?.logo_url}
                name={f.home_team?.name || f.home_placeholder || 'TBC'}
              />
              <span style={!f.home_team ? placeholderStyle : undefined}>
                {f.home_team?.name || f.home_placeholder || 'TBC'}
              </span>
              <span style={{ color: 'var(--muted)' }}>v</span>
              <Badge
                logoUrl={f.away_team?.logo_url}
                name={f.away_team?.name || f.away_placeholder || 'TBC'}
              />
              <span style={!f.away_team ? placeholderStyle : undefined}>
                {f.away_team?.name || f.away_placeholder || 'TBC'}
              </span>
            </div>
            {(f.venue || (f.fixture_date && f.fixture_date.slice(11, 16) !== '00:00')) && (
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>
                {f.fixture_date && f.fixture_date.slice(11, 16) !== '00:00' ? f.fixture_date.slice(11, 16) : ''}
                {f.fixture_date && f.fixture_date.slice(11, 16) !== '00:00' && f.venue ? ' · ' : ''}
                {f.venue || ''}
              </div>
            )}
          </div>
          <div style={{ textAlign: 'right' }}>
            {f.status === 'played' ? (
              <span style={{ fontWeight: 800, color: 'var(--ink)' }}>
                {f.home_score} – {f.away_score}
              </span>
            ) : (
              <span style={{ color: 'var(--muted)' }}>
                {f.fixture_date
                  ? new Date(f.fixture_date).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                    })
                  : 'TBC'}
              </span>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}

const placeholderStyle = {
  color: 'var(--muted)',
  fontStyle: 'italic',
  fontWeight: 400,
}
