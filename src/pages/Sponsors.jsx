import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function Sponsors() {
  const [sponsors, setSponsors] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('sponsors')
      .select('id, name, summary, website_url, logo_url, competition_name, competition_path, sort_order')
      .eq('is_published', true)
      .order('sort_order')
      .order('name')
      .then(({ data }) => {
        setSponsors(data || [])
        setLoading(false)
      })
  }, [])

  return (
    <div className="container" style={{ padding: '32px 20px 48px', maxWidth: 820 }}>
      <h1 style={{ fontSize: 30, marginBottom: 4 }}>Our Sponsors</h1>
      <p style={{ color: 'var(--muted)', marginBottom: 30 }}>
        The businesses supporting the ECFA and its competitions during the 2026/27 season.
      </p>

      <div style={{ display: 'grid', gap: 22 }}>
        {loading && <p style={{ color: 'var(--muted)' }}>Loading sponsors…</p>}
        {!loading && sponsors.length === 0 && <p style={{ color: 'var(--muted)' }}>Sponsor details will be added soon.</p>}
        {sponsors.map((item) => (
          <section key={item.id} style={competitionStyle}>
            {item.competition_name && (
              <div style={competitionHeaderStyle}>
                <div style={eyebrowStyle}>Competition</div>
                <h2 style={{ fontSize: 19, margin: '3px 0 6px' }}>{item.competition_name}</h2>
                {item.competition_path && (
                  <Link to={item.competition_path} style={competitionLinkStyle}>
                    View competition &rarr;
                  </Link>
                )}
              </div>
            )}

            <div style={sponsorStyle}>
              <div style={logoPanelStyle}>
                {item.logo_url ? <img src={item.logo_url} alt={`${item.name} logo`} style={logoStyle} /> : <span style={{ color: 'var(--muted)', fontSize: 12 }}>Logo</span>}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={eyebrowStyle}>{item.competition_name ? 'Competition sponsor' : 'League sponsor'}</div>
                <h3 style={{ fontSize: 17, margin: '2px 0 5px' }}>{item.name}</h3>
                <p style={{ margin: '0 0 9px', color: 'var(--muted)', lineHeight: 1.45, fontSize: 14 }}>
                  {item.summary}
                </p>
                {item.website_url && (
                  <a href={item.website_url} target="_blank" rel="noopener noreferrer" style={websiteLinkStyle}>
                    Visit website &rarr;
                  </a>
                )}
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

const competitionStyle = {
  border: '1px solid var(--line)',
  borderRadius: 10,
  background: '#fff',
  overflow: 'hidden',
}

const competitionHeaderStyle = {
  padding: '14px 16px',
  borderBottom: '3px solid var(--brass)',
}

const sponsorStyle = {
  display: 'grid',
  gridTemplateColumns: '72px minmax(0, 1fr)',
  alignItems: 'center',
  gap: 14,
  padding: 16,
}

const logoPanelStyle = {
  width: 72,
  height: 72,
  boxSizing: 'border-box',
  padding: 7,
  border: '1px solid var(--line)',
  borderRadius: 8,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#fff',
}

const logoStyle = {
  display: 'block',
  width: '100%',
  maxHeight: 54,
  objectFit: 'contain',
}

const eyebrowStyle = {
  color: 'var(--brass)',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 0.6,
  textTransform: 'uppercase',
}

const competitionLinkStyle = {
  color: 'var(--ink)',
  fontSize: 13,
  fontWeight: 700,
  textDecoration: 'none',
}

const websiteLinkStyle = {
  color: 'var(--ink)',
  fontSize: 13,
  fontWeight: 700,
  textDecoration: 'underline',
  textUnderlineOffset: 3,
}
