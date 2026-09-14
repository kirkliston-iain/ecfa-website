import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'

const YELLOW_POINTS = 2
const RED_POINTS = 4
const SERIOUS_RULES = {
  opponent_abuse: { label: 'Abusive language (opponent)', tiers: [{ ban: 3 }] },
  official_abuse: { label: 'Abusive language (official)', tiers: [{ ban: 5 }, { months: 12 }] },
  discriminatory: { label: 'Discriminatory language', tiers: [{ ban: 3 }, { months: 12 }] },
  violent_conduct: { label: 'Violent conduct', tiers: [{ months: 12 }, { lifetime: true }] },
}

function dateKey(value) {
  return String(value || '').slice(0, 10)
}

function displayDate(value) {
  return new Date(`${dateKey(value)}T00:00:00`).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function fullName(player) {
  return `${player?.first_name || ''} ${player?.last_name || ''}`.trim()
}

function normalName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase()
}

function gamesPlayedSince(fixtures, teamId, startDate) {
  if (!teamId || !startDate) return 0
  const start = dateKey(startDate)
  return fixtures.filter((fixture) =>
    dateKey(fixture.fixture_date) > start &&
    (fixture.home_team_id === teamId || fixture.away_team_id === teamId)
  ).length
}

function wrapLines(ctx, text, maxWidth) {
  const words = String(text || '').split(/\s+/)
  const lines = []
  let line = ''
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line)
      line = word
    } else {
      line = next
    }
  }
  if (line) lines.push(line)
  return lines
}

function roundRect(ctx, x, y, width, height, radius, fill) {
  ctx.beginPath()
  ctx.roundRect(x, y, width, height, radius)
  ctx.fillStyle = fill
  ctx.fill()
}

function drawTitle(ctx, title, x, y) {
  ctx.fillStyle = '#b59025'
  ctx.font = '700 25px Arial'
  ctx.fillText(title.toUpperCase(), x, y)
}

function drawTable(ctx, { x, y, width, columns, rows, rowHeight = 48 }) {
  const headerHeight = 44
  roundRect(ctx, x, y, width, headerHeight + rows.length * rowHeight, 10, '#f4f6f8')
  ctx.fillStyle = '#17212b'
  ctx.fillRect(x, y, width, headerHeight)
  ctx.font = '700 16px Arial'
  ctx.fillStyle = '#ffffff'
  let cursor = x + 16
  for (const column of columns) {
    ctx.fillText(column.label, cursor, y + 28)
    cursor += width * column.ratio
  }

  rows.forEach((row, rowIndex) => {
    const top = y + headerHeight + rowIndex * rowHeight
    if (rowIndex % 2 === 1) {
      ctx.fillStyle = '#e9edf0'
      ctx.fillRect(x, top, width, rowHeight)
    }
    ctx.font = '600 16px Arial'
    ctx.fillStyle = '#17212b'
    let cellX = x + 16
    columns.forEach((column) => {
      const value = row[column.key] ?? ''
      const lines = wrapLines(ctx, value, width * column.ratio - 22).slice(0, 2)
      lines.forEach((line, lineIndex) => ctx.fillText(line, cellX, top + 20 + lineIndex * 17))
      cellX += width * column.ratio
    })
  })
  return y + headerHeight + rows.length * rowHeight
}

