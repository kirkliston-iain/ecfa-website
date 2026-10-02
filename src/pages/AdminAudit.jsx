import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'

const IAIN_ID = '28696bc6-2df2-4855-b259-3f156ad55748'
const ignored = new Set(['updated_at', 'created_at'])

export default function AdminAudit() {
  const [allowed, setAllowed] = useState(null)
  const [rows, setRows] = useState([])
  const [error, setError] = useState('')
  const [actor, setActor] = useState('')
  const [signIns, setSignIns] = useState(null)
  const [signInError, setSignInError] = useState('')
  const [names, setNames] = useState({ teams: {}, competitions: {}, stages: {}, players: {}, fixtures: {} })

  useEffect(() => {
    async function load() {
      const { data: userData } = await supabase.auth.getUser()
      const canView = userData.user?.id === IAIN_ID || userData.user?.app_metadata?.role === 'owner'
      setAllowed(canView)
      if (!canView) return
      const { data, error: loadError } = await supabase
        .from('admin_audit_log')
        .select('id, actor_name, table_name, action, record_id, old_values, new_values, created_at')
        .order('created_at', { ascending: false })
        .limit(250)
      if (loadError) setError(loadError.message)
      else setRows(data || [])
      const [{ data: teams }, { data: competitions }, { data: stages }] = await Promise.all([
        supabase.from('teams').select('id, name'),
        supabase.from('competitions').select('id, name'),
        supabase.from('stages').select('id, name'),
      ])
      const playerIds = (data || []).flatMap((row) => [row.old_values?.player_id, row.new_values?.player_id, ...(row.table_name === 'players' ? [row.record_id] : [])]).filter(Boolean)
      const fixtureIds = (data || []).flatMap((row) => [row.old_values?.fixture_id, row.new_values?.fixture_id, ...(row.table_name === 'fixtures' ? [row.record_id] : [])]).filter(Boolean)
      const [players, fixtures] = await Promise.all([
        lookupByIds('players', 'id, first_name, last_name', playerIds),
        lookupByIds('fixtures', 'id, fixture_date, home_team_id, away_team_id', fixtureIds),
      ])
      setNames({
        teams: Object.fromEntries((teams || []).map((item) => [item.id, item.name])),
        competitions: Object.fromEntries((competitions || []).map((item) => [item.id, item.name])),
        stages: Object.fromEntries((stages || []).map((item) => [item.id, item.name])),
        players: Object.fromEntries(players.map((item) => [item.id, [item.first_name, item.last_name].filter(Boolean).join(' ')])),
        fixtures: Object.fromEntries(fixtures.map((item) => [item.id, item])),
      })
      const { data: signInData, error: signInLoadError } = await supabase.rpc('get_owner_sign_in_audit')
      if (signInLoadError) setSignInError('Sign-in activity could not be loaded.')
      else setSignIns(signInData)
    }
    async function lookupByIds(table, columns, values) {
      const ids = [...new Set(values.filter((value) => typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value)))]
      if (!ids.length) return []
      const results = await Promise.all(Array.from({ length: Math.ceil(ids.length / 50) }, (_, index) =>
        supabase.from(table).select(columns).in('id', ids.slice(index * 50, (index + 1) * 50)))
      )
      return results.flatMap(({ data }) => data || [])
    }
    load()
  }, [])

  const visibleRows = useMemo(
    () => rows.filter((row) => !actor || row.actor_name === actor),
    [rows, actor]
  )
  const actors = [...new Set(rows.map((row) => row.actor_name))].sort()

  if (allowed === null) return null
  if (!allowed) {
    return (
      <div className="container" style={{ padding: '32px 20px', maxWidth: 760 }}>
        <Link to="/admin/dashboard" style={linkStyle}>← Back to admin</Link>
        <h1>Audit trail</h1>
        <p>You do not have permission to view the audit trail.</p>
      </div>
    )
  }

  return (
    <div className="container" style={{ padding: '32px 20px', maxWidth: 900 }}>
      <Link to="/admin/dashboard" style={linkStyle}>← Back to admin</Link>
      <h1 style={{ marginBottom: 8 }}>Audit trail</h1>
      <p style={{ color: 'var(--muted)' }}>Administrator changes and sign-in activity. Only the site owner can view this page.</p>
      <section style={{ margin: '28px 0 34px' }}>
        <h2 style={{ fontSize: 20 }}>Sign-in activity</h2>
        <p style={{ color: 'var(--muted)', fontSize: 14 }}>Latest known sign-ins include activity before this audit began. Individual sign-in entries start when tracking was added. Managers use one shared code, so individual managers cannot be identified.</p>
        {signInError && <p role="alert" style={{ color: '#B3261E' }}>{signInError}</p>}
        {signIns && <>
          <div style={{ ...cardStyle, marginBottom: 16 }}>
            <strong>Manager code</strong>
            <span>Last signed in: {signIns.manager_last_at ? new Date(signIns.manager_last_at).toLocaleString('en-GB') : 'Never'}</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <caption style={{ textAlign: 'left', fontWeight: 700, marginBottom: 8 }}>Administrator accounts</caption>
              <thead><tr><th style={auditCell}>Administrator</th><th style={auditCell}>Last signed in</th><th style={auditCell}>Recorded sign-ins</th></tr></thead>
              <tbody>{(signIns.admin_accounts || []).map((account) => <tr key={account.name}>
                <td style={auditCell}>{account.name}</td>
                <td style={auditCell}>{account.last_at ? new Date(account.last_at).toLocaleString('en-GB') : 'Never'}</td>
                <td style={auditCell}>{Number(account.recorded_count || 0).toLocaleString()}</td>
              </tr>)}</tbody>
            </table>
          </div>
          <h3 style={{ fontSize: 16, marginTop: 22 }}>Recent sign-ins</h3>
          <div style={{ display: 'grid', gap: 8 }}>
            {(signIns.events || []).map((event) => <div key={event.id} style={cardStyle}>
              <strong>{event.kind === 'admin' ? event.name : 'Manager code used'}</strong>
              <time>{new Date(event.at).toLocaleString('en-GB')}</time>
            </div>)}
            {!(signIns.events || []).length && <p style={{ color: 'var(--muted)' }}>No individual sign-ins recorded since auditing began.</p>}
          </div>
        </>}
      </section>
      <h2 style={{ fontSize: 20 }}>Administrator changes</h2>
      <p style={{ color: 'var(--muted)', fontSize: 14 }}>Latest 250 changes.</p>
      <select value={actor} onChange={(e) => setActor(e.target.value)} style={selectStyle}>
        <option value="">All administrators</option>
        {actors.map((name) => <option key={name} value={name}>{name}</option>)}
      </select>
      {error && <p role="alert" style={{ color: '#B3261E' }}>{error}</p>}
      <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
        {visibleRows.map((row) => (
          <article key={row.id} style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <strong>{row.actor_name}</strong>
              <time style={{ color: 'var(--muted)', fontSize: 13 }}>
                {new Date(row.created_at).toLocaleString('en-GB')}
              </time>
            </div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>
              {row.action !== 'DELETE' && (row.table_name === 'players' ? names.players[row.record_id] : row.table_name === 'fixtures' && names.fixtures[row.record_id]) && row.record_id
                ? <Link to={`/${row.table_name}/${row.record_id}`} style={{ color: 'var(--ink)' }}>{describeRecord(row, names)}</Link>
                : describeRecord(row, names)}
            </div>
            <div style={{ display: 'grid', gap: 5, fontSize: 14 }}>
              {changes(row).map((change) => (
                <div key={change.field}>
                  <strong>{friendlyField(change.field)}:</strong> {formatValue(change.before, change.field, names)} → {formatValue(change.after, change.field, names)}
                </div>
              ))}
              {changes(row).length === 0 && <span style={{ color: 'var(--muted)' }}>No other details changed.</span>}
            </div>
            {row.record_id && <details style={{ fontSize: 12, color: 'var(--muted)' }}>
              <summary style={{ cursor: 'pointer' }}>Technical record IDs</summary>
              <div>Record: <code style={{ overflowWrap: 'anywhere' }}>{row.record_id}</code></div>
              {changes(row).filter((change) => change.field.endsWith('_id')).map((change) => <div key={change.field}>
                {friendlyField(change.field)}: <code style={{ overflowWrap: 'anywhere' }}>{change.before || '—'} → {change.after || '—'}</code>
              </div>)}
            </details>}
          </article>
        ))}
        {!error && visibleRows.length === 0 && <p style={{ color: 'var(--muted)' }}>No changes recorded yet.</p>}
      </div>
    </div>
  )
}

