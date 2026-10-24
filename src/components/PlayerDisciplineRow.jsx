import DisciplineDetailLink from './DisciplineDetailLink'

export default function PlayerDisciplineRow({ row, cellStyle, teamFilter }) {
  const name = `${row.player.first_name} ${row.player.last_name}`
  return (
    <tr>
      <td style={{ ...cellStyle, fontWeight: 600 }}>
        <DisciplineDetailLink className="discipline-player-toggle" to={`/discipline/players/${row.player.id}`} teamFilter={teamFilter}>
          {name} <span aria-hidden="true">→</span>
        </DisciplineDetailLink>
      </td>
      <td style={{ ...cellStyle, color: 'var(--muted)' }}>{row.team?.name || 'No team'}</td>
      <td style={{ ...cellStyle, textAlign: 'center', fontWeight: 700 }}>{row.points}</td>
    </tr>
  )
}
