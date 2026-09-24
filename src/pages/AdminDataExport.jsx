import { useState } from 'react'
import { Link } from 'react-router-dom'
import * as XLSX from 'xlsx'
import { supabase } from '../supabaseClient'

const PAGE_SIZE = 1000

async function fetchAll(table, orderColumn = 'id') {
  const rows = []
  let from = 0

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .order(orderColumn, { ascending: true })
      .range(from, from + PAGE_SIZE - 1)

    if (error) throw new Error(`${table}: ${error.message}`)
    rows.push(...(data || []))
    if (!data || data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  return rows
}

function lookup(rows, value = (row) => row.name) {
  return new Map(rows.map((row) => [row.id, value(row)]))
}

function excelDate(value) {
  if (!value) return ''
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`)
  return Number.isNaN(date.getTime()) ? value : date
}

function excelDateTime(value) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date
}

function addSheet(workbook, name, rows, widths = []) {
  const safeRows = rows.length ? rows : [{ Information: 'No records found' }]
  const sheet = XLSX.utils.json_to_sheet(safeRows, { cellDates: true })
  sheet['!cols'] = widths.map((wch) => ({ wch }))
  sheet['!autofilter'] = { ref: sheet['!ref'] }
  XLSX.utils.book_append_sheet(workbook, sheet, name.slice(0, 31))
}

function downloadWorkbook(fileName, sheets) {
  const workbook = XLSX.utils.book_new()
  sheets.forEach(({ name, rows, widths }) => addSheet(workbook, name, rows, widths))
  XLSX.writeFile(workbook, fileName, { compression: true, cellDates: true })
}

function exportDate() {
  return new Date().toISOString().slice(0, 10)
}

async function loadExportData() {
  const [
    competitions,
    stages,
    groups,
    teams,
    players,
    privatePlayers,
    venues,
    referees,
    refereeContacts,
    fixtures,
    scorers,
    discipline,
    historicFixtures,
    historicScorers,
    historicLeagueTables,
  ] = await Promise.all([
    fetchAll('competitions'),
    fetchAll('stages'),
    fetchAll('groups'),
    fetchAll('teams'),
    fetchAll('players'),
    fetchAll('player_private_details', 'player_id'),
    fetchAll('venues'),
    fetchAll('referees'),
    fetchAll('referee_contacts', 'referee_id'),
    fetchAll('fixtures'),
    fetchAll('fixture_scorers'),
    fetchAll('discipline_records'),
    fetchAll('historic_fixtures'),
    fetchAll('historic_scorers', 'id'),
    fetchAll('historic_league_tables', 'id'),
  ])

  const teamNames = lookup(teams)
  const playerNames = lookup(players, (player) => `${player.first_name || ''} ${player.last_name || ''}`.trim())
  const privateByPlayer = new Map(privatePlayers.map((row) => [row.player_id, row]))
  const contactByReferee = new Map(refereeContacts.map((row) => [row.referee_id, row]))
  const competitionById = new Map(competitions.map((row) => [row.id, row]))
  const stageById = new Map(stages.map((row) => [row.id, row]))
  const groupNames = lookup(groups)
  const fixtureById = new Map(fixtures.map((row) => [row.id, row]))

  const fixtureRows = fixtures.map((fixture) => {
    const stage = stageById.get(fixture.stage_id)
    const competition = competitionById.get(stage?.competition_id)
    return {
      'Fixture ID': fixture.id,
      Season: competition?.season || '',
      Competition: competition?.name || '',
      Stage: stage?.name || '',
      'Stage type': stage?.stage_type || '',
      Group: groupNames.get(fixture.group_id) || '',
      Round: fixture.round_name || '',
      Date: excelDateTime(fixture.fixture_date),
      Status: fixture.status || '',
      'Home team': teamNames.get(fixture.home_team_id) || fixture.home_placeholder || '',
      'Away team': teamNames.get(fixture.away_team_id) || fixture.away_placeholder || '',
      'Home score': fixture.home_score ?? '',
      'Away score': fixture.away_score ?? '',
      'Extra time': fixture.went_to_extra_time ? 'Yes' : 'No',
      'Home ET score': fixture.home_extra_time_score ?? '',
      'Away ET score': fixture.away_extra_time_score ?? '',
      Penalties: fixture.decided_by_penalties ? 'Yes' : 'No',
      'Home penalty score': fixture.home_penalty_score ?? '',
      'Away penalty score': fixture.away_penalty_score ?? '',
      Venue: fixture.venue || '',
      Referee: fixture.referee_name || '',
      'Hidden from public': fixture.hidden_from_public ? 'Yes' : 'No',
      'Week off requested': fixture.week_off_requested ? 'Yes' : 'No',
      'Week-off team': teamNames.get(fixture.week_off_requested_team_id) || '',
      'LeagueRepublic ID': fixture.leaguerepublic_fixture_id || '',
      'Last updated': excelDateTime(fixture.updated_at),
    }
  })

  const playerRows = players.map((player) => ({
    'Player ID': player.id,
    'First name': player.first_name || '',
    'Last name': player.last_name || '',
    'Full name': playerNames.get(player.id),
    'Current team': teamNames.get(player.team_id) || '',
    'Date of birth (private)': excelDate(privateByPlayer.get(player.id)?.date_of_birth),
    'LeagueRepublic person ID': player.leaguerepublic_person_id || '',
    'Player created': excelDateTime(player.created_at),
    'Private record updated': excelDateTime(privateByPlayer.get(player.id)?.updated_at),
  }))

  const scorerRows = scorers.map((scorer) => {
    const fixture = fixtureById.get(scorer.fixture_id)
    const stage = stageById.get(fixture?.stage_id)
    const competition = competitionById.get(stage?.competition_id)
    const oppositionId = scorer.team_id === fixture?.home_team_id ? fixture?.away_team_id : fixture?.home_team_id
    return {
      'Scorer record ID': scorer.id,
      'Fixture ID': scorer.fixture_id,
      Season: competition?.season || '',
      Competition: competition?.name || '',
      Date: excelDateTime(fixture?.fixture_date),
      Player: playerNames.get(scorer.player_id) || '',
      'Player ID': scorer.player_id,
      Team: teamNames.get(scorer.team_id) || '',
      Opponent: teamNames.get(oppositionId) || '',
      Goals: Number(scorer.goals || 0),
      'Home team': teamNames.get(fixture?.home_team_id) || '',
      'Away team': teamNames.get(fixture?.away_team_id) || '',
      'Home score': fixture?.home_score ?? '',
      'Away score': fixture?.away_score ?? '',
    }
  })

  const disciplineRows = discipline.map((record) => {
    const fixture = fixtureById.get(record.fixture_id)
    const stage = stageById.get(fixture?.stage_id)
    const competition = competitionById.get(stage?.competition_id)
    return {
      'Discipline record ID': record.id,
      'Fixture ID': record.fixture_id,
      Season: competition?.season || '',
      Competition: competition?.name || '',
      Date: excelDateTime(fixture?.fixture_date),
      Player: playerNames.get(record.player_id) || '',
      'Player ID': record.player_id,
      Team: teamNames.get(record.team_id) || '',
      'Card type': record.card_type || '',
      Count: record.card_count ?? '',
      'Serious offence': record.serious_offence || '',
      Notes: record.notes || '',
      'Home team': teamNames.get(fixture?.home_team_id) || '',
      'Away team': teamNames.get(fixture?.away_team_id) || '',
    }
  })

  const refereeRows = referees.map((referee) => ({
    'Referee ID': referee.id,
    Name: referee.name,
    'Mobile (private)': contactByReferee.get(referee.id)?.mobile || '',
    'Contact updated': excelDateTime(contactByReferee.get(referee.id)?.updated_at),
  }))

  const teamRows = teams.map((team) => ({
    'Team ID': team.id,
    Name: team.name,
    'Short name': team.short_name || '',
    Manager: team.manager_name || '',
    'LeagueRepublic team ID': team.leaguerepublic_team_id || '',
    'Logo URL': team.logo_url || '',
  }))

  const competitionRows = competitions.map((competition) => ({
    'Competition ID': competition.id,
    Season: competition.season,
    Name: competition.name,
    Slug: competition.slug,
    'Sort order': competition.sort_order,
  }))

  const stageRows = stages.map((stage) => ({
    'Stage ID': stage.id,
    Season: competitionById.get(stage.competition_id)?.season || '',
    Competition: competitionById.get(stage.competition_id)?.name || '',
    Name: stage.name,
    Type: stage.stage_type,
    'Sort order': stage.sort_order,
  }))

  const historicFixtureRows = historicFixtures.map((fixture) => ({
    'Historic fixture ID': fixture.id,
    Season: fixture.season,
    Competition: fixture.competition_name,
    Date: excelDate(fixture.fixture_date),
    'Home team': fixture.home_team_name,
    'Away team': fixture.away_team_name,
    'Home goals': fixture.home_goals,
    'Away goals': fixture.away_goals,
    Referee: fixture.referee_name || '',
    Comment: fixture.comment || '',
    'Current fixture ID': fixture.source_fixture_id || '',
  }))

  const historicScorerRows = historicScorers.map((scorer) => ({
    'Historic scorer ID': scorer.id,
    Season: scorer.season,
    Date: excelDate(scorer.fixture_date),
    Player: scorer.player_name,
    Team: scorer.team_name,
    Goals: Number(scorer.goals || 0),
    'Historic fixture ID': scorer.historic_fixture_id || '',
  }))

  const historicTableRows = historicLeagueTables.map((row) => ({
    Season: row.season,
    Position: row.position,
    Team: row.team_name,
    Played: row.played,
    Won: row.won,
    Drawn: row.drawn,
    Lost: row.lost,
    'Goal difference': row.goal_difference,
    Points: row.points,
  }))

  return {
    fixtures: fixtureRows,
    players: playerRows,
    scorers: scorerRows,
    discipline: disciplineRows,
    referees: refereeRows,
    teams: teamRows,
    venues: venues.map((venue) => ({ 'Venue ID': venue.id, Name: venue.name })),
    competitions: competitionRows,
    stages: stageRows,
    groups: groups.map((group) => ({
      'Group ID': group.id,
      Stage: stageById.get(group.stage_id)?.name || '',
      Name: group.name,
      'Sort order': group.sort_order,
    })),
    historicFixtures: historicFixtureRows,
    historicScorers: historicScorerRows,
    historicTables: historicTableRows,
  }
}

const exports = [
  { key: 'fixtures', title: 'Fixtures', description: 'All scheduled, played, postponed and hidden fixtures, with results and appointments.', sheets: ['fixtures'] },
  { key: 'players', title: 'Players and squads', description: 'Every player, current squad assignment and private date of birth.', sheets: ['players'] },
  { key: 'scoring', title: 'Scoring records', description: 'Match-linked scorers plus historic season records.', sheets: ['scorers', 'historicScorers'] },
  { key: 'discipline', title: 'Discipline', description: 'All yellow, red and serious-offence records linked to fixtures.', sheets: ['discipline'] },
  { key: 'referees', title: 'Referees', description: 'Referee list and private mobile contact details.', sheets: ['referees'] },
  { key: 'reference', title: 'Teams and reference data', description: 'Teams, venues, competitions, stages and groups.', sheets: ['teams', 'venues', 'competitions', 'stages', 'groups'] },
  { key: 'archive', title: 'Archive records', description: 'Historic fixtures, scorers and league tables.', sheets: ['historicFixtures', 'historicScorers', 'historicTables'] },
]

const sheetSettings = {
  fixtures: ['Fixtures', [38, 12, 30, 22, 14, 18, 18, 20, 14, 28, 28, 12, 12, 12, 14, 14, 12, 18, 18, 28, 24, 18, 18, 30, 20, 20]],
  players: ['Players - Private', [38, 18, 18, 30, 30, 20, 24, 20, 22]],
  scorers: ['Match Scorers', [38, 38, 12, 30, 20, 30, 38, 28, 28, 10, 28, 28, 12, 12]],
  discipline: ['Discipline', [38, 38, 12, 30, 20, 30, 38, 28, 15, 10, 28, 36, 28, 28]],
  referees: ['Referees - Private', [38, 28, 22, 22]],
  teams: ['Teams', [38, 30, 18, 28, 24, 45]],
  venues: ['Venues', [38, 34]],
  competitions: ['Competitions', [38, 12, 34, 32, 12]],
  stages: ['Stages', [38, 12, 34, 26, 16, 12]],
  groups: ['Groups', [38, 28, 24, 12]],
  historicFixtures: ['Historic Fixtures', [38, 12, 30, 16, 28, 28, 12, 12, 26, 40, 38]],
  historicScorers: ['Historic Scorers', [22, 12, 16, 30, 28, 10, 38]],
  historicTables: ['Historic Tables', [12, 12, 30, 10, 10, 10, 10, 16, 10]],
}

function selectedSheets(data, keys) {
  return keys.map((key) => ({ name: sheetSettings[key][0], rows: data[key], widths: sheetSettings[key][1] }))
}

export default function AdminDataExport() {
  const [working, setWorking] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function runExport(item) {
    setWorking(item.key)
    setError('')
    setMessage('')
    try {
      const data = await loadExportData()
      const prefix = item.key === 'complete' ? 'ecfa-complete-admin-data' : `ecfa-${item.key}`
      downloadWorkbook(`${prefix}-${exportDate()}.xlsx`, selectedSheets(data, item.sheets))
      setMessage(`${item.title} workbook downloaded.`)
    } catch (exportError) {
      setError(`The export could not be created. ${exportError.message}`)
    } finally {
      setWorking('')
    }
  }

  const allSheetKeys = Object.keys(sheetSettings)

  return (
    <div className="container" style={{ padding: '32px 20px 56px', maxWidth: 820 }}>
      <Link to="/admin/dashboard" style={backStyle}>← Back to admin</Link>
      <h1 style={{ fontSize: 34, margin: '20px 0 8px' }}>Admin data exports</h1>
      <p style={{ color: 'var(--muted)', lineHeight: 1.55, margin: '0 0 18px' }}>
        Download the website records as Excel workbooks for checking, reconciliation and secure administration.
      </p>

      <div style={privateNoticeStyle}>
        <strong>Private administrator data.</strong> Player dates of birth and referee mobile numbers are included in the relevant exports. Store and share these files securely.
      </div>

      {(error || message) && (
        <div style={{ ...noticeStyle, color: error ? '#B3261E' : '#176B3A', borderColor: error ? '#B3261E' : '#176B3A' }}>
          {error || message}
        </div>
      )}

      <section style={{ ...cardStyle, borderColor: 'var(--brass)', marginBottom: 24 }}>
        <h2 style={titleStyle}>Complete admin workbook</h2>
        <p style={descriptionStyle}>One Excel file containing every export below in separate worksheets.</p>
        <button
          type="button"
          onClick={() => runExport({ key: 'complete', title: 'Complete admin', sheets: allSheetKeys })}
          disabled={!!working}
          style={primaryButtonStyle}
        >
          {working === 'complete' ? 'Preparing all records…' : 'Download complete Excel workbook'}
        </button>
      </section>

      <h2 style={{ fontSize: 22, margin: '0 0 14px' }}>Focused exports</h2>
      <div style={{ display: 'grid', gap: 14 }}>
        {exports.map((item) => (
          <section key={item.key} style={cardStyle}>
            <h3 style={titleStyle}>{item.title}</h3>
            <p style={descriptionStyle}>{item.description}</p>
            <button type="button" onClick={() => runExport(item)} disabled={!!working} style={secondaryButtonStyle}>
              {working === item.key ? 'Preparing…' : `Download ${item.title} Excel`}
            </button>
          </section>
        ))}
      </div>
    </div>
  )
}

const backStyle = { color: 'var(--brass)', textDecoration: 'none', fontWeight: 700 }
const cardStyle = { border: '1px solid var(--line)', borderRadius: 10, padding: 20, background: '#fff' }
const titleStyle = { fontSize: 20, margin: '0 0 6px' }
const descriptionStyle = { color: 'var(--muted)', lineHeight: 1.5, margin: '0 0 16px' }
const primaryButtonStyle = { width: '100%', border: 0, borderRadius: 7, padding: '13px 16px', background: '#111', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer' }
const secondaryButtonStyle = { ...primaryButtonStyle, background: '#fff', color: '#111', border: '1px solid #111' }
const privateNoticeStyle = { border: '1px solid #D69B25', borderRadius: 8, padding: 14, background: '#FFF9EA', color: '#614600', lineHeight: 1.5, marginBottom: 18 }
const noticeStyle = { border: '1px solid', borderRadius: 8, padding: 12, marginBottom: 18, background: '#fff' }
