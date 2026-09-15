import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from 'docx'
import { jsPDF } from 'jspdf'
import { supabase } from '../supabaseClient'

const PAGE_SIZE = 1000
const CURRENT_SEASON = '2026/27'

function normal(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-GB')
}

function seasonLabel(value) {
  return String(value || '').replace('-', '/')
}

function displayDate(value) {
  if (!value) return ''
  return new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString('en-GB')
}

function safeFileName(value) {
  return String(value || 'referee').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
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

function cardKind(value) {
  return normal(value).includes('red') ? 'Red' : 'Yellow'
}

function cardColours(kind) {
  return kind === 'Red'
    ? { background: '#b3261e', color: '#fff' }
    : { background: '#f4c430', color: '#241d00' }
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
  const nextPage = () => { if (y > 192) { doc.addPage(); y = 14 } }
  const heading = (text) => {
    nextPage()
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(181, 144, 37)
    doc.text(text.toUpperCase(), margin, y)
    y += 7
  }
  const row = (cells, widths, header = false, colours = {}) => {
    nextPage()
    let x = margin
    cells.forEach((value, index) => {
      const fill = colours[index] || (header ? [19, 31, 41] : [247, 248, 249])
      doc.setFillColor(...fill)
      doc.rect(x, y - 4, widths[index], 7, 'F')
      doc.setTextColor(header ? 255 : 19, header ? 255 : 31, header ? 255 : 41)
      doc.setFont('helvetica', header ? 'bold' : 'normal')
      doc.setFontSize(7)
      doc.text(String(value ?? '').slice(0, 34), x + 1.4, y)
      x += widths[index]
    })
    y += 8
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.setTextColor(19, 31, 41)
  doc.text('ECFA REFEREE REPORT', margin, y)
  y += 9
  doc.setFontSize(14)
  doc.text(report.referee, margin, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`${report.selectionLabel} | ${report.matches.length} games | ${report.yellow} yellow | ${report.red} red | ${report.totalCards} cards`, margin, y)
  y += 11

  heading('Games officiated')
  const gameWidths = [22, 19, 44, 50, 50, 35, 20]
  row(['Date', 'Season', 'Competition', 'Home team', 'Away team', 'Venue', 'Score'], gameWidths, true)
  report.matches.forEach((m) => row([displayDate(m.date), m.season, m.competition, m.home, m.away, m.venue, m.score], gameWidths))

  y += 4
  heading('Cards issued')
  const cardWidths = [22, 19, 42, 42, 42, 55, 20, 14]
  row(['Date', 'Season', 'Home team', 'Away team', 'Team', 'Player', 'Card', 'Qty'], cardWidths, true)
  report.cards.forEach((c) => row(
    [displayDate(c.date), c.season, c.home, c.away, c.team, c.player, c.kind, c.count],
    cardWidths,
    false,
    { 6: c.kind === 'Red' ? [179, 38, 30] : [244, 196, 48] }
  ))
  if (!report.cards.length) {
    doc.setFontSize(9)
    doc.setTextColor(100)
    doc.text('No player-level card records are available for this selection.', margin, y)
  }
  doc.save(`ecfa-${safeFileName(report.referee)}-${safeFileName(report.selectionLabel)}.pdf`)
}

async function wordReport(report) {
  const cell = (value, bold = false, shade = '') => new TableCell({
    shading: shade ? { fill: shade } : undefined,
    children: [new Paragraph({ children: [new TextRun({ text: String(value ?? ''), bold })] })],
  })
  const header = (items) => new TableRow({ children: items.map((item) => cell(item, true, '131F29')) })
  const documentFile = new Document({ sections: [{ children: [
    new Paragraph({ children: [new TextRun({ text: 'ECFA REFEREE REPORT', bold: true, size: 32 })] }),
    new Paragraph({ children: [new TextRun({ text: report.referee, bold: true, size: 26 })] }),
    new Paragraph(`${report.selectionLabel} | ${report.matches.length} games | ${report.yellow} yellow | ${report.red} red | ${report.totalCards} cards`),
    new Paragraph({ children: [new TextRun({ text: 'GAMES OFFICIATED', bold: true, color: 'B59025', size: 24 })], spacing: { before: 300, after: 120 } }),
    new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [
      header(['Date', 'Season', 'Competition', 'Home', 'Away', 'Venue', 'Score']),
      ...report.matches.map((m) => new TableRow({ children: [cell(displayDate(m.date)), cell(m.season), cell(m.competition), cell(m.home), cell(m.away), cell(m.venue), cell(m.score)] })),
    ] }),
    new Paragraph({ children: [new TextRun({ text: 'CARDS ISSUED', bold: true, color: 'B59025', size: 24 })], spacing: { before: 300, after: 120 } }),
    ...(report.cards.length ? [new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [
      header(['Date', 'Game', 'Team', 'Player', 'Card', 'Qty']),
      ...report.cards.map((c) => new TableRow({ children: [
        cell(displayDate(c.date)), cell(`${c.home} v ${c.away}`), cell(c.team), cell(c.player),
        cell(c.kind, true, c.kind === 'Red' ? 'B3261E' : 'F4C430'), cell(c.count),
      ] })),
    ] })] : [new Paragraph('No player-level card records are available for this selection.')]),
    new Paragraph({ children: [new TextRun({ text: 'Historic fixture records do not contain player-level card details, so older seasons show games, teams, results and available venues only.', italics: true, color: '666666' })], spacing: { before: 240 } }),
  ] }] })
  const blob = await Packer.toBlob(documentFile)
  saveBlob(`ecfa-${safeFileName(report.referee)}-${safeFileName(report.selectionLabel)}.docx`, blob, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
}

