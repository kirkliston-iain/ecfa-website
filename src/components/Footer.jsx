import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

export default function Footer() {
  const [views, setViews] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function bump() {
      const { data, error } = await supabase.rpc('increment_page_views')
      if (!cancelled && !error && typeof data === 'number') {
        setViews(data)
      }
    }

    bump()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <footer style={{ borderTop: '1px solid var(--line)', marginTop: 60 }}>
      <div
        className="container"
        style={{
          padding: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 13,
          color: 'var(--muted)',
          gap: 12,
        }}
      >
        <span>Edinburgh Churches Football Association</span>
        {views != null && <span>{views.toLocaleString()} site visits</span>}
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={() => window.dispatchEvent(new Event('open-manager-gate'))}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              font: 'inherit',
              color: 'var(--muted)',
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            Manager sign in
          </button>
          <Link to="/admin">Admin</Link>
        </div>
      </div>
    </footer>
  )
}
