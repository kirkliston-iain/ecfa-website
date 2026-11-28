import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from 'docx'
import { jsPDF } from 'jspdf'
import { supabase } from '../supabaseClient'
import { packAnalytics, coverageNote } from '../utils/playerPack.mjs'
import './playerPack.css'
import { regularFont as regular, boldFont as bold } from '../utils/teamPackFonts'
import { trackInteraction } from '../utils/webAnalytics'

const PAGE_SIZE = 1000
const CURRENT_SEASON = '2026/27'

function normalName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-GB')
}

const PLAYER_SEARCH_ALIASES = {
  'darran taylor': ['darran taylor', 'darron taylor', 'darron cairns'],
}

function playerNameMatches(name, query) {
  const normalisedName = normalName(name)
  if (normalisedName.includes(query)) return true
  return (PLAYER_SEARCH_ALIASES[normalisedName] || []).some((alias) => alias.includes(query))
}

function seasonLabel(value) {
  return String(value || '').replace('-', '/')
}

async function fetchAll(table, select) {
  let from = 0
  let rows = []
  while (true) {
    const { data, error } = await supabase.from(table).select(select).range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    rows = rows.concat(data || [])
    if (!data || data.length < PAGE_SIZE) return rows
    from += PAGE_SIZE
  }
}

function resultFor(teamName, homeName, awayName, homeScore, awayScore) {
  if (homeScore == null || awayScore == null) return ''
  if (Number(homeScore) === Number(awayScore)) return 'Draw'
  const isHome = normalName(teamName) === normalName(homeName)
  const won = isHome ? Number(homeScore) > Number(awayScore) : Number(awayScore) > Number(homeScore)
  return won ? 'Win' : 'Loss'
}

function resultColour(result) {
  if (result === 'Win') return '#dff3e6'
  if (result === 'Draw') return '#fff0bf'
  if (result === 'Loss') return '#f8d7da'
  return '#fff'
}

function displayDate(value) {
  if (!value) return ''
  return new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString('en-GB')
}

