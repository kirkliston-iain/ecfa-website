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

export default function CompetitionsIndex() {
  return (
    <div className="container" style={{ padding: '32px 20px 48px' }}>
      <h1 style={{ fontSize: 30, marginBottom: 4 }}>Competitions</h1>
      <p style={{ color: 'var(--muted)', marginBottom: 28 }}>
        Pick a competition for its fixtures, results and table.
      </p>

      <div style={{ display: 'grid', gap: 12 }}>
        {COMPETITIONS.map((c) => (
          <Link
            key={c.slug}
            to={`/competitions/${c.slug}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              border: '1px solid var(--line)',
              borderRadius: 6,
              padding: '20px 22px',
              background: '#fff',
            }}
          >
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>{c.name}</div>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>{c.description}</div>
            </div>
            <span style={{ fontSize: 22, color: 'var(--brass)', flexShrink: 0 }}>&rarr;</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
