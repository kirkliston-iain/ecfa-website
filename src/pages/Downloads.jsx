import { useState } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../supabaseClient'

const PAGE_SIZE = 1000

async function fetchAll(table, select = '*') {
  let from = 0
  let rows = []
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    rows = rows.concat(data || [])
    if (!data || data.length < PAGE_SIZE) return rows
    from += PAGE_SIZE
  }
}

function csvCell(value) {
  const text = value == null ? '' : String(value)
  return `"${text.replace(/"/g, '""')}"`
}

function downloadExcel(filename, rows) {
  if (!rows.length) throw new Error('There is no data available for this download.')

  const worksheet = XLSX.utils.json_to_sheet(rows)
  const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row))))
  worksheet['!cols'] = columns.map((column) => ({
    wch: Math.min(
      50,
      Math.max(
        column.length + 2,
        ...rows.slice(0, 500).map((row) => String(row[column] ?? '').length + 2)
      )
    ),
  }))
  worksheet['!autofilter'] = { ref: worksheet['!ref'] }

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'ECFA Data')
  const bytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })

  downloadFile(
    filename,
    bytes,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  )
}

function downloadCsv(filename, rows) {
  if (!rows.length) throw new Error('There is no data available for this download.')
  const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row))))
  const csv = [
    columns.map(csvCell).join(','),
    ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(',')),
  ].join('\r\n')
  downloadFile(filename, `\uFEFF${csv}`, 'text/csv;charset=utf-8')
}

