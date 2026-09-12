import { Link } from 'react-router-dom'

const COMPETITIONS = [
  {
    slug: 'appin-league',
    name: 'Appin Sports League',
    description: '12 teams, home and away — the main ECFA league table.',
  },
  {
    slug: 'knockout-cup',
    name: 'ECFA Knockout Cup',
    description: 'Straight knockout, right through to the final.',
  },
  {
    slug: 'league-cup',
    name: 'ECFA League Cup',
    description: 'Two groups of six, top four go on to the knockout stage.',
  },
  {
    slug: 'brian-latto-cup',
    name: 'Brian Latto Cup',
    description: 'For the four teams who just miss out on the League Cup knockout stage.',
  },
]

const SPONSORS = [
  {
    name: 'Appin Sports',
    url: 'https://appinsports.com/',
    logo: 'https://appinsports.com/wp-content/uploads/logo/logo-footer.png',
    blurb: 'Custom teamwear specialists — proud kit sponsor of the ECFA.',
  },
]

export default function Home() {
  return (
    <div className="container" style={{ padding: '48px 20px' }}>
      <h1 style={{ fontSize: 36, marginBottom: 12, color: 'var(--pitch)' }}>
        2026–27 Season
      </h1>
      <p style={{ maxWidth: 520, color: '#5A5646', marginBottom: 40 }}>
        Tables, fixtures and results for every ECFA competition, updated through the season.
      </p>

      <div style={{ display: 'grid', gap: 1, background: 'var(--line)' }}>
        {COMPETITIONS.map((c) => (
          <Link
            key={c.slug}
            to={`/competitions/${c.slug}`}
            style={{
              background: 'var(--paper)',
              padding: '22px 24px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <h2 style={{ fontSize: 20, marginBottom: 4 }}>{c.name}</h2>
              <p style={{ margin: 0, fontSize: 14, color: '#8A8570' }}>{c.description}</p>
            </div>
            <span style={{ fontSize: 22, color: 'var(--brass)' }}>&rarr;</span>
          </Link>
        ))}
      </div>

      <h2
        style={{
          fontSize: 15,
          fontWeight: 700,
          letterSpacing: 0.6,
          textTransform: 'uppercase',
          color: '#8A8570',
          marginTop: 56,
          marginBottom: 16,
        }}
      >
        Our Sponsors
      </h2>
      <div style={{ display: 'grid', gap: 1, background: 'var(--line)' }}>
        {SPONSORS.map((s) => (
          <a
            key={s.name}
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              background: 'var(--paper)',
              padding: '20px 24px',
              display: 'flex',
              alignItems: 'center',
              gap: 20,
            }}
          >
            <img
              src={s.logo}
              alt={s.name}
              style={{ height: 40, width: 'auto', objectFit: 'contain', flexShrink: 0 }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{s.name}</div>
              <p style={{ margin: '2px 0 0', fontSize: 13, color: '#8A8570' }}>{s.blurb}</p>
            </div>
            <span style={{ fontSize: 22, color: 'var(--brass)' }}>&rarr;</span>
          </a>
        ))}
      </div>
    </div>
  )
}
