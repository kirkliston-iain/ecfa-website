import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'

const PLACEHOLDER_VENUES = new Set(['n/a', 'league decide', ''])

function formatDateTime(iso) {
  const d = new Date(iso)
  const dateStr = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  const timeStr = iso.slice(11, 16)
  return timeStr !== '00:00' ? `${dateStr}, ${timeStr}` : dateStr
}

export default function FixtureTracker() {
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [venueRows, setVenueRows] = useState([])
  const [refRows, setRefRows] = useState([])

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

      const venueMap = {}
      const refMap = {}

      for (const f of fixtures || []) {
        const teams = [f.home_team?.name, f.away_team?.name].filter(Boolean)
        const venueOk = f.venue && !PLACEHOLDER_VENUES.has(f.venue.trim().toLowerCase())
        for (const team of teams) {
          if (venueOk) {
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
        How often each team has been at a venue or had a particular referee this season, with dates
        (and kickoff times, for venues). Only fixtures with a real venue/referee assigned are counted.
      </p>

      {!isAdmin && <p style={{ color: 'var(--muted)' }}>Admin access required.</p>}
      {isAdmin && loading && <p style={{ color: 'var(--muted)' }}>Loading…</p>}

      {isAdmin && !loading && (
        <>
          <h2 style={sectionHeaderStyle}>Teams by Venue</h2>
          {venueRows.length === 0 ? (
            <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 28 }}>No venue data recorded yet.</p>
          ) : (
            <div style={{ overflowX: 'auto', marginBottom: 32 }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Team</th>
                    <th style={thStyle}>Venue</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>Count</th>
                    <th style={thStyle}>Dates &amp; KO times</th>
                  </tr>
                </thead>
                <tbody>
                  {venueRows.map((r, i) => (
                    <tr key={i}>
                      <td style={tdStyle}>{r.team}</td>
                      <td style={tdStyle}>{r.venue}</td>
                      <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 700 }}>{r.count}</td>
                      <td style={{ ...tdStyle, color: 'var(--muted)' }}>{r.dates.join(', ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <h2 style={sectionHeaderStyle}>Teams by Referee</h2>
          {refRows.length === 0 ? (
            <p style={{ color: 'var(--muted)', fontSize: 14 }}>No referee data recorded yet.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Team</th>
                    <th style={thStyle}>Referee</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>Count</th>
                    <th style={thStyle}>Dates</th>
                  </tr>
                </thead>
                <tbody>
                  {refRows.map((r, i) => (
                    <tr key={i}>
                      <td style={tdStyle}>{r.team}</td>
                      <td style={tdStyle}>{r.referee}</td>
                      <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 700 }}>{r.count}</td>
                      <td style={{ ...tdStyle, color: 'var(--muted)' }}>{r.dates.join(', ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
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
const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 12,
  minWidth: 480,
}
const thStyle = {
  textAlign: 'left',
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: 0.3,
  color: 'var(--muted)',
  padding: '6px 8px',
  borderBottom: '1px solid var(--line)',
  whiteSpace: 'nowrap',
}
const tdStyle = {
  padding: '6px 8px',
  borderBottom: '1px solid var(--line)',
  verticalAlign: 'top',
}
