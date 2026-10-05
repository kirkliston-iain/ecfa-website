import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { displayedScore, outcomeNote } from '../utils/fixtureOutcome'
import { historicDisplayedScore } from '../utils/historicFixtureOutcome'
import { historicTeamName, previousTeamUrl } from '../utils/historicTeams'
import { trackInteraction } from '../utils/webAnalytics'
import { websiteForTeam } from '../utils/teamWebsites'

function Badge({ logoUrl, name, size = 24 }) {
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt=""
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', background: '#fff', flexShrink: 0 }}
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

const CURRENT_SEASON = '2026/27'

function canonicalTeamName(name, teamId, currentTeams) {
  const currentTeam = teamId ? currentTeams.find((entry) => entry.id === teamId) : null
  if (currentTeam) return currentTeam.name
  return historicTeamName(name)
}

function canvasLines(ctx, value, width, limit = 2) {
  const lines = ['']
  for (const word of String(value || '').split(/\s+/)) {
    const index = lines.length - 1
    const next = `${lines[index]} ${word}`.trim()
    if (lines[index] && ctx.measureText(next).width > width) lines.push(word)
    else lines[index] = next
  }
  if (lines.length > limit) {
    const kept = lines.slice(0, limit)
    kept[limit - 1] += '…'
    while (ctx.measureText(kept[limit - 1]).width > width && kept[limit - 1].length > 1) {
      kept[limit - 1] = `${kept[limit - 1].slice(0, -2)}…`
    }
    return kept
  }
  return lines
}

export default function TeamsHub() {
  const [teams, setTeams] = useState([])
  const [previousTeams, setPreviousTeams] = useState([])
  const [teamId, setTeamId] = useState('')
  const [team, setTeam] = useState(null)
  const [loading, setLoading] = useState(false)
  const [fixtureMonth, setFixtureMonth] = useState('')
  const [fixtureDate, setFixtureDate] = useState('')
  const [fixtureCompetition, setFixtureCompetition] = useState('appin-league')
  const [sharingFixtures, setSharingFixtures] = useState(false)

  const [currentFixtures, setCurrentFixtures] = useState([])
  const [placeholderFixtures, setPlaceholderFixtures] = useState([])
  const [calendarEvents, setCalendarEvents] = useState([])
  const [historicFixtures, setHistoricFixtures] = useState([])
  const [currentScorers, setCurrentScorers] = useState([])
  const [historicScorers, setHistoricScorers] = useState([])
  const [honours, setHonours] = useState([])
  const [squad, setSquad] = useState([])

  const [resultsSeason, setResultsSeason] = useState(CURRENT_SEASON)
  const [scorersSeason, setScorersSeason] = useState(CURRENT_SEASON)
  const [headToHeadSeason, setHeadToHeadSeason] = useState(CURRENT_SEASON)
  const [headToHeadSort, setHeadToHeadSort] = useState({ key: 'played', direction: 'desc' })

  useEffect(() => {
    supabase.from('calendar_events').select('event_date, title, description').order('event_date')
      .then(({ data }) => setCalendarEvents(data || []))
  }, [])

  async function loadAllHistoricFixtures() {
    const pageSize = 1000
    const allFixtures = []
    for (let from = 0; ; from += pageSize) {
      const result = await supabase
        .from('historic_fixtures')
        .select('id, season, competition_name, fixture_date, home_team_id, home_team_name, home_goals, away_team_id, away_team_name, away_goals, comment, penalty_winner_name')
        .order('fixture_date', { ascending: false })
        .range(from, from + pageSize - 1)
      if (result.error) return result
      allFixtures.push(...(result.data || []))
      if ((result.data || []).length < pageSize) break
    }
    return { data: allFixtures, error: null }
  }

  useEffect(() => {
    supabase
      .from('teams')
      .select('id, name, logo_url, manager_name, team_website_url, team_website_label')
      .order('name')
      .then(({ data }) => setTeams(data || []))
  }, [])

  useEffect(() => {
    if (teams.length === 0) return
    let cancelled = false
    async function loadPreviousTeams() {
      const [{ data: fixtures }, { data: scorers }, { data: honoursRows }] = await Promise.all([
        loadAllHistoricFixtures(),
        supabase.from('historic_scorers').select('team_name'),
        supabase.from('honours').select('winner_name'),
      ])
      if (cancelled) return
      const currentNames = new Set(teams.map((entry) => entry.name))
      const names = new Set()
      for (const fixture of fixtures || []) {
        names.add(historicTeamName(fixture.home_team_name))
        names.add(historicTeamName(fixture.away_team_name))
      }
      for (const scorer of scorers || []) names.add(historicTeamName(scorer.team_name))
      for (const honour of honoursRows || []) names.add(historicTeamName(honour.winner_name))
      setPreviousTeams([...names].filter((name) => name && !currentNames.has(name)).sort((a, b) => a.localeCompare(b, 'en-GB')))
    }
    loadPreviousTeams()
    return () => { cancelled = true }
  }, [teams])

  useEffect(() => {
    if (!teamId) {
      setTeam(null)
      return
    }
    setLoading(true)
    setResultsSeason(CURRENT_SEASON)
    setScorersSeason(CURRENT_SEASON)
    setHeadToHeadSeason(CURRENT_SEASON)
    setFixtureMonth('')
    setFixtureDate('')
    setFixtureCompetition('appin-league')

    async function load() {
      setTeam(teams.find((t) => t.id === teamId) || null)

      const { data: cf } = await supabase
        .from('fixtures')
        .select(
          'id, fixture_date, venue, home_score, away_score, went_to_extra_time, home_extra_time_score, away_extra_time_score, decided_by_penalties, home_penalty_score, away_penalty_score, status, home_team:home_team_id(id, name, logo_url), away_team:away_team_id(id, name, logo_url), stage:stage_id(name, competition:competition_id(name, slug))'
        )
        .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
        .eq('hidden_from_public', false)
        .order('fixture_date')
      setCurrentFixtures(cf || [])
      const competitionNames = new Set((cf || []).filter((fixture) => fixture.status === 'scheduled').map((fixture) => fixture.stage?.competition?.name).filter(Boolean))
      const { data: placeholders } = await supabase
        .from('fixtures')
        .select('id, fixture_date, round_name, stage:stage_id(name, competition:competition_id(name, slug))')
        .eq('status', 'scheduled')
        .eq('hidden_from_public', false)
        .gte('fixture_date', new Date().toISOString())
        .or('home_team_id.is.null,away_team_id.is.null')
        .order('fixture_date')
      setPlaceholderFixtures((placeholders || []).filter((fixture) => competitionNames.has(fixture.stage?.competition?.name)))

      const { data: hf } = await loadAllHistoricFixtures()
      const selectedTeamName = teams.find((entry) => entry.id === teamId)?.name
      setHistoricFixtures((hf || []).filter((fixture) => {
        const homeName = canonicalTeamName(fixture.home_team_name, fixture.home_team_id, teams)
        const awayName = canonicalTeamName(fixture.away_team_name, fixture.away_team_id, teams)
        return fixture.home_team_id === teamId || fixture.away_team_id === teamId || homeName === selectedTeamName || awayName === selectedTeamName
      }))

      const { data: cs } = await supabase
        .from('fixture_scorers')
        .select('goals, player:player_id(id, first_name, last_name)')
        .eq('team_id', teamId)
      setCurrentScorers(cs || [])

      const { data: hs } = await supabase
        .from('historic_scorers')
        .select('player_name, goals, season')
        .eq('team_id', teamId)
      setHistoricScorers(hs || [])

      const { data: ho } = await supabase
        .from('honours')
        .select('season, competition, status, winner_name')
        .eq('team_id', teamId)
        .order('season', { ascending: false })
      setHonours(ho || [])

      const { data: sq } = await supabase
        .from('players')
        .select('id, first_name, last_name')
        .eq('team_id', teamId)
        .order('first_name')
        .order('last_name')
      setSquad(sq || [])

      setLoading(false)
    }
    load()
  }, [teamId, teams])

  const played = currentFixtures.filter((f) => f.status === 'played').sort((a, b) => new Date(b.fixture_date) - new Date(a.fixture_date))
  const teamWebsites = teams.map(websiteForTeam).filter(Boolean)
  const upcoming = currentFixtures
    .filter((f) => f.status === 'scheduled')
    .sort((a, b) => new Date(a.fixture_date) - new Date(b.fixture_date))[0]
  const scheduledFixtures = currentFixtures.filter((f) => f.status === 'scheduled')
  const fixtureDay = (fixture) => fixture.fixture_date?.slice(0, 10) || ''
  const possibleDates = [...new Map(placeholderFixtures.map((fixture) => [
    `${fixtureDay(fixture)}|${fixture.stage?.competition?.name}|${fixture.round_name || fixture.stage?.name}`,
    fixture,
  ])).values()]
  const upcomingEvents = calendarEvents.filter((event) => event.event_date >= new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/London' }))
  const fixtureCompetitions = [...new Map([...scheduledFixtures, ...possibleDates]
    .map((fixture) => fixture.stage?.competition)
    .filter((competition) => competition?.slug)
    .map((competition) => [competition.slug, competition])).values()]
    .sort((a, b) => a.slug === 'appin-league' ? -1 : b.slug === 'appin-league' ? 1 : a.name.localeCompare(b.name))
  const matchesCompetition = (fixture) => fixtureCompetition === 'all' || fixture.stage?.competition?.slug === fixtureCompetition
  const selectedFixtures = scheduledFixtures.filter(matchesCompetition)
  const selectedPossibleDates = possibleDates.filter(matchesCompetition)
  const selectedEvents = fixtureCompetition === 'all' || fixtureCompetition === 'appin-league' ? upcomingEvents : []
  const fixtureMonths = [...new Set([...selectedFixtures, ...selectedPossibleDates].map((f) => fixtureDay(f).slice(0, 7)).concat(selectedEvents.map((event) => event.event_date.slice(0, 7))).filter(Boolean))].sort()
  const filterDate = (fixture) => (!fixtureMonth || fixtureDay(fixture).startsWith(fixtureMonth)) && (!fixtureDate || fixtureDay(fixture) === fixtureDate)
  const visibleFixtures = selectedFixtures.filter((f) =>
    filterDate(f)
  )
  const visiblePossibleDates = selectedPossibleDates.filter(filterDate)
  const visibleEvents = selectedEvents.filter((event) => (!fixtureMonth || event.event_date.startsWith(fixtureMonth)) && (!fixtureDate || event.event_date === fixtureDate))
  const visibleSchedule = [
    ...visibleFixtures.map((fixture) => ({ kind: 'fixture', date: fixtureDay(fixture), fixture })),
    ...visiblePossibleDates.map((fixture) => ({ kind: 'possible', date: fixtureDay(fixture), fixture })),
    ...visibleEvents.map((event) => ({ kind: 'event', date: event.event_date, event })),
  ].sort((a, b) => a.date.localeCompare(b.date) || ({ event: 0, fixture: 1, possible: 2 }[a.kind] - { event: 0, fixture: 1, possible: 2 }[b.kind]))

  async function shareFixtureImage() {
    if (!visibleSchedule.length || sharingFixtures) return
    setSharingFixtures(true)
    try {
      const canvas = document.createElement('canvas')
      const columns = visibleSchedule.length > 12 ? 2 : 1
      const rowsPerColumn = Math.ceil(visibleSchedule.length / columns)
      const rowHeight = 132
      const columnWidth = columns === 2 ? 736 : 984
      canvas.width = columns === 2 ? 1600 : 1080
      canvas.height = 230 + rowsPerColumn * rowHeight + 64
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Canvas unavailable')
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = '#b8912b'
      ctx.fillRect(0, 0, canvas.width, 12)
      ctx.fillStyle = '#141414'
      ctx.font = 'bold 42px Arial, sans-serif'
      ctx.fillText(team.name, 48, 72)
      ctx.font = '25px Arial, sans-serif'
      ctx.fillStyle = '#6b6b6b'
      const period = fixtureDate ? new Date(`${fixtureDate}T12:00:00`).toLocaleDateString('en-GB', { dateStyle: 'long' }) : fixtureMonth ? new Date(`${fixtureMonth}-01T12:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) : 'All upcoming fixtures'
      const label = `${fixtureCompetition === 'all' ? 'All competitions' : fixtureCompetitions.find((competition) => competition.slug === fixtureCompetition)?.name || 'Appin Sports League'} · ${period}`
      ctx.fillText(label, 48, 117)
      ctx.fillStyle = '#6b6b6b'
      ctx.font = '20px Arial, sans-serif'
      ctx.fillText(fixtureCompetition === 'all' ? 'Fixtures · possible cup dates · league calendar' : fixtureCompetition === 'appin-league' ? 'League fixtures · league calendar' : 'Fixtures · possible cup dates', 48, 154)
      visibleSchedule.forEach((item, index) => {
        const column = Math.floor(index / rowsPerColumn)
        const x = 48 + column * (columnWidth + 32)
        const y = 205 + (index % rowsPerColumn) * rowHeight
        if (item.kind === 'event') {
          ctx.fillStyle = '#f7f4eb'
          ctx.fillRect(x, y, columnWidth, rowHeight - 4)
        } else if (item.kind === 'possible') {
          ctx.fillStyle = '#f7f8f9'
          ctx.fillRect(x, y, columnWidth, rowHeight - 4)
        }
        ctx.strokeStyle = '#e2e2e2'
        ctx.beginPath()
        ctx.moveTo(x, y)
        ctx.lineTo(x + columnWidth, y)
        ctx.stroke()
        const date = item.date
        ctx.fillStyle = '#b8912b'
        ctx.font = 'bold 21px Arial, sans-serif'
        ctx.fillText(date ? new Date(`${date}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : 'TBC', x + 12, y + 36)
        ctx.fillStyle = '#141414'
        ctx.font = 'bold 24px Arial, sans-serif'
        const fixture = item.fixture
        const home = fixture?.home_team?.id === teamId
        const title = item.kind === 'event' ? item.event.title
          : item.kind === 'possible' ? `${fixture.stage?.competition?.name || 'Cup'} · ${fixture.round_name || fixture.stage?.name || 'Round'}`
            : `${home ? 'vs' : 'at'} ${home ? fixture.away_team?.name : fixture.home_team?.name}`
        const textX = x + 155
        const textWidth = columnWidth - 170
        canvasLines(ctx, title, textWidth).forEach((line, lineIndex) => ctx.fillText(line, textX, y + 35 + lineIndex * 28))
        ctx.fillStyle = '#6b6b6b'
        ctx.font = '18px Arial, sans-serif'
        const detail = item.kind === 'event' ? item.event.description || 'League calendar'
          : item.kind === 'possible' ? 'Possible date — qualification and opponent to be confirmed'
            : [fixture.stage?.competition?.name, fixture.round_name || fixture.stage?.name, fixture.fixture_date?.slice(11, 16) !== '00:00' ? fixture.fixture_date?.slice(11, 16) : '', fixture.venue && fixture.venue !== 'N/A' ? fixture.venue : ''].filter(Boolean).join(' · ')
        canvasLines(ctx, detail, textWidth).forEach((line, lineIndex) => ctx.fillText(line, textX, y + 91 + lineIndex * 21))
      })
      ctx.fillStyle = '#6b6b6b'
      ctx.font = '20px Arial, sans-serif'
      ctx.fillText('Edinburgh Churches Football Association · ecfa-website.vercel.app', 48, canvas.height - 31)
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
      if (!blob) throw new Error('Image unavailable')
      const file = new File([blob], `${team.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-fixtures.png`, { type: 'image/png' })
      if (navigator.share && navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: `${team.name} fixtures` })
      else {
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = file.name
        link.click()
        setTimeout(() => URL.revokeObjectURL(url), 60000)
      }
    } catch (error) {
      if (error.name !== 'AbortError') window.alert('Could not create the fixture image. Please try again.')
    } finally {
      setSharingFixtures(false)
    }
  }
  const lastResult = played[0]
  const form = played.slice(0, 5)

  function resultFor(f) {
    const isHome = f.home_team?.id === teamId
    const us = isHome ? f.home_score : f.away_score
    const them = isHome ? f.away_score : f.home_score
    if (us == null || them == null) return null
    if (us > them) return 'W'
    if (us < them) return 'L'
    return 'D'
  }

  // Season-by-season results: current season (from live fixtures) + historic seasons
  const historicSeasons = Array.from(new Set(historicFixtures.map((f) => f.season))).sort().reverse()
  const resultSeasonOptions = [CURRENT_SEASON, ...historicSeasons]
  const headToHeadSeasonOptions = ['Overall', ...new Set([CURRENT_SEASON, ...historicSeasons])]

  const currentPlayedForResults = played
  const historicForSeason = historicFixtures.filter((f) => f.season === resultsSeason)

  // Season-by-season scorers
  const historicScorerSeasons = Array.from(new Set(historicScorers.map((s) => s.season))).sort().reverse()
  const scorerSeasonOptions = ['Overall', CURRENT_SEASON, ...historicScorerSeasons]

  const currentScorersAgg = {}
  for (const s of currentScorers) {
    const name = s.player ? `${s.player.first_name} ${s.player.last_name}` : 'Unknown'
    currentScorersAgg[name] = (currentScorersAgg[name] || 0) + Number(s.goals || 0)
  }
  const currentScorersList = Object.entries(currentScorersAgg).sort((a, b) => b[1] - a[1])

  const historicScorersAgg = {}
  for (const s of historicScorers.filter((s) => s.season === scorersSeason)) {
    historicScorersAgg[s.player_name] = (historicScorersAgg[s.player_name] || 0) + Number(s.goals || 0)
  }
  const historicScorersList = Object.entries(historicScorersAgg).sort((a, b) => b[1] - a[1])

  const overallScorersAgg = { ...currentScorersAgg }
  for (const s of historicScorers) {
    overallScorersAgg[s.player_name] = (overallScorersAgg[s.player_name] || 0) + Number(s.goals || 0)
  }
  const overallScorersList = Object.entries(overallScorersAgg).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))

  const headToHeadMap = {}
  function addHeadToHead(opponentName, goalsFor, goalsAgainst, outcome) {
    if (!opponentName || goalsFor == null || goalsAgainst == null) return
    if (!headToHeadMap[opponentName]) {
      headToHeadMap[opponentName] = { opponent: opponentName, played: 0, wins: 0, losses: 0, draws: 0, goalsFor: 0, goalsAgainst: 0 }
    }
    const row = headToHeadMap[opponentName]
    row.played += 1
    row.goalsFor += Number(goalsFor)
    row.goalsAgainst += Number(goalsAgainst)
    if (outcome === 'W') row.wins += 1
    else if (outcome === 'L') row.losses += 1
    else row.draws += 1
  }

  for (const f of played) {
    if (headToHeadSeason !== 'Overall' && headToHeadSeason !== CURRENT_SEASON) continue
    const isHome = f.home_team?.id === teamId
    const opponentName = isHome ? f.away_team?.name : f.home_team?.name
    const homeGoals = f.went_to_extra_time && f.home_extra_time_score != null ? f.home_extra_time_score : f.home_score
    const awayGoals = f.went_to_extra_time && f.away_extra_time_score != null ? f.away_extra_time_score : f.away_score
    const goalsFor = isHome ? homeGoals : awayGoals
    const goalsAgainst = isHome ? awayGoals : homeGoals
    let outcome = goalsFor > goalsAgainst ? 'W' : goalsFor < goalsAgainst ? 'L' : 'D'
    if (f.decided_by_penalties && f.home_penalty_score != null && f.away_penalty_score != null) {
      const homeWon = f.home_penalty_score > f.away_penalty_score
      outcome = (isHome === homeWon) ? 'W' : 'L'
    }
    addHeadToHead(opponentName, goalsFor, goalsAgainst, outcome)
  }

  for (const f of historicFixtures) {
    if (headToHeadSeason !== 'Overall' && f.season !== headToHeadSeason) continue
    const selectedTeamName = canonicalTeamName(team?.name, teamId, teams)
    const homeName = canonicalTeamName(f.home_team_name, f.home_team_id, teams)
    const awayName = canonicalTeamName(f.away_team_name, f.away_team_id, teams)
    const isHome = f.home_team_id === teamId || homeName === selectedTeamName
    const opponentName = isHome ? awayName : homeName
    if (opponentName === selectedTeamName) continue
    const goalsFor = isHome ? f.home_goals : f.away_goals
    const goalsAgainst = isHome ? f.away_goals : f.home_goals
    const outcome = goalsFor > goalsAgainst ? 'W' : goalsFor < goalsAgainst ? 'L' : 'D'
    addHeadToHead(opponentName, goalsFor, goalsAgainst, outcome)
  }
  const headToHead = Object.values(headToHeadMap).sort((a, b) => {
    const valueFor = (row) => {
      if (headToHeadSort.key === 'opponent') return row.opponent
      if (headToHeadSort.key === 'winPercentage') return row.played ? row.wins / row.played : 0
      return row[headToHeadSort.key]
    }
    const aValue = valueFor(a)
    const bValue = valueFor(b)
    const comparison = typeof aValue === 'string' ? aValue.localeCompare(bValue) : aValue - bValue
    return (headToHeadSort.direction === 'asc' ? comparison : -comparison) || a.opponent.localeCompare(b.opponent)
  })

  function changeHeadToHeadSort(key) {
    setHeadToHeadSort((current) => current.key === key
      ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
      : { key, direction: key === 'opponent' ? 'asc' : 'desc' })
  }

  function sortableHead(label, key, align = 'center') {
    const active = headToHeadSort.key === key
    const direction = active ? headToHeadSort.direction : null
    return (
      <th
        scope="col"
        style={{ ...headToHeadHeaderStyle, textAlign: align }}
        aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
      >
        <button
          type="button"
          onClick={() => changeHeadToHeadSort(key)}
          style={{ ...headToHeadSortButtonStyle, justifyContent: align === 'left' ? 'flex-start' : 'center' }}
          aria-label={`Sort by ${label}${active ? `, currently ${direction === 'asc' ? 'ascending' : 'descending'}` : ''}`}
        >
          <span>{label}</span>
          <span aria-hidden="true" style={{ minWidth: 8, color: active ? 'var(--brass)' : 'var(--muted)' }}>
            {active ? (direction === 'asc' ? '▲' : '▼') : '↕'}
          </span>
        </button>
      </th>
    )
  }

  const displayedScorers = scorersSeason === 'Overall'
    ? overallScorersList
    : scorersSeason === CURRENT_SEASON
      ? currentScorersList
      : historicScorersList

  return (
    <div className="container" style={{ padding: '32px 20px 48px' }}>
      <h1 style={{ fontSize: 30, marginBottom: 4 }}>Teams</h1>
      <p style={{ color: 'var(--muted)', marginBottom: 24 }}>
        Everything about one club in one place — badge, honours, results, scorers, squad.
      </p>

      <select
        value={teamId}
        onChange={(e) => {
          const selected = teams.find((entry) => entry.id === e.target.value)
          setTeamId(e.target.value)
          if (selected) trackInteraction('team_selection', selected.name)
        }}
        style={{ ...selectStyle, marginBottom: 24 }}
      >
        <option value="">Select a team…</option>
        {teams.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>

      <section style={{ marginBottom: 28 }} aria-labelledby="team-websites-heading">
        <h2 id="team-websites-heading" style={{ ...sectionHeaderStyle, marginTop: 0 }}>Team websites</h2>
        <div style={{ display: 'grid', gap: 8 }}>
          {teamWebsites.map((website) => (
            <a key={website.url} href={website.url} target="_blank" rel="noopener noreferrer"
              onClick={() => trackInteraction('team_website_click', `${website.name} — Teams`)}
              style={{ ...cardStyle, color: 'var(--ink)', textDecoration: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <strong>{website.name}</strong>
              <span style={{ color: 'var(--brass)', fontWeight: 700, whiteSpace: 'nowrap' }}>Visit website ↗</span>
            </a>
          ))}
        </div>
      </section>

      {previousTeams.length > 0 && (
        <section style={{ marginBottom: 28 }}>
          <h2 style={{ ...sectionHeaderStyle, marginTop: 0 }}>Previous teams</h2>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: -4, marginBottom: 12 }}>
            Former ECFA teams with records held in the archive.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 8 }}>
            {previousTeams.map((name) => (
              <Link key={name} to={previousTeamUrl(name)} style={{ ...cardStyle, color: 'var(--ink)', textDecoration: 'none', fontWeight: 700 }}>
                {name} <span aria-hidden="true" style={{ color: 'var(--brass)', float: 'right' }}>→</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {loading && <p style={{ color: 'var(--muted)' }}>Loading…</p>}

      {!loading && team && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
            <Badge logoUrl={team.logo_url} name={team.name} size={56} />
            <div>
              <h2 style={{ fontSize: 22, margin: 0 }}>{team.name}</h2>
              {websiteForTeam(team) && <a href={websiteForTeam(team).url} target="_blank" rel="noopener noreferrer" onClick={() => trackInteraction('team_website_click', `${websiteForTeam(team).name} — Teams profile`)} style={{ color: 'var(--brass)', fontWeight: 700, fontSize: 14 }}>Visit team website ↗</a>}
              {team.manager_name && (
                <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
                  Manager: <strong style={{ color: 'var(--ink)' }}>{team.manager_name}</strong>
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginBottom: 28, flexWrap: 'wrap' }}>
            {upcoming && (
              <div style={{ ...cardStyle, flex: '1 1 200px' }}>
                <div style={sectionLabelStyle}>Upcoming</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>
                  {upcoming.home_team?.id === teamId ? upcoming.away_team?.name : upcoming.home_team?.name}
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                  {new Date(upcoming.fixture_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  {upcoming.venue ? ` · ${upcoming.venue}` : ''}
                </div>
              </div>
            )}
            {lastResult && (
              <div style={{ ...cardStyle, flex: '1 1 200px' }}>
                <div style={sectionLabelStyle}>Last result</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>
                  {lastResult.home_team?.name} {displayedScore(lastResult)} {lastResult.away_team?.name}
                  {outcomeNote(lastResult) && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{outcomeNote(lastResult)}</div>}
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                  {new Date(lastResult.fixture_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </div>
              </div>
            )}
            {form.length > 0 && (
              <div style={{ ...cardStyle, flex: '1 1 200px' }}>
                <div style={sectionLabelStyle}>Form (last {form.length})</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {form.map((f, i) => {
                    const r = resultFor(f)
                    const color = r === 'W' ? '#1a7a3c' : r === 'L' ? '#B3261E' : '#8a7a00'
                    return (
                      <span
                        key={i}
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: '50%',
                          background: color,
                          color: '#fff',
                          fontSize: 11,
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {r}
                      </span>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          <section style={{ marginBottom: 32 }}>
            <h2 style={sectionHeaderStyle}>Next five fixtures</h2>
            {scheduledFixtures.length === 0 ? <p style={{ color: 'var(--muted)', fontSize: 14 }}>No upcoming fixtures scheduled.</p> : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {scheduledFixtures.slice(0, 5).map((fixture) => <li key={fixture.id} className="team-fixture-row">
                  <Link to={`/fixtures/${fixture.id}`}>
                    <span className="team-fixture-date">{fixtureDay(fixture) ? new Date(`${fixtureDay(fixture)}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : 'TBC'}</span>
                    <span className="team-fixture-opponent">{fixture.home_team?.id === teamId ? 'vs' : 'at'} {fixture.home_team?.id === teamId ? fixture.away_team?.name : fixture.home_team?.name}</span>
                    <span className="team-fixture-location">{[fixture.stage?.competition?.name, fixture.round_name || fixture.stage?.name, fixture.venue].filter(Boolean).join(' · ')}</span>
                  </Link>
                </li>)}
              </ul>
            )}
          </section>

          <section id="all-fixtures" style={{ marginBottom: 36 }}>
            <h2 style={sectionHeaderStyle}>All upcoming fixtures</h2>
            <p style={{ color: 'var(--muted)', fontSize: 12, margin: '0 0 12px' }}>Choose a competition, month or date. Cup dates are conditional until qualification is confirmed; league dates include Match Hub events.</p>
            <div className="team-fixture-filters">
              <label>Competition<select value={fixtureCompetition} onChange={(event) => { setFixtureCompetition(event.target.value); setFixtureMonth(''); setFixtureDate('') }}>
                <option value="appin-league">Appin Sports League</option>
                {fixtureCompetitions.filter((competition) => competition.slug !== 'appin-league').map((competition) => <option key={competition.slug} value={competition.slug}>{competition.name}</option>)}
                <option value="all">All competitions</option>
              </select></label>
              <label>Month<select value={fixtureMonth} onChange={(event) => { setFixtureMonth(event.target.value); setFixtureDate('') }}>
                <option value="">All months</option>
                {fixtureMonths.map((month) => <option key={month} value={month}>{new Date(`${month}-01T12:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</option>)}
              </select></label>
              <label>Date<input type="date" value={fixtureDate} onChange={(event) => { const date = event.target.value; setFixtureDate(date); if (date) setFixtureMonth(date.slice(0, 7)) }} /></label>
              <button type="button" disabled={!visibleSchedule.length || sharingFixtures} onClick={shareFixtureImage}>{sharingFixtures ? 'Preparing…' : 'Share picture'}</button>
            </div>
            {visibleSchedule.length === 0 ? <p style={{ color: 'var(--muted)', fontSize: 14 }}>No fixtures or calendar dates for this selection.</p> : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {visibleSchedule.map((item) => {
                  const date = item.date ? new Date(`${item.date}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : 'TBC'
                  if (item.kind === 'fixture') {
                    const fixture = item.fixture
                    return <li key={`fixture-${fixture.id}`} className="team-fixture-row">
                      <Link to={`/fixtures/${fixture.id}`}>
                        <span className="team-fixture-date">{date}</span>
                        <span className="team-fixture-opponent">{fixture.home_team?.id === teamId ? 'vs' : 'at'} {fixture.home_team?.id === teamId ? fixture.away_team?.name : fixture.home_team?.name}</span>
                        <span className="team-fixture-location">{[fixture.stage?.competition?.name, fixture.round_name || fixture.stage?.name, fixture.fixture_date?.slice(11, 16) !== '00:00' ? fixture.fixture_date?.slice(11, 16) : null, fixture.venue].filter(Boolean).join(' · ')}</span>
                      </Link>
                    </li>
                  }
                  return <li key={item.kind === 'event' ? `event-${item.date}-${item.event.title}` : `possible-${item.fixture.id}`} className="team-fixture-row">
                    <div className="team-fixture-possible">
                      <span className="team-fixture-date">{date}</span>
                      <span className="team-fixture-opponent">{item.kind === 'event' ? item.event.title : `${item.fixture.stage?.competition?.name} · ${item.fixture.round_name || item.fixture.stage?.name}`}</span>
                      <span className="team-fixture-location">{item.kind === 'event' ? item.event.description : 'Possible cup date · qualification to be confirmed'}</span>
                    </div>
                  </li>
                })}
              </ul>
            )}
          </section>

          <h2 style={sectionHeaderStyle}>Squad</h2>
          {squad.length === 0 ? (
            <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 32 }}>No squad recorded.</p>
          ) : (
            <div style={{ marginBottom: 32, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {squad.map((p) => (
                <Link
                  key={p.id}
                  to={`/players/${p.id}`}
                  aria-label={`View ${p.first_name} ${p.last_name}'s player profile`}
                  style={{
                    fontSize: 13,
                    padding: '6px 12px',
                    border: '1px solid var(--line)',
                    borderRadius: 20,
                    color: 'var(--ink)',
                    textDecoration: 'none',
                  }}
                >
                  {p.first_name} {p.last_name}
                </Link>
              ))}
            </div>
          )}

          <h2 style={sectionHeaderStyle}>Honours</h2>
          {honours.length === 0 ? (
            <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 32 }}>No honours recorded.</p>
          ) : (
            <div style={{ marginBottom: 32 }}>
              {honours.map((h, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '8px 0',
                    borderBottom: '1px solid var(--line)',
                    fontSize: 14,
                  }}
                >
                  <span>
                    {h.competition} <span style={{ color: 'var(--muted)' }}>({h.season})</span>
                  </span>
                  <strong style={{ textTransform: 'capitalize' }}>{h.status}</strong>
                </div>
              ))}
            </div>
          )}

          <h2 style={sectionHeaderStyle}>Season by Season — Results</h2>
          <select
            value={resultsSeason}
            onChange={(e) => setResultsSeason(e.target.value)}
            style={{ ...selectStyle, marginBottom: 12 }}
          >
            {resultSeasonOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <div style={{ marginBottom: 32 }}>
            {(resultsSeason === CURRENT_SEASON ? currentPlayedForResults : historicForSeason).length === 0 ? (
              <p style={{ color: 'var(--muted)', fontSize: 14 }}>No results for this season.</p>
            ) : resultsSeason === CURRENT_SEASON ? (
              currentPlayedForResults.map((f) => (
                <div key={f.id} style={resultRowStyle}>
                  <span>
                    {f.home_team?.name} {displayedScore(f)} {f.away_team?.name}
                    {outcomeNote(f) && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{outcomeNote(f)}</div>}
                  </span>
                  <span style={{ color: 'var(--muted)', fontSize: 12 }}>
                    {new Date(f.fixture_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
              ))
            ) : (
              historicForSeason.map((f) => (
                <div key={f.id} style={resultRowStyle}>
                  <span>
                    {f.home_team_name} {historicDisplayedScore(f)} {f.away_team_name}
                  </span>
                  <span style={{ color: 'var(--muted)', fontSize: 12 }}>{f.competition_name}</span>
                </div>
              ))
            )}
          </div>

          <h2 style={sectionHeaderStyle}>Season by Season — Scorers</h2>
          <select
            value={scorersSeason}
            onChange={(e) => setScorersSeason(e.target.value)}
            style={{ ...selectStyle, marginBottom: 12 }}
          >
            {scorerSeasonOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <div style={{ marginBottom: 12 }}>
            {displayedScorers.length === 0 ? (
              <p style={{ color: 'var(--muted)', fontSize: 14 }}>No scorers recorded for this season.</p>
            ) : (
              displayedScorers.map(([name, goals]) => (
                <div key={name} style={resultRowStyle}>
                  <span>{name}</span>
                  <strong>{goals}</strong>
                </div>
              ))
            )}
          </div>

          <h2 style={{ ...sectionHeaderStyle, marginTop: 36 }}>Overall Head-to-Head Record</h2>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: -4, marginBottom: 12 }}>
            Complete record from the results currently held on this website. Penalty shootout victories count as wins; shootout kicks are not included in goals.
          </p>
          <label htmlFor="head-to-head-season" style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 5 }}>Season</label>
          <select
            id="head-to-head-season"
            value={headToHeadSeason}
            onChange={(event) => setHeadToHeadSeason(event.target.value)}
            style={{ ...selectStyle, marginBottom: 12 }}
          >
            {headToHeadSeasonOptions.map((season) => <option key={season} value={season}>{season}</option>)}
          </select>
          {headToHead.length === 0 ? (
            <p style={{ color: 'var(--muted)', fontSize: 14 }}>No head-to-head results recorded.</p>
          ) : (
            <div>
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: 11 }}>
                <colgroup>
                  <col style={{ width: '41%' }} />
                  <col style={{ width: '7%' }} />
                  <col style={{ width: '7%' }} />
                  <col style={{ width: '7%' }} />
                  <col style={{ width: '7%' }} />
                  <col style={{ width: '8%' }} />
                  <col style={{ width: '8%' }} />
                  <col style={{ width: '15%' }} />
                </colgroup>
                <thead>
                  <tr style={{ borderBottom: '3px solid var(--brass)' }}>
                    {sortableHead('Team', 'opponent', 'left')}
                    {sortableHead('P', 'played')}
                    {sortableHead('W', 'wins')}
                    {sortableHead('L', 'losses')}
                    {sortableHead('D', 'draws')}
                    {sortableHead('GF', 'goalsFor')}
                    {sortableHead('GA', 'goalsAgainst')}
                    {sortableHead('Win %', 'winPercentage')}
                  </tr>
                </thead>
                <tbody>
                  {headToHead.map((row) => (
                    <tr key={row.opponent} style={{ borderBottom: '1px solid var(--line)' }}>
                      <td style={{ padding: '8px 3px', fontWeight: 600, fontSize: 12, lineHeight: 1.25 }}>{row.opponent}</td>
                      <td style={headToHeadCellStyle}>{row.played}</td>
                      <td style={headToHeadCellStyle}>{row.wins}</td>
                      <td style={headToHeadCellStyle}>{row.losses}</td>
                      <td style={headToHeadCellStyle}>{row.draws}</td>
                      <td style={headToHeadCellStyle}>{row.goalsFor}</td>
                      <td style={headToHeadCellStyle}>{row.goalsAgainst}</td>
                      <td style={{ ...headToHeadCellStyle, fontWeight: 700 }}>{((row.wins / row.played) * 100).toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}

const selectStyle = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '12px 14px',
  fontSize: 15,
  fontWeight: 600,
  borderRadius: 6,
  border: '1px solid var(--line)',
  background: '#fff',
}
const cardStyle = {
  border: '1px solid var(--line)',
  borderRadius: 8,
  padding: 12,
}
const sectionLabelStyle = {
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: 0.4,
  color: 'var(--brass)',
  fontWeight: 700,
  marginBottom: 4,
}
const sectionHeaderStyle = {
  fontSize: 15,
  textTransform: 'uppercase',
  letterSpacing: 0.4,
  color: 'var(--brass)',
  marginBottom: 12,
  paddingBottom: 8,
  borderBottom: '2px solid var(--line)',
}
const resultRowStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  padding: '8px 0',
  borderBottom: '1px solid var(--line)',
  fontSize: 14,
}
const headToHeadHeaderStyle = { padding: '7px 2px', textAlign: 'center', fontSize: 9, textTransform: 'uppercase', whiteSpace: 'nowrap' }
const headToHeadSortButtonStyle = { width: '100%', display: 'flex', alignItems: 'center', gap: 2, padding: '5px 0', border: 0, background: 'transparent', color: 'var(--ink)', font: 'inherit', fontWeight: 700, textTransform: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }
const headToHeadCellStyle = { padding: '8px 2px', textAlign: 'center', whiteSpace: 'nowrap' }