export default function RefereeReportDownload() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [referees, setReferees] = useState([])
  const [liveFixtures, setLiveFixtures] = useState([])
  const [historicFixtures, setHistoricFixtures] = useState([])
  const [discipline, setDiscipline] = useState([])
  const [refereeName, setRefereeName] = useState('')
  const [search, setSearch] = useState('')
  const [showResults, setShowResults] = useState(false)
  const [season, setSeason] = useState(CURRENT_SEASON)
  const [working, setWorking] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [refRows, liveRows, historicRows, cardRows] = await Promise.all([
          fetchAll('referees', 'id, name'),
          fetchAll('fixtures', 'id, fixture_date, venue, referee_name, home_score, away_score, status, home_team:home_team_id(name), away_team:away_team_id(name), stage:stage_id(name, competition:competition_id(name, season))'),
          fetchAll('historic_fixtures', 'id, season, competition_name, fixture_date, referee_name, home_team_name, away_team_name, home_goals, away_goals'),
          fetchAll('discipline_records', 'fixture_id, card_type, card_count, player:player_id(first_name, last_name), team:team_id(name)'),
        ])
        if (cancelled) return
        setReferees((refRows || []).sort((a, b) => a.name.localeCompare(b.name)))
        setLiveFixtures((liveRows || []).filter((row) => row.status === 'played' && row.referee_name).map((row) => ({
          id: row.id,
          referee: row.referee_name,
          season: seasonLabel(row.stage?.competition?.season || CURRENT_SEASON),
          competition: row.stage?.competition?.name || '',
          date: row.fixture_date,
          venue: row.venue || '',
          home: row.home_team?.name || '',
          away: row.away_team?.name || '',
          homeScore: row.home_score,
          awayScore: row.away_score,
          historic: false,
        })))
        setHistoricFixtures((historicRows || []).filter((row) => row.referee_name).map((row) => ({
          id: `historic-${row.id}`,
          referee: row.referee_name,
          season: seasonLabel(row.season),
          competition: row.competition_name || '',
          date: row.fixture_date,
          venue: '',
          home: row.home_team_name || '',
          away: row.away_team_name || '',
          homeScore: row.home_goals,
          awayScore: row.away_goals,
          historic: true,
        })))
        setDiscipline(cardRows || [])
      } catch (err) {
        if (!cancelled) setError(err.message || 'Referee information could not be loaded.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const filteredReferees = useMemo(() => {
    const query = normal(search)
    if (!query) return referees.slice(0, 30)
    return referees.filter((referee) => normal(referee.name).includes(query)).slice(0, 50)
  }, [referees, search])

  const seasons = useMemo(() => {
    const values = new Set([CURRENT_SEASON])
    historicFixtures.forEach((row) => row.season && values.add(row.season))
    liveFixtures.forEach((row) => row.season && values.add(row.season))
    return [...values].sort((a, b) => b.localeCompare(a))
  }, [historicFixtures, liveFixtures])

  const report = useMemo(() => {
    if (!refereeName) return null
    const allMatches = [...liveFixtures, ...historicFixtures]
      .filter((row) => normal(row.referee) === normal(refereeName))
      .filter((row) => season === 'all' || row.season === season)
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))
      .map((row) => ({ ...row, score: row.homeScore == null || row.awayScore == null ? '' : `${row.homeScore}-${row.awayScore}` }))

    const liveById = new Map(allMatches.filter((row) => !row.historic).map((row) => [row.id, row]))
    const cards = discipline.flatMap((row) => {
      const fixture = liveById.get(row.fixture_id)
      if (!fixture) return []
      return [{
        date: fixture.date,
        season: fixture.season,
        home: fixture.home,
        away: fixture.away,
        team: row.team?.name || '',
        player: `${row.player?.first_name || ''} ${row.player?.last_name || ''}`.trim() || 'Player not recorded',
        kind: cardKind(row.card_type),
        count: Number(row.card_count || 1),
      }]
    }).sort((a, b) => String(b.date).localeCompare(String(a.date)))

    const yellow = cards.filter((row) => row.kind === 'Yellow').reduce((sum, row) => sum + row.count, 0)
    const red = cards.filter((row) => row.kind === 'Red').reduce((sum, row) => sum + row.count, 0)
    const teamMap = new Map()
    const venueMap = new Map()
    allMatches.forEach((match) => {
      ;[match.home, match.away].filter(Boolean).forEach((team) => teamMap.set(team, (teamMap.get(team) || 0) + 1))
      if (match.venue) venueMap.set(match.venue, (venueMap.get(match.venue) || 0) + 1)
    })
    return {
      referee: refereeName,
      selectionLabel: season === 'all' ? 'All seasons' : season,
      matches: allMatches,
      cards,
      yellow,
      red,
      totalCards: yellow + red,
      teams: [...teamMap.entries()].sort((a, b) => b[1] - a[1]),
      venues: [...venueMap.entries()].sort((a, b) => b[1] - a[1]),
    }
  }, [refereeName, season, liveFixtures, historicFixtures, discipline])

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

  if (loading) return <div className="container" style={{ padding: 48 }}>Loading referee records…</div>

  return (
    <div className="container" style={{ padding: '32px 20px 48px', maxWidth: 980 }}>
      <Link to="/downloads" style={{ color: 'var(--brass)', fontWeight: 700, textDecoration: 'none' }}>← Back to downloads</Link>
      <h1 style={{ fontSize: 30, margin: '18px 0 4px' }}>Referee report</h1>
      <p style={{ color: 'var(--muted)', marginBottom: 22 }}>Search for a referee, choose a season, and review their games, venues, teams and cards.</p>
      {error && <div style={{ padding: 12, marginBottom: 16, border: '1px solid #B3261E', borderRadius: 6, color: '#B3261E' }}>{error}</div>}

      <section style={panelStyle}>
        <label style={{ ...labelStyle, position: 'relative' }}>Referee
          <input
            type="search"
            value={search}
            placeholder="Search part of a name…"
            autoComplete="off"
            onFocus={() => setShowResults(true)}
            onBlur={() => window.setTimeout(() => setShowResults(false), 150)}
            onChange={(e) => { setSearch(e.target.value); setRefereeName(''); setShowResults(true) }}
            style={inputStyle}
          />
          {showResults && <div style={searchResultsStyle}>
            {filteredReferees.map((referee) => <button type="button" key={referee.id} onMouseDown={(e) => e.preventDefault()} onClick={() => { setRefereeName(referee.name); setSearch(referee.name); setShowResults(false) }} style={searchResultStyle}>{referee.name}</button>)}
            {!filteredReferees.length && <div style={{ padding: 12, color: 'var(--muted)', fontWeight: 400 }}>No matching referees</div>}
          </div>}
        </label>
        <label style={labelStyle}>Season
          <select value={season} onChange={(e) => setSeason(e.target.value)} style={inputStyle}>
            <option value="all">All seasons</option>
            {seasons.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignSelf: 'end' }}>
          <button disabled={!report || !!working} onClick={() => exportReport('pdf')} style={buttonStyle}>{working === 'pdf' ? 'Preparing…' : 'Download PDF'}</button>
          <button disabled={!report || !!working} onClick={() => exportReport('word')} style={buttonStyle}>{working === 'word' ? 'Preparing…' : 'Download Word'}</button>
        </div>
      </section>

      {!report ? <div style={{ padding: 30, textAlign: 'center', color: 'var(--muted)' }}>Search for and select a referee to create their report.</div> : <>
        <section style={{ marginTop: 28 }}>
          <h2 style={{ marginBottom: 12 }}>{report.referee} — {report.selectionLabel}</h2>
          <div style={statsStyle}>
            <Stat label="Games" value={report.matches.length} />
            <Stat label="Yellow cards" value={report.yellow} colour="#f4c430" />
            <Stat label="Red cards" value={report.red} colour="#b3261e" />
            <Stat label="Cards per game" value={report.matches.length ? (report.totalCards / report.matches.length).toFixed(2) : '0.00'} />
          </div>
        </section>

        <section style={{ marginTop: 30 }}>
          <h2 style={sectionTitleStyle}>Cards issued</h2>
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>Player-level card records are available for the current season. Historic seasons retain the match information but not the individual card records.</p>
          <div style={{ overflowX: 'auto' }}><table style={{ ...tableStyle, minWidth: 760 }}><thead><tr>{['Date','Game','Team','Player','Card','Qty'].map((h) => <th key={h} style={thStyle}>{h}</th>)}</tr></thead><tbody>
            {report.cards.map((card, index) => <tr key={`${card.date}-${card.player}-${index}`} style={{ borderBottom: '1px solid var(--line)' }}>
              <td style={tdStyle}>{displayDate(card.date)}</td><td style={tdStyle}>{card.home} v {card.away}</td><td style={tdStyle}>{card.team}</td><td style={tdStyle}>{card.player}</td>
              <td style={tdStyle}><span style={{ ...cardBadgeStyle, ...cardColours(card.kind) }}>{card.kind}</span></td><td style={{ ...tdStyle, textAlign: 'center', fontWeight: 800 }}>{card.count}</td>
            </tr>)}
            {!report.cards.length && <tr><td colSpan="6" style={{ ...tdStyle, padding: 24, textAlign: 'center', color: 'var(--muted)' }}>No player-level card records are available for this selection.</td></tr>}
          </tbody></table></div>
        </section>

        <section style={{ marginTop: 30 }}>
          <h2 style={sectionTitleStyle}>Games officiated</h2>
          <div style={{ overflowX: 'auto' }}><table style={{ ...tableStyle, minWidth: 820 }}><thead><tr>{['Date','Season','Competition','Home team','Away team','Score','Venue','Cards'].map((h) => <th key={h} style={thStyle}>{h}</th>)}</tr></thead><tbody>
            {report.matches.map((match) => {
              const matchCards = report.cards.filter((card) => card.date === match.date && card.home === match.home && card.away === match.away)
              const yellow = matchCards.filter((card) => card.kind === 'Yellow').reduce((sum, card) => sum + card.count, 0)
              const red = matchCards.filter((card) => card.kind === 'Red').reduce((sum, card) => sum + card.count, 0)
              return <tr key={match.id} style={{ borderBottom: '1px solid var(--line)' }}>
                <td style={tdStyle}>{displayDate(match.date)}</td><td style={tdStyle}>{match.season}</td><td style={tdStyle}>{match.competition}</td><td style={tdStyle}>{match.home}</td><td style={tdStyle}>{match.away}</td><td style={{ ...tdStyle, fontWeight: 800 }}>{match.score}</td><td style={tdStyle}>{match.venue || 'Not recorded'}</td>
                <td style={tdStyle}>{yellow > 0 && <span style={{ ...miniCardStyle, background: '#f4c430' }}>{yellow}</span>} {red > 0 && <span style={{ ...miniCardStyle, background: '#b3261e', color: '#fff' }}>{red}</span>}{!yellow && !red ? '—' : ''}</td>
              </tr>
            })}
            {!report.matches.length && <tr><td colSpan="8" style={{ ...tdStyle, padding: 24, textAlign: 'center', color: 'var(--muted)' }}>No games are recorded for this selection.</td></tr>}
          </tbody></table></div>
        </section>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20, marginTop: 30 }}>
          <Breakdown title="Teams officiated" rows={report.teams} />
          <Breakdown title="Venues" rows={report.venues} empty="No venues recorded." />
        </div>
      </>}
    </div>
  )
}

