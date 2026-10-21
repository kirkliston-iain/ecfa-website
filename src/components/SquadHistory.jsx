import { TeamHistoryLink } from './HistoryLinks'

export const SQUAD_SELECT = 'id, player_id, previous_team_id, new_team_id, event_type, effective_date, date_basis, recorded_at, previous_team:previous_team_id(id, name), new_team:new_team_id(id, name)'

export function historyDate(value) {
  return value ? new Date(`${value.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : 'Joining date unknown'
}

export default function SquadHistory({ rows, error }) {
  return <section style={{ marginBottom: 34 }}>
    <h2 style={{ fontSize: 21, color: 'var(--brass)' }}>Squad history</h2>
    <p style={{ color: 'var(--muted)', fontSize: 13 }}>Recorded squad membership, including players who have not played or scored. This is registration evidence, not an appearance record. Earlier history may be incomplete.</p>
    {error ? <p role="alert">Squad history could not be loaded. Please refresh.</p> : !rows.length ? <p>No squad history recorded.</p> : <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead><tr>{['Date', 'Squad change', 'Club'].map(text => <th key={text} style={cell}>{text}</th>)}</tr></thead>
        <tbody>{rows.map(row => <tr key={row.id}>
          <td style={cell}>{historyDate(row.effective_date)}<small style={{ display: 'block', color: 'var(--muted)' }}>{row.date_basis === 'confirmed' ? 'Confirmed transfer date' : row.date_basis === 'observed' ? `On list when checked ${historyDate(row.recorded_at)}` : 'Website record date'}</small></td>
          <td style={cell}>{{ snapshot: 'On squad list', added: 'Added to squad', removed: 'Removed from squad', moved: 'Moved club' }[row.event_type]}</td>
          <td style={cell}>{row.previous_team_id && <TeamHistoryLink id={row.previous_team_id} name={row.previous_team?.name} />}{row.previous_team_id && row.new_team_id && ' → '}{row.new_team_id && <TeamHistoryLink id={row.new_team_id} name={row.new_team?.name} />}</td>
        </tr>)}</tbody>
      </table>
    </div>}
  </section>
}
const cell = { textAlign: 'left', padding: '11px 8px', borderBottom: '1px solid var(--line)', verticalAlign: 'top' }
