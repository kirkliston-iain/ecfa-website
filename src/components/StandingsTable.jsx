import { Link } from 'react-router-dom'

export function TopScorersTable({ rows }) {
  return (
    <div style={{ marginBottom: 40 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ borderBottom: '3px solid var(--brass)' }}>
            <th style={thStyle('left')}>#</th>
            <th style={thStyle('left')}>Player</th>
            <th style={thStyle('left')}>Team</th>
            <th style={thStyle()}>Goals</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.player_id} style={{ borderBottom: '1px solid var(--line)' }}>
              <td style={{ padding: '10px 8px' }}>{i + 1}</td>
              <td style={{ padding: '10px 8px', fontWeight: 600 }}>
                {row.first_name} {row.last_name}
              </td>
              <td style={{ padding: '10px 8px', color: 'var(--muted)' }}>{row.team_name}</td>
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
          <tr style={{ borderBottom: '3px solid var(--brass)' }}>
            <th style={thStyle('left')}>#</th>
            <th style={thStyle('left')}>Team</th>
            <th style={thStyle()}>P</th>
            <th style={thStyle()}>W</th>
            <th style={thStyle()}>D</th>
            <th style={thStyle()}>L</th>
            <th style={thStyle()}>GD</th>
            <th style={thStyle()}>Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.teamId} style={{ borderBottom: '1px solid var(--line)' }}>
              <td style={tdStyle('left')}>{i + 1}</td>
              <td style={{ ...tdStyle('left'), fontWeight: 600 }}>
                <Link
                  to={`/teams/${row.teamId}`}
                  style={{ color: 'var(--brass)', textDecoration: 'underline' }}
                >
                  {row.teamName}
                </Link>
              </td>
              <td style={tdStyle()}>{row.played}</td>
              <td style={tdStyle()}>{row.won}</td>
              <td style={tdStyle()}>{row.drawn}</td>
              <td style={tdStyle()}>{row.lost}</td>
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
    padding: '8px',
    fontWeight: 700,
    color: 'var(--ink)',
    textTransform: 'uppercase',
    fontSize: 12,
    letterSpacing: 0.4,
  }
}

function tdStyle(align = 'center') {
  return { textAlign: align, padding: '10px 8px' }
}
