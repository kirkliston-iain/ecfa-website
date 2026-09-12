import { useEffect, useRef } from 'react'

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return {
    weekday: d.toLocaleDateString('en-GB', { weekday: 'short' }).toUpperCase(),
    day: d.getDate(),
    month: d.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase(),
  }
}

export default function MatchdayCarousel({ days, selected, onSelect }) {
  const scrollRef = useRef(null)
  const selectedRef = useRef(null)

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [selected])

  function scroll(dir) {
    scrollRef.current?.scrollBy({ left: dir * 260, behavior: 'smooth' })
  }

  if (days.length === 0) return null

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 28 }}>
      <button onClick={() => scroll(-1)} style={arrowStyle} aria-label="Earlier matchdays">
        &lsaquo;
      </button>
      <div
        ref={scrollRef}
        className="hscroll"
        style={{ display: 'flex', gap: 2, overflowX: 'auto', flex: 1 }}
      >
        {days.map((d) => {
          const isSelected = d.date === selected
          const { weekday, day, month } = formatDate(d.date)
          return (
            <button
              key={d.date}
              ref={isSelected ? selectedRef : null}
              onClick={() => onSelect(d.date)}
              style={{
                minWidth: 84,
                flexShrink: 0,
                border: 'none',
                borderBottom: isSelected ? '3px solid var(--brass)' : '3px solid var(--line)',
                background: isSelected ? 'var(--brass)' : 'transparent',
                color: isSelected ? '#fff' : 'var(--ink)',
                padding: '10px 6px',
                cursor: 'pointer',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, opacity: 0.75 }}>{weekday}</div>
              <div style={{ fontSize: 15, fontWeight: 800 }}>
                {day} {month}
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginTop: 4, minHeight: 16 }}>
                {d.played > 0 && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      background: isSelected ? 'rgba(255,255,255,0.25)' : 'var(--line)',
                      color: isSelected ? '#fff' : 'var(--muted)',
                      borderRadius: 8,
                      padding: '1px 6px',
                    }}
                  >
                    {d.played} FT
                  </span>
                )}
                {d.scheduled > 0 && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      background: isSelected ? 'rgba(255,255,255,0.25)' : 'var(--line)',
                      color: isSelected ? '#fff' : 'var(--muted)',
                      borderRadius: 8,
                      padding: '1px 6px',
                    }}
                  >
                    {d.scheduled}
                  </span>
                )}
              </div>
            </button>
          )
        })}
      </div>
      <button onClick={() => scroll(1)} style={arrowStyle} aria-label="Later matchdays">
        &rsaquo;
      </button>
    </div>
  )
}

const arrowStyle = {
  border: 'none',
  background: 'var(--ink)',
  color: '#fff',
  width: 32,
  height: 32,
  borderRadius: '50%',
  cursor: 'pointer',
  fontSize: 18,
  lineHeight: '18px',
  flexShrink: 0,
}
