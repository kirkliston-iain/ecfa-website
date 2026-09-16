import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from 'docx'
import { jsPDF } from 'jspdf'
import { supabase } from '../supabaseClient'

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

function pdfReport(report) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const margin = 12
  let y = 14

  const heading = (title) => {
    if (y > 180) { doc.addPage(); y = 14 }
    doc.setTextColor(181, 144, 37)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.text(title.toUpperCase(), margin, y)
    y += 7
  }

  doc.setTextColor(19, 31, 41)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.text('ECFA PLAYER SCORING REPORT', margin, y)
  y += 9
  doc.setFontSize(14)
  doc.text(report.playerName, margin, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`Current team: ${report.currentTeam || 'Not recorded'}   |   Selection: ${report.selectionLabel}   |   Goals: ${report.totalGoals}`, margin, y)
  y += 11

  heading('Verified scoring matches')
  const headers = ['Date', 'Season', 'Competition', 'Team', 'Opponent', 'H/A', 'Score', 'Result', 'Goals']
  const widths = [22, 19, 48, 48, 48, 12, 18, 18, 14]
  const drawRow = (cells, header = false, result = '') => {
    if (y > 195) { doc.addPage(); y = 14 }
    let x = margin
    cells.forEach((cell, index) => {
      if (result && index === 7) {
        const rgb = result === 'Win' ? [223, 243, 230] : result === 'Draw' ? [255, 240, 191] : [248, 215, 218]
        doc.setFillColor(...rgb)
      } else doc.setFillColor(header ? 19 : 247, header ? 31 : 248, header ? 41 : 249)
      doc.rect(x, y - 4, widths[index], 7, 'F')
      doc.setTextColor(header ? 255 : 19, header ? 255 : 31, header ? 255 : 41)
      doc.setFont('helvetica', header ? 'bold' : 'normal')
      doc.setFontSize(7)
      doc.text(String(cell ?? '').slice(0, index === 2 || index === 3 || index === 4 ? 30 : 15), x + 1.5, y)
      x += widths[index]
    })
    y += 8
  }
  drawRow(headers, true)
  if (report.matches.length) report.matches.forEach((m) => drawRow([
    displayDate(m.date), m.season, m.competition, m.team, m.opponent, m.homeAway,
    m.score, m.result, m.goals,
  ], false, m.result))
  else {
    doc.setFontSize(9)
    doc.setTextColor(100)
    doc.text('No fixture-linked scoring records are available for this selection.', margin, y)
    y += 9
  }

  y += 4
  heading('Goals by season')
  drawRow(['Season', 'Team(s)', 'Goals'], true)
  report.summary.forEach((row) => drawRow([row.season, row.teams, row.goals]))
  y += 3
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(8)
  doc.setTextColor(100)
  doc.text('Verified matches show games in which a goal record is linked to a fixture; this is not a complete appearance record.', margin, y)
  doc.save(`ecfa-${safeFileName(report.playerName)}-${safeFileName(report.selectionLabel)}.pdf`)
}

