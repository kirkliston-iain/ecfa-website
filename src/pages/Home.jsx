import { Link } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import MatchdayCarousel from '../components/MatchdayCarousel'
import StandingsTable from '../components/StandingsTable'

const APPIN_LOGO = 'https://appinsports.com/wp-content/uploads/logo/logo-footer.png'

const COMPETITIONS = [
  { slug: 'appin-league', name: 'Appin Sports League' },
  { slug: 'knockout-cup', name: 'ECFA Knockout Cup' },
  { slug: 'league-cup', name: 'ECFA League Cup' },
  { slug: 'brian-latto-cup', name: 'Brian Latto Cup' },
]

const SPONSORS = [
  {
    name: 'Appin Sports',
    url: 'https://appinsports.com/',
    logo: 'https://appinsports.com/wp-content/uploads/logo/logo-footer.png',
    blurb: 'Custom teamwear specialists — proud kit sponsor of the ECFA.',
  },
]

function todayUK() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const y = parts.find((p) => p.type === 'year').value
  const m = parts.find((p) => p.type === 'month').value
  const d = parts.find((p) => p.type === 'day').value
  return `${y}-${m}-${d}`
}

function getMode() {
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

function dateKey(fixtureDate) {
  return fixtureDate ? fixtureDate.slice(0, 10) : null
}

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`
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

async function loadCompetition(meta) {
  const { data: comp } = await supabase.from('competitions').select('id').eq('slug', meta.slug).single()
  if (!comp) return { ...meta, fixtures: [], groupTeams: {} }

  const { data: stages } = await supabase
    .from('stages')
    .select('id, stage_type, groups(id, name)')
    .eq('competition_id', comp.id)

  const stageIds = (stages || []).map((s) => s.id)
  const groupStageIds = new Set((stages || []).filter((s) => s.stage_type === 'group').map((s) => s.id))

  const { data: fixtures } = await supabase
    .from('fixtures')
    .select(
      'id, fixture_date, venue, referee_name, round_name, home_placeholder, away_placeholder, home_score, away_score, status, group_id, stage_id, home_team:home_team_id(id, name, logo_url), away_team:away_team_id(id, name, logo_url)'
    )
    .in('stage_id', stageIds.length ? stageIds : ['00000000-0000-0000-0000-000000000000'])
    .eq('hidden_from_public', false)

  const groupTeams = {}
  for (const stage of stages || []) {
    if (stage.stage_type !== 'group') continue
    for (const group of stage.groups || []) {
      const { data: stageTeams } = await supabase
        .from('stage_teams')
        .select('team:team_id(id, name, logo_url)')
        .eq('stage_id', stage.id)
        .eq('group_id', group.id)
      groupTeams[group.id] = (stageTeams || []).map((st) => st.team)
    }
  }

  const taggedFixtures = (fixtures || []).map((f) => ({
    ...f,
    compSlug: meta.slug,
    compName: meta.name,
    isGroupStage: groupStageIds.has(f.stage_id),
  }))

  return { ...meta, fixtures: taggedFixtures, groupTeams }
}

function pickDefaultDate(days, todayStr, mode) {
  if (days.length === 0) return null
  const past = days.filter((d) => d.date <= todayStr && d.played > 0)
  const future = days.filter((d) => d.date >= todayStr && d.scheduled > 0)
  if (mode === 'recap') {
    if (past.length) return past[past.length - 1].date
    if (future.length) return future[0].date
  } else {
    if (future.length) return future[0].date
    if (past.length) return past[past.length - 1].date
  }
  return days[days.length - 1].date
}

function previousSeasonLabel(season) {
  if (!season) return null
  const m = season.match(/(\d{4})[/-](\d{2,4})/)
  if (!m) return null
  const startYear = parseInt(m[1], 10) - 1
  const endYearShort = String(startYear + 1).slice(-2)
  return `${startYear}/${endYearShort}`
}

const CUP_NAME_KEYWORDS = {
  'knockout-cup': 'knockout cup',
  'league-cup': 'league cup',
  'brian-latto-cup': 'brian latto',
}

function roundLabelFromCompName(name) {
  const n = name.toLowerCase()
  if (n.endsWith('final') && !n.includes('semi') && !n.includes('quarter')) return 'the Final'
  if (n.includes('semi')) return 'the Semi Final'
  if (n.includes('quarter')) return 'the Quarter Final'
  if (n.includes('preliminary')) return 'the Preliminary Round'
  return null
}

function previewSentenceForFixture(f, comp, groupTeams, info) {
  const homeName = f.home_team?.name
  const awayName = f.away_team?.name
  const parts = []

  if (info?.lastMeeting) {
    const m = info.lastMeeting
    const mHomeName = m.isCurrentSeason ? m.home_team?.name : m.home_team_name
    const mAwayName = m.isCurrentSeason ? m.away_team?.name : m.away_team_name
    const hs = m.isCurrentSeason ? m.home_score : m.home_goals
    const as = m.isCurrentSeason ? m.away_score : m.away_goals
    if (hs != null && as != null) {
      const dateStr = new Date(m.fixture_date).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
      if (hs === as) {
        parts.push(`They last met in ${dateStr}, drawing ${hs}-${as}.`)
      } else {
        const winner = hs > as ? mHomeName : mAwayName
        const ws = Math.max(hs, as)
        const ls = Math.min(hs, as)
        parts.push(`They last met in ${dateStr}, with ${winner} winning ${ws}-${ls}.`)
      }
    }
  }

  if (f.isGroupStage && f.group_id && groupTeams[f.group_id]) {
    const teams = groupTeams[f.group_id]
    const played = comp.fixtures.filter((x) => x.group_id === f.group_id && x.status === 'played')
    const table = computeStandings(teams, played)

    function projectedRank(winnerId) {
      if (!winnerId) return null
      const bumped = table.map((r) =>
        r.teamId === winnerId ? { ...r, points: r.points + 3, played: r.played + 1 } : r
      )
      bumped.sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor)
      return bumped.findIndex((r) => r.teamId === winnerId) + 1
    }

    const homeRank = projectedRank(f.home_team?.id)
    const awayRank = projectedRank(f.away_team?.id)
    const bits = []
    if (homeRank) bits.push(`a win could move ${homeName} to ${ordinal(homeRank)}`)
    if (awayRank) bits.push(`a win for ${awayName} could take them to ${ordinal(awayRank)}`)
    if (bits.length) parts.push(bits.join(', while ') + ' — depending on other results.')
  } else if (info?.cupRun) {
    const describeCupRun = (teamName, run, teamId) => {
      if (!run) return null
      const isHome = run.home_team_id === teamId
      const oppName = isHome ? run.away_team_name : run.home_team_name
      const us = isHome ? run.home_goals : run.away_goals
      const opp = isHome ? run.away_goals : run.home_goals
      const round = roundLabelFromCompName(run.competition_name)
      const roundText = round ? ` in ${round}` : ' in their last game in this competition'
      if (us == null || opp == null) {
        return `${teamName} were last involved${roundText} against ${oppName} last season.`
      }
      if (us === opp) {
        return `${teamName} drew ${us}-${opp} with ${oppName}${roundText} last season.`
      }
      const result = us > opp ? 'won' : 'lost'
      return `${teamName} ${result} ${Math.max(us, opp)}-${Math.min(us, opp)} against ${oppName}${roundText} last season.`
    }
    const h = describeCupRun(homeName, info.cupRun.home, f.home_team?.id)
    const a = describeCupRun(awayName, info.cupRun.away, f.away_team?.id)
    if (h) parts.push(h)
    if (a) parts.push(a)
  }

  return parts.join(' ')
}

function recapSentenceForFixture(f, allFixturesForComp, groupTeams, selectedDate) {
  const homeName = f.home_team?.name
  const awayName = f.away_team?.name
  const hs = f.home_score
  const as = f.away_score

  if (!f.isGroupStage || !f.group_id || !groupTeams[f.group_id]) {
    if (hs === as) return `${homeName} and ${awayName} drew ${hs}-${as} in the ${f.compName}.`
    const winner = hs > as ? homeName : awayName
    const loser = hs > as ? awayName : homeName
    const ws = Math.max(hs, as)
    const ls = Math.min(hs, as)
    return `${winner} beat ${loser} ${ws}-${ls} in the ${f.compName}.`
  }

  const teams = groupTeams[f.group_id]
  const before = computeStandings(
    teams,
    allFixturesForComp.filter(
      (x) => x.group_id === f.group_id && x.status === 'played' && dateKey(x.fixture_date) < selectedDate
    )
  )
  const after = computeStandings(
    teams,
    allFixturesForComp.filter(
      (x) => x.group_id === f.group_id && x.status === 'played' && dateKey(x.fixture_date) <= selectedDate
    )
  )
  const rankBefore = {}
  before.forEach((r, i) => {
    rankBefore[r.teamId] = { rank: i + 1, played: r.played }
  })
  const rankAfter = {}
  after.forEach((r, i) => {
    rankAfter[r.teamId] = { rank: i + 1, points: r.points }
  })

  if (hs === as) {
    const hr = rankAfter[f.home_team?.id]?.rank
    const ar = rankAfter[f.away_team?.id]?.rank
    const tail = hr && ar ? `, leaving them ${ordinal(hr)} and ${ordinal(ar)} respectively` : ''
    return `${homeName} and ${awayName} drew ${hs}-${as}${tail}.`
  }

  const winnerId = hs > as ? f.home_team?.id : f.away_team?.id
  const winnerName = hs > as ? homeName : awayName
  const loserName = hs > as ? awayName : homeName
  const ws = Math.max(hs, as)
  const ls = Math.min(hs, as)

  const beforeInfo = rankBefore[winnerId]
  const afterInfo = rankAfter[winnerId]
  let movement = ''
  if (afterInfo) {
    if (!beforeInfo || beforeInfo.played === 0) {
      movement = `, moving into ${ordinal(afterInfo.rank)} with ${afterInfo.points} points`
    } else if (beforeInfo.rank !== afterInfo.rank) {
      movement =
        afterInfo.rank < beforeInfo.rank
          ? `, climbing to ${ordinal(afterInfo.rank)} with ${afterInfo.points} points`
          : `, though they stay ${ordinal(afterInfo.rank)} with ${afterInfo.points} points`
    } else {
      movement = `, staying ${ordinal(afterInfo.rank)} with ${afterInfo.points} points`
    }
  }
  return `${winnerName} beat ${loserName} ${ws}-${ls}${movement}.`
}

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

const tbcDotStyle = {
  width: 24,
  height: 24,
  borderRadius: '50%',
  background: 'var(--line)',
  color: 'var(--muted)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 11,
  fontWeight: 700,
  flexShrink: 0,
}

function MatchCard({ f }) {
  const played = f.status === 'played'
  return (
    <Link
      to={`/fixtures/${f.id}`}
      style={{
        display: 'block',
        border: '1px solid var(--line)',
        borderRadius: 6,
        padding: '12px 16px',
        marginBottom: 10,
        background: '#fff',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: 'var(--brass)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>
        {f.compSlug === 'appin-league' && (
          <img src={APPIN_LOGO} alt="" style={{ height: 14, width: 'auto', objectFit: 'contain' }} />
        )}
        {f.compName}
        {f.round_name ? ` — ${f.round_name}` : ''}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, fontWeight: 600, fontSize: 15, textAlign: 'right' }}>
          <span style={!f.home_team ? { color: 'var(--muted)', fontStyle: 'italic', fontWeight: 400 } : undefined}>
            {f.home_team?.name || f.home_placeholder || 'TBC'}
          </span>
          {f.home_team ? (
            <Badge logoUrl={f.home_team?.logo_url} name={f.home_team?.name} />
          ) : (
            <span style={tbcDotStyle}>?</span>
          )}
        </div>
        <div
          style={{
            minWidth: 60,
            textAlign: 'center',
            fontWeight: 800,
            fontSize: 17,
            color: played ? '#fff' : 'var(--muted)',
            background: played ? 'var(--ink)' : 'transparent',
            borderRadius: 4,
            padding: played ? '4px 10px' : 0,
          }}
        >
          {played ? `${f.home_score} - ${f.away_score}` : 'v'}
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 15 }}>
          {f.away_team ? (
            <Badge logoUrl={f.away_team?.logo_url} name={f.away_team?.name} />
          ) : (
            <span style={tbcDotStyle}>?</span>
          )}
          <span style={!f.away_team ? { color: 'var(--muted)', fontStyle: 'italic', fontWeight: 400 } : undefined}>
            {f.away_team?.name || f.away_placeholder || 'TBC'}
          </span>
        </div>
      </div>
      {(f.venue || f.referee_name || (f.fixture_date && f.fixture_date.slice(11, 16) !== '00:00')) && (
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6, textAlign: 'center' }}>
          {[
            f.fixture_date && f.fixture_date.slice(11, 16) !== '00:00' ? f.fixture_date.slice(11, 16) : null,
            f.venue || null,
            f.referee_name ? `Ref: ${f.referee_name}` : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </div>
      )}
    </Link>
  )
}

export default function Home() {
  const [loading, setLoading] = useState(true)
  const [competitions, setCompetitions] = useState([])
  const [selectedDate, setSelectedDate] = useState(null)
  const [calendarEvents, setCalendarEvents] = useState([])
  useEffect(() => {
    supabase
      .from('calendar_events')
      .select('event_date, title, description')
      .then(({ data }) => setCalendarEvents(data || []))
  }, [])

  useEffect(() => {
    let cancelled = false

    async function load() {
      const results = await Promise.all(COMPETITIONS.map((c) => loadCompetition(c)))
      if (cancelled) return
      setCompetitions(results)

      const dateMap = new Map()
      for (const comp of results) {
        for (const f of comp.fixtures) {
          const key = dateKey(f.fixture_date)
          if (!key) continue
          if (!dateMap.has(key)) dateMap.set(key, { date: key, played: 0, scheduled: 0 })
          const entry = dateMap.get(key)
          if (f.status === 'played') entry.played += 1
          else entry.scheduled += 1
        }
      }
      const days = Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date))
      const mode = getMode()
      const initial = pickDefaultDate(days, todayUK(), mode)
      setSelectedDate(initial)
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  const allDays = useMemo(() => {
    const dateMap = new Map()
    for (const comp of competitions) {
      for (const f of comp.fixtures) {
        const key = dateKey(f.fixture_date)
        if (!key) continue
        if (!dateMap.has(key)) dateMap.set(key, { date: key, played: 0, scheduled: 0 })
        const entry = dateMap.get(key)
        if (f.status === 'played') entry.played += 1
        else entry.scheduled += 1
      }
    }
    for (const ev of calendarEvents) {
      if (!dateMap.has(ev.event_date)) {
        dateMap.set(ev.event_date, { date: ev.event_date, played: 0, scheduled: 0, isEvent: true })
      }
    }
    return Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date))
  }, [competitions, calendarEvents])

  const matchesForDate = useMemo(() => {
    if (!selectedDate) return []
    const rows = []
    for (const comp of competitions) {
      for (const f of comp.fixtures) {
        if (dateKey(f.fixture_date) === selectedDate) rows.push(f)
      }
    }
    return rows
  }, [competitions, selectedDate])

  const recapParagraphs = useMemo(() => {
    if (!selectedDate) return []
    const paragraphs = []
    for (const comp of competitions) {
      const playedToday = comp.fixtures.filter(
        (f) => dateKey(f.fixture_date) === selectedDate && f.status === 'played'
      )
      if (playedToday.length === 0) continue
      const sentences = playedToday.map((f) => recapSentenceForFixture(f, comp.fixtures, comp.groupTeams, selectedDate))
      paragraphs.push({ compName: comp.name, text: sentences.join(' ') })
    }
    return paragraphs
  }, [competitions, selectedDate])

  const hasResultsToday = matchesForDate.some((f) => f.status === 'played')

  const [currentSeasonLabel, setCurrentSeasonLabel] = useState('')
  useEffect(() => {
    supabase
      .from('competitions')
      .select('season')
      .limit(1)
      .then(({ data }) => setCurrentSeasonLabel(data?.[0]?.season || ''))
  }, [])

  const [previewInfo, setPreviewInfo] = useState({})
  useEffect(() => {
    const upcoming = matchesForDate.filter((f) => f.status !== 'played')
    if (upcoming.length === 0) {
      setPreviewInfo({})
      return
    }

    let cancelled = false
    async function load() {
      const teamIds = Array.from(
        new Set(upcoming.flatMap((f) => [f.home_team?.id, f.away_team?.id]).filter(Boolean))
      )
      if (teamIds.length === 0) return
      const { data: hist } = await supabase
        .from('historic_fixtures')
        .select(
          'id, season, competition_name, fixture_date, home_team_name, home_team_id, home_goals, away_team_name, away_team_id, away_goals'
        )
        .or(`home_team_id.in.(${teamIds.join(',')}),away_team_id.in.(${teamIds.join(',')})`)
        .order('fixture_date', { ascending: false })

      const prevSeason = previousSeasonLabel(currentSeasonLabel)

      const info = {}
      for (const f of upcoming) {
        const homeId = f.home_team?.id
        const awayId = f.away_team?.id

        let lastMeeting = null
        for (const comp of competitions) {
          for (const other of comp.fixtures) {
            if (other.id === f.id || other.status !== 'played') continue
            const oh = other.home_team?.id
            const oa = other.away_team?.id
            if ((oh === homeId && oa === awayId) || (oh === awayId && oa === homeId)) {
              if (!lastMeeting || new Date(other.fixture_date) > new Date(lastMeeting.fixture_date)) {
                lastMeeting = { ...other, isCurrentSeason: true }
              }
            }
          }
        }
        if (!lastMeeting) {
          const match = (hist || []).find(
            (h) =>
              (h.home_team_id === homeId && h.away_team_id === awayId) ||
              (h.home_team_id === awayId && h.away_team_id === homeId)
          )
          if (match) lastMeeting = match
        }

        let cupRun = null
        if (!f.isGroupStage && prevSeason) {
          const keyword = CUP_NAME_KEYWORDS[f.compSlug]
          if (keyword) {
            const findRun = (teamId) => {
              if (!teamId) return null
              const rows = (hist || []).filter(
                (h) =>
                  h.season === prevSeason &&
                  h.competition_name.toLowerCase().includes(keyword) &&
                  (h.home_team_id === teamId || h.away_team_id === teamId)
              )
              if (rows.length === 0) return null
              rows.sort((a, b) => new Date(b.fixture_date) - new Date(a.fixture_date))
              return rows[0]
            }
            cupRun = { home: findRun(homeId), away: findRun(awayId) }
          }
        }

        info[f.id] = { lastMeeting, cupRun }
      }
      if (!cancelled) setPreviewInfo(info)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [matchesForDate, competitions, currentSeasonLabel])

  const previewParagraphs = useMemo(() => {
    if (!selectedDate || hasResultsToday) return []
    const items = []
    for (const comp of competitions) {
      const upcomingToday = comp.fixtures.filter(
        (f) => dateKey(f.fixture_date) === selectedDate && f.status !== 'played'
      )
      for (const f of upcomingToday) {
        const text = previewSentenceForFixture(f, comp, comp.groupTeams, previewInfo[f.id])
        if (!text) continue
        items.push({
          fixtureId: f.id,
          compName: comp.name,
          homeName: f.home_team?.name,
          awayName: f.away_team?.name,
          text,
        })
      }
    }
    return items
  }, [competitions, selectedDate, hasResultsToday, previewInfo])

  const appinStandings = useMemo(() => {
    const appin = competitions.find((c) => c.slug === 'appin-league')
    if (!appin) return []
    const groupId = Object.keys(appin.groupTeams)[0]
    if (!groupId) return []
    return computeStandings(
      appin.groupTeams[groupId],
      appin.fixtures.filter((f) => f.group_id === groupId)
    )
  }, [competitions])

  if (loading) {
    return (
      <div className="container" style={{ padding: '48px 20px' }}>
        <p style={{ color: 'var(--muted)' }}>Loading match hub…</p>
      </div>
    )
  }

  return (
    <div className="container" style={{ padding: '32px 20px 48px' }}>
      <h1 style={{ fontSize: 30, marginBottom: 4 }}>Match Hub</h1>
      <p style={{ color: 'var(--muted)', marginBottom: 24 }}>
        Results and fixtures across every ECFA competition.
      </p>

      <MatchdayCarousel days={allDays} selected={selectedDate} onSelect={setSelectedDate} />

      {hasResultsToday && recapParagraphs.length > 0 && (
        <section style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--brass)', marginBottom: 10 }}>
            Match Day Recap
          </h2>
          {recapParagraphs.map((p) => (
            <p key={p.compName} style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 10 }}>
              {p.text}
            </p>
          ))}
        </section>
      )}

      {!hasResultsToday && previewParagraphs.length > 0 && (
        <section style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--brass)', marginBottom: 10 }}>
            Match Preview
          </h2>
          {previewParagraphs.map((p) => (
            <div key={p.fixtureId} style={{ marginBottom: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>
                {p.homeName} v {p.awayName}
              </div>
              <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--muted)', margin: 0 }}>{p.text}</p>
            </div>
          ))}
        </section>
      )}

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--muted)', marginBottom: 12 }}>
          {hasResultsToday ? 'Full Time' : 'Upcoming Fixtures'}
        </h2>
        {matchesForDate.length === 0 ? (
          (() => {
            const events = calendarEvents.filter((ev) => ev.event_date === selectedDate)
            if (events.length > 0) {
              return events.map((ev, i) => (
                <div
                  key={i}
                  style={{
                    border: '1px solid var(--line)',
                    borderRadius: 6,
                    padding: '14px 16px',
                    marginBottom: 10,
                    background: '#fafafa',
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: ev.description ? 4 : 0 }}>{ev.title}</div>
                  {ev.description && <div style={{ fontSize: 13, color: 'var(--muted)' }}>{ev.description}</div>}
                </div>
              ))
            }
            return <p style={{ color: 'var(--muted)', fontSize: 14 }}>No matches on this date.</p>
          })()
        ) : (
          matchesForDate.map((f) => <MatchCard key={f.id} f={f} />)
        )}
      </section>

      {appinStandings.length > 0 && (
        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--muted)', marginBottom: 12 }}>
            League Table
          </h2>
          <StandingsTable rows={appinStandings} />
        </section>
      )}

      <h2
        style={{
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: 0.6,
          textTransform: 'uppercase',
          color: 'var(--muted)',
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
              background: '#fff',
              padding: '20px 24px',
              display: 'flex',
              alignItems: 'center',
              gap: 20,
            }}
          >
            <img src={s.logo} alt={s.name} style={{ height: 40, width: 'auto', objectFit: 'contain', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{s.name}</div>
              <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--muted)' }}>{s.blurb}</p>
            </div>
            <span style={{ fontSize: 22, color: 'var(--brass)' }}>&rarr;</span>
          </a>
        ))}
      </div>
    </div>
  )
}
