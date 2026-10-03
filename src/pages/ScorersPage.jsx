import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { trackInteraction } from '../utils/webAnalytics'

const CURRENT_SEASON = '2026/27'

const SEASON_OPTIONS = [
  { value: 'overall', label: 'Overall (All-time)' },
  { value: '2026/27', label: '2026/27 (current)' },
  { value: '2025/26', label: '2025/26' },
  { value: '2024/25', label: '2024/25' },
  { value: '2023/24', label: '2023/24' },
  { value: '2022/23', label: '2022/23' },
  { value: '2021/22', label: '2021/22' },
  { value: '2019/20', label: '2019/20' },
  { value: '2018/19', label: '2018/19' },
  { value: '2017/18', label: '2017/18' },
  { value: '2016/17', label: '2016/17' },
  { value: '2015/16', label: '2015/16' },
]

function Badge({ logoUrl, name, size = 20 }) {
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt=""
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          objectFit: 'cover',
          background: '#fff',
          flexShrink: 0,
        }}
      />
    )
  }
  const initials = (name || '?')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'var(--ink)',
        color: '#fff',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.4,
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {initials}
    </span>
  )
}

function normalisePlayerName(name) {
  return String(name || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-GB')
}

const PLAYER_NAME_ALIASES = {
  'darron taylor': 'darran taylor',
  'darron cairns': 'darran taylor',
}

function playerKey(name) {
  const normalised = normalisePlayerName(name)
  return PLAYER_NAME_ALIASES[normalised] || normalised
}

function canonicalPlayerName(name) {
  return playerKey(name) === 'darran taylor' ? 'Darran Taylor' : String(name || '').trim()
}

function competitionGroup(name, slug) {
  if (slug === 'appin-league' || /league/i.test(name || '') && !/cup/i.test(name || '')) return 'League'
  if (/cup/i.test(name || '') || slug?.includes('cup')) return 'Cup'
  return 'Competition not recorded'
}

const COMPETITION_SCOPES = [
  { value: 'all', label: 'All goals' },
  { value: 'League', label: 'League' },
  { value: 'Cup', label: 'Cup' },
]

const SPONSOR_NAMES = ['Game of Throwing Edinburgh', 'Escape Edinburgh']

// Supabase/PostgREST caps a plain select at 1000 rows by default. historic_scorers
// has more rows than that, so a single query silently truncates the tail end of the
// table. Page through it in batches of 1000 so every row is loaded.
async function fetchAllHistoricScorers() {
  const pageSize = 1000
  let from = 0
  let all = []
  while (true) {
    const { data, error } = await supabase
      .from('historic_scorers')
      .select('player_name, team_name, goals, season')
      .order('id')
      .range(from, from + pageSize - 1)

    if (error || !data) break
    all = all.concat(data)
    if (data.length < pageSize) break
    from += pageSize
  }
  return all
}

export default function ScorersPage() {
  const [searchParams] = useSearchParams()
  const playerSearch = (searchParams.get('player') || '').trim()
  const [season, setSeason] = useState('overall')
  const [competition, setCompetition] = useState('all')
  const [loading, setLoading] = useState(true)
  const [historic, setHistoric] = useState([])
  const [current, setCurrent] = useState([])
  const [teamLogos, setTeamLogos] = useState({})
  const [playerDirectory, setPlayerDirectory] = useState([])
  const [sponsors, setSponsors] = useState([])

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [playerSearch])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)

      const hist = await fetchAllHistoricScorers()

      const [{ data: scorers }, { data: teams }, { data: directoryPlayers }, { data: sponsorRows }] = await Promise.all([
        supabase
          .from('fixture_scorers')
          .select('goals, player:player_id(id, first_name, last_name), team:team_id(name), fixture:fixture_id(stage:stage_id(competition:competition_id(name, slug)))'),
        supabase.from('teams').select('name, logo_url'),
        supabase.from('players').select('id, first_name, last_name, team_id').order('last_name').order('first_name'),
        supabase.from('sponsors').select('id, name, website_url, logo_url').eq('is_published', true).in('name', SPONSOR_NAMES),
      ])

      if (!cancelled) {
        setHistoric((hist || []).map((row) => ({ ...row, competition: 'League' })))
        setCurrent(
          (scorers || []).map((s) => ({
            player_id: s.player?.id || null,
            player_name: `${s.player?.first_name || ''} ${s.player?.last_name || ''}`.trim(),
            team_name: s.team?.name || '',
            goals: Number(s.goals),
            competition: competitionGroup(s.fixture?.stage?.competition?.name, s.fixture?.stage?.competition?.slug),
          }))
        )
        setSponsors((sponsorRows || []).sort((a, b) => SPONSOR_NAMES.indexOf(a.name) - SPONSOR_NAMES.indexOf(b.name)))
        const logoMap = {}
        for (const t of teams || []) logoMap[t.name] = t.logo_url
        setTeamLogos(logoMap)
        setPlayerDirectory(directoryPlayers || [])
        setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  const rows = useMemo(() => {
    const rosterNames = {}
    const rosterIds = {}
    for (const player of playerDirectory) {
      const name = `${player.first_name || ''} ${player.last_name || ''}`.trim()
      const key = playerKey(name)
      if (!key || rosterIds[key]) continue
      rosterNames[key] = name
      rosterIds[key] = player.id
    }
    for (const row of current) {
      const key = playerKey(row.player_name)
      rosterNames[key] = row.player_name
      if (row.player_id) rosterIds[key] = row.player_id
    }

    const seasonRows = season === 'overall'
      ? [...historic, ...current]
      : season === '2026/27'
        ? current
        : historic.filter((row) => row.season === season)
    const sourceRows = competition === 'all' ? seasonRows : seasonRows.filter((row) => row.competition === competition)

    const totals = {}
    const displayNames = {}
    const teamOf = {}
    const byCompetition = {}
    for (const row of sourceRows) {
      const key = playerKey(row.player_name)
      if (!key) continue
      totals[key] = (totals[key] || 0) + Number(row.goals || 0)
      if (!byCompetition[key]) byCompetition[key] = {}
      byCompetition[key][row.competition] = (byCompetition[key][row.competition] || 0) + Number(row.goals || 0)
      displayNames[key] = key === 'darran taylor' ? 'Darran Taylor' : rosterNames[key] || displayNames[key] || canonicalPlayerName(row.player_name)
      if (row.team_name) teamOf[key] = row.team_name
    }

    return Object.entries(totals)
      .map(([key, goals]) => ({
        player_name: displayNames[key],
        player_id: rosterIds[key] || null,
        team_name: teamOf[key] || '',
        goals,
        byCompetition: byCompetition[key],
      }))
      .sort((a, b) => b.goals - a.goals)
  }, [season, competition, historic, current, playerDirectory])

  const visibleRows = playerSearch
    ? rows.filter((row) => playerKey(row.player_name) === playerKey(playerSearch))
    : rows

  const playerSeasonRows = useMemo(() => {
    if (!playerSearch) return []
    const searchedKey = playerKey(playerSearch)
    const totals = new Map()
    const addRow = (seasonName, teamName, goalCompetition, goals) => {
      const cleanSeason = String(seasonName || 'Unknown').replace('-', '/')
      const cleanTeam = String(teamName || 'Team not recorded').trim()
      const key = `${cleanSeason.toLocaleLowerCase('en-GB')}::${cleanTeam.toLocaleLowerCase('en-GB')}::${goalCompetition}`
      const existing = totals.get(key)
      if (existing) existing.goals += Number(goals || 0)
      else totals.set(key, { season: cleanSeason, team_name: cleanTeam, competition: goalCompetition, goals: Number(goals || 0) })
    }

    for (const row of historic) {
      if (playerKey(row.player_name) === searchedKey && (competition === 'all' || competition === row.competition)) addRow(row.season, row.team_name, row.competition, row.goals)
    }
    for (const row of current) {
      if (playerKey(row.player_name) === searchedKey && (competition === 'all' || competition === row.competition)) addRow(CURRENT_SEASON, row.team_name, row.competition, row.goals)
    }

    return [...totals.values()].sort((left, right) => {
      const seasonOrder = right.season.localeCompare(left.season, 'en-GB', { numeric: true })
      return seasonOrder || left.team_name.localeCompare(right.team_name, 'en-GB')
    })
  }, [playerSearch, historic, current, competition])

  const playerHistoryTotal = playerSeasonRows.reduce((sum, row) => sum + row.goals, 0)

  if (loading) return <div className="container" style={{ padding: 48 }}>Loading…</div>

  const seasonLabel =
    season === 'overall'
      ? 'All-time career goals across every ECFA season on record.'
      : season === '2026/27'
        ? 'Goals scored so far this season.'
        : `Goals scored in the ${season} season.`

  return (
    <div className="container" style={{ padding: '32px 20px 48px' }}>
      <h1 style={{ fontSize: 30, marginBottom: 4 }}>Goalscorers</h1>
      {sponsors.length > 0 && <div aria-label="Goalscorers sponsors" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, maxWidth: 500, margin: '12px 0 18px' }}>
        {sponsors.map((sponsor) => <a key={sponsor.id} href={sponsor.website_url} target="_blank" rel="noopener noreferrer" onClick={() => trackInteraction('sponsor_click', `${sponsor.name} — Goalscorers`)} style={sponsorLinkStyle}>
          {sponsor.logo_url && <img src={sponsor.logo_url} alt="" style={{ width: 46, height: 46, objectFit: 'contain', flexShrink: 0 }} />}
          <span>{sponsor.name}</span>
        </a>)}
      </div>}
      <p style={{ color: 'var(--muted)', marginBottom: 20 }}>{seasonLabel} Earlier seasons are recorded as league goals.</p>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        <label style={filterLabelStyle}>Competition
          <select value={competition} onChange={(event) => setCompetition(event.target.value)} style={filterSelectStyle}>
            {COMPETITION_SCOPES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label style={filterLabelStyle}>Season
          <select value={season} onChange={(event) => setSeason(event.target.value)} style={filterSelectStyle}>
            {SEASON_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
      </div>

      {playerSearch && (
        <div style={{ marginBottom: 18, padding: '10px 12px', background: '#f5f8fa', border: '1px solid var(--line)', borderRadius: 6, fontSize: 14 }}>
          Showing scorer history for <strong>{playerSearch}</strong>. <Link to="/goalscorers" style={{ color: 'var(--brass)', fontWeight: 700 }}>Show all</Link>
        </div>
      )}


      {playerSearch && playerSeasonRows.length > 0 && (
        <section id="player-scoring-history" style={{ marginBottom: 28, scrollMarginTop: 24 }}>
          <h2 style={{ color: 'var(--brass)', fontSize: 18, paddingBottom: 8, borderBottom: '2px solid var(--line)' }}>
            Scoring history
          </h2>
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>
            {playerHistoryTotal} goal{playerHistoryTotal === 1 ? '' : 's'} across recorded ECFA seasons.
          </p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={thStyle('left')}>Season</th>
                <th style={thStyle('left')}>Team</th>
                <th style={thStyle('left')}>Competition</th>
                <th style={thStyle()}>Goals</th>
              </tr>
            </thead>
            <tbody>
              {playerSeasonRows.map((row) => (
                <tr key={`${row.season}-${row.team_name}-${row.competition}`} style={{ borderBottom: '1px solid var(--line)' }}>
                  <td style={{ padding: '10px 8px' }}>{row.season}</td>
                  <td style={{ padding: '10px 8px' }}>{row.team_name}</td>
                  <td style={{ padding: '10px 8px' }}>{row.competition}</td>
                  <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 800 }}>{row.goals}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ borderBottom: '3px solid var(--brass)' }}>
            <th style={thStyle('left')}>#</th>
            <th style={thStyle('left')}>Player</th>
            {season !== 'overall' && <th style={thStyle('left')}>Team</th>}
            <th style={thStyle()}>Goals</th>
          </tr>
        </thead>
        <tbody>
          {visibleRows.slice(0, 100).map((row, i) => (
            <tr key={row.player_name} style={{ borderBottom: '1px solid var(--line)' }}>
              <td style={{ padding: '10px 8px' }}>{i + 1}</td>
              <td style={{ padding: '10px 8px', fontWeight: 600 }}>
                <Link
                  to={`/goalscorers?player=${encodeURIComponent(row.player_name)}`}
                  style={{ color: 'var(--ink)', textDecoration: 'underline', textDecorationColor: 'var(--brass)', textUnderlineOffset: 3 }}
                  aria-label={`View ${row.player_name} season-by-season scoring history`}
                >
                  {row.player_name}
                </Link>
                {competition === 'all' && <span style={{ display: 'block', marginTop: 3, color: 'var(--muted)', fontSize: 11, fontWeight: 400 }}>
                  {['League', 'Cup', 'Competition not recorded'].filter((group) => row.byCompetition[group]).map((group) => `${group}: ${row.byCompetition[group]}`).join(' · ')}
                </span>}
              </td>
              {season !== 'overall' && (
                <td style={{ padding: '10px 8px', color: 'var(--muted)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Badge logoUrl={teamLogos[row.team_name]} name={row.team_name} />
                    <span>{row.team_name}</span>
                  </div>
                </td>
              )}
              <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 800, color: 'var(--ink)' }}>
                {row.goals}
              </td>
            </tr>
          ))}
          {visibleRows.length === 0 && (
            <tr>
              <td colSpan={season === 'overall' ? 3 : 4} style={{ padding: '24px 8px', textAlign: 'center', color: 'var(--muted)' }}>
                No scorers recorded for this selection.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function thStyle(align = 'center') {
  return {
    textAlign: align,
    padding: '8px',
    fontWeight: 700,
    color: 'var(--ink)',
    textTransform: 'uppercase',
    fontSize: 12,
    letterSpacing: 0.4,
  }
}

const sponsorLinkStyle = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, minWidth: 0, minHeight: 72, padding: '8px 6px', border: '1px solid var(--line)', borderRadius: 8, background: '#fff', color: 'var(--ink)', fontSize: 12, fontWeight: 700, lineHeight: 1.2, overflowWrap: 'anywhere', textDecoration: 'none' }
const filterLabelStyle = { display: 'grid', gap: 5, minWidth: 160, color: 'var(--muted)', fontSize: 12, fontWeight: 700 }
const filterSelectStyle = { padding: '9px 12px', fontSize: 14, borderRadius: 6, border: '1px solid var(--line)', background: '#fff', color: 'var(--ink)' }
