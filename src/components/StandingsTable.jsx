export function TopScorersTable({ rows }) {
  return (
    <div style={{ marginBottom: 40 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--pitch)' }}>
            <th style={{ textAlign: 'left', padding: '8px', fontFamily: 'var(--font-display)', color: 'var(--pitch)' }}>#</th>
            <th style={{ textAlign: 'left', padding: '8px', fontFamily: 'var(--font-display)', color: 'var(--pitch)' }}>Player</th>
            <th style={{ textAlign: 'left', padding: '8px', fontFamily: 'var(--font-display)', color: 'var(--pitch)' }}>Team</th>
            <th style={{ textAlign: 'center', padding: '8px', fontFamily: 'var(--font-display)', color: 'var(--pitch)' }}>Goals</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.player_id} style={{ borderBottom: '1px solid var(--line)' }}>
              <td style={{ padding: '10px 8px' }}>{i + 1}</td>
              <td style={{ padding: '10px 8px', fontWeight: 500 }}>
                {row.first_name} {row.last_name}
              </td>
              <td style={{ padding: '10px 8px', color: '#5A5646' }}>{row.team_name}</td>
              <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700, color: 'var(--pitch)' }}>
                {row.total_goals}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} style={{ padding: '24px 8px', textAlign: 'center', color: '#8A8570' }}>
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
        <h3 style={{ fontSize: 18, marginBottom: 10, color: 'var(--pitch)' }}>{groupName}</h3>
      )}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--pitch)' }}>
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
              <td style={{ ...tdStyle('left'), fontWeight: 500 }}>{row.teamName}</td>
              <td style={tdStyle()}>{row.played}</td>
              <td style={tdStyle()}>{row.won}</td>
              <td style={tdStyle()}>{row.drawn}</td>
              <td style={tdStyle()}>{row.lost}</td>
              <td style={tdStyle()}>{row.goalDifference}</td>
              <td style={{ ...tdStyle(), fontWeight: 700, color: 'var(--pitch)' }}>{row.points}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={8} style={{ padding: '24px 8px', textAlign: 'center', color: '#8A8570' }}>
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
    fontFamily: 'var(--font-display)',
    fontWeight: 600,
    color: 'var(--pitch)',
  }
}

function tdStyle(align = 'center') {
  return { textAlign: align, padding: '10px 8px' }
}
