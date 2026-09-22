import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'

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
  const [loading, setLoading] = useState(true)
  const [historic, setHistoric] = useState([])
  const [current, setCurrent] = useState([])
  const [teamLogos, setTeamLogos] = useState({})
  const [playerDirectory, setPlayerDirectory] = useState([])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)

      const hist = await fetchAllHistoricScorers()

      const [{ data: scorers }, { data: teams }, { data: directoryPlayers }] = await Promise.all([
        supabase
          .from('fixture_scorers')
          .select('goals, player:player_id(id, first_name, last_name), team:team_id(name)'),
        supabase.from('teams').select('name, logo_url'),
        supabase.from('players').select('id, first_name, last_name, team_id').order('last_name').order('first_name'),
      ])

      if (!cancelled) {
        setHistoric(hist || [])
        setCurrent(
          (scorers || []).map((s) => ({
            player_id: s.player?.id || null,
            player_name: `${s.player?.first_name || ''} ${s.player?.last_name || ''}`.trim(),
            team_name: s.team?.name || '',
            goals: Number(s.goals),
          }))
        )
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

    const sourceRows = season === 'overall'
      ? [...historic, ...current]
      : season === '2026/27'
        ? current
        : historic.filter((row) => row.season === season)

    const totals = {}
    const displayNames = {}
    const teamOf = {}
    for (const row of sourceRows) {
      const key = playerKey(row.player_name)
      if (!key) continue
      totals[key] = (totals[key] || 0) + Number(row.goals || 0)
      displayNames[key] = key === 'darran taylor' ? 'Darran Taylor' : rosterNames[key] || displayNames[key] || canonicalPlayerName(row.player_name)
      if (row.team_name) teamOf[key] = row.team_name
    }

    return Object.entries(totals)
      .map(([key, goals]) => ({
        player_name: displayNames[key],
        player_id: rosterIds[key] || null,
        team_name: teamOf[key] || '',
        goals,
      }))
      .sort((a, b) => b.goals - a.goals)
  }, [season, historic, current, playerDirectory])

  const visibleRows = playerSearch
    ? rows.filter((row) => playerKey(row.player_name) === playerKey(playerSearch))
    : rows

  const playerSeasonRows = useMemo(() => {
    if (!playerSearch) return []
    const searchedKey = playerKey(playerSearch)
    const totals = new Map()
    const addRow = (seasonName, teamName, goals) => {
      const cleanSeason = String(seasonName || 'Unknown').replace('-', '/')
      const cleanTeam = String(teamName || 'Team not recorded').trim()
      const key = `${cleanSeason.toLocaleLowerCase('en-GB')}::${cleanTeam.toLocaleLowerCase('en-GB')}`
      const existing = totals.get(key)
      if (existing) existing.goals += Number(goals || 0)
      else totals.set(key, { season: cleanSeason, team_name: cleanTeam, goals: Number(goals || 0) })
    }

    for (const row of historic) {
      if (playerKey(row.player_name) === searchedKey) addRow(row.season, row.team_name, row.goals)
    }
    for (const row of current) {
      if (playerKey(row.player_name) === searchedKey) addRow(CURRENT_SEASON, row.team_name, row.goals)
    }

    return [...totals.values()].sort((left, right) => {
      const seasonOrder = right.season.localeCompare(left.season, 'en-GB', { numeric: true })
      return seasonOrder || left.team_name.localeCompare(right.team_name, 'en-GB')
    })
  }, [playerSearch, historic, current])

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
      <h1 style={{ fontSize: 30, marginBottom: 4 }}>Scorers</h1>
      <p style={{ color: 'var(--muted)', marginBottom: 24 }}>{seasonLabel}</p>

      <select
        value={season}
        onChange={(e) => setSeason(e.target.value)}
        style={{
          marginBottom: 28,
          padding: '8px 12px',
          fontSize: 14,
          borderRadius: 6,
          border: '1px solid var(--line)',
          background: '#fff',
        }}
      >
        {SEASON_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      {playerSearch && (
        <div style={{ marginBottom: 18, padding: '10px 12px', background: '#f5f8fa', border: '1px solid var(--line)', borderRadius: 6, fontSize: 14 }}>
          Showing scorer history for <strong>{playerSearch}</strong>. <Link to="/scorers" style={{ color: 'var(--brass)', fontWeight: 700 }}>Show all</Link>
        </div>
      )}


      {playerSearch && playerSeasonRows.length > 0 && (
        <section style={{ marginBottom: 28 }}>
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
                <th style={thStyle()}>Goals</th>
              </tr>
            </thead>
            <tbody>
              {playerSeasonRows.map((row) => (
                <tr key={`${row.season}-${row.team_name}`} style={{ borderBottom: '1px solid var(--line)' }}>
                  <td style={{ padding: '10px 8px' }}>{row.season}</td>
                  <td style={{ padding: '10px 8px' }}>{row.team_name}</td>
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
                {row.player_id ? (
                  <Link to={`/players/${row.player_id}`} style={{ color: 'var(--ink)' }}>{row.player_name}</Link>
                ) : (
                  <Link to={`/scorers?player=${encodeURIComponent(row.player_name)}`} style={{ color: 'var(--ink)' }}>{row.player_name}</Link>
                )}
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
                No scorers recorded for this season.
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
