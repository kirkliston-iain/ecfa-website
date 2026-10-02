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
      const { data: signInData, error: signInLoadError } = await supabase.rpc('get_owner_sign_in_audit')
      if (signInLoadError) setSignInError('Sign-in activity could not be loaded.')
      else setSignIns(signInData)
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
            <div style={{ fontSize: 14 }}>
              <strong>{friendlyAction(row.action)}</strong> · {friendlyTable(row.table_name)}
              {row.record_id ? ` · record ${row.record_id}` : ''}
            </div>
            <div style={{ display: 'grid', gap: 5, fontSize: 13 }}>
              {changes(row).map((change) => (
                <div key={change.field}>
                  <strong>{friendlyField(change.field)}:</strong> {formatValue(change.before)} → {formatValue(change.after)}
                </div>
              ))}
              {changes(row).length === 0 && <span style={{ color: 'var(--muted)' }}>Record {row.action.toLowerCase()}d.</span>}
            </div>
          </article>
        ))}
        {!error && visibleRows.length === 0 && <p style={{ color: 'var(--muted)' }}>No changes recorded yet.</p>}
      </div>
    </div>
  )
}

function changes(row) {
  if (row.action === 'INSERT') return Object.entries(row.new_values || {}).filter(([key]) => !ignored.has(key)).map(([field, after]) => ({ field, before: null, after }))
  if (row.action === 'DELETE') return Object.entries(row.old_values || {}).filter(([key]) => !ignored.has(key)).map(([field, before]) => ({ field, before, after: null }))
  const oldValues = row.old_values || {}
  const newValues = row.new_values || {}
  return [...new Set([...Object.keys(oldValues), ...Object.keys(newValues)])]
    .filter((field) => !ignored.has(field) && JSON.stringify(oldValues[field]) !== JSON.stringify(newValues[field]))
    .map((field) => ({ field, before: oldValues[field], after: newValues[field] }))
}

function formatValue(value) {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}
function friendlyAction(action) { return ({ INSERT: 'Added', UPDATE: 'Changed', DELETE: 'Deleted' })[action] || action }
function friendlyTable(table) { return table.replaceAll('_', ' ') }
function friendlyField(field) { return field.replaceAll('_', ' ') }
const cardStyle = { border: '1px solid var(--line)', borderRadius: 8, padding: 14, display: 'grid', gap: 8 }
const auditCell = { padding: '9px 10px', borderBottom: '1px solid var(--line)', textAlign: 'left' }
const selectStyle = { width: '100%', maxWidth: 340, padding: '11px', border: '1px solid var(--line)', borderRadius: 6, background: 'white', fontSize: 15 }
const linkStyle = { color: 'var(--brass)', fontWeight: 700, textDecoration: 'none' }
