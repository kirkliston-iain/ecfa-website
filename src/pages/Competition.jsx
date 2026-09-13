import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import StandingsTable, { TopScorersTable } from '../components/StandingsTable'
import FixtureWeekNav from '../components/FixtureWeekNav'

export default function Competition() {
  const { slug } = useParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [competition, setCompetition] = useState(null)
  const [stages, setStages] = useState([])
  const [topScorers, setTopScorers] = useState([])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      const { data: comp, error: compErr } = await supabase
        .from('competitions')
        .select('id, name, season, slug')
        .eq('slug', slug)
        .single()

      if (compErr || !comp) {
        if (!cancelled) {
          setError('Competition not found.')
          setLoading(false)
        }
        return
      }

      const { data: stageRows } = await supabase
        .from('stages')
        .select('id, name, stage_type, sort_order, groups(id, name, sort_order)')
        .eq('competition_id', comp.id)
        .order('sort_order')

      const stagesWithData = await Promise.all(
        (stageRows || []).map(async (stage) => {
          const groupIds = (stage.groups || []).map((g) => g.id)

          const { data: fixtures } = await supabase
            .from('fixtures')
            .select(
              'id, round_name, fixture_date, home_score, away_score, status, group_id, home_team:home_team_id(id, name, logo_url), away_team:away_team_id(id, name, logo_url)'
            )
            .eq('stage_id', stage.id)
            .eq('hidden_from_public', false)
            .order('fixture_date', { ascending: true })

          let standingsByGroup = {}

          if (stage.stage_type === 'group') {
            const { data: stageTeams } = await supabase
              .from('stage_teams')
              .select('group_id, team:team_id(id, name, logo_url)')
              .eq('stage_id', stage.id)

            for (const group of stage.groups || []) {
              const teamsInGroup = (stageTeams || []).filter((st) => st.group_id === group.id)
              standingsByGroup[group.id] = computeStandings(
                teamsInGroup.map((st) => st.team),
                (fixtures || []).filter((f) => f.group_id === group.id)
              )
            }
          }

          return { ...stage, fixtures: fixtures || [], standingsByGroup }
        })
      )

      const { data: scorers } = await supabase
        .from('competition_top_scorers')
        .select('*')
        .eq('competition_id', comp.id)
        .order('total_goals', { ascending: false })

      if (!cancelled) {
        setCompetition(comp)
        setStages(stagesWithData.sort((a, b) => a.sort_order - b.sort_order))
        setTopScorers(scorers || [])
        setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [slug])

  if (loading) return <div className="container" style={{ padding: 48 }}>Loading…</div>
  if (error) return <div className="container" style={{ padding: 48 }}>{error}</div>

  return (
    <div className="container" style={{ padding: '32px 20px 48px' }}>
      <h1 style={{ fontSize: 30, marginBottom: 4 }}>{competition.name}</h1>
      <p style={{ color: 'var(--muted)', marginBottom: 32 }}>{competition.season} season</p>

      {stages.map((stage) => (
        <section key={stage.id} style={{ marginBottom: 44 }}>
          <h2
            style={{
              fontSize: 13,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              marginBottom: 18,
              paddingBottom: 8,
              borderBottom: '3px solid var(--brass)',
              color: 'var(--ink)',
            }}
          >
            {stage.name}
          </h2>

          {stage.stage_type === 'group' &&
            (stage.groups || [])
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((group) => (
                <StandingsTable
                  key={group.id}
                  groupName={stage.groups.length > 1 ? group.name : null}
                  rows={stage.standingsByGroup[group.id] || []}
                />
              ))}

          <h3 style={{ fontSize: 13, marginBottom: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
            Fixtures &amp; Results
          </h3>
          <FixtureWeekNav fixtures={stage.fixtures} />
        </section>
      ))}

      {stages.length === 0 && <p style={{ color: 'var(--muted)' }}>No stages set up for this competition yet.</p>}

      {competition.slug === 'appin-league' && (
        <section>
          <h2
            style={{
              fontSize: 13,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              marginBottom: 18,
              paddingBottom: 8,
              borderBottom: '3px solid var(--brass)',
              color: 'var(--ink)',
            }}
          >
            Top Scorers
          </h2>
          <TopScorersTable rows={topScorers.slice(0, 20)} />
        </section>
      )}
    </div>
  )
}

function computeStandings(teams, fixtures) {
  const table = {}

  for (const team of teams) {
    if (!team) continue
    table[team.id] = {
      teamId: team.id,
      teamName: team.name,
      teamLogo: team.logo_url,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
    }
  }

  for (const f of fixtures) {
    if (f.status !== 'played' || f.home_score == null || f.away_score == null) continue
    const home = table[f.home_team?.id]
    const away = table[f.away_team?.id]
    if (!home || !away) continue

    home.played += 1
    away.played += 1
    home.goalsFor += f.home_score
    home.goalsAgainst += f.away_score
    away.goalsFor += f.away_score
    away.goalsAgainst += f.home_score

    if (f.home_score > f.away_score) {
      home.won += 1
      home.points += 3
      away.lost += 1
    } else if (f.home_score < f.away_score) {
      away.won += 1
      away.points += 3
      home.lost += 1
    } else {
      home.drawn += 1
      away.drawn += 1
      home.points += 1
      away.points += 1
    }
  }

  return Object.values(table)
    .map((row) => ({ ...row, goalDifference: row.goalsFor - row.goalsAgainst }))
    .sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor)
}
