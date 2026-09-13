import { useNavigate } from 'react-router-dom'

const APPIN_LOGO = 'https://appinsports.com/wp-content/uploads/logo/logo-footer.png'

const COMPETITIONS = [
  {
    slug: 'appin-league',
    name: 'Appin Sports League',
    description: '12 teams, home and away — the main ECFA league table.',
    logo: APPIN_LOGO,
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
  const navigate = useNavigate()

  return (
    <div className="container" style={{ padding: '32px 20px 48px' }}>
      <h1 style={{ fontSize: 30, marginBottom: 4 }}>Competitions</h1>
      <p style={{ color: 'var(--muted)', marginBottom: 28 }}>
        Pick a competition for its fixtures, results and table.
      </p>

      <select
        defaultValue=""
        onChange={(e) => {
          if (e.target.value) navigate(`/competitions/${e.target.value}`)
        }}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          padding: '14px 16px',
          fontSize: 16,
          fontWeight: 600,
          borderRadius: 6,
          border: '1px solid var(--line)',
          background: '#fff',
          marginBottom: 28,
        }}
      >
        <option value="" disabled>
          Select a competition…
        </option>
        {COMPETITIONS.map((c) => (
          <option key={c.slug} value={c.slug}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  )
}
