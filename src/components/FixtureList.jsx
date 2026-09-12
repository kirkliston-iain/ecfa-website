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
            <div style={{ fontWeight: 600 }}>
              {f.home_team?.name} <span style={{ color: 'var(--muted)' }}>v</span> {f.away_team?.name}
            </div>
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