async function wordReport(report) {
  const cell = (value, bold = false, shade = '') => new TableCell({
    shading: shade ? { fill: shade.replace('#', '') } : undefined,
    children: [new Paragraph({ children: [new TextRun({ text: String(value ?? ''), bold })] })],
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
  const [working, setWorking] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [historicRows, historicMatchRows, currentRows] = await Promise.all([
          fetchAll('historic_scorers', 'player_name, team_name, goals, season, fixture_date, fixture:historic_fixture_id(id, competition_name, season, fixture_date, home_team_name, home_goals, away_team_name, away_goals)'),
          fetchAll('historic_match_scorers', 'player_name, team_name, goals, season, fixture_date, competition_name, home_team_name, away_team_name, home_goals, away_goals, source_url'),
          fetchAll('fixture_scorers', 'goals, player:player_id(first_name, last_name, team:team_id(name)), team:team_id(name), fixture:fixture_id(id, fixture_date, home_score, away_score, home_team:home_team_id(name), away_team:away_team_id(name), stage:stage_id(name, competition:competition_id(name, season)))'),
        ])
        if (cancelled) return
        setHistoric(historicRows)
        setHistoricMatches(historicMatchRows)
        setCurrent(currentRows.map((row) => ({
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
    for (const row of historic) {
      const key = normalName(row.player_name)
      if (key && !map.has(key)) map.set(key, { key, name: String(row.player_name).trim(), currentTeam: '' })
    }
    for (const row of current) {
      const key = normalName(row.player_name)
      if (!key) continue
      map.set(key, { key, name: row.player_name, currentTeam: row.current_team || row.team_name || '' })
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [historic, current])

  const filteredPlayers = useMemo(() => {
    const query = normalName(playerSearch)
    if (!query) return players.slice(0, 30)
    return players.filter((player) => playerNameMatches(player.name, query)).slice(0, 50)
  }, [players, playerSearch])

  function choosePlayer(player) {
    setPlayerKey(player.key)
    setPlayerSearch(player.name)
    setShowPlayerResults(false)
  }

  const seasons = useMemo(() => {
    const values = new Set([CURRENT_SEASON])
    historic.forEach((row) => row.season && values.add(seasonLabel(row.season)))
    return [...values].sort((a, b) => b.localeCompare(a))
  }, [historic])

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
        date: fixture.fixture_date || row.fixture_date,
        season: seasonLabel(row.season || fixture.season),
        competition: fixture.competition_name || fixture.stage?.competition?.name || '',
        team,
        opponent: isHome ? away : home,
        homeAway: isHome ? 'H' : 'A',
        score: `${homeScore ?? ''}-${awayScore ?? ''}`,
        result: resultFor(team, home, away, homeScore, awayScore),
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
    return {
      playerName: player?.name || '', currentTeam: player?.currentTeam || '',
      selectionLabel: season === 'combined' ? 'Combined / all seasons' : season,
      totalGoals: summary.reduce((sum, row) => sum + row.goals, 0), matches, summary,
    }
  }, [playerKey, season, players, historic, historicMatches, current])

  async function exportReport(format) {
    if (!report) return
    setWorking(format)
    setError('')
    try {
      if (format === 'pdf') pdfReport(report)
      else await wordReport(report)
    } catch (err) {
      setError(err.message || 'The report could not be created.')
    } finally {
      setWorking('')
    }
  }

  if (loading) return <div className="container" style={{ padding: 48 }}>Loading player records…</div>

  return (
    <div className="container" style={{ padding: '32px 20px 48px', maxWidth: 980 }}>
      <Link to="/downloads" style={{ color: 'var(--brass)', fontWeight: 700, textDecoration: 'none' }}>← Back to downloads</Link>
      <h1 style={{ fontSize: 30, margin: '18px 0 4px' }}>Player scoring report</h1>
      <p style={{ color: 'var(--muted)', marginBottom: 22 }}>Choose a player and season, preview the available information, then download it as PDF or Word.</p>
      {error && <div style={{ padding: 12, marginBottom: 16, border: '1px solid #B3261E', borderRadius: 6, color: '#B3261E' }}>{error}</div>}

      <section style={panelStyle}>
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
          <button disabled={!report || !!working} onClick={() => exportReport('pdf')} style={buttonStyle}>{working === 'pdf' ? 'Preparing…' : 'Download PDF'}</button>
          <button disabled={!report || !!working} onClick={() => exportReport('word')} style={buttonStyle}>{working === 'word' ? 'Preparing…' : 'Download Word'}</button>
        </div>
      </section>

      {!report ? <div style={{ padding: 30, textAlign: 'center', color: 'var(--muted)' }}>Select a player to create their report.</div> : <>
        <section style={{ marginTop: 28 }}>
          <h2 style={{ marginBottom: 4 }}>{report.playerName}</h2>
          <div style={{ color: 'var(--muted)' }}>Current team: <strong style={{ color: 'var(--ink)' }}>{report.currentTeam || 'Not recorded'}</strong> · {report.selectionLabel} · <strong style={{ color: 'var(--ink)' }}>{report.totalGoals} goals</strong></div>
        </section>
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
      </>}
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