function safeFileName(value) {
  return String(value || 'player').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function saveBlob(filename, data, type) {
  const url = URL.createObjectURL(new Blob([data], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function pdfReport(report) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true, putOnlyUsedFonts: true })
  doc.addFileToVFS('Pack-Regular.ttf', regular); doc.addFont('Pack-Regular.ttf', 'Pack', 'normal')
  doc.addFileToVFS('Pack-Bold.ttf', bold); doc.addFont('Pack-Bold.ttf', 'Pack', 'bold')
  doc.setFont('Pack', 'normal')
  const stats = packAnalytics(report)
  const ink = [21,38,50], gold = [177,138,40]
  let y = 0
  const page = (title) => {
    if (y) doc.addPage()
    doc.setFillColor(...ink); doc.rect(0,0,210,48,'F')
    doc.setTextColor(235,207,129); doc.setFont('Pack','bold'); doc.setFontSize(9); doc.text('ECFA  /  PLAYER EDITION',16,13)
    doc.setTextColor(255); doc.setFontSize(23)
    const name = doc.splitTextToSize(report.playerName,178); doc.text(name,16,25)
    doc.setFontSize(9); doc.setFont('Pack','normal'); doc.text(report.selectionLabel,16,42)
    y=61; doc.setTextColor(...ink); doc.setFontSize(17); doc.setFont('Pack','bold'); doc.text(title,16,y); y+=10
  }
  const room = height => { if(y+height>276) page('Continued') }
  const text = (value,size=10) => {
    doc.setFontSize(size); doc.setFont('Pack','normal'); doc.setTextColor(...ink)
    const lines=doc.splitTextToSize(String(value),178)
    lines.forEach(line=>{room(6);doc.text(line,16,y);y+=5.5});y+=3
  }
  const bars = (title,rows) => {
    room(22);doc.setFontSize(13);doc.setFont('Pack','bold');doc.setTextColor(...ink);doc.text(title,16,y);y+=9
    if(!rows.length) {text('No records available.');return}
    const max=Math.max(1,...rows.map(r=>r.goals))
    rows.forEach(row=>{const lines=doc.splitTextToSize(row.label,152);room(lines.length*4+12);doc.setFont('Pack','normal');doc.setFontSize(9);doc.setTextColor(...ink);doc.text(lines,16,y);doc.text(String(row.goals),194,y,{align:'right'});y+=lines.length*4;doc.setFillColor(237,242,244);doc.roundedRect(16,y,178,3,1,1,'F');if(row.goals>0){doc.setFillColor(...gold);doc.roundedRect(16,y,178*row.goals/max,3,1,1,'F')}y+=10});y+=4
  }
  page('Your scoring profile')
  text(report.currentTeam ? `Current team: ${report.currentTeam}` : 'Current team not recorded.')
  const metrics=[[report.totalGoals,'Recorded goals'],[report.rank ? '#'+report.rank : '-','Scorer rank (shared ties)'],[stats.scoringMatches,'Linked scoring matches'],[stats.linkedGoals,'Fixture-linked goals'],[stats.braces,'Braces (exactly 2) - linked matches'],[stats.hatTricks,'Hat-tricks (3+) - linked matches']]
  const top=y
  metrics.forEach(([value,label],i)=>{const x=16+i%2*91,cy=top+Math.floor(i/2)*25;doc.setFillColor(242,245,247);doc.roundedRect(x,cy,87,22,2,2,'F');doc.setTextColor(...ink);doc.setFont('Pack','bold');doc.setFontSize(20);doc.text(String(value),x+5,cy+10);doc.setFont('Pack','normal');doc.setFontSize(8);doc.text(label,x+5,cy+17)})
  y=top+85; stats.highlights.forEach(t=>text(t));text(coverageNote,9)
  page('Seasons and clubs')
  text('Recorded season totals. Earlier season totals may exclude cups.',9)
  bars('Goals by season',[...stats.seasonBars].reverse()); bars('Goals by club',stats.clubs)
  page('Inside the scoring record')
  text('The following charts use fixture-linked goals only; they do not represent all career goals or appearances.',9)
  bars('Favourite opponents - Top 5',stats.opponents.slice(0,5)); bars('Goals by competition',stats.competitions); bars('Home and away',stats.homeAway); bars('Scoring timeline - linked goals by month',stats.months)
  page('Match journal')
  text('All available fixture-linked scoring matches. Scores are shown home team first. Results exclude penalty shoot-outs.',9)
  if(!report.matches.length) text('No fixture-linked scoring records available for this selection.')
  report.matches.forEach(m=>{
    const lines=doc.splitTextToSize(`${displayDate(m.date)} | ${m.season} | ${m.competition}\n${m.team} v ${m.opponent} (${m.homeAway})\nScore: ${m.score} | ${m.result || 'Result not recorded'} | Goals: ${m.goals}`,170)
    room(lines.length*5+10);doc.setFillColor(242,245,247);doc.roundedRect(16,y-4,178,lines.length*5+6,2,2,'F');doc.setTextColor(...ink);doc.setFont('Pack','normal');doc.setFontSize(9);doc.text(lines,20,y);if(m.sourceUrl)doc.link(16,y-4,178,lines.length*5+6,{url:new URL(m.sourceUrl,window.location.origin).href});y+=lines.length*5+12
  })
  const pages=doc.getNumberOfPages()
  for(let i=1;i<=pages;i++){doc.setPage(i);doc.setTextColor(90);doc.setFontSize(8);doc.text('ECFA | '+report.playerName,16,289);doc.text(`${i} / ${pages}`,194,289,{align:'right'})}
  doc.save(`ecfa-${safeFileName(report.playerName)}-${safeFileName(report.selectionLabel)}.pdf`)
}

async function wordReport(report) {
  const stats = packAnalytics(report)
  const cell = (value, bold = false, shade = '') => new TableCell({
    shading: shade ? { fill: shade.replace('#', '') } : undefined,
    children: [new Paragraph({ children: [new TextRun({ text: String(value ?? ''), bold, color: shade === '#131f29' ? 'FFFFFF' : '152632' })] })],
  })
  const matchHeader = ['Date', 'Season', 'Competition', 'Team', 'Opponent', 'H/A', 'Score', 'Result', 'Goals', 'Source']
  const matchRows = report.matches.map((m) => new TableRow({ children: [
    cell(displayDate(m.date)), cell(m.season), cell(m.competition), cell(m.team), cell(m.opponent),
    cell(m.homeAway), cell(m.score), cell(m.result, true, resultColour(m.result)), cell(m.goals), cell(m.sourceUrl || ''),
  ] }))
  const documentFile = new Document({ sections: [{ children: [
    new Paragraph({ children: [new TextRun({ text: 'ECFA PLAYER SCORING REPORT', bold: true, size: 32 })] }),
    new Paragraph({ children: [new TextRun({ text: report.playerName, bold: true, size: 26 })] }),
    new Paragraph(`Current team: ${report.currentTeam || 'Not recorded'} | Selection: ${report.selectionLabel} | Goals: ${report.totalGoals}`),
    new Paragraph(`Scorer rank: ${report.rank || 'Not ranked'} (shared ties) | Fixture-linked goals: ${stats.linkedGoals} | Linked scoring matches: ${stats.scoringMatches} | Braces: ${stats.braces} | Hat-tricks: ${stats.hatTricks}`),
    ...stats.highlights.map(t=>new Paragraph(t)),
    ...[['FAVOURITE OPPONENTS (TOP 5)',stats.opponents.slice(0,5)],['COMPETITIONS',stats.competitions],['HOME / AWAY',stats.homeAway],['CLUB TOTALS',stats.clubs]].flatMap(([title,rows])=>[
      new Paragraph({children:[new TextRun({text:title,bold:true,color:'B18A28'})],spacing:{before:240}}),
      ...rows.map(r=>new Paragraph(`${r.label}: ${r.goals} goals`)),
    ]),
    new Paragraph(coverageNote),
    ...stats.months.map(r=>new Paragraph(`${r.label}: ${r.goals} fixture-linked goals`)),
    new Paragraph({ children: [new TextRun({ text: 'VERIFIED SCORING MATCHES', bold: true, color: 'B59025', size: 24 })], spacing: { before: 300, after: 120 } }),
    ...(report.matches.length ? [new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [
      new TableRow({ children: matchHeader.map((h) => cell(h, true, '#131f29')) }), ...matchRows,
    ] })] : [new Paragraph('No fixture-linked scoring records are available for this selection.')]),
    new Paragraph({ children: [new TextRun({ text: 'GOALS BY SEASON', bold: true, color: 'B59025', size: 24 })], spacing: { before: 300, after: 120 } }),
    new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [
      new TableRow({ children: ['Season', 'Team(s)', 'Goals'].map((h) => cell(h, true, '#131f29')) }),
      ...report.summary.map((row) => new TableRow({ children: [cell(row.season), cell(row.teams), cell(row.goals)] })),
    ] }),
    new Paragraph({ children: [new TextRun({ text: 'Verified matches show games in which a goal record is linked to a fixture; this is not a complete appearance record.', italics: true, color: '666666' })], spacing: { before: 240 } }),
  ] }] })
  const blob = await Packer.toBlob(documentFile)
  saveBlob(`ecfa-${safeFileName(report.playerName)}-${safeFileName(report.selectionLabel)}.docx`, blob, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
}

