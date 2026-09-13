import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import StandingsTable from '../components/StandingsTable'

const APPIN_LOGO = 'https://appinsports.com/wp-content/uploads/logo/logo-footer.png'

const COMPETITIONS = [
  { slug: 'appin-league', name: 'Appin Sports League' },
  { slug: 'knockout-cup', name: 'ECFA Knockout Cup' },
  { slug: 'league-cup', name: 'ECFA League Cup' },
  { slug: 'brian-latto-cup', name: 'Brian Latto Cup' },
]

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

async function loadCompetitionTables(meta) {
  const { data: comp } = await supabase.from('competitions').select('id').eq('slug', meta.slug).single()
  if (!comp) return { ...meta, tables: [] }

  const { data: stages } = await supabase
    .from('stages')
    .select('id, stage_type, sort_order, groups(id, name, sort_order)')
    .eq('competition_id', comp.id)
    .order('sort_order')

  const tables = []
  for (const stage of stages || []) {
    if (stage.stage_type !== 'group') continue
    const groups = (stage.groups || []).sort((a, b) => a.sort_order - b.sort_order)

    for (const group of groups) {
      const { data: stageTeams } = await supabase
        .from('stage_teams')
        .select('team:team_id(id, name, logo_url)')
        .eq('stage_id', stage.id)
        .eq('group_id', group.id)

      const { data: fixtures } = await supabase
        .from('fixtures')
        .select('home_score, away_score, status, home_team:home_team_id(id, name), away_team:away_team_id(id, name)')
        .eq('group_id', group.id)

      tables.push({
        groupId: group.id,
        groupName: groups.length > 1 ? group.name : null,
        rows: computeStandings((stageTeams || []).map((st) => st.team), fixtures || []),
      })
    }
  }

  return { ...meta, tables }
}

export default function StandingsPage() {
  const [loading, setLoading] = useState(true)
  const [competitions, setCompetitions] = useState([])

  useEffect(() => {
    let cancelled = false

    async function load() {
      const results = await Promise.all(COMPETITIONS.map((c) => loadCompetitionTables(c)))
      if (!cancelled) {
        setCompetitions(results)
        setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <div className="container" style={{ padding: '48px 20px' }}>
        <p style={{ color: 'var(--muted)' }}>Loading standings…</p>
      </div>
    )
  }

  return (
    <div className="container" style={{ padding: '32px 20px 48px' }}>
      <h1 style={{ fontSize: 30, marginBottom: 4 }}>Standings</h1>
      <p style={{ color: 'var(--muted)', marginBottom: 28 }}>Every ECFA table, at a glance.</p>

      {competitions.map((comp) => (
        <section key={comp.slug} style={{ marginBottom: 40 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              borderBottom: '3px solid var(--brass)',
              paddingBottom: 8,
              marginBottom: 16,
            }}
          >
            <h2 style={{ fontSize: 19, display: 'flex', alignItems: 'center', gap: 8 }}>
              {comp.slug === 'appin-league' && (
                <img src={APPIN_LOGO} alt="" style={{ height: 20, width: 'auto', objectFit: 'contain' }} />
              )}
              {comp.name}
            </h2>
            <Link to={`/competitions/${comp.slug}`} style={{ fontSize: 13, color: 'var(--brass)', fontWeight: 600 }}>
              Full competition &rarr;
            </Link>
          </div>

          {comp.tables.length === 0 ? (
            <p style={{ color: 'var(--muted)', fontSize: 14 }}>No table for this competition (knockout format).</p>
          ) : (
            comp.tables.map((t) => <StandingsTable key={t.groupId} groupName={t.groupName} rows={t.rows} />)
          )}
        </section>
      ))}
    </div>
  )
}
