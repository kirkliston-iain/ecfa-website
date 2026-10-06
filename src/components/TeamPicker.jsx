import { useEffect, useRef } from 'react'
import './TeamPicker.css'

export default function TeamPicker({ teams, previousTeams, value, onChange }) {
  const pickerRef = useRef(null)
  const summaryRef = useRef(null)
  const selected = teams.find((team) => team.id === value)

  useEffect(() => {
    function closeOutside(event) {
      if (!pickerRef.current?.contains(event.target) && pickerRef.current) {
        pickerRef.current.open = false
      }
    }
    document.addEventListener('pointerdown', closeOutside)
    return () => document.removeEventListener('pointerdown', closeOutside)
  }, [])

  function choose(nextValue) {
    pickerRef.current.open = false
    summaryRef.current.focus()
    onChange(nextValue)
  }

  return (
    <details ref={pickerRef} className="team-picker" onKeyDown={(event) => {
      if (event.key === 'Escape') {
        pickerRef.current.open = false
        summaryRef.current.focus()
      }
    }}>
      <summary ref={summaryRef} aria-label={`Select a team${selected ? `, ${selected.name} selected` : ''}`}>
        <span>{selected?.name || 'Select a team…'}</span>
        <span className="team-picker-chevron" aria-hidden="true">▾</span>
      </summary>
      <div className="team-picker-options">
        <button type="button" className="team-picker-option" onClick={() => choose('')} aria-pressed={!value}>Select a team…</button>
        <section aria-labelledby="current-team-picker-heading">
          <h2 id="current-team-picker-heading" className="team-picker-heading team-picker-heading-current">Current league teams</h2>
          {teams.map((team) => (
            <button key={team.id} type="button" className="team-picker-option" aria-pressed={value === team.id} onClick={() => choose(team.id)}>{team.name}</button>
          ))}
        </section>
        {previousTeams.length > 0 && (
          <section aria-labelledby="previous-team-picker-heading" className="team-picker-previous">
            <h2 id="previous-team-picker-heading" className="team-picker-heading team-picker-heading-previous">
              Previous teams
              <span>No longer in the league</span>
            </h2>
            {previousTeams.map((name) => (
              <button key={name} type="button" className="team-picker-option" onClick={() => choose(`previous:${name}`)}>
                {name}<span className="team-picker-status">Former team</span>
              </button>
            ))}
          </section>
        )}
      </div>
    </details>
  )
}