export default function PlayerReportDownload() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [historic, setHistoric] = useState([])
  const [historicMatches, setHistoricMatches] = useState([])
  const [current, setCurrent] = useState([])
  const [playerKey, setPlayerKey] = useState('')
  const [playerSearch, setPlayerSearch] = useState('')
  const [showPlayerResults, setShowPlayerResults] = useState(false)
  const [season, setSeason] = useState('combined')
  const [viewing, setViewing] = useState(true)
  const [working, setWorking] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [historicRows, historicMatchRows, currentRows] = await Promise.all([
          fetchAll('historic_scorers', 'player_name, team_name, goals, season, fixture_date, fixture:historic_fixture_id(id, competition_name, season, fixture_date, home_team_name, home_goals, away_team_name, away_goals)'),
          fetchAll('historic_match_scorers', 'player_name, team_name, goals, season, fixture_date, competition_name, home_team_name, away_team_name, home_goals, away_goals, source_url'),
          fetchAll('fixture_scorers', 'goals, player:player_id(first_name, last_name, team:team_id(name)), team:team_id(name), fixture:fixture_id(id, fixture_date, hidden_from_public, status, home_score, away_score, home_team:home_team_id(name), away_team:away_team_id(name), stage:stage_id(name, competition:competition_id(name, season)))'),
        ])
        if (cancelled) return
        setHistoric(historicRows)
        setHistoricMatches(historicMatchRows)
        setCurrent(currentRows.filter(row => row.fixture && row.fixture.hidden_from_public === false && row.fixture.status === 'played').map((row) => ({
          player_name: `${row.player?.first_name || ''} ${row.player?.last_name || ''}`.trim(),
          current_team: row.player?.team?.name || '',
          team_name: row.team?.name || row.player?.team?.name || '',
          goals: Number(row.goals || 0),
          season: seasonLabel(row.fixture?.stage?.competition?.season || CURRENT_SEASON),
          fixture: row.fixture,
        })))
      } catch (err) {
        if (!cancelled) setError(err.message || 'Player data could not be loaded.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const players = useMemo(() => {
    const map = new Map()
    for (const row of [...historic, ...historicMatches]) {
      const key = normalName(row.player_name)
      if (key && !map.has(key)) map.set(key, { key, name: String(row.player_name).trim(), currentTeam: '' })
    }
    for (const row of current) {
      const key = normalName(row.player_name)
      if (!key) continue
      map.set(key, { key, name: row.player_name, currentTeam: row.current_team || row.team_name || '' })
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [historic, historicMatches, current])

  const filteredPlayers = useMemo(() => {
    const query = normalName(playerSearch)
    if (!query) return players.slice(0, 30)
    return players.filter((player) => playerNameMatches(player.name, query)).slice(0, 50)
  }, [players, playerSearch])

  function choosePlayer(player) {
    setViewing(true)
    setPlayerKey(player.key)
    setPlayerSearch(player.name)
    setShowPlayerResults(false)
    trackInteraction('view', `Player pack: ${player.name}`)
  }

  const seasons = useMemo(() => {
    const values = new Set([CURRENT_SEASON])
    ;[...historic, ...current, ...historicMatches].forEach((row) => row.season && values.add(seasonLabel(row.season)))
    return [...values].sort((a, b) => b.localeCompare(a))
  }, [historic, current, historicMatches])

  const report = useMemo(() => {
    if (!playerKey) return null
    const player = players.find((p) => p.key === playerKey)
    const historicRows = historic.filter((row) => normalName(row.player_name) === playerKey)
    const currentRows = current.filter((row) => normalName(row.player_name) === playerKey)
    const playerHistoricMatches = historicMatches.filter((row) => normalName(row.player_name) === playerKey)
    const allRows = [...historicRows, ...currentRows]
    const selected = season === 'combined' ? allRows : allRows.filter((row) => seasonLabel(row.season) === season)
    const detailedRows = [
      ...playerHistoricMatches.map((row) => ({
        ...row,
        fixture: {
          fixture_date: row.fixture_date,
          competition_name: row.competition_name,
          home_team_name: row.home_team_name,
          away_team_name: row.away_team_name,
          home_goals: row.home_goals,
          away_goals: row.away_goals,
        },
      })),
      ...currentRows,
    ]
    const selectedMatches = season === 'combined' ? detailedRows : detailedRows.filter((row) => seasonLabel(row.season) === season)

    const matches = selectedMatches.flatMap((row) => {
      const fixture = row.fixture
      if (!fixture) return []
      const home = fixture.home_team_name || fixture.home_team?.name || ''
      const away = fixture.away_team_name || fixture.away_team?.name || ''
      const team = row.team_name || ''
      const isHome = normalName(team) === normalName(home)
      const homeScore = fixture.home_goals ?? fixture.home_score
      const awayScore = fixture.away_goals ?? fixture.away_score
      return [{
        month: String(fixture.fixture_date || row.fixture_date || '').slice(0,7),
        date: fixture.fixture_date || row.fixture_date,
        season: seasonLabel(row.season || fixture.season),
        competition: fixture.competition_name || fixture.stage?.competition?.name || '',
        team,
        opponent: isHome ? away : normalName(team) === normalName(away) ? home : 'Not recorded',
        homeAway: isHome ? 'H' : normalName(team) === normalName(away) ? 'A' : '?',
        score: `${homeScore ?? ''}-${awayScore ?? ''}`,
        result: normalName(team) === normalName(home) || normalName(team) === normalName(away) ? resultFor(team, home, away, homeScore, awayScore) : '',
        goals: Number(row.goals || 0),
        sourceUrl: row.source_url || (fixture.id ? `/fixtures/${fixture.id}` : ''),
      }]
    }).sort((a, b) => String(a.date).localeCompare(String(b.date)))

    const summaryMap = new Map()
    for (const row of selected) {
      const rowSeason = seasonLabel(row.season)
      if (!summaryMap.has(rowSeason)) summaryMap.set(rowSeason, { season: rowSeason, teams: new Set(), goals: 0 })
      const item = summaryMap.get(rowSeason)
      if (row.team_name) item.teams.add(row.team_name)
      item.goals += Number(row.goals || 0)
    }
    const summary = [...summaryMap.values()].map((row) => ({ ...row, teams: [...row.teams].join(', ') })).sort((a, b) => b.season.localeCompare(a.season))
    const totals = new Map()
    for (const row of [...historic, ...current]) {
      if (season !== 'combined' && seasonLabel(row.season) !== season) continue
      const key = normalName(row.player_name)
      totals.set(key, (totals.get(key) || 0) + Number(row.goals || 0))
    }
    const totalGoals = summary.reduce((sum, row) => sum + row.goals, 0)
    const clubs = new Map()
    for (const row of selected) clubs.set(row.team_name || 'Not recorded', (clubs.get(row.team_name || 'Not recorded') || 0) + Number(row.goals || 0))
    return {
      rank: totalGoals > 0 ? 1 + [...totals.values()].filter(n=>n>totalGoals).length : null,
      clubs: [...clubs].map(([label,goals])=>({label,goals})).sort((a,b)=>b.goals-a.goals),
      playerName: player?.name || '', currentTeam: player?.currentTeam || '',
      selectionLabel: season === 'combined' ? 'Combined / all seasons' : season,
      totalGoals: summary.reduce((sum, row) => sum + row.goals, 0), matches, summary,
    }
  }, [playerKey, season, players, historic, historicMatches, current])

  const analysis = useMemo(() => report ? packAnalytics(report) : null, [report])

  async function exportReport(format) {
    if (!report) return
    setWorking(format)
    setError('')
    try {
      if (format === 'pdf') pdfReport(report)
      else await wordReport(report)
      trackInteraction('download', `Player pack: ${report.playerName} · ${report.selectionLabel} · ${format.toUpperCase()}`)
    } catch (err) {
      setError(err.message || 'The report could not be created.')
    } finally {
      setWorking('')
    }
  }

  if (loading) return <div className="container" style={{ padding: 48 }}>Loading player records…</div>

  return (
    <div className="container player-pack" style={{ padding: '32px 20px 48px', maxWidth: 980 }}>
      <Link to="/downloads" style={{ color: 'var(--brass)', fontWeight: 700, textDecoration: 'none' }}>← Back to downloads</Link>
      <h1 style={{ fontSize: 30, margin: '18px 0 4px' }}>Player performance packs</h1>
      <p style={{ color: 'var(--muted)', marginBottom: 22 }}>Explore a player’s scoring story. View the full report online or keep a professionally styled PDF or Word copy.</p>
      {error && <div style={{ padding: 12, marginBottom: 16, border: '1px solid #B3261E', borderRadius: 6, color: '#B3261E' }}>{error}</div>}

      <section className="pack-controls" style={panelStyle}>
        <label style={{ ...labelStyle, position: 'relative' }}>Player
          <input
            type="search"
            value={playerSearch}
            placeholder="Search part of a name…"
            autoComplete="off"
            onFocus={() => setShowPlayerResults(true)}
            onBlur={() => window.setTimeout(() => setShowPlayerResults(false), 150)}
            onChange={(e) => {
              setPlayerSearch(e.target.value)
              setPlayerKey('')
              setShowPlayerResults(true)
            }}
            style={selectStyle}
          />
          {showPlayerResults && (
            <div style={searchResultsStyle}>
              {filteredPlayers.map((player) => (
                <button
                  type="button"
                  key={player.key}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choosePlayer(player)}
                  style={searchResultStyle}
                >
                  <span>{player.name}</span>
                  {player.currentTeam && <small style={{ color: 'var(--muted)' }}>{player.currentTeam}</small>}
                </button>
              ))}
              {!filteredPlayers.length && <div style={{ padding: 12, color: 'var(--muted)', fontWeight: 400 }}>No matching players</div>}
            </div>
          )}
        </label>
        <label style={labelStyle}>Season
          <select value={season} onChange={(e) => setSeason(e.target.value)} style={selectStyle}>
            <option value="combined">Combined — all seasons</option>
            {seasons.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignSelf: 'end' }}>
          <button disabled={!report} onClick={() => { setViewing(true); window.setTimeout(() => document.getElementById('player-pack-report')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0) }} style={buttonStyle}>View report</button>
          <button disabled={!report || !!working} onClick={() => exportReport('pdf')} style={buttonStyle}>{working === 'pdf' ? 'Preparing…' : 'Download PDF'}</button>
          <button disabled={!report || !!working} onClick={() => exportReport('word')} style={buttonStyle}>{working === 'word' ? 'Preparing…' : 'Download Word'}</button>
        </div>
      </section>

      {!report ? <div style={{ padding: 30, textAlign: 'center', color: 'var(--muted)' }}>Select a player to create their report.</div> : viewing && <div id="player-pack-report">
        <section className="pack-hero">
          <div className="pack-eyebrow">ECFA • Player edition • {report.selectionLabel}</div>
          <h2 style={{ marginBottom: 4 }}>{report.playerName}</h2>
          <div style={{ color: '#e3eaf0' }}>Current team: <strong style={{ color: '#fff' }}>{report.currentTeam || 'Not recorded'}</strong> · {report.selectionLabel} · <strong style={{ color: '#fff' }}>{report.totalGoals} goals</strong></div>
        </section>
        <div className="pack-metrics">{[
          [report.totalGoals, 'Recorded goals'], [report.rank ? `#${report.rank}` : '—', 'Scorer rank · selected period (ties shared)'],
          [report.summary.length, 'Seasons with recorded goals'], [analysis.scoringMatches, 'Fixture-linked scoring matches'],
          [analysis.linkedGoals, 'Goals linked to fixtures'], [analysis.braces, 'Braces · linked matches only'],
          [analysis.hatTricks, 'Hat-tricks (3+) · linked matches'], [analysis.best?.goals || '—', 'Best linked match haul'],
        ].map(([value,label])=><div className="pack-metric" key={label}><strong>{value}</strong><span>{label}</span></div>)}</div>
        <div className="pack-note"><strong>Understanding your records</strong><br/>{coverageNote} Rankings compare recorded scorer totals for the selected period, rather than a complete appearance-based leaderboard.</div>
        <div className="pack-grid">
          <Bars title="Season by season" subtitle="Recorded season totals" rows={analysis.seasonBars}/>
          <div className="pack-card"><h3>The scoring story</h3>{analysis.highlights.map(text=><p key={text}>{text}</p>)}<p><strong>Next milestone:</strong> {Math.floor(report.totalGoals / 25 + 1) * 25} recorded goals ({Math.floor(report.totalGoals / 25 + 1) * 25 - report.totalGoals} to go).</p></div>
          <Bars title="Favourite opponents" subtitle="Top 5 · fixture-linked goals" rows={analysis.opponents.slice(0,5)}/>
          <Bars title="Competition breakdown" subtitle="Fixture-linked goals only" rows={analysis.competitions}/>
          <Bars title="Home and away" subtitle="Goals in fixture-linked scoring matches" rows={analysis.homeAway}/>
          <Bars title="Goals by club" subtitle="Recorded totals for the selected period" rows={analysis.clubs}/>
          <Bars title="Scoring timeline" subtitle="Goals by calendar month · linked matches only" rows={analysis.months}/>
          <div className="pack-card"><h3>Results when scoring</h3><p>Fixture-linked scoring matches only. These are match counts, rather than all appearances.</p>{['Win','Draw','Loss'].map(result=><p key={result}><strong>{result === 'Loss' ? 'Defeats' : result+'s'}:</strong> {report.matches.filter(m=>m.result===result).length}</p>)}<p>Unknown results: {report.matches.filter(m=>!m.result).length}</p></div>
        </div>
        <section style={{ marginTop: 28 }}>
          <h2 style={sectionTitleStyle}>Verified scoring matches</h2>
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>Games where this player’s scoring record can be linked to a fixture. This is not a full appearance record.</p>
          <div style={{ overflowX: 'auto' }}><table style={tableStyle}><thead><tr>{['Date','Season','Competition','Team','Opponent','H/A','Score','Result','Goals','Source'].map((h) => <th key={h} style={thStyle}>{h}</th>)}</tr></thead><tbody>
            {report.matches.map((m, i) => <tr key={`${m.date}-${i}`} style={{ borderBottom: '1px solid var(--line)' }}><td style={tdStyle}>{displayDate(m.date)}</td><td style={tdStyle}>{m.season}</td><td style={tdStyle}>{m.competition}</td><td style={tdStyle}>{m.team}</td><td style={tdStyle}>{m.opponent}</td><td style={tdStyle}>{m.homeAway}</td><td style={tdStyle}>{m.score}</td><td style={{ ...tdStyle, background: resultColour(m.result), fontWeight: 700 }}>{m.result}</td><td style={{ ...tdStyle, textAlign: 'center', fontWeight: 800 }}>{m.goals}</td><td style={tdStyle}>{m.sourceUrl && <a href={m.sourceUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--brass)', fontWeight: 700, whiteSpace: 'nowrap' }}>View match</a>}</td></tr>)}
            {!report.matches.length && <tr><td colSpan="10" style={{ ...tdStyle, padding: 24, textAlign: 'center', color: 'var(--muted)' }}>No fixture-linked scoring records are available for this selection.</td></tr>}
          </tbody></table></div>
        </section>
        <section style={{ marginTop: 30 }}>
          <h2 style={sectionTitleStyle}>Goals by season</h2>
          <div style={{ overflowX: 'auto' }}><table style={tableStyle}><thead><tr><th style={thStyle}>Season</th><th style={thStyle}>Team(s)</th><th style={thStyle}>Goals</th></tr></thead><tbody>
            {report.summary.map((row) => <tr key={row.season} style={{ borderBottom: '1px solid var(--line)' }}><td style={tdStyle}>{row.season}</td><td style={tdStyle}>{row.teams}</td><td style={{ ...tdStyle, fontWeight: 800 }}>{row.goals}</td></tr>)}
          </tbody></table></div>
        </section>
      </div>}
    </div>
  )
}

const panelStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14, padding: 18, border: '1px solid var(--line)', borderRadius: 8, background: '#f7f8f9' }
const labelStyle = { display: 'grid', gap: 6, fontWeight: 700, fontSize: 13 }
const selectStyle = { width: '100%', padding: '11px 12px', border: '1px solid var(--line)', borderRadius: 6, background: '#fff', fontSize: 14 }
const searchResultsStyle = { position: 'absolute', zIndex: 20, top: '100%', left: 0, right: 0, maxHeight: 300, overflowY: 'auto', marginTop: 4, border: '1px solid var(--line)', borderRadius: 6, background: '#fff', boxShadow: '0 8px 24px rgba(0,0,0,.14)' }
const searchResultStyle = { width: '100%', display: 'grid', gap: 2, padding: '10px 12px', border: 0, borderBottom: '1px solid var(--line)', background: '#fff', color: 'var(--ink)', textAlign: 'left', cursor: 'pointer', fontSize: 14 }
const buttonStyle = { padding: '11px 15px', border: 0, borderRadius: 6, background: 'var(--ink)', color: '#fff', fontWeight: 700, cursor: 'pointer' }
const sectionTitleStyle = { fontSize: 18, color: 'var(--brass)', marginBottom: 6 }
const tableStyle = { width: '100%', minWidth: 780, borderCollapse: 'collapse', fontSize: 13 }
const thStyle = { padding: '9px 8px', textAlign: 'left', color: '#fff', background: 'var(--ink)', whiteSpace: 'nowrap' }
const tdStyle = { padding: '9px 8px', verticalAlign: 'top' }

function Bars({title,subtitle,rows}) {
  const max = Math.max(1,...rows.map(r=>r.goals))
  return <section className="pack-card"><h3>{title}</h3><p>{subtitle}</p>{rows.length ? rows.map(row=><div className="pack-bar" key={row.label}><div className="pack-bar-label"><span>{row.label}</span><strong>{row.goals}</strong></div><div className="pack-track" aria-hidden="true"><div className="pack-fill" style={{width:`${row.goals/max*100}%`}}/></div></div>) : <p>No records available for this selection.</p>}</section>
}
