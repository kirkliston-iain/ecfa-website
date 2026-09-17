import { Link } from 'react-router-dom'

const leagueSeasons = [
  {
    season: '2026/27',
    charity: 'Forget Me Notes Project',
    logo: '/charities/forget-me-notes.png',
    charityUrl: 'https://www.forgetmenotes.org.uk/',
    summary: 'An Edinburgh-based charity that uses music to build inclusive communities, encourage self-expression and combat social isolation. Its work is rooted in dementia-friendly values and is open to everyone.',
    eventTitle: 'ECFA Charity Tournament',
    eventDate: 'Saturday, 7 November 2026',
    eventDetails: 'Details are still to be confirmed. The event is expected to be a five-a-side or seven-a-side football tournament.',
  },
  {
    season: '2025/26',
    charity: "Don't Screen Us Out",
    logo: '/charities/dont-screen-us-out-full.svg',
    charityUrl: 'https://dontscreenusout.org/',
    summary: "A campaign working towards a society in which people with Down's syndrome are equally valued, including reform of legislation, policy and practice affecting people with Down's syndrome and their families.",
    raised: '£4,204',
    eventDetails: 'The ECFA community raised funds throughout the season through charity football matches, pool events and sponsored dips in the sea.',
  },
]

const teamEvents = [
  {
    season: '2026/27',
    team: 'South East Saints',
    title: 'Community fundraiser',
    summary: 'South East Saints organised a team-led fundraising event and raised almost £2,000.',
    url: 'https://www.justgiving.com/crowdfunding/nathan-elliott-1?utm_medium=CF&utm_source=CL',
  },
]

export default function Charity() {
  return (
    <div className="container" style={{ padding: '32px 20px 48px', maxWidth: 820 }}>
      <h1 style={{ fontSize: 30, marginBottom: 4 }}>Charity</h1>
      <p style={{ color: 'var(--muted)', margin: '0 0 30px' }}>
          Each season, the ECFA nominates a charity and brings teams together to raise funds. Clubs also organise their own events for causes close to their communities.
      </p>

      <section style={{ marginBottom: 34 }}>
        <h2 style={sectionHeadingStyle}>League charity events by season</h2>
        <div style={{ display: 'grid', gap: 18 }}>
          {leagueSeasons.map((item) => (
            <article key={item.season} style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div style={charityIdentityStyle}>
                  <div style={logoPanelStyle}>
                    <img src={item.logo} alt={`${item.charity} logo`} style={logoStyle} />
                  </div>
                  <div>
                    <div style={seasonStyle}>{item.season} SEASON</div>
                    <h3 style={{ fontSize: 20, margin: '4px 0 3px' }}>{item.charity}</h3>
                    {item.season === '2026/27' && <div style={{ color: 'var(--brass)', fontSize: 13, fontWeight: 800 }}>ECFA nominated charity</div>}
                  </div>
                </div>
                {item.raised && (
                  <div style={amountStyle}>
                    <span style={{ display: 'block', fontSize: 12, letterSpacing: 0.6 }}>RAISED</span>
                    {item.raised}
                  </div>
                )}
              </div>

              <p style={{ margin: '14px 0 10px', color: 'var(--muted)', fontSize: 14, lineHeight: 1.5 }}>{item.summary}</p>
              <a href={item.charityUrl} target="_blank" rel="noreferrer" style={textLinkStyle}>
                Visit {item.charity}'s website →
              </a>

              <div style={eventPanelStyle}>
                {item.eventTitle && <h4 style={{ fontSize: 18, margin: '0 0 4px' }}>{item.eventTitle}</h4>}
                {item.eventDate && <div style={{ fontWeight: 800, marginBottom: 7 }}>{item.eventDate}</div>}
                <p style={{ margin: 0 }}>{item.eventDetails}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: 34 }}>
        <h2 style={sectionHeadingStyle}>Team charity events by season</h2>
        <div style={{ display: 'grid', gap: 16 }}>
          {teamEvents.map((item) => (
            <article key={`${item.season}-${item.team}`} style={cardStyle}>
              <div style={seasonStyle}>{item.season} SEASON</div>
              <h3 style={{ fontSize: 20, margin: '4px 0 2px' }}>{item.team}</h3>
              <div style={{ color: 'var(--muted)', fontSize: 13, fontWeight: 700 }}>{item.title}</div>
              <p style={{ margin: '12px 0', color: 'var(--muted)', fontSize: 14, lineHeight: 1.5 }}>{item.summary}</p>
              <a href={item.url} target="_blank" rel="noreferrer" style={buttonLinkStyle}>View fundraiser</a>
            </article>
          ))}
        </div>
      </section>

      <aside style={{ border: '1px solid var(--line)', padding: 16, borderRadius: 10 }}>
        <h2 style={{ fontSize: 18, marginBottom: 6 }}>Charity enquiries</h2>
        <p style={{ margin: '0 0 10px', color: 'var(--muted)', fontSize: 14 }}>
          To ask about the league charity, the November tournament or adding a team event, send a charity enquiry through Contact Us.
        </p>
        <Link to="/contact?type=Charity Enquiry" style={textLinkStyle}>
          Send a charity enquiry →
        </Link>
      </aside>
    </div>
  )
}

const sectionHeadingStyle = { fontSize: 18, marginBottom: 12 }
const cardStyle = { background: '#fff', border: '1px solid var(--line)', borderRadius: 10, padding: 16 }
const charityIdentityStyle = { display: 'grid', gridTemplateColumns: '92px minmax(0, 1fr)', gap: 13, alignItems: 'center', minWidth: 0, flex: '1 1 320px' }
const logoPanelStyle = { width: 92, height: 64, padding: 6, border: '1px solid var(--line)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff' }
const logoStyle = { display: 'block', width: '100%', maxHeight: 52, objectFit: 'contain' }
const seasonStyle = { color: 'var(--brass)', fontWeight: 700, letterSpacing: 0.6, fontSize: 11 }
const amountStyle = { background: 'var(--ink)', color: '#fff', padding: '8px 12px', borderRadius: 7, fontWeight: 900, fontSize: 19, textAlign: 'center' }
const eventPanelStyle = { background: '#F6F3EA', borderLeft: '3px solid var(--brass)', borderRadius: 6, padding: 13, marginTop: 16, fontSize: 14 }
const textLinkStyle = { color: 'var(--ink)', fontSize: 13, fontWeight: 700, textDecoration: 'underline', textUnderlineOffset: 3 }
const buttonLinkStyle = { display: 'inline-block', background: 'var(--ink)', color: '#fff', padding: '8px 12px', borderRadius: 6, fontSize: 13, fontWeight: 700 }
