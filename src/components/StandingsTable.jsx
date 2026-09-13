import { Link } from 'react-router-dom'

function Badge({ logoUrl, name, size = 26 }) {
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

export function TopScorersTable({ rows }) {
  return (
    <div style={{ marginBottom: 40 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--line)' }}>
            <th style={thStyle('left')}>#</th>
            <th style={thStyle('left')}>Player</th>
            <th style={thStyle('left')}>Team</th>
            <th style={thStyle()}>Goals</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.player_id} style={{ borderBottom: '1px solid var(--line)' }}>
              <td style={{ padding: '10px 8px', color: 'var(--muted)' }}>{i + 1}</td>
              <td style={{ padding: '10px 8px', fontWeight: 600 }}>
                {row.first_name} {row.last_name}
              </td>
              <td style={{ padding: '10px 8px', color: 'var(--muted)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Badge logoUrl={row.team_logo} name={row.team_name} size={20} />
                  <span>{row.team_name}</span>
                </div>
              </td>
              <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 800, color: 'var(--ink)' }}>
                {row.total_goals}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} style={{ padding: '24px 8px', textAlign: 'center', color: 'var(--muted)' }}>
                No goals recorded yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

export default function StandingsTable({ groupName, rows }) {
  return (
    <div style={{ marginBottom: 40 }}>
      {groupName && (
        <h3 style={{ fontSize: 16, marginBottom: 10, fontWeight: 700 }}>{groupName}</h3>
      )}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ color: 'var(--muted)' }}>
            <th style={{ ...thStyle('left'), width: 30 }}>Pos</th>
            <th style={thStyle('left')}>Team</th>
            <th style={{ ...thStyle(), width: 34 }}>Pl</th>
            <th style={{ ...thStyle(), width: 34 }}>W</th>
            <th style={{ ...thStyle(), width: 36 }}>GF</th>
            <th style={{ ...thStyle(), width: 36 }}>GA</th>
            <th style={{ ...thStyle(), width: 40 }}>GD</th>
            <th style={{ ...thStyle(), width: 40 }}>Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.teamId} style={{ borderTop: '1px solid var(--line)' }}>
              <td style={{ padding: '14px 8px 14px 12px', fontWeight: 700, color: 'var(--muted)' }}>
                {i + 1}
              </td>
              <td style={{ padding: '14px 8px' }}>
                <Link to={`/teams/${row.teamId}`} style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700, color: 'var(--ink)' }}>
                  <Badge logoUrl={row.teamLogo} name={row.teamName} />
                  <span>{row.teamName}</span>
                </Link>
              </td>
              <td style={tdStyle()}>{row.played}</td>
              <td style={tdStyle()}>{row.won}</td>
              <td style={tdStyle()}>{row.goalsFor}</td>
              <td style={tdStyle()}>{row.goalsAgainst}</td>
              <td style={tdStyle()}>{row.goalDifference}</td>
              <td style={{ ...tdStyle(), fontWeight: 800, color: 'var(--ink)' }}>{row.points}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={8} style={{ padding: '24px 8px', textAlign: 'center', color: 'var(--muted)' }}>
                No standings yet — check back once fixtures have been played.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function thStyle(align = 'center') {
  return {
    textAlign: align,
    padding: '6px 8px',
    fontWeight: 600,
    textTransform: 'uppercase',
    fontSize: 11,
    letterSpacing: 0.4,
  }
}

function tdStyle() {
  return { textAlign: 'center', padding: '14px 8px' }
}
