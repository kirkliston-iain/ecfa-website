import { PlayerHistoryLink, TeamHistoryLink, CompetitionHistoryLink, HistoryBack } from '../components/HistoryLinks'
import { historicTeamName } from '../utils/historicTeams'
import { supportsMatchScorers } from '../utils/historyLinks'
import { useRememberedState, useRememberedScroll } from '../hooks/usePageMemory'
import { useEffect, useMemo } from 'react'
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
  const [season, setSeason] = useRememberedState('season', searchParams.get('season') || 'overall')
  const [competition, setCompetition] = useRememberedState('competition', searchParams.get('competition') || 'all')
  const [sortKey, setSortKey] = useRememberedState('sortKey', 'overall')
  const [sortDirection, setSortDirection] = useRememberedState('sortDirection', 'desc')
  const [loading, setLoading] = useRememberedState('loading', true)
  const [historic, setHistoric] = useRememberedState('historic', [])
  const [current, setCurrent] = useRememberedState('current', [])
  const [playerDirectory, setPlayerDirectory] = useRememberedState('playerDirectory', [])
  const [sponsors, setSponsors] = useRememberedState('sponsors', [])
  useRememberedScroll(!loading)

  useEffect(() => {
  }, [playerSearch])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)

      const hist = await fetchAllHistoricScorers()

      const [{ data: scorers }, { data: directoryPlayers }, { data: sponsorRows }] = await Promise.all([
        supabase
          .from('fixture_scorers')
          .select('goals, player:player_id(id, first_name, last_name), team:team_id(id, name), fixture:fixture_id(id, fixture_date, hidden_from_public, home_team:home_team_id(id, name), away_team:away_team_id(id, name), stage:stage_id(competition:competition_id(name, slug, season)))'),
        supabase.from('players').select('id, first_name, last_name, team_id').order('last_name').order('first_name'),
        supabase.from('sponsors').select('id, name, website_url, logo_url').eq('is_published', true).in('name', SPONSOR_NAMES),
      ])

      if (!cancelled) {
        setHistoric((hist || []).map((row) => ({ ...row, competition: 'League' })))
        setCurrent(
          (scorers || []).map((s) => ({
            fixture: s.fixture,
            team_id: s.team?.id,
            player_id: s.player?.id || null,
            player_name: `${s.player?.first_name || ''} ${s.player?.last_name || ''}`.trim(),
            team_name: s.team?.name || '',
            goals: Number(s.goals),
            competition: competitionGroup(s.fixture?.stage?.competition?.name, s.fixture?.stage?.competition?.slug),
          }))
        )
        setSponsors((sponsorRows || []).sort((a, b) => SPONSOR_NAMES.indexOf(a.name) - SPONSOR_NAMES.indexOf(b.name)))
        setPlayerDirectory(directoryPlayers || [])
        setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  const [historicMatches, setHistoricMatches] = useRememberedState('historicMatches', [])
  const [matchError, setMatchError] = useRememberedState('matchError', '')
  useEffect(() => {
    let cancelled = false
    setHistoricMatches([])
    setMatchError('')
    if (!playerSearch) return
    async function loadMatches() {
      const all = []
      for (let from = 0; ; from += 1000) {
        const result = await supabase.from('historic_match_scorers')
          .select('id, historic_fixture_id, player_name, team_name, goals, fixture:historic_fixture_id(id, season, fixture_date, competition_name, home_team_name, away_team_name)')
          .ilike('player_name', canonicalPlayerName(playerSearch).replace(/[%_]/g, '\\$&'))
          .not('historic_fixture_id', 'is', null).order('id').range(from, from + 999)
        if (cancelled) return
        if (result.error) { setMatchError('Unable to load match-linked scoring history.'); return }
        all.push(...(result.data || []))
        if ((result.data || []).length < 1000) break
      }
      if (!cancelled) setHistoricMatches(all)
    }
    loadMatches()
    return () => { cancelled = true }
  }, [playerSearch])
  const recordedMatches = [
    ...current.filter((row) => playerKey(row.player_name) === playerKey(playerSearch) && row.fixture?.id && row.fixture.hidden_from_public === false)
      .map((row) => ({ id: row.fixture.id, season: CURRENT_SEASON, date: row.fixture.fixture_date, competition: row.competition,
        competitionName: row.fixture.stage?.competition?.name, goals: row.goals, team: row.team_name,
        opponent: row.fixture.home_team?.id === row.team_id ? row.fixture.away_team?.name : row.fixture.home_team?.name })),
    ...historicMatches.filter((row) => row.fixture && supportsMatchScorers(row.fixture.season))
      .map((row) => ({ id: row.fixture.id, season: row.fixture.season, date: row.fixture.fixture_date,
        competition: competitionGroup(row.fixture.competition_name), competitionName: row.fixture.competition_name,
        goals: row.goals, team: row.team_name,
        opponent: historicTeamName(row.team_name) === historicTeamName(row.fixture.home_team_name) ? row.fixture.away_team_name : row.fixture.home_team_name })),
  ].filter((row) => (competition === 'all' || row.competition === competition) && (season === 'overall' || row.season?.replace('-', '/') === season.replace('-', '/')) && (!searchParams.get('opponent') || historicTeamName(row.opponent) === historicTeamName(searchParams.get('opponent')))).sort((a, b) => String(b.date).localeCompare(String(a.date)))

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
    const totals = {}
    const displayNames = {}
    const teamOf = {}
    const byCompetition = {}
    for (const row of seasonRows) {
      const key = playerKey(row.player_name)
      if (!key) continue
      totals[key] = (totals[key] || 0) + Number(row.goals || 0)
      if (!byCompetition[key]) byCompetition[key] = {}
      byCompetition[key][row.competition] = (byCompetition[key][row.competition] || 0) + Number(row.goals || 0)
      displayNames[key] = key === 'darran taylor' ? 'Darran Taylor' : rosterNames[key] || displayNames[key] || canonicalPlayerName(row.player_name)
      if (row.team_name) {
        const rowSeason = row.season || CURRENT_SEASON
        if (!teamOf[key] || rowSeason > teamOf[key].season) teamOf[key] = { season: rowSeason, names: [row.team_name] }
        else if (rowSeason === teamOf[key].season && !teamOf[key].names.includes(row.team_name)) teamOf[key].names.push(row.team_name)
      }
    }

    return Object.entries(totals)
      .map(([key, goals]) => ({
        player_name: displayNames[key],
        player_id: rosterIds[key] || null,
        team_name: teamOf[key]?.names.join(' / ') || '',
        goals,
        byCompetition: byCompetition[key],
      }))
      .filter((row) => competition === 'all' || row.byCompetition[competition] > 0)
      .sort((a, b) => {
        const value = (row) => sortKey === 'league' ? row.byCompetition.League || 0
          : sortKey === 'cup' ? row.byCompetition.Cup || 0 : row.goals
        const order = sortKey === 'name' || sortKey === 'team'
          ? (sortKey === 'name' ? a.player_name : a.team_name).localeCompare(sortKey === 'name' ? b.player_name : b.team_name, 'en-GB', { sensitivity: 'base' })
          : value(a) - value(b)
        return (sortDirection === 'asc' ? order : -order)
          || b.goals - a.goals || a.player_name.localeCompare(b.player_name, 'en-GB')
      })
  }, [season, competition, sortKey, sortDirection, historic, current, playerDirectory])

  const sortBy = (key) => {
    setSortDirection(key === sortKey ? (sortDirection === 'desc' ? 'asc' : 'desc') : (key === 'name' || key === 'team' ? 'asc' : 'desc'))
    setSortKey(key)
  }

  const sortHeader = (key, label) => {
    const active = sortKey === key
    const nextDirection = active ? (sortDirection === 'desc' ? 'asc' : 'desc') : (key === 'name' || key === 'team' ? 'asc' : 'desc')
    return <th scope="col" aria-sort={active ? (sortDirection === 'desc' ? 'descending' : 'ascending') : 'none'} style={{ ...goalHeaderStyle, textAlign: key === 'name' || key === 'team' ? 'left' : 'center' }}>
      <button type="button" onClick={() => sortBy(key)} aria-label={`Sort by ${label}, ${key === 'name' || key === 'team' ? (nextDirection === 'asc' ? 'A to Z' : 'Z to A') : (nextDirection === 'desc' ? 'largest first' : 'smallest first')}`} style={{ ...sortButtonStyle, textAlign: key === 'name' || key === 'team' ? 'left' : 'center' }}>
        {label}{active && <span aria-hidden="true">{sortDirection === 'desc' ? ' ↓' : ' ↑'}</span>}
      </button>
    </th>
  }

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
      {playerSearch && <HistoryBack fallback="/goalscorers" />}
      <h1 style={{ fontSize: 30, marginBottom: 4 }}>Goalscorers</h1>
      {sponsors.length > 0 && <div aria-label="Goalscorers sponsors" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, maxWidth: 500, margin: '12px 0 18px' }}>
        {sponsors.map((sponsor) => <a key={sponsor.id} href={sponsor.website_url} target="_blank" rel="noopener noreferrer" onClick={() => trackInteraction('sponsor_click', `${sponsor.name} — Goalscorers`)} style={sponsorLinkStyle}>
          {sponsor.logo_url && <img src={sponsor.logo_url} alt="" style={{ width: 46, height: 46, objectFit: 'contain', flexShrink: 0 }} />}
          <span>{sponsor.name}</span>
        </a>)}
      </div>}
      <p style={{ color: 'var(--muted)', marginBottom: 20 }}>{seasonLabel} Earlier seasons are recorded as league goals.{season === 'overall' ? ' Team shows the most recent recorded club.' : ''}</p>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        <label style={filterLabelStyle}>Competition
          <select value={competition} onChange={(event) => {
            const selected = event.target.value
            setCompetition(selected)
            setSortKey(selected === 'all' ? 'overall' : selected.toLowerCase())
            setSortDirection('desc')
          }} style={filterSelectStyle}>
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
          <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: 11 }}>
            <colgroup><col style={{ width: '20%' }} /><col style={{ width: '38%' }} /><col style={{ width: '27%' }} /><col style={{ width: '15%' }} /></colgroup>
            <thead>
              <tr>
                <th style={goalHeaderStyle}>Season</th>
                <th style={goalHeaderStyle}>Team</th>
                <th style={goalHeaderStyle}>Competition</th>
                <th style={{ ...goalHeaderStyle, textAlign: 'center' }}>Goals</th>
              </tr>
            </thead>
            <tbody>
              {playerSeasonRows.map((row) => (
                <tr key={`${row.season}-${row.team_name}-${row.competition}`} style={{ borderBottom: '1px solid var(--line)' }}>
                  <td style={goalCellStyle}><Link to={`/archive?season=${encodeURIComponent(row.season)}`}>{row.season}</Link></td>
                  <td style={goalCellStyle}><TeamHistoryLink name={row.team_name} /></td>
                  <td style={goalCellStyle}><CompetitionHistoryLink name={row.competition} season={row.season} /></td>
                  <td style={{ ...goalCellStyle, textAlign: 'center', fontWeight: 800 }}><Link to={`/goalscorers?player=${encodeURIComponent(playerSearch)}&season=${encodeURIComponent(row.season)}&competition=${row.competition === 'League' || row.competition === 'Cup' ? row.competition : 'all'}`}>{row.goals}</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {playerSearch && <section style={{ marginBottom: 28 }}>
        <h2 style={{ color: 'var(--brass)', fontSize: 18 }}>Games scored in</h2>
        {playerDirectory.filter((player) => playerKey(`${player.first_name} ${player.last_name}`) === playerKey(playerSearch)).map((player) => <p key={player.id}><PlayerHistoryLink id={player.id} name={`${player.first_name} ${player.last_name}`}>Player profile and scoring details</PlayerHistoryLink></p>)}
        {matchError && <p role="alert">{matchError}</p>}
        <p style={{ color: 'var(--muted)', fontSize: 12 }}>Match-linked records from 2025/26 onwards.</p>
        {recordedMatches.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 13 }}>No linked scoring matches recorded for this selection.</p>}
        {recordedMatches.map((match, index) => <article key={`${match.id}-${index}`} style={{ padding: '10px 0', borderBottom: '1px solid var(--line)', fontSize: 13 }}>
          <Link to={`/fixtures/${match.id}`} style={{ color: 'var(--ink)', fontWeight: 700 }}>{match.goals} {match.goals === 1 ? 'goal' : 'goals'} against {match.opponent}</Link>
          <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 5 }}>{match.season} · {new Date(match.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} · <TeamHistoryLink name={match.team} /> · <CompetitionHistoryLink name={match.competitionName} season={match.season} /></div>
        </article>)}
      </section>}

      <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: 12 }}>
        <colgroup><col style={{ width: '30%' }} /><col style={{ width: '27%' }} /><col style={{ width: '14%' }} /><col style={{ width: '12%' }} /><col style={{ width: '17%' }} /></colgroup>
        <thead>
          <tr style={{ borderBottom: '3px solid var(--brass)' }}>
            {sortHeader('name', 'Name')}
            {sortHeader('team', 'Team')}
            {sortHeader('league', 'League')}
            {sortHeader('cup', 'Cup')}
            {sortHeader('overall', 'Overall')}
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((row) => (
            <tr key={row.player_name} style={{ borderBottom: '1px solid var(--line)' }}>
              <td style={{ ...goalCellStyle, fontWeight: 700 }}>
                <Link
                  to={`/goalscorers?player=${encodeURIComponent(row.player_name)}`}
                  style={{ color: 'var(--ink)', textDecoration: 'underline', textDecorationColor: 'var(--brass)', textUnderlineOffset: 3, overflowWrap: 'anywhere' }}
                  aria-label={`View ${row.player_name} season-by-season scoring history`}
                >
                  {row.player_name}
                </Link>
              </td>
              <td style={{ ...goalCellStyle, color: 'var(--muted)' }} title={season === 'overall' ? 'Most recently recorded team' : undefined}>{row.team_name ? row.team_name.split(' / ').map((name, i) => <span key={name}>{i > 0 && ' / '}<TeamHistoryLink name={name} /></span>) : '—'}</td>
              <td style={{ ...goalCellStyle, textAlign: 'center' }}>{row.byCompetition.League ? <Link to={`/goalscorers?player=${encodeURIComponent(row.player_name)}&season=${encodeURIComponent(season)}&competition=League`}>{row.byCompetition.League}</Link> : '—'}</td>
              <td style={{ ...goalCellStyle, textAlign: 'center' }}>{row.byCompetition.Cup ? <Link to={`/goalscorers?player=${encodeURIComponent(row.player_name)}&season=${encodeURIComponent(season)}&competition=Cup`}>{row.byCompetition.Cup}</Link> : '—'}</td>
              <td style={{ ...goalCellStyle, textAlign: 'center', fontWeight: 800, color: 'var(--ink)' }}>
                <Link to={`/goalscorers?player=${encodeURIComponent(row.player_name)}&season=${encodeURIComponent(season)}`} style={{ color: 'inherit' }}>{row.goals}</Link>
              </td>
            </tr>
          ))}
          {visibleRows.length === 0 && (
            <tr>
              <td colSpan={5} style={{ padding: '24px 8px', textAlign: 'center', color: 'var(--muted)' }}>
                No scorers recorded for this selection.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

const sponsorLinkStyle = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, minWidth: 0, minHeight: 72, padding: '8px 6px', border: '1px solid var(--line)', borderRadius: 8, background: '#fff', color: 'var(--ink)', fontSize: 12, fontWeight: 700, lineHeight: 1.2, overflowWrap: 'anywhere', textDecoration: 'none' }
const filterLabelStyle = { display: 'grid', gap: 5, minWidth: 140, flex: '1 1 140px', color: 'var(--muted)', fontSize: 12, fontWeight: 700 }
const filterSelectStyle = { width: '100%', minWidth: 0, boxSizing: 'border-box', padding: '9px 10px', fontSize: 14, borderRadius: 6, border: '1px solid var(--line)', background: '#fff', color: 'var(--ink)' }
const goalHeaderStyle = { textAlign: 'left', padding: '8px 2px', fontWeight: 800, color: 'var(--ink)', textTransform: 'uppercase', fontSize: 10, letterSpacing: 0.1, overflowWrap: 'anywhere' }
const sortButtonStyle = { display: 'block', width: '100%', border: 0, padding: 0, background: 'none', color: 'inherit', font: 'inherit', fontWeight: 'inherit', textTransform: 'inherit', letterSpacing: 'inherit', cursor: 'pointer', overflowWrap: 'anywhere' }
const goalCellStyle = { padding: '11px 2px', verticalAlign: 'middle', lineHeight: 1.35, overflowWrap: 'anywhere' }