function makeGraphic({ reportDate, weekendRows, teamRows, bans, season }) {
  const width = 1600
  const margin = 60
  const columnGap = 40
  const columnWidth = (width - margin * 2 - columnGap) / 2
  const weekendHeight = 44 + Math.max(1, weekendRows.length) * 54
  const teamHeight = 44 + Math.max(1, teamRows.length) * 44
  const firstSectionBottom = 190 + Math.max(weekendHeight, teamHeight)
  const bansHeight = 44 + Math.max(1, bans.length) * 58
  const height = Math.max(980, firstSectionBottom + bansHeight + 170)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = '#b59025'
  ctx.fillRect(0, 0, width, 22)

  ctx.fillStyle = '#17212b'
  ctx.font = '800 42px Arial'
  ctx.fillText('ECFA WEEKLY DISCIPLINE', margin, 82)
  ctx.font = '600 21px Arial'
  ctx.fillStyle = '#58636d'
  ctx.fillText(`${season} · Matchday: ${displayDate(reportDate)}`, margin, 120)

  ctx.textAlign = 'right'
  ctx.font = '700 17px Arial'
  ctx.fillStyle = '#b59025'
  ctx.fillText('YELLOW = 2 POINTS · RED = 4 POINTS', width - margin, 82)
  ctx.textAlign = 'left'

  drawTitle(ctx, 'Cards this matchday', margin, 170)
  const weekendData = weekendRows.length ? weekendRows : [{ player: 'No cards recorded', team: '', cards: '', weekend: '', season: '' }]
  drawTable(ctx, {
    x: margin,
    y: 190,
    width: columnWidth,
    rowHeight: 54,
    columns: [
      { key: 'player', label: 'Player', ratio: 0.28 },
      { key: 'team', label: 'Team', ratio: 0.32 },
      { key: 'cards', label: 'Cards', ratio: 0.16 },
      { key: 'weekend', label: 'Day pts', ratio: 0.12 },
      { key: 'season', label: 'Total', ratio: 0.12 },
    ],
    rows: weekendData,
  })

  drawTitle(ctx, 'Total points by team', margin + columnWidth + columnGap, 170)
  const teamData = teamRows.length ? teamRows : [{ team: 'No points recorded', points: '' }]
  drawTable(ctx, {
    x: margin + columnWidth + columnGap,
    y: 190,
    width: columnWidth,
    rowHeight: 44,
    columns: [
      { key: 'team', label: 'Team', ratio: 0.82 },
      { key: 'points', label: 'Points', ratio: 0.18 },
    ],
    rows: teamData,
  })

  const bansY = firstSectionBottom + 70
  drawTitle(ctx, 'Current bans', margin, bansY)
  const banData = bans.length ? bans : [{ player: 'No current bans', team: '', ban: '', progress: '' }]
  const endY = drawTable(ctx, {
    x: margin,
    y: bansY + 20,
    width: width - margin * 2,
    rowHeight: 58,
    columns: [
      { key: 'player', label: 'Player', ratio: 0.22 },
      { key: 'team', label: 'Team', ratio: 0.30 },
      { key: 'ban', label: 'Ban / reason', ratio: 0.28 },
      { key: 'progress', label: 'Status', ratio: 0.20 },
    ],
    rows: banData,
  })

  ctx.fillStyle = '#b59025'
  ctx.fillRect(margin, endY + 42, width - margin * 2, 4)
  ctx.font = '16px Arial'
  ctx.fillStyle = '#58636d'
  ctx.fillText('Generated from the live Edinburgh Churches Football Association website.', margin, endY + 78)

  return canvas
}

