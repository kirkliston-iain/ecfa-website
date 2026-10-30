import { matchPitch, PITCH_SOURCE_URL, reportCoversDate, ukDate } from '../utils/pitchStatus'

const labels = { playable: 'Playable', unplayable: 'Unplayable', referee: 'Referee’s decision', unknown: 'Check with venue', 'not-listed': 'No football status listed' }
const colours = { playable: ['#e8f5ec', '#186536'], unplayable: ['#fcebea', '#a12622'], referee: ['#fff4d6', '#735400'] }
const dateLabel = value => new Date(`${value}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/London' })

export default function PitchStatus({ venue, fixtureDate, status, report, state }) {
  if (['played', 'postponed', 'cancelled'].includes(status) || fixtureDate?.slice(0, 10) < ukDate()) return null
  const pitch = matchPitch(venue, report)
  if (!pitch) return null
  const current = state === 'ready' && reportCoversDate(report, fixtureDate)
  const label = current ? labels[pitch.status] : 'Awaiting weekend update'
  const [background, color] = current ? colours[pitch.status] || ['#f0f2f4', '#46515a'] : ['#f0f2f4', '#46515a']
  return <div style={{ marginTop: 5, textAlign: 'center', fontSize: 11, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: '3px 7px' }}>
    <a href={PITCH_SOURCE_URL} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', padding: '3px 7px', borderRadius: 5, background, color, fontWeight: 700 }} title={`${pitch.name}${pitch.follows ? ` — follows ${pitch.follows}` : ''}${current && pitch.comments ? `: ${pitch.comments}` : ''}`}>
      Grass pitch: {label} ↗
    </a>
    <span style={{ color: 'var(--muted)', fontSize: 10 }}>{pitch.follows ? `Follows ${pitch.follows}` : 'Edinburgh Leisure'} · updated {dateLabel(report.updatedDate)}</span>
    {current && pitch.comments && <span style={{ flexBasis: '100%', color: 'var(--muted)' }}>{pitch.comments}</span>}
  </div>
}

export function PitchReportSummary({ report, state }) {
  const current = report && reportCoversDate(report, ukDate())
  return <section style={{ border: '1px solid var(--line)', borderRadius: 6, padding: '10px 12px', marginBottom: 20, fontSize: 12 }} aria-label="Grass pitch updates">
    <strong>Grass pitch update</strong>{' · '}
    {state === 'loading' ? 'Checking Edinburgh Leisure…' : report ? `Updated ${dateLabel(report.updatedDate)}${current ? '' : ' · Awaiting this weekend’s update'}` : 'Update unavailable — check Edinburgh Leisure'}
    <a href={PITCH_SOURCE_URL} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginLeft: 8, fontWeight: 700 }}>Official report ↗</a>
    <p style={{ color: 'var(--muted)', margin: '5px 0 0', lineHeight: 1.5 }}>Friday updates cover Friday–Sunday grass bookings. Status appears beside matched fixtures. 3G pitches are excluded; the referee still makes the final decision on the day.</p>
    <div aria-label="Pitch status key" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '5px 7px', marginTop: 8, fontSize: 10 }}>
      <strong>Key:</strong>
      {['playable', 'referee', 'unplayable', 'awaiting'].map(status => {
        const [background, color] = colours[status] || ['#f0f2f4', '#46515a']
        return <span key={status} style={{ padding: '3px 6px', borderRadius: 4, background, color, fontWeight: 700 }}>{labels[status] || 'Awaiting weekend update'}</span>
      })}
    </div>
    {report && <details style={{ marginTop: 8 }}>
      <summary style={{ cursor: 'pointer', fontWeight: 700 }}>View Edinburgh Leisure grass pitches</summary>
      <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0' }}>
        {report.pitches.filter(p => p.status !== 'not-listed').map(p => <li key={p.name} style={{ padding: '7px 0', borderTop: '1px solid var(--line)' }}>
          <strong>{p.name}</strong>{' — '}{current ? labels[p.status] : 'Awaiting weekend update'}
          {p.comments && <span style={{ display: 'block', color: 'var(--muted)' }}>{p.comments}</span>}
        </li>)}
      </ul>
    </details>}
  </section>
}
