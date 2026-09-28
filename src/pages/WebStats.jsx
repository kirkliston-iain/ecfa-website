import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

export default function WebStats() {
  const [stats, setStats] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    supabase.rpc('get_public_web_summary').then(({ data, error: loadError }) => {
      if (cancelled) return
      if (loadError) setError('Could not load web statistics.')
      else setStats(data)
    })
    return () => { cancelled = true }
  }, [])

  const periods = [
    ['This week', 'this_week'],
    ['Last 7 days', 'last_7'],
    ['Last 30 days', 'last_30'],
    ['Last 90 days', 'last_90'],
    ['Last year', 'last_year'],
  ]

  return <div className="container" style={{ padding: '32px 20px 48px', maxWidth: 900 }}>
    <h1 style={{ fontSize: 30, marginBottom: 6 }}>Web Stats</h1>
    <p style={{ color: 'var(--muted)', margin: '0 0 24px' }}>Overall ECFA website page views.</p>
    {error && <p role="alert" style={{ color: '#B3261E' }}>{error}</p>}
    {!stats && !error && <p>Loading web statistics…</p>}
    {stats && <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
        {periods.map(([title, key]) => <div key={key} style={{ padding: 18, border: '1px solid var(--line)', borderRadius: 8, background: '#f5f8fa' }}>
          <div style={{ color: 'var(--brass)', fontSize: 14, fontWeight: 800 }}>{title}</div>
          <div style={{ fontSize: 34, fontWeight: 900 }}>{Number(stats[key] || 0).toLocaleString()}</div>
        </div>)}
      </div>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 18 }}>All time: {Number(stats.all_time || 0).toLocaleString()} page views. A page view is recorded when someone opens a page; it is not a unique visitor count.</p>
    </>}
  </div>
}
