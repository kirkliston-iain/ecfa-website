import { useState } from 'react'
import DisciplineCardHistory from './DisciplineCardHistory'

export default function PlayerDisciplineRow({ row, cellStyle }) {
  const [open, setOpen] = useState(false)
  const name = `${row.player.first_name} ${row.player.last_name}`
  const historyId = `card-history-${row.player.id}`

  const toggle = () => setOpen((value) => !value)
  return (
    <>
      <tr className="discipline-player-row" onClick={toggle}>
        <td style={{ ...cellStyle, fontWeight: 600 }}>
          <button className="discipline-player-toggle" type="button" onClick={(event) => { event.stopPropagation(); toggle() }} aria-expanded={open} aria-controls={historyId} aria-label={`${open ? 'Hide' : 'Show'} card history for ${name}`}>
            {name} <span aria-hidden="true">{open ? '−' : '+'}</span>
          </button>
        </td>
        <td style={{ ...cellStyle, color: 'var(--muted)' }}>{row.team?.name || 'No team'}</td>
        <td style={{ ...cellStyle, textAlign: 'center', fontWeight: 700 }}>{row.points}</td>
      </tr>
      {open && (
        <tr>
          <td colSpan={3} style={{ padding: 0 }}>
            <section id={historyId} className="discipline-card-history" aria-label={`Card history for ${name}`}>
              <h3>When did I get cards?</h3>
              <p className="discipline-history-summary">{name} · {row.points} points</p>
              <DisciplineCardHistory playerId={row.player.id} />
            </section>
          </td>
        </tr>
      )}
    </>
  )
}
