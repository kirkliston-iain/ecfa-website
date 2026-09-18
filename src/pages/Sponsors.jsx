import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

export default function Sponsors() {
  const [sponsors, setSponsors] = useState([])
  const [fundraisers, setFundraisers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('sponsors')
      .select('id, name, summary, website_url, logo_url, sort_order')
      .eq('is_published', true)
      .order('sort_order')
      .order('name')
      .then(({ data }) => {
        setSponsors(data || [])
        setLoading(false)
      })

    supabase
      .from('team_fundraisers')
      .select('id, team_name, title, summary, fundraiser_url, season, amount_raised_text, sort_order')
      .eq('is_published', true)
      .order('sort_order')
      .order('team_name')
      .then(({ data }) => setFundraisers(data || []))
  }, [])

  return (
    <div className="container" style={{ padding: '32px 20px 48px', maxWidth: 820 }}>
      <h1 style={{ fontSize: 30, marginBottom: 4 }}>ECFA Sponsors</h1>
      <p style={{ color: 'var(--muted)', marginBottom: 30 }}>
        The businesses supporting the ECFA and its competitions during the 2026/27 season.
      </p>

      <div className="desktop-card-grid" style={{ display: 'grid', gap: 22 }}>
        {loading && <p style={{ color: 'var(--muted)' }}>Loading sponsors…</p>}
        {!loading && sponsors.length === 0 && <p style={{ color: 'var(--muted)' }}>Sponsor details will be added soon.</p>}
        {sponsors.map((item) => (
          <section key={item.id} style={competitionStyle}>
            <div style={sponsorStyle}>
              <div style={logoPanelStyle}>
                {item.logo_url ? <img src={item.logo_url} alt={`${item.name} logo`} style={logoStyle} /> : <span style={{ color: 'var(--muted)', fontSize: 12 }}>Logo</span>}
              </div>
              <div style={{ minWidth: 0 }}>
                <h2 style={{ fontSize: 18, margin: '0 0 5px' }}>{item.name}</h2>
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

      <section style={{ marginTop: 38 }}>
        <h2 style={{ fontSize: 24, margin: '0 0 6px' }}>Teams’ own fundraisers</h2>
        <p style={{ color: 'var(--muted)', margin: '0 0 18px', lineHeight: 1.5 }}>
          Fundraising organised by ECFA teams for causes important to their communities.
        </p>
        {fundraisers.length === 0 ? (
          <p style={{ color: 'var(--muted)' }}>No team fundraisers are currently listed.</p>
        ) : (
          <div style={{ display: 'grid', gap: 16 }}>
            {fundraisers.map((item) => (
              <article key={item.id} style={{ ...competitionStyle, padding: 18 }}>
                <div style={eyebrowStyle}>{item.season} · Team fundraiser</div>
                <h3 style={{ fontSize: 19, margin: '5px 0 2px' }}>{item.team_name}</h3>
                <div style={{ fontWeight: 700, marginBottom: 9 }}>{item.title}</div>
                {item.amount_raised_text && <div style={amountStyle}>{item.amount_raised_text}</div>}
                <p style={{ color: 'var(--muted)', lineHeight: 1.5, fontSize: 14 }}>{item.summary}</p>
                {item.fundraiser_url && (
                  <a href={item.fundraiser_url} target="_blank" rel="noopener noreferrer" style={websiteLinkStyle}>
                    View fundraiser &rarr;
                  </a>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

const competitionStyle = {
  border: '1px solid var(--line)',
  borderRadius: 10,
  background: '#fff',
  overflow: 'hidden',
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

const websiteLinkStyle = {
  color: 'var(--ink)',
  fontSize: 13,
  fontWeight: 700,
  textDecoration: 'underline',
  textUnderlineOffset: 3,
}

const amountStyle = {
  display: 'inline-block',
  padding: '7px 10px',
  borderRadius: 6,
  background: '#111',
  color: '#fff',
  fontSize: 13,
  fontWeight: 700,
}