function Stat({ label, value, colour }) {
  return <div style={{ ...statCardStyle, borderTop: `5px solid ${colour || 'var(--brass)'}` }}><div style={{ color: 'var(--muted)', fontSize: 12 }}>{label}</div><div style={{ fontSize: 26, fontWeight: 800 }}>{value}</div></div>
}

function Breakdown({ title, rows, empty = 'No records.' }) {
  return <section><h2 style={sectionTitleStyle}>{title}</h2><div style={{ border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
    {rows.map(([name, count]) => <div key={name} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '9px 12px', borderBottom: '1px solid var(--line)' }}><span>{name}</span><strong>{count}</strong></div>)}
    {!rows.length && <div style={{ padding: 16, color: 'var(--muted)' }}>{empty}</div>}
  </div></section>
}

const panelStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14, padding: 18, border: '1px solid var(--line)', borderRadius: 8, background: '#f7f8f9' }
const labelStyle = { display: 'grid', gap: 6, fontWeight: 700, fontSize: 13 }
const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '11px 12px', border: '1px solid var(--line)', borderRadius: 6, background: '#fff', fontSize: 14 }
const searchResultsStyle = { position: 'absolute', zIndex: 20, top: '100%', left: 0, right: 0, maxHeight: 300, overflowY: 'auto', marginTop: 4, border: '1px solid var(--line)', borderRadius: 6, background: '#fff', boxShadow: '0 8px 24px rgba(0,0,0,.14)' }
const searchResultStyle = { width: '100%', padding: '10px 12px', border: 0, borderBottom: '1px solid var(--line)', background: '#fff', color: 'var(--ink)', textAlign: 'left', cursor: 'pointer', fontSize: 14 }
const buttonStyle = { padding: '11px 15px', border: 0, borderRadius: 6, background: 'var(--ink)', color: '#fff', fontWeight: 700, cursor: 'pointer' }
const statsStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))', gap: 10 }
const statCardStyle = { padding: 14, border: '1px solid var(--line)', borderRadius: 8, background: '#fff' }
const sectionTitleStyle = { fontSize: 18, color: 'var(--brass)', marginBottom: 8 }
const tableStyle = { width: '100%', borderCollapse: 'collapse', fontSize: 13 }
const thStyle = { padding: '9px 8px', textAlign: 'left', color: '#fff', background: 'var(--ink)', whiteSpace: 'nowrap' }
const tdStyle = { padding: '9px 8px', verticalAlign: 'top' }
const cardBadgeStyle = { display: 'inline-block', minWidth: 54, padding: '4px 7px', borderRadius: 4, fontWeight: 800, textAlign: 'center' }
const miniCardStyle = { display: 'inline-block', minWidth: 20, padding: '2px 5px', borderRadius: 3, textAlign: 'center', fontWeight: 800 }