function changes(row) {
  if (row.action === 'INSERT') return Object.entries(row.new_values || {}).filter(([key]) => !ignored.has(key) && key !== 'id').map(([field, after]) => ({ field, before: null, after }))
  if (row.action === 'DELETE') return Object.entries(row.old_values || {}).filter(([key]) => !ignored.has(key) && key !== 'id').map(([field, before]) => ({ field, before, after: null }))
  const oldValues = row.old_values || {}
  const newValues = row.new_values || {}
  return [...new Set([...Object.keys(oldValues), ...Object.keys(newValues)])]
    .filter((field) => !ignored.has(field) && field !== 'id' && JSON.stringify(oldValues[field]) !== JSON.stringify(newValues[field]))
    .map((field) => ({ field, before: oldValues[field], after: newValues[field] }))
}

function formatValue(value, field, names) {
  if (value === null || value === undefined || value === '') {
    if (field === 'team_id') return 'No team assigned'
    if (field === 'referee_name' || field === 'referee_id') return 'No referee assigned'
    return 'Not set'
  }
  if (field === 'team_id' || field === 'home_team_id' || field === 'away_team_id') return names.teams[value] || 'Team no longer listed (see ID)'
  if (field === 'competition_id') return names.competitions[value] || 'Competition no longer listed (see ID)'
  if (field === 'stage_id') return names.stages[value] || 'Stage no longer listed (see ID)'
  if (field === 'player_id') return names.players[value] || 'Player no longer listed (see ID)'
  if (field === 'fixture_id') return fixtureTitle(names.fixtures[value], names) || 'Match no longer listed (see ID)'
  if (field.endsWith('_id') && /^[0-9a-f-]{36}$/i.test(String(value))) return 'Related record (see technical IDs)'
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value) && /date|_at$/.test(field)) {
    const date = new Date(value.length === 10 ? `${value}T12:00:00` : value)
    if (!Number.isNaN(date.getTime())) return date.toLocaleString('en-GB', value.length === 10 ? { dateStyle: 'medium' } : { dateStyle: 'medium', timeStyle: 'short' })
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}
function fixtureTitle(fixture, names) {
  if (!fixture) return ''
  const date = fixture.fixture_date ? new Date(fixture.fixture_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Date to be confirmed'
  return `${date}: ${names.teams[fixture.home_team_id] || 'TBC'} v ${names.teams[fixture.away_team_id] || 'TBC'}`
}
function describeRecord(row, names) {
  const snapshot = row.new_values || row.old_values || {}
  const noun = ({ players: 'player', fixtures: 'match', teams: 'team', competitions: 'competition', fixture_scorers: 'goalscorer', discipline_records: 'discipline record', suspensions: 'suspension', referees: 'referee', venues: 'venue' })[row.table_name] || row.table_name.replaceAll('_', ' ')
  let subject = ''
  if (row.table_name === 'players') subject = [snapshot.first_name, snapshot.last_name].filter(Boolean).join(' ') || names.players[row.record_id]
  else if (row.table_name === 'fixtures') subject = fixtureTitle(snapshot.home_team_id ? snapshot : names.fixtures[row.record_id], names)
  else if (row.table_name === 'fixture_scorers' || row.table_name === 'discipline_records') subject = names.players[snapshot.player_id] || [snapshot.player_name, snapshot.name].find(Boolean) || fixtureTitle(names.fixtures[snapshot.fixture_id], names)
  else subject = snapshot.name || snapshot.title || snapshot.full_name
  return `${({ INSERT: 'Added', UPDATE: 'Changed', DELETE: 'Deleted' })[row.action] || row.action} ${noun}${subject ? `: ${subject}` : ''}`
}
function friendlyField(field) { return ({ team_id: 'Team', referee_name: 'Referee', referee_id: 'Referee', home_team_id: 'Home team', away_team_id: 'Away team', player_id: 'Player', fixture_id: 'Match', competition_id: 'Competition', stage_id: 'Stage', fixture_date: 'Match date', venue: 'Venue', home_score: 'Home score', away_score: 'Away score' })[field] || field.replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase()) }
const cardStyle = { border: '1px solid var(--line)', borderRadius: 8, padding: 14, display: 'grid', gap: 8 }
const auditCell = { padding: '9px 10px', borderBottom: '1px solid var(--line)', textAlign: 'left' }
const selectStyle = { width: '100%', maxWidth: 340, padding: '11px', border: '1px solid var(--line)', borderRadius: 6, background: 'white', fontSize: 15 }
const linkStyle = { color: 'var(--brass)', fontWeight: 700, textDecoration: 'none' }
