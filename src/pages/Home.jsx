import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import StandingsTable from '../components/StandingsTable'

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

// Games are typically played on Saturdays. Results (matchday recap) are the
// priority display from Saturday through Sunday and into the small hours of
// Monday; from 3am UK time on Monday the dashboard switches over to showing
// the upcoming fixtures for the next matchday.
function getDashboardMode() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    weekday: 'short',
    hour: 'numeric',
    hour12: false,
  }).formatToParts(new Date())
  const weekday = parts.find((p) => p.type === 'weekday')?.value
  const hour = Number(parts.find((p) => p.type === 'hour')?.value)

  if (weekday === 'Sun' || weekday === 'Sat') return 'recap'
  if (weekday === 'Mon' && hour < 3) return 'recap'
  return 'fixtures'
}

function computeStandings(teams, fixtures) {
  const table = {}
  for (const team of teams) {
    if (!team) continue
    table[team.id] = {
      teamId: team.id,
      teamName: team.name,
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

function MiniFixtureRow({ f }) {
  return (
    <li style={{ borderBottom: '1px solid var(--line)' }}>
      <Link
        to={`/fixtures/${f.id}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 4px',
          fontSize: 14,
        }}
      >
        <span style={{ flex: 1 }}>
          {f.home_team?.name} <span style={{ color: '#8A8570' }}>v</span> {f.away_team?.name}
        </span>
        {f.status === 'played' ? (
          <span style={{ fontWeight: 700, color: 'var(--pitch)' }}>
            {f.home_score} – {f.away_score}
          </span>
        ) : (
          <span style={{ color: '#8A8570', fontSize: 12 }}>
            {f.fixture_date
              ? new Date(f.fixture_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
              : 'TBC'}
          </span>
        )}
      </Link>
    </li>
  )
}

function CompetitionCard({ meta, mode }) {
  const [loading, setLoading] = useState(true)
  const [recap, setRecap] = useState([])
  const [upcoming, setUpcoming] = useState([])
  const [groupTables, setGroupTables] = useState([])

  useEffect(() => {
    let cancelled = false

    async function load() {
      const { data: comp } = await supabase
        .from('competitions')
        .select('id')
        .eq('slug', meta.slug)
        .single()

      if (!comp) {
        if (!cancelled) setLoading(false)
        return
      }

      const { data: stages } = await supabase
        .from('stages')
        .select('id, stage_type, sort_order, groups(id, name, sort_order)')
        .eq('competition_id', comp.id)
        .order('sort_order')

      const stageIds = (stages || []).map((s) => s.id)

      const { data: fixtures } = await supabase
        .from('fixtures')
        .select(
          'id, fixture_date, home_score, away_score, status, group_id, stage_id, home_team:home_team_id(id, name), away_team:away_team_id(id, name)'
        )
        .in('stage_id', stageIds.length ? stageIds : ['00000000-0000-0000-0000-000000000000'])
        .order('fixture_date', { ascending: true })

      const all = fixtures || []
      const played = all.filter((f) => f.status === 'played').sort((a, b) => new Date(b.fixture_date) - new Date(a.fixture_date))
      const notPlayed = all.filter((f) => f.status !== 'played').sort((a, b) => new Date(a.fixture_date) - new Date(b.fixture_date))

      const lastDate = played[0]?.fixture_date
      const recapRows = lastDate ? played.filter((f) => f.fixture_date === lastDate) : []
      const nextDate = notPlayed[0]?.fixture_date
      const upcomingRows = nextDate ? notPlayed.filter((f) => f.fixture_date === nextDate) : []

      const tables = []
      for (const stage of stages || []) {
        if (stage.stage_type !== 'group') continue
        const groups = (stage.groups || []).sort((a, b) => a.sort_order - b.sort_order)
        const { data: stageTeams } = await supabase
          .from('stage_teams')
          .select('group_id, team:team_id(id, name)')
          .eq('stage_id', stage.id)

        for (const group of groups) {
          const teamsInGroup = (stageTeams || []).filter((st) => st.group_id === group.id).map((st) => st.team)
          const groupFixtures = all.filter((f) => f.group_id === group.id)
          tables.push({
            groupId: group.id,
            groupName: groups.length > 1 ? group.name : null,
            rows: computeStandings(teamsInGroup, groupFixtures),
          })
        }
      }

      if (!cancelled) {
        setRecap(recapRows)
        setUpcoming(upcomingRows)
        setGroupTables(tables)
        setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [meta.slug])

  const showRecap = mode === 'recap' ? recap.length > 0 || upcoming.length === 0 : recap.length > 0 && upcoming.length === 0
  const fixturesToShow = showRecap ? recap : upcoming

  return (
    <section
      style={{
        border: '1px solid var(--line)',
        borderRadius: 8,
        padding: '20px 24px',
        marginBottom: 32,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <Link to={`/competitions/${meta.slug}`} style={{ fontSize: 20, fontWeight: 700, color: 'var(--pitch)' }}>
          {meta.name}
        </Link>
        <Link to={`/competitions/${meta.slug}`} style={{ fontSize: 13, color: 'var(--brass)' }}>
          Full competition &rarr;
        </Link>
      </div>
      <p style={{ margin: '0 0 16px', fontSize: 13, color: '#8A8570' }}>{meta.description}</p>

      {loading ? (
        <p style={{ color: '#8A8570', fontSize: 14 }}>Loading…</p>
      ) : (
        <>
          <h3 style={{ fontSize: 14, textTransform: 'uppercase', letterSpacing: 0.5, color: '#5A5646', marginBottom: 4 }}>
            {showRecap ? 'Matchday Recap' : 'Upcoming Fixtures'}
          </h3>
          {fixturesToShow.length === 0 ? (
            <p style={{ color: '#8A8570', fontSize: 14, marginBottom: 16 }}>Nothing scheduled right now.</p>
          ) : (
            <ul style={{ listStyle: 'none', margin: '0 0 16px', padding: 0 }}>
              {fixturesToShow.map((f) => (
                <MiniFixtureRow key={f.id} f={f} />
              ))}
            </ul>
          )}

          {groupTables.map((t) => (
            <StandingsTable key={t.groupId} groupName={t.groupName} rows={t.rows} />
          ))}
        </>
      )}
    </section>
  )
}

export default function Home() {
  const mode = getDashboardMode()

  return (
    <div className="container" style={{ padding: '48px 20px' }}>
      <h1 style={{ fontSize: 36, marginBottom: 12, color: 'var(--pitch)' }}>Dashboard</h1>
      <p style={{ maxWidth: 560, color: '#5A5646', marginBottom: 40 }}>
        2026–27 season — live tables, recent results and upcoming fixtures for every ECFA competition.
      </p>

      {COMPETITIONS.map((c) => (
        <CompetitionCard key={c.slug} meta={c} mode={mode} />
      ))}

      <h2
        style={{
          fontSize: 15,
          fontWeight: 700,
          letterSpacing: 0.6,
          textTransform: 'uppercase',
          color: '#8A8570',
          marginTop: 24,
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
