import { Link } from 'react-router-dom'

const SPONSORED_COMPETITIONS = [
  {
    competition: 'Appin Sports League',
    competitionPath: '/competitions/appin-league',
    sponsor: 'Appin Sports',
    logo: '/sponsors/appin-sports.png',
    website: 'https://appinsports.com/',
    summary:
      'Appin Sports creates custom sportswear for football clubs, running clubs, charities and sporting events. Its team supports customers from the first design ideas through production and delivery.',
  },
  {
    competition: 'ECFA League Cup',
    competitionPath: '/competitions/league-cup',
    sponsor: 'Kwik Fit',
    logo: '/sponsors/kwik-fit.png',
    website: 'https://www.kwik-fit.com/',
    summary:
      'Kwik Fit provides vehicle care across the UK, including tyres, MOT testing, servicing, exhausts, batteries and brakes, with online booking and local centres.',
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
              <div>
                <div style={eyebrowStyle}>Competition</div>
                <h2 style={{ fontSize: 21, margin: '3px 0 0' }}>{item.competition}</h2>
              </div>
              <Link to={item.competitionPath} style={competitionLinkStyle}>
                View competition &rarr;
              </Link>
            </div>

            <div style={sponsorStyle}>
              <a
                href={item.website}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Visit ${item.sponsor} website`}
                style={logoPanelStyle}
              >
                <img src={item.logo} alt={`${item.sponsor} logo`} style={logoStyle} />
              </a>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={eyebrowStyle}>Competition sponsor</div>
                <h3 style={{ fontSize: 19, margin: '3px 0 8px' }}>{item.sponsor}</h3>
                <p style={{ margin: '0 0 14px', color: 'var(--muted)', lineHeight: 1.55 }}>
                  {item.summary}
                </p>
                <a
                  href={item.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={websiteLinkStyle}
                >
                  Visit {item.sponsor} website &rarr;
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
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 14,
  padding: '16px 18px',
  borderBottom: '3px solid var(--brass)',
  flexWrap: 'wrap',
}

const sponsorStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 22,
  padding: 20,
  flexWrap: 'wrap',
}

const logoPanelStyle = {
  width: 210,
  minHeight: 110,
  padding: 16,
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
  maxWidth: 190,
  maxHeight: 82,
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
  display: 'inline-block',
  padding: '9px 13px',
  borderRadius: 6,
  background: 'var(--ink)',
  color: '#fff',
  fontSize: 13,
  fontWeight: 700,
  textDecoration: 'none',
}