export default function WeeklyDisciplineReport() {
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [records, setRecords] = useState([])
  const [playerPoints, setPlayerPoints] = useState([])
  const [teamOverrides, setTeamOverrides] = useState({})
  const [teams, setTeams] = useState([])
  const [suspensions, setSuspensions] = useState([])
  const [fixtures, setFixtures] = useState([])
  const [season, setSeason] = useState('2026/27')
  const [reportDate, setReportDate] = useState('')
  const [graphicUrl, setGraphicUrl] = useState('')
  const [graphicBlob, setGraphicBlob] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const [recordResult, pointResult, overrideResult, teamResult, suspensionResult, fixtureResult, competitionResult] = await Promise.all([
        supabase.from('discipline_records').select('id, card_type, card_count, serious_offence, notes, player:player_id(id, first_name, last_name), team:team_id(id, name), fixture:fixture_id(id, fixture_date)'),
        supabase.from('player_discipline_points').select('player_name, points, team_id, team_name_raw, team:team_id(id, name)').eq('season', '2026/27'),
        supabase.from('team_points_override').select('team_id, points'),
        supabase.from('teams').select('id, name').order('name'),
        supabase.from('suspensions').select('id, reason, games_banned, is_lifetime, games_served, status, notes, available_from, start_date, created_at, player:player_id(id, first_name, last_name), team:team_id(id, name)'),
        supabase.from('fixtures').select('id, fixture_date, status, home_team_id, away_team_id').eq('status', 'played').order('fixture_date'),
        supabase.from('competitions').select('season').limit(1),
      ])

      const failed = [recordResult, pointResult, overrideResult, teamResult, suspensionResult, fixtureResult].find((result) => result.error)
      if (failed) {
        if (!cancelled) setError('The weekly discipline data could not be loaded.')
        setLoading(false)
        return
      }

      if (!cancelled) {
        const loadedRecords = recordResult.data || []
        setRecords(loadedRecords)
        setPlayerPoints(pointResult.data || [])
        setTeams(teamResult.data || [])
        setSuspensions(suspensionResult.data || [])
        setFixtures(fixtureResult.data || [])
        setSeason(competitionResult.data?.[0]?.season || '2026/27')
        setTeamOverrides(Object.fromEntries((overrideResult.data || []).map((row) => [row.team_id, Number(row.points)])))
        const dates = loadedRecords.map((row) => dateKey(row.fixture?.fixture_date)).filter(Boolean).sort()
        setReportDate(dates[dates.length - 1] || new Date().toISOString().slice(0, 10))
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const dateOptions = useMemo(
    () => Array.from(new Set(records.map((row) => dateKey(row.fixture?.fixture_date)).filter(Boolean))).sort().reverse(),
    [records]
  )

  const reportData = useMemo(() => {
    const totalsByName = {}
    const teamTotals = {}
    for (const row of playerPoints) {
      totalsByName[normalName(row.player_name)] = Number(row.points || 0)
      const teamId = row.team?.id || row.team_id
      if (teamId) teamTotals[teamId] = (teamTotals[teamId] || 0) + Number(row.points || 0)
    }

    const weekendMap = new Map()
    for (const row of records.filter((record) => dateKey(record.fixture?.fixture_date) === reportDate && !record.serious_offence)) {
      const key = row.player?.id || normalName(fullName(row.player))
      if (!weekendMap.has(key)) weekendMap.set(key, { player: fullName(row.player), team: row.team?.name || 'No team', yellow: 0, red: 0 })
      const item = weekendMap.get(key)
      if (row.card_type === 'red') item.red += Number(row.card_count || 0)
      else item.yellow += Number(row.card_count || 0)
    }

    const weekendRows = Array.from(weekendMap.values()).map((row) => {
      const weekend = row.red > 0 ? row.red * RED_POINTS : row.yellow * YELLOW_POINTS
      const cardParts = []
      if (row.yellow) cardParts.push(`${row.yellow}Y`)
      if (row.red) cardParts.push(`${row.red}R`)
      return {
        player: row.player,
        team: row.team,
        cards: cardParts.join(' + '),
        weekend: String(weekend),
        season: String(totalsByName[normalName(row.player)] ?? weekend),
      }
    }).sort((a, b) => Number(b.weekend) - Number(a.weekend) || a.team.localeCompare(b.team))

    const teamRows = teams.map((team) => ({
      team: team.name,
      points: String(teamOverrides[team.id] ?? teamTotals[team.id] ?? 0),
    })).sort((a, b) => Number(b.points) - Number(a.points) || a.team.localeCompare(b.team))

    const activeManual = suspensions.filter((suspension) => {
      if (suspension.status && suspension.status !== 'active') return false
      if (suspension.is_lifetime) return true
      if (suspension.available_from) return new Date(`${suspension.available_from}T23:59:59`) >= new Date()
      const served = suspension.team?.id
        ? gamesPlayedSince(fixtures, suspension.team.id, suspension.start_date || suspension.created_at)
        : Number(suspension.games_served || 0)
      return !suspension.games_banned || served < suspension.games_banned
    })

    const coveredPlayers = new Set(activeManual.map((row) => row.player?.id))
    const seriousGroups = new Map()
    for (const row of records.filter((record) => record.serious_offence)) {
      const key = `${row.player?.id}::${row.serious_offence}`
      if (!seriousGroups.has(key)) seriousGroups.set(key, { ...row, dates: [], count: 0 })
      const group = seriousGroups.get(key)
      group.count += 1
      if (row.fixture?.fixture_date) group.dates.push(dateKey(row.fixture.fixture_date))
    }

    const automatic = Array.from(seriousGroups.values()).filter((row) => !coveredPlayers.has(row.player?.id)).map((row) => {
      const rule = SERIOUS_RULES[row.serious_offence]
      if (!rule) return null
      const tier = rule.tiers[Math.min(row.count - 1, rule.tiers.length - 1)]
      const startDate = row.dates.sort().at(-1)
      const served = gamesPlayedSince(fixtures, row.team?.id, startDate)
      let active = true
      let progress = ''
      let ban = rule.label
      if (tier.lifetime) {
        ban += ' - lifetime ban'
        progress = 'Indefinite / lifetime'
      } else if (tier.ban) {
        active = served < tier.ban
        ban += ` - ${tier.ban}-match ban`
        progress = `${served} served · ${Math.max(0, tier.ban - served)} remaining`
      } else {
        const available = new Date(`${startDate}T00:00:00`)
        available.setFullYear(available.getFullYear() + 1)
        active = available >= new Date()
        ban += ' - minimum 12-month ban'
        progress = `Available ${available.toLocaleDateString('en-GB')}`
      }
      return active ? { ...row, ban, progress } : null
    }).filter(Boolean)

    const manualBans = activeManual.map((row) => {
      const served = row.team?.id
        ? gamesPlayedSince(fixtures, row.team.id, row.start_date || row.created_at)
        : Number(row.games_served || 0)
      return {
        player: fullName(row.player),
        team: row.team?.name || 'No team',
        ban: row.reason || (row.is_lifetime ? 'Indefinite ban' : 'Suspension'),
        progress: row.is_lifetime
          ? 'Indefinite / lifetime'
          : row.available_from
            ? `Available ${new Date(`${row.available_from}T00:00:00`).toLocaleDateString('en-GB')}`
            : `${served} served · ${Math.max(0, Number(row.games_banned || 0) - served)} remaining`,
      }
    })

    const automaticBans = automatic.map((row) => ({
      player: fullName(row.player),
      team: row.team?.name || 'No team',
      ban: row.ban,
      progress: row.progress,
    }))

    return { weekendRows, teamRows, bans: [...automaticBans, ...manualBans].sort((a, b) => a.team.localeCompare(b.team)) }
  }, [records, playerPoints, teamOverrides, teams, suspensions, fixtures, reportDate])

  function generate() {
    setGenerating(true)
    setError('')
    try {
      if (graphicUrl) URL.revokeObjectURL(graphicUrl)
      const canvas = makeGraphic({ reportDate, ...reportData, season })
      canvas.toBlob((blob) => {
        if (!blob) {
          setError('The report graphic could not be created.')
          setGenerating(false)
          return
        }
        setGraphicBlob(blob)
        setGraphicUrl(URL.createObjectURL(blob))
        setGenerating(false)
      }, 'image/png')
    } catch (err) {
      setError(err.message || 'The report graphic could not be created.')
      setGenerating(false)
    }
  }

  function download() {
    if (!graphicBlob) return
    const link = document.createElement('a')
    link.href = graphicUrl
    link.download = `ecfa-weekly-discipline-${reportDate}.png`
    document.body.appendChild(link)
    link.click()
    link.remove()
  }

  async function share() {
    if (!graphicBlob) return
    const file = new File([graphicBlob], `ecfa-weekly-discipline-${reportDate}.png`, { type: 'image/png' })
    const shareData = {
      title: 'ECFA Weekly Discipline',
      text: `ECFA weekly disciplinary update - ${displayDate(reportDate)}`,
      files: [file],
    }
    if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
      try {
        await navigator.share(shareData)
        return
      } catch (err) {
        if (err?.name === 'AbortError') return
      }
    }
    download()
    window.location.href = `https://wa.me/?text=${encodeURIComponent(shareData.text + ' - attach the downloaded ECFA graphic')}`
  }

  if (loading) return <div className="container" style={{ padding: 48 }}>Loading weekly discipline data…</div>

  return (
    <div className="container" style={{ padding: '32px 20px 48px', maxWidth: 900 }}>
      <Link to="/discipline" style={{ color: 'var(--brass)', fontWeight: 700, fontSize: 13 }}>← Back to discipline</Link>
      <h1 style={{ fontSize: 28, margin: '22px 0 4px' }}>Weekly Discipline Report</h1>
      <p style={{ color: 'var(--muted)', marginBottom: 24 }}>
        Generate the matchday cards, season player totals, team points and every current ban.
      </p>

      {error && <div style={{ padding: 12, marginBottom: 16, border: '1px solid #b3261e', color: '#b3261e', borderRadius: 6 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', padding: 16, border: '1px solid var(--line)', borderRadius: 8, marginBottom: 24 }}>
        <label style={{ flex: '1 1 230px', fontSize: 13, fontWeight: 700 }}>
          Matchday
          <select value={reportDate} onChange={(event) => setReportDate(event.target.value)} style={selectStyle}>
            {dateOptions.map((date) => <option key={date} value={date}>{displayDate(date)}</option>)}
          </select>
        </label>
        <button onClick={generate} disabled={!reportDate || generating} style={primaryButtonStyle}>
          {generating ? 'Generating…' : 'Generate discipline report'}
        </button>
      </div>

      {graphicUrl && (
        <>
          <img src={graphicUrl} alt={`ECFA weekly discipline report for ${displayDate(reportDate)}`} style={{ width: '100%', display: 'block', border: '1px solid var(--line)', borderRadius: 8, marginBottom: 14 }} />
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button onClick={share} style={{ ...primaryButtonStyle, flex: '1 1 220px' }}>Share to WhatsApp</button>
            <button onClick={download} style={{ ...secondaryButtonStyle, flex: '1 1 180px' }}>Download graphic</button>
          </div>
          <p style={{ color: 'var(--muted)', fontSize: 12 }}>
            On supported phones, Share opens the system share sheet with the graphic attached so WhatsApp can be selected.
          </p>
        </>
      )}
    </div>
  )
}

const selectStyle = {
  width: '100%',
  boxSizing: 'border-box',
  display: 'block',
  marginTop: 7,
  padding: '10px 12px',
  border: '1px solid var(--line)',
  borderRadius: 6,
  background: '#fff',
  fontSize: 14,
}
const primaryButtonStyle = {
  alignSelf: 'flex-end',
  minHeight: 42,
  padding: '10px 16px',
  border: 0,
  borderRadius: 6,
  background: 'var(--ink)',
  color: '#fff',
  fontWeight: 800,
  cursor: 'pointer',
}
const secondaryButtonStyle = {
  ...primaryButtonStyle,
  background: '#fff',
  color: 'var(--ink)',
  border: '1px solid var(--line)',
}
