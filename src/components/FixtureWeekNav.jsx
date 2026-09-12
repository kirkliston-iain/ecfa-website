import { useMemo, useState } from 'react'
import FixtureList from './FixtureList'

function dayKey(fixtureDate) {
  return fixtureDate ? fixtureDate.slice(0, 10) : 'tbc'
}

function groupByDay(fixtures) {
  const map = new Map()
  for (const f of fixtures) {
    const key = dayKey(f.fixture_date)
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(f)
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, items]) => ({ date, fixtures: items }))
}

function formatDay(dateStr) {
  if (dateStr === 'tbc') return 'Date TBC'
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

export default function FixtureWeekNav({ fixtures }) {
  const days = useMemo(() => groupByDay(fixtures), [fixtures])

  const defaultIndex = useMemo(() => {
    if (days.length === 0) return 0
    const today = new Date().toISOString().slice(0, 10)
    const idx = days.findIndex((d) => d.date >= today)
    return idx === -1 ? days.length - 1 : idx
  }, [days])

  const [index, setIndex] = useState(defaultIndex)

  if (days.length === 0) {
    return <p style={{ color: '#8A8570' }}>No fixtures scheduled yet.</p>
  }

  const current = days[index]
  const today = new Date().toISOString().slice(0, 10)

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
          gap: 12,
        }}
      >
        <button
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
          aria-label="Previous matchday"
          style={navButtonStyle(index === 0)}
        >
          &larr;
        </button>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
            fontSize: 15,
            color: current.date === today ? 'var(--pitch)' : 'var(--ink)',
            textAlign: 'center',
          }}
        >
          {formatDay(current.date)}
          {current.date === today && (
            <span
              style={{
                marginLeft: 8,
                fontSize: 10,
                fontWeight: 700,
                color: '#fff',
                background: 'var(--pitch)',
                borderRadius: 4,
                padding: '2px 6px',
                verticalAlign: 'middle',
              }}
            >
              TODAY
            </span>
          )}
        </div>
        <button
          onClick={() => setIndex((i) => Math.min(days.length - 1, i + 1))}
          disabled={index === days.length - 1}
          aria-label="Next matchday"
          style={navButtonStyle(index === days.length - 1)}
        >
          &rarr;
        </button>
      </div>
      <FixtureList fixtures={current.fixtures} />
    </div>
  )
}

function navButtonStyle(disabled) {
  return {
    border: 'none',
    background: disabled ? 'var(--line)' : 'var(--pitch)',
    color: disabled ? '#9AA5B1' : '#fff',
    width: 32,
    height: 32,
    borderRadius: '50%',
    cursor: disabled ? 'default' : 'pointer',
    fontSize: 16,
    flexShrink: 0,
  }
}
