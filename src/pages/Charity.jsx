import { Link } from 'react-router-dom'

const leagueSeasons = [
  {
    season: '2026/27',
    charity: 'Forget Me Notes Project',
    charityUrl: 'https://www.forgetmenotes.org.uk/',
    summary: 'An Edinburgh-based charity that uses music to build inclusive communities, encourage self-expression and combat social isolation. Its work is rooted in dementia-friendly values and is open to everyone.',
    eventTitle: 'ECFA Charity Tournament',
    eventDate: 'Saturday, 7 November 2026',
    eventDetails: 'Details are still to be confirmed. The event is expected to be a five-a-side or seven-a-side football tournament.',
  },
  {
    season: '2025/26',
    charity: "Don't Screen Us Out",
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
    <div className="container" style={{ padding: '34px 20px 64px', maxWidth: 820 }}>
      <div style={{ borderLeft: '5px solid var(--brass)', paddingLeft: 18, marginBottom: 34 }}>
        <div style={eyebrowStyle}>ECFA CHARITY WORK</div>
        <h1 style={{ fontSize: 38, margin: '5px 0 10px' }}>Football supporting our community</h1>
        <p style={{ color: 'var(--muted)', fontSize: 17, margin: 0, maxWidth: 690 }}>
          Each season, the ECFA nominates a charity and brings teams together to raise funds. Clubs also organise their own events for causes close to their communities.
        </p>
      </div>

      <section style={{ marginBottom: 42 }}>
        <h2 style={sectionHeadingStyle}>League charity events by season</h2>
        <div style={{ display: 'grid', gap: 18 }}>
          {leagueSeasons.map((item, index) => (
            <article key={item.season} style={{ ...cardStyle, borderTop: index === 0 ? '5px solid var(--brass)' : '1px solid var(--line)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div>
                  <div style={seasonStyle}>{item.season} SEASON</div>
                  <h3 style={{ fontSize: 26, margin: '7px 0 4px' }}>{item.charity}</h3>
                  {index === 0 && <div style={{ color: 'var(--brass)', fontWeight: 800 }}>ECFA nominated charity</div>}
                </div>
                {item.raised && (
                  <div style={amountStyle}>
                    <span style={{ display: 'block', fontSize: 12, letterSpacing: 0.6 }}>RAISED</span>
                    {item.raised}
                  </div>
                )}
              </div>

              <p style={{ margin: '18px 0 14px', lineHeight: 1.65 }}>{item.summary}</p>
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

      <section style={{ marginBottom: 42 }}>
        <h2 style={sectionHeadingStyle}>Team charity events by season</h2>
        <div style={{ display: 'grid', gap: 16 }}>
          {teamEvents.map((item) => (
            <article key={`${item.season}-${item.team}`} style={cardStyle}>
              <div style={seasonStyle}>{item.season} SEASON</div>
              <h3 style={{ fontSize: 23, margin: '7px 0 2px' }}>{item.team}</h3>
              <div style={{ color: 'var(--muted)', fontWeight: 700 }}>{item.title}</div>
              <p style={{ margin: '14px 0', lineHeight: 1.65 }}>{item.summary}</p>
              <a href={item.url} target="_blank" rel="noreferrer" style={buttonLinkStyle}>View fundraiser</a>
            </article>
          ))}
        </div>
      </section>

      <aside style={{ background: 'var(--ink)', color: '#fff', padding: 22, borderRadius: 10 }}>
        <h2 style={{ fontSize: 21, marginBottom: 8 }}>Charity enquiries</h2>
        <p style={{ margin: '0 0 12px', color: '#E5E5E5' }}>
          To ask about the league charity, the November tournament or adding a team event, send a charity enquiry through Contact Us.
        </p>
        <Link to="/contact?type=Charity Enquiry" style={{ color: 'var(--brass-light)', fontWeight: 800 }}>
          Send a charity enquiry →
        </Link>
      </aside>
    </div>
  )
}

const eyebrowStyle = { color: 'var(--brass)', fontWeight: 900, letterSpacing: 1, fontSize: 13 }
const sectionHeadingStyle = { fontSize: 25, marginBottom: 16, paddingBottom: 10, borderBottom: '3px solid var(--brass)' }
const cardStyle = { background: '#fff', border: '1px solid var(--line)', borderRadius: 10, padding: 22, boxShadow: '0 3px 14px rgba(0,0,0,0.04)' }
const seasonStyle = { color: 'var(--brass)', fontWeight: 900, letterSpacing: 0.7, fontSize: 13 }
const amountStyle = { background: 'var(--ink)', color: '#fff', padding: '10px 15px', borderRadius: 8, fontWeight: 900, fontSize: 23, textAlign: 'center' }
const eventPanelStyle = { background: '#F6F3EA', borderLeft: '4px solid var(--brass)', borderRadius: 6, padding: 16, marginTop: 20 }
const textLinkStyle = { color: 'var(--brass)', fontWeight: 800, textDecoration: 'underline', textUnderlineOffset: 3 }
const buttonLinkStyle = { display: 'inline-block', background: 'var(--ink)', color: '#fff', padding: '10px 15px', borderRadius: 6, fontWeight: 800 }
