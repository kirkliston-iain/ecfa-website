import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'

function Badge({ logoUrl, name, size = 62 }) {
  if (logoUrl) {
    return <img src={logoUrl} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', background: '#fff' }} />
  }
  const initials = (name || '?').split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()
  return (
    <span style={{ width: size, height: size, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'var(--ink)', color: '#fff', fontWeight: 800 }}>
      {initials}
    </span>
  )
}

function matchLabel(fixture) {
  if (!fixture) return 'Match details unavailable'
  const home = fixture.home_team?.name || 'TBC'
  const away = fixture.away_team?.name || 'TBC'
  return `${home} v ${away}`
}

const TEAM_ALIASES = {
  'Barclay Viewforth FC': 'Barclay Viewforth Church',
  'Bingham FC': 'Hope Church',
  'Bristo Memorial FC': 'South East Saints',
  Carrubbers: 'Carrubbers Church',
  'Carrubbers FC': 'Carrubbers Church',
  Central: 'Liberton Church',
  'Central FC': 'Liberton Church',
  'Gorgie United': 'Gorgie United Salvation Army',
  'Gorgie United FC': 'Gorgie United Salvation Army',
  Ladywell: 'Ladywell Baptist Church',
  Niddrie: 'The Mission',
  'Niddrie FC': 'The Mission',
  'Port Seton FC': 'Port Seton',
  'South East Saints FC': 'South East Saints',
  "St Mary's Metropolitan FC": 'St Marys Metropolitan Church',
  'St Marys': 'St Marys Metropolitan Church',
  'The Mission FC': 'The Mission',
  'White Lightning': 'White Lightning Bruntsfield Church',
  'White Lightning FC': 'White Lightning Bruntsfield Church',
}

function canonicalTeamName(name) {
  const cleanName = String(name || '').trim().replace(/\s+/g, ' ')
  return TEAM_ALIASES[cleanName] || cleanName
}

