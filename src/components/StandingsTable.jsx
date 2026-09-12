import { Link } from 'react-router-dom'

function Badge({ logoUrl, name, size = 22 }) {
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
        background: 'rgba(255,255,255,0.25)',
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
              <td style={{ padding: '10px 8px', color: '#5A6B85' }}>{row.team_name}</td>
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
    <div style={{ marginBottom: 28 }}>
      {groupName && (
        <h3 style={{ fontSize: 16, marginBottom: 8, color: 'var(--pitch)' }}>{groupName}</h3>
      )}
      <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 4px', fontSize: 13 }}>
        <thead>
          <tr>
            <th style={headStyle('left')}>#</th>
            <th style={headStyle('left')}>Team</th>
            <th style={headStyle()}>P</th>
            <th style={headStyle()}>W</th>
            <th style={headStyle()}>D</th>
            <th style={headStyle()}>L</th>
            <th style={headStyle()}>F</th>
            <th style={headStyle()}>A</th>
            <th style={headStyle()}>+/-</th>
            <th style={headStyle()}>PTS</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.teamId}>
              <td style={rowStyle('left', 'first')}>{i + 1}</td>
              <td style={{ ...rowStyle('left'), fontWeight: 600 }}>
                <Link
                  to={`/teams/${row.teamId}`}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: '#fff' }}
                >
                  <Badge logoUrl={row.teamLogo} name={row.teamName} />
                  {row.teamName}
                </Link>
              </td>
              <td style={rowStyle()}>{row.played}</td>
              <td style={rowStyle()}>{row.won}</td>
              <td style={rowStyle()}>{row.drawn}</td>
              <td style={rowStyle()}>{row.lost}</td>
              <td style={rowStyle()}>{row.goalsFor}</td>
              <td style={rowStyle()}>{row.goalsAgainst}</td>
              <td style={rowStyle()}>{row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}</td>
              <td style={rowStyle('center', 'last', true)}>{row.points}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={10} style={{ padding: '20px 8px', textAlign: 'center', color: '#8A8570' }}>
                No standings yet — check back once fixtures have been played.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function headStyle(align = 'center') {
  return {
    textAlign: align,
    padding: '4px 6px 6px',
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: 10,
    color: '#5A6B85',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  }
}

function rowStyle(align = 'center', position, isPoints) {
  const style = {
    textAlign: align,
    padding: '7px 6px',
    fontWeight: isPoints ? 700 : 400,
    background: isPoints ? 'var(--pitch-dark)' : 'var(--pitch)',
    color: '#fff',
  }
  if (position === 'first') style.borderRadius = '8px 0 0 8px'
  if (position === 'last') style.borderRadius = '0 8px 8px 0'
  return style
}
