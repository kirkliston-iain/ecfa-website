import { displayedScore } from '../utils/fixtureOutcome'

const nameOf = (fixture, side) => fixture?.[`${side}_team`]?.name || fixture?.[`${side}_placeholder`] || 'To be decided'

function dateOf(fixture) {
  if (!fixture?.fixture_date) return 'Date to be confirmed'
  return new Date(fixture.fixture_date).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'long', timeZone: 'Europe/London',
  })
}

function timeOf(fixture) {
  return fixture?.fixture_date?.slice(11, 16) || ''
}

function winnerLabel(fixture) {
  return `Winner: ${nameOf(fixture, 'home')} v ${nameOf(fixture, 'away')}`
}

function Slot({ fixture, side }) {
  const team = fixture?.[`${side}_team`]
  const raw = nameOf(fixture, side)
  const name = raw.startsWith('Winner: ') ? `Winner of ${raw.slice(8)}` : raw
  return (
    <div className={`bracket-slot${team ? '' : ' bracket-slot-pending'}`}>
      {team?.logo_url && <img src={team.logo_url} alt="" />}
      <span>{name}</span>
    </div>
  )
}

function Tie({ fixture, label }) {
  return (
    <div className={`bracket-tie${fixture?.status === 'played' ? ' bracket-tie-played' : ''}`}>
      <div className="bracket-tie-header">
        <strong>{label}</strong>
        <span>{dateOf(fixture)}{timeOf(fixture) ? ` · ${timeOf(fixture)}` : ''}</span>
      </div>
      <Slot fixture={fixture} side="home" />
      <Slot fixture={fixture} side="away" />
      {fixture?.status === 'played' && <div className="bracket-result">Result: {displayedScore(fixture)}</div>}
    </div>
  )
}

export default function KnockoutBracket({ fixtures }) {
  const quarters = fixtures.filter((f) => f.round_name === 'Quarter-Final')
  const semis = fixtures.filter((f) => f.round_name === 'Semi-Final')
  const final = fixtures.find((f) => f.round_name === 'Final')

  if (!quarters.length || !semis.length) return null

  const paths = semis.map((semi, index) => {
    const sources = [semi.home_placeholder, semi.away_placeholder]
    const linked = sources.map((source) => quarters.find((quarter) => source === winnerLabel(quarter)))
    // When a quarter-final has been played, its winner is already in the semi-final slot.
    for (const quarter of quarters) {
      if (linked.includes(quarter) || quarter.status !== 'played') continue
      const home = semi.home_team?.id && semi.home_team.id === quarter.home_team?.id
      const away = semi.away_team?.id && semi.away_team.id === quarter.away_team?.id
      const reverseHome = semi.home_team?.id && semi.home_team.id === quarter.away_team?.id
      const reverseAway = semi.away_team?.id && semi.away_team.id === quarter.home_team?.id
      if (home || away || reverseHome || reverseAway) linked[sources[0] ? 1 : 0] = quarter
    }
    return { semi, index, linked: linked.filter(Boolean) }
  })

  return (
    <div className="knockout-bracket">
      <div className="bracket-heading">
        <h3>Road to the final</h3>
        <p>Follow each quarter-final into its semi-final.</p>
      </div>
      {paths.map(({ semi, index, linked }) => (
        <div className="bracket-path" key={semi.id}>
          <div className="bracket-sources">
            {linked.map((quarter) => <Tie key={quarter.id} fixture={quarter} label="Quarter-final" />)}
          </div>
          <div className="bracket-connector" aria-hidden="true" />
          <Tie fixture={semi} label={`Semi-final ${index + 1}`} />
        </div>
      ))}
      {final && <div className="bracket-final"><Tie fixture={final} label="Final" /></div>}
      {quarters.some((quarter) => !paths.some((path) => path.linked.includes(quarter))) && (
        <p className="bracket-note">Some quarter-final paths have not yet been linked in the draw.</p>
      )}
    </div>
  )
}