function downloadFile(filename, contents, type) {
  const blob = new Blob([contents], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function todayStamp() {
  return new Date().toISOString().slice(0, 10)
}

async function currentScorers() {
  const rows = await fetchAll(
    'fixture_scorers',
    'goals, player:player_id(first_name, last_name), team:team_id(name)'
  )
  const totals = {}
  for (const row of rows) {
    const player = `${row.player?.first_name || ''} ${row.player?.last_name || ''}`.trim()
    const team = row.team?.name || ''
    const key = `${player}::${team}`
    if (!totals[key]) totals[key] = { player, team, goals: 0 }
    totals[key].goals += Number(row.goals || 0)
  }
  return Object.values(totals).sort((a, b) => b.goals - a.goals || a.player.localeCompare(b.player))
}

async function historicScorers() {
  const rows = await fetchAll('historic_scorers', 'season, player_name, team_name, goals')
  return rows
    .map((row) => ({
      season: row.season,
      player: row.player_name,
      team: row.team_name,
      goals: row.goals,
    }))
    .sort((a, b) => String(b.season).localeCompare(String(a.season)) || Number(b.goals) - Number(a.goals))
}

async function currentResults() {
  const rows = await fetchAll(
    'fixtures',
    'fixture_date, round_name, venue, referee_name, home_score, away_score, status, home_team:home_team_id(name), away_team:away_team_id(name), stage:stage_id(name, competition:competition_id(name, season))'
  )
  return rows.map((row) => ({
    season: row.stage?.competition?.season || '',
    competition: row.stage?.competition?.name || '',
    stage: row.stage?.name || '',
    round: row.round_name || '',
    date: row.fixture_date || '',
    home_team: row.home_team?.name || '',
    away_team: row.away_team?.name || '',
    home_score: row.home_score,
    away_score: row.away_score,
    status: row.status,
    venue: row.venue || '',
    referee: row.referee_name || '',
  }))
}

async function historicResults() {
  const rows = await fetchAll('historic_fixtures')
  return rows.map((row) => ({
    season: row.season,
    competition: row.competition_name,
    date: row.fixture_date,
    home_team: row.home_team_name,
    away_team: row.away_team_name,
    home_score: row.home_goals,
    away_score: row.away_goals,
    venue: row.venue || '',
    referee: row.referee_name || '',
  }))
}

async function refereeStats() {
  const fixtures = await fetchAll(
    'fixtures',
    'id, fixture_date, round_name, venue, referee_name, home_score, away_score, status, home_team:home_team_id(name), away_team:away_team_id(name), stage:stage_id(name, competition:competition_id(name, season))'
  )
  const played = fixtures.filter((fixture) => fixture.status === 'played' && fixture.referee_name)
  const fixtureIds = new Set(played.map((fixture) => fixture.id))
  const cards = await fetchAll('discipline_records', 'fixture_id, card_count')
  const cardsByFixture = {}
  for (const card of cards) {
    if (!fixtureIds.has(card.fixture_id)) continue
    cardsByFixture[card.fixture_id] = (cardsByFixture[card.fixture_id] || 0) + Number(card.card_count || 0)
  }
  return played.map((fixture) => ({
    referee: fixture.referee_name,
    season: fixture.stage?.competition?.season || '',
    competition: fixture.stage?.competition?.name || '',
    stage: fixture.stage?.name || '',
    round: fixture.round_name || '',
    date: fixture.fixture_date,
    home_team: fixture.home_team?.name || '',
    away_team: fixture.away_team?.name || '',
    score: `${fixture.home_score ?? ''}-${fixture.away_score ?? ''}`,
    venue: fixture.venue || '',
    cards: cardsByFixture[fixture.id] || 0,
  }))
}

const PUBLIC_TABLES = [
  'competitions',
  'stages',
  'groups',
  'teams',
  'stage_teams',
  'fixtures',
  'players',
  'fixture_scorers',
  'historic_scorers',
  'historic_fixtures',
  'historic_league_tables',
  'honours',
  'site_stats',
  'referees',
  'venues',
  'calendar_events',
]

const DOWNLOADS = [
  {
    title: 'Current-season scorers',
    description: 'Every scorer and their current-season goal total.',
    filename: 'ecfa-current-scorers.csv',
    load: currentScorers,
  },
  {
    title: 'Historical scorers',
    description: 'Scoring records by player, team and season.',
    filename: 'ecfa-historical-scorers.csv',
    load: historicScorers,
  },
  {
    title: 'Current-season fixtures and results',
    description: 'All scheduled and played fixtures, scores, venues and referees.',
    filename: 'ecfa-current-results.csv',
    load: currentResults,
  },
  {
    title: 'Previous-season results',
    description: 'The complete historical fixture and result archive.',
    filename: 'ecfa-historical-results.csv',
    load: historicResults,
  },
  {
    title: 'Referee match statistics',
    description: 'Games, teams, venues, results and total cards for each referee.',
    filename: 'ecfa-referee-statistics.csv',
    load: refereeStats,
  },
]

export default function Downloads() {
  const [working, setWorking] = useState('')
  const [error, setError] = useState('')

  async function runDownload(item, format) {
    setWorking(`${item.title}-${format}`)
    setError('')
    try {
      const rows = await item.load()
      if (format === 'excel') {
        downloadExcel(item.filename.replace(/\.csv$/, '.xlsx'), rows)
      } else {
        downloadCsv(item.filename, rows)
      }
    } catch (err) {
      setError(err.message || 'The download could not be created.')
    } finally {
      setWorking('')
    }
  }

  async function downloadEverything() {
    setWorking('Complete public archive')
    setError('')
    try {
      const entries = await Promise.all(
        PUBLIC_TABLES.map(async (table) => [table, await fetchAll(table)])
      )
      const archive = {
        exported_at: new Date().toISOString(),
        description: 'ECFA public website data archive',
        data: Object.fromEntries(entries),
      }
      downloadFile(
        `ecfa-public-data-${todayStamp()}.json`,
        JSON.stringify(archive, null, 2),
        'application/json;charset=utf-8'
      )
    } catch (err) {
      setError(err.message || 'The archive could not be created.')
    } finally {
      setWorking('')
    }
  }

  return (
    <div className="container" style={{ padding: '32px 20px 48px', maxWidth: 760 }}>
      <h1 style={{ fontSize: 30, marginBottom: 4 }}>Downloads</h1>
      <p style={{ color: 'var(--muted)', marginBottom: 28 }}>
        Download ECFA statistics and historical records for your own analysis.
      </p>

      {error && (
        <div style={{ padding: 12, marginBottom: 16, border: '1px solid #B3261E', borderRadius: 6, color: '#B3261E' }}>
          {error}
        </div>
      )}

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 18, marginBottom: 10 }}>League documents</h2>
        <div style={cardStyle}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>ECFA League Handbook 2026/27</div>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>
              Official league rules, procedures, competition formats and manager guidance.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <a href="/documents/ECFA-League-Handbook-2026-27.pdf" target="_blank" rel="noreferrer" style={{ ...buttonStyle, textDecoration: 'none' }}>
              View PDF
            </a>
            <a href="/documents/ECFA-League-Handbook-2026-27.pdf" download style={{ ...buttonStyle, textDecoration: 'none' }}>
              Download PDF
            </a>
            <a href="/documents/ECFA-League-Handbook-2026-27.docx" download style={{ ...buttonStyle, textDecoration: 'none' }}>
              Download Word
            </a>
          </div>
        </div>
      </section>

      <div style={{ display: 'grid', gap: 12 }}>
        {DOWNLOADS.map((item) => (
          <div key={item.title} style={cardStyle}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>{item.title}</div>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>{item.description}</div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                onClick={() => runDownload(item, 'csv')}
                disabled={!!working}
                style={buttonStyle}
              >
                {working === `${item.title}-csv` ? 'Preparing…' : 'CSV'}
              </button>
              <button
                onClick={() => runDownload(item, 'excel')}
                disabled={!!working}
                style={buttonStyle}
              >
                {working === `${item.title}-excel` ? 'Preparing…' : 'Excel'}
              </button>
            </div>
          </div>
        ))}
      </div>

      <section style={{ marginTop: 34, paddingTop: 24, borderTop: '3px solid var(--brass)' }}>
        <h2 style={{ fontSize: 18, marginBottom: 6 }}>Complete public data archive</h2>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14 }}>
          A single JSON download containing competitions, stages, teams, players, fixtures,
          scorers, historical results, league tables, honours, referees, venues and calendar
          information. Private admin and disciplinary data is excluded.
        </p>
        <button onClick={downloadEverything} disabled={!!working} style={{ ...buttonStyle, width: '100%' }}>
          {working === 'Complete public archive' ? 'Preparing archive…' : 'Download everything'}
        </button>
      </section>
    </div>
  )
}

const cardStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 16,
  padding: 16,
  border: '1px solid var(--line)',
  borderRadius: 8,
  background: '#fff',
  flexWrap: 'wrap',
}

const buttonStyle = {
  padding: '10px 14px',
  border: 'none',
  borderRadius: 6,
  background: 'var(--ink)',
  color: '#fff',
  fontWeight: 700,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}
