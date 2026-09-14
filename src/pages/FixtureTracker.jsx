import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'

function formatDateTime(iso) {
  const d = new Date(iso)
  const dateStr = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  const timeStr = iso.slice(11, 16)
  return timeStr !== '00:00' ? `${dateStr}, ${timeStr}` : dateStr
}

export default function FixtureTracker() {
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [venueRows, setVenueRows] = useState([]) // { team, venue, entries: [{date, time}] }
  const [refRows, setRefRows] = useState([]) // { team, referee, entries: [{date}] }

  useEffect(() => {
    supabase
      .from('admin_profiles')
      .select('id')
      .maybeSingle()
      .then(({ data }) => setIsAdmin(!!data))

    async function load() {
      const { data: fixtures } = await supabase
        .from('fixtures')
        .select(
          'fixture_date, venue, referee_name, home_team:home_team_id(name), away_team:away_team_id(name)'
        )
        .order('fixture_date')

      const venueMap = {} // team -> venue -> [{date,time}]
      const refMap = {} // team -> referee -> [{date}]

      for (const f of fixtures || []) {
        const teams = [f.home_team?.name, f.away_team?.name].filter(Boolean)
        for (const team of teams) {
          if (f.venue) {
            venueMap[team] = venueMap[team] || {}
            venueMap[team][f.venue] = venueMap[team][f.venue] || []
            venueMap[team][f.venue].push(formatDateTime(f.fixture_date))
          }
          if (f.referee_name) {
            refMap[team] = refMap[team] || {}
            refMap[team][f.referee_name] = refMap[team][f.referee_name] || []
            refMap[team][f.referee_name].push(formatDateTime(f.fixture_date))
          }
        }
      }

      const vRows = []
      for (const team of Object.keys(venueMap).sort()) {
        const entries = Object.entries(venueMap[team]).sort((a, b) => b[1].length - a[1].length)
        for (const [venue, dates] of entries) {
          vRows.push({ team, venue, count: dates.length, dates })
        }
      }

      const rRows = []
      for (const team of Object.keys(refMap).sort()) {
        const entries = Object.entries(refMap[team]).sort((a, b) => b[1].length - a[1].length)
        for (const [referee, dates] of entries) {
          rRows.push({ team, referee, count: dates.length, dates })
        }
      }

      setVenueRows(vRows)
      setRefRows(rRows)
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="container" style={{ padding: '24px 16px', maxWidth: 480 }}>
      <Link to="/admin/dashboard" style={{ fontSize: 13, color: 'var(--brass)', display: 'block', marginBottom: 16 }}>
        &larr; Back to admin
      </Link>
      <h1 style={{ fontSize: 22, color: 'var(--pitch)', marginBottom: 4 }}>Fixture Tracker</h1>
      <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 24 }}>
        How often each team has been at a venue or had a particular referee this season, with kickoff
        times and dates. Covers every fixture with a venue or referee set, played or upcoming.
      </p>

      {!isAdmin && <p style={{ color: 'var(--muted)' }}>Admin access required.</p>}
      {isAdmin && loading && <p style={{ color: 'var(--muted)' }}>Loading…</p>}

      {isAdmin && !loading && (
        <>
          <h2 style={sectionHeaderStyle}>Teams by Venue</h2>
          {venueRows.length === 0 ? (
            <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 28 }}>No venue data recorded yet.</p>
          ) : (
            <div style={{ marginBottom: 32 }}>
              {venueRows.map((r, i) => (
                <div key={i} style={cardStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                    <div>
                      <strong>{r.team}</strong>
                      <span style={{ color: 'var(--muted)' }}> at {r.venue}</span>
                    </div>
                    <strong>{r.count}</strong>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>{r.dates.join(' · ')}</div>
                </div>
              ))}
            </div>
          )}

          <h2 style={sectionHeaderStyle}>Teams by Referee</h2>
          {refRows.length === 0 ? (
            <p style={{ color: 'var(--muted)', fontSize: 14 }}>No referee data recorded yet.</p>
          ) : (
            <div>
              {refRows.map((r, i) => (
                <div key={i} style={cardStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                    <div>
                      <strong>{r.team}</strong>
                      <span style={{ color: 'var(--muted)' }}> with {r.referee}</span>
                    </div>
                    <strong>{r.count}</strong>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>{r.dates.join(' · ')}</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

const cardStyle = {
  border: '1px solid var(--line)',
  borderRadius: 8,
  padding: 12,
  marginBottom: 8,
}
const sectionHeaderStyle = {
  fontSize: 15,
  textTransform: 'uppercase',
  letterSpacing: 0.4,
  color: 'var(--brass)',
  marginBottom: 12,
  paddingBottom: 8,
  borderBottom: '2px solid var(--line)',
}
