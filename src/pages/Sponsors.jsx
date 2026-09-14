import { Link } from 'react-router-dom'

const SPONSORED_COMPETITIONS = [
  {
    competition: 'Appin Sports League',
    competitionPath: '/competitions/appin-league',
    sponsor: 'Appin Sports',
    logo: '/sponsors/appin-sports.png',
    website: 'https://appinsports.com/',
    summary:
      'Edinburgh-based specialists in custom teamwear for football clubs, sports teams and events.',
  },
  {
    competition: 'ECFA League Cup',
    competitionPath: '/competitions/league-cup',
    sponsor: 'Kwik Fit',
    logo: '/sponsors/kwik-fit.png',
    website: 'https://www.kwik-fit.com/',
    summary:
      'UK vehicle-care specialists providing tyres, MOT testing, servicing, brakes, batteries and exhausts.',
  },
]

export default function Sponsors() {
  return (
    <div className="container" style={{ padding: '32px 20px 48px', maxWidth: 820 }}>
      <h1 style={{ fontSize: 30, marginBottom: 4 }}>Our Sponsors</h1>
      <p style={{ color: 'var(--muted)', marginBottom: 30 }}>
        The businesses supporting ECFA competitions during the 2026/27 season.
      </p>

      <div style={{ display: 'grid', gap: 22 }}>
        {SPONSORED_COMPETITIONS.map((item) => (
          <section key={item.competition} style={competitionStyle}>
            <div style={competitionHeaderStyle}>
              <div style={eyebrowStyle}>Competition</div>
              <h2 style={{ fontSize: 19, margin: '3px 0 6px' }}>{item.competition}</h2>
              <Link to={item.competitionPath} style={competitionLinkStyle}>
                View competition &rarr;
              </Link>
            </div>

            <div style={sponsorStyle}>
              <div style={logoPanelStyle}>
                <img src={item.logo} alt={`${item.sponsor} logo`} style={logoStyle} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={eyebrowStyle}>Competition sponsor</div>
                <h3 style={{ fontSize: 17, margin: '2px 0 5px' }}>{item.sponsor}</h3>
                <p style={{ margin: '0 0 9px', color: 'var(--muted)', lineHeight: 1.45, fontSize: 14 }}>
                  {item.summary}
                </p>
                <a
                  href={item.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={websiteLinkStyle}
                >
                  Visit website &rarr;
                </a>
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
