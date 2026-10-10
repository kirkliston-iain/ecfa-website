import { Link } from 'react-router-dom'
import { TeamHistoryLink } from './HistoryLinks'
import { playerName } from '../lib/playerTransfers.mjs'

export const TRANSFER_SELECT = 'id, player_id, previous_team_id, new_team_id, transfer_date, recorded_at, history_only, player:player_id(id, first_name, last_name), previous_team:previous_team_id(id, name), new_team:new_team_id(id, name)'

export default function TransferHistory({ rows, showPlayer = false }) {
  if (!rows.length) return <p style={{ color: 'var(--muted)' }}>No transfers recorded.</p>
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead><tr><th style={heading}>Date</th>{showPlayer && <th style={heading}>Player</th>}<th style={heading}>Previous club</th><th style={heading}>New club</th></tr></thead>
        <tbody>{rows.map((row) => (
          <tr key={row.id}>
            <td style={cell}>{new Date(`${row.transfer_date}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
            {showPlayer && <td style={cell}><Link to={`/players/${row.player_id}`}>{playerName(row.player)}</Link></td>}
            <td style={cell}><TeamHistoryLink name={row.previous_team?.name} id={row.previous_team_id} /></td>
            <td style={cell}><TeamHistoryLink name={row.new_team?.name} id={row.new_team_id} /></td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  )
}
const heading = { textAlign: 'left', padding: '9px 8px', borderBottom: '1px solid var(--line)', color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase' }
const cell = { padding: '11px 8px', borderBottom: '1px solid var(--line)', verticalAlign: 'top' }
