import { computeStandings } from '../utils/standings'
import { useRememberedState, useRememberedScroll } from '../hooks/usePageMemory'
import ManagedSponsorLogo from '../components/ManagedSponsorLogo'
import { Link } from 'react-router-dom'
import { useEffect } from 'react'
import { supabase } from '../supabaseClient'
import StandingsTable from '../components/StandingsTable'
import MatchGraphic from '../components/MatchGraphic'


const COMPETITIONS = [
  { slug: 'appin-league', name: 'Appin Sports League' },
  { slug: 'knockout-cup', name: 'ECFA Knockout Cup' },
  { slug: 'league-cup', name: 'ECFA League Cup' },
  { slug: 'brian-latto-cup', name: 'Brian Latto Cup' },
]


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
  const [shareTable, setShareTable] = useRememberedState('shareTable', false)
  const [loading, setLoading] = useRememberedState('loading', true)
  const [competitions, setCompetitions] = useRememberedState('competitions', [])
  useRememberedScroll(!loading)

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
        <section key={comp.slug} style={{ marginBottom: 24 }}>
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
                <ManagedSponsorLogo alt="" style={{ height: 20, width: 'auto', objectFit: 'contain' }} />
              )}
              {comp.name}
            </h2>
            <Link to={`/competitions/${comp.slug}`} style={{ fontSize: 13, color: 'var(--brass)', fontWeight: 600 }}>
              Full competition &rarr;
            </Link>
          </div>

          {comp.slug === 'appin-league' && comp.tables.length > 0 && <div style={{marginBottom:12}}><button type="button" onClick={() => setShareTable(!shareTable)} aria-expanded={shareTable} style={{fontSize:13,padding:'8px 12px',border:'1px solid var(--brass)',borderRadius:5}}>{shareTable?'Hide league table graphic':'Share league table graphic'}</button>{shareTable && comp.tables.map(t => <MatchGraphic key={t.groupId} fixture={{id:'league-table',status:'played'}} scorers={[]} report={{type:'table',subtitle:comp.name+(t.groupName?' · '+t.groupName:''),displayEnd:new Date().toLocaleDateString('en-GB'),season:'Current season',rows:t.rows,badges:t.rows.map(r=>r.teamLogo),sharePath:'/standings'}} />)}</div>}
          {comp.tables.length === 0 ? (
            <p style={{ color: 'var(--muted)', fontSize: 14 }}>No table for this competition (knockout format).</p>
          ) : (
            comp.tables.map((t) => <StandingsTable key={t.groupId} groupName={t.groupName} rows={t.rows} competition={comp.slug} groupId={t.groupId} />)
          )}
        </section>
      ))}
    </div>
  )
}