export default function PlayerDetail() {
  const { id } = useParams()
  const [player, setPlayer] = useState(null)
  const [goals, setGoals] = useState([])
  const [historicGoals, setHistoricGoals] = useState([])
  const [historicMatchGoals, setHistoricMatchGoals] = useState([])
  const [discipline, setDiscipline] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')

      const { data: playerRow, error: playerError } = await supabase
        .from('players')
        .select('id, first_name, last_name, team:team_id(id, name, logo_url)')
        .eq('id', id)
        .single()

      if (playerError || !playerRow) {
        if (!cancelled) {
          setError('Player not found.')
          setLoading(false)
        }
        return
      }

      const fullName = `${playerRow.first_name || ''} ${playerRow.last_name || ''}`.trim()
      const [goalResult, historicResult, historicMatchResult, disciplineResult] = await Promise.all([
        supabase
          .from('fixture_scorers')
          .select('id, goals, team:team_id(id, name), fixture:fixture_id(id, fixture_date, home_score, away_score, home_team:home_team_id(id, name), away_team:away_team_id(id, name))')
          .eq('player_id', id),
        supabase
          .from('historic_scorers')
          .select('season, team_name, goals')
          .ilike('player_name', fullName)
          .order('season', { ascending: false }),
        supabase
          .from('historic_match_scorers')
          .select('season, fixture_date, team_name, home_team_name, away_team_name, goals')
          .ilike('player_name', fullName),
        supabase
          .from('discipline_records')
          .select('id, card_type, card_count, notes, serious_offence, fixture:fixture_id(id, fixture_date, home_score, away_score, home_team:home_team_id(name), away_team:away_team_id(name))')
          .eq('player_id', id),
      ])

      if (!cancelled) {
        setPlayer(playerRow)
        setGoals(goalResult.data || [])
        setHistoricGoals(historicResult.data || [])
        setHistoricMatchGoals(historicMatchResult.data || [])
        setDiscipline((disciplineResult.data || []).sort((a, b) => new Date(b.fixture?.fixture_date || 0) - new Date(a.fixture?.fixture_date || 0)))
        setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [id])

  const yellowTotal = useMemo(
    () => discipline.filter((row) => row.card_type === 'yellow').reduce((sum, row) => sum + Number(row.card_count || 0), 0),
    [discipline]
  )
  const redTotal = useMemo(
    () => discipline.filter((row) => row.card_type === 'red').reduce((sum, row) => sum + Number(row.card_count || 0), 0),
    [discipline]
  )
  const aggregatedHistoricGoals = useMemo(() => {
    const totals = new Map()
    for (const row of historicGoals) {
      const season = String(row.season || 'Unknown').trim()
      const teamName = String(row.team_name || 'Team not recorded').trim().replace(/\s+/g, ' ')
      const key = `${season.toLocaleLowerCase('en-GB')}::${teamName.toLocaleLowerCase('en-GB')}`
      const existing = totals.get(key)
      if (existing) existing.goals += Number(row.goals || 0)
      else totals.set(key, { season, team_name: teamName, goals: Number(row.goals || 0) })
    }
    return [...totals.values()].sort((left, right) => {
      const seasonOrder = right.season.localeCompare(left.season, 'en-GB', { numeric: true })
      return seasonOrder || left.team_name.localeCompare(right.team_name, 'en-GB')
    })
  }, [historicGoals])

  const currentGoals = goals.reduce((sum, row) => sum + Number(row.goals || 0), 0)
  const historicalGoals = aggregatedHistoricGoals.reduce((sum, row) => sum + Number(row.goals || 0), 0)
  const goalsByOpponent = useMemo(() => {
    const totals = new Map()
    const addGoals = (opponent, goalCount) => {
      const name = canonicalTeamName(opponent)
      if (!name) return
      totals.set(name, (totals.get(name) || 0) + Number(goalCount || 0))
    }

    for (const row of goals) {
      const fixture = row.fixture
      if (!fixture) continue
      const isHome = row.team?.id
        ? row.team.id === fixture.home_team?.id
        : canonicalTeamName(row.team?.name) === canonicalTeamName(fixture.home_team?.name)
      addGoals(isHome ? fixture.away_team?.name : fixture.home_team?.name, row.goals)
    }

    for (const row of historicMatchGoals) {
      const scoringTeam = canonicalTeamName(row.team_name)
      const homeTeam = canonicalTeamName(row.home_team_name)
      const awayTeam = canonicalTeamName(row.away_team_name)
      if (scoringTeam === homeTeam) addGoals(awayTeam, row.goals)
      else if (scoringTeam === awayTeam) addGoals(homeTeam, row.goals)
    }

    return [...totals.entries()]
      .map(([opponent, goalCount]) => ({ opponent, goals: goalCount }))
      .sort((left, right) => right.goals - left.goals || left.opponent.localeCompare(right.opponent))
  }, [goals, historicMatchGoals])

  if (loading) return <div className="container" style={{ padding: 48 }}>Loading player…</div>
  if (error) return <div className="container" style={{ padding: 48 }}>{error}</div>

  const fullName = `${player.first_name || ''} ${player.last_name || ''}`.trim()

  return (
    <div className="container" style={{ padding: '32px 20px 48px', maxWidth: 820 }}>
      <Link to="/search" style={{ color: 'var(--brass)', fontWeight: 700, fontSize: 13 }}>← Back to search</Link>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, margin: '24px 0 10px' }}>
        <Badge logoUrl={player.team?.logo_url} name={player.team?.name || fullName} />
        <div>
          <h1 style={{ fontSize: 30, margin: 0 }}>{fullName}</h1>
          <div style={{ color: 'var(--muted)', marginTop: 5 }}>
            Current team:{' '}
            {player.team ? <Link to={`/teams/${player.team.id}`} style={{ color: 'var(--brass)', fontWeight: 700 }}>{player.team.name}</Link> : 'No current team recorded'}
          </div>
        </div>
      </div>

      <div style={summaryGridStyle}>
        <div style={summaryStyle}><span style={labelStyle}>Current goals</span><strong style={valueStyle}>{currentGoals}</strong></div>
        <div style={summaryStyle}><span style={labelStyle}>Historical goals</span><strong style={valueStyle}>{historicalGoals}</strong></div>
        <div style={summaryStyle}><span style={labelStyle}>Yellow cards</span><strong style={{ ...valueStyle, color: '#b88900' }}>{yellowTotal}</strong></div>
        <div style={summaryStyle}><span style={labelStyle}>Red cards</span><strong style={{ ...valueStyle, color: '#b3261e' }}>{redTotal}</strong></div>
      </div>

      <section style={{ marginBottom: 34 }}>
        <h2 style={sectionHeadingStyle}>Discipline history</h2>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: -5 }}>
          Recorded yellow and red cards, shown match by match.
        </p>
        {discipline.length === 0 ? (
          <p style={{ color: 'var(--muted)' }}>No discipline records.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 560, borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={thStyle}>Date</th>
                  <th style={thStyle}>Match</th>
                  <th style={thStyle}>Card</th>
                  <th style={thStyle}>Details</th>
                </tr>
              </thead>
              <tbody>
                {discipline.map((row) => (
                  <tr key={row.id}>
                    <td style={tdStyle}>
                      {row.fixture?.fixture_date ? new Date(row.fixture.fixture_date).toLocaleDateString('en-GB') : '—'}
                    </td>
                    <td style={tdStyle}>
                      {row.fixture?.id ? <Link to={`/fixtures/${row.fixture.id}`} style={{ color: 'var(--brass)', fontWeight: 700 }}>{matchLabel(row.fixture)}</Link> : matchLabel(row.fixture)}
                    </td>
                    <td style={tdStyle}>
                      <span style={{ color: row.card_type === 'red' ? '#b3261e' : '#8a6900', fontWeight: 800, textTransform: 'capitalize' }}>
                        {row.card_count > 1 ? `${row.card_count} × ` : ''}{row.card_type}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, color: 'var(--muted)' }}>{row.serious_offence || row.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 style={sectionHeadingStyle}>Scoring history</h2>
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>
          {currentGoals} goal{currentGoals === 1 ? '' : 's'} this season and {historicalGoals} across previous recorded seasons.
        </p>
        {aggregatedHistoricGoals.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr><th style={thStyle}>Season</th><th style={thStyle}>Team</th><th style={{ ...thStyle, textAlign: 'right' }}>Goals</th></tr></thead>
            <tbody>
              {aggregatedHistoricGoals.map((row) => (
                <tr key={`${row.season}-${row.team_name}`}>
                  <td style={tdStyle}>{row.season}</td>
                  <td style={tdStyle}>{row.team_name}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 800 }}>{row.goals}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section style={{ marginTop: 34 }}>
        <h2 style={sectionHeadingStyle}>Goals by opponent</h2>
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>
          Goals scored against each team from the match-level records currently held on the website.
        </p>
        {goalsByOpponent.length === 0 ? (
          <p style={{ color: 'var(--muted)' }}>No match-level scoring records are available.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={thStyle}>Opponent</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Goals</th>
              </tr>
            </thead>
            <tbody>
              {goalsByOpponent.map((row) => (
                <tr key={row.opponent}>
                  <td style={tdStyle}>{row.opponent}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 800 }}>{row.goals}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}

const summaryGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
  gap: 10,
  margin: '26px 0 34px',
}
const summaryStyle = { padding: 14, border: '1px solid var(--line)', borderRadius: 8, background: '#f5f8fa' }
const labelStyle = { display: 'block', color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 }
const valueStyle = { display: 'block', fontSize: 26, marginTop: 5 }
const sectionHeadingStyle = { color: 'var(--brass)', fontSize: 18, paddingBottom: 8, borderBottom: '2px solid var(--line)' }
const thStyle = { padding: '8px', borderBottom: '1px solid var(--line)', textAlign: 'left', color: 'var(--muted)', textTransform: 'uppercase', fontSize: 11 }
const tdStyle = { padding: '10px 8px', borderBottom: '1px solid var(--line)', verticalAlign: 'top' }
