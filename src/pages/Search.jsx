import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'

const SITE_PAGES = [
  { label: 'Match Hub', description: 'Fixtures and results by date', to: '/' },
  { label: 'Competitions', description: 'Tables, fixtures, results and next-round possibilities', to: '/standings' },
  { label: 'Scorers', description: 'Current and historical goalscorers', to: '/scorers' },
  { label: 'Honours', description: 'ECFA competition winners', to: '/honours' },
  { label: 'History', description: 'Previous seasons and results', to: '/history' },
  { label: 'Teams', description: 'Team pages, squads, managers and fixtures', to: '/teams' },
  { label: 'Referees', description: 'Officials, games, venues and cards', to: '/referees' },
  { label: 'Sponsors', description: 'ECFA competition sponsors', to: '/sponsors' },
  { label: 'Charity', description: 'League and team charity events by season', to: '/charity' },
  { label: 'Downloads', description: 'Download ECFA statistics and the league handbook', to: '/downloads' },
  { label: 'Web Stats', description: 'Website page-view statistics', to: '/web-stats' },
  { label: 'Contact Us', description: 'General queries and sponsorship enquiries', to: '/contact' },
]

function includes(value, query) {
  return String(value || '').toLowerCase().includes(query.toLowerCase())
}

const PLAYER_SEARCH_ALIASES = {
  'darran taylor': ['darran taylor', 'darron taylor', 'darron cairns'],
}

function playerMatches(name, query) {
  if (includes(name, query)) return true
  const aliases = PLAYER_SEARCH_ALIASES[String(name || '').trim().toLowerCase()] || []
  return aliases.some((alias) => includes(alias, query))
}

function ResultGroup({ title, rows }) {
  if (!rows.length) return null
  return (
    <section style={{ marginBottom: 28 }}>
      <h2 style={headingStyle}>{title}</h2>
      <div style={{ borderTop: '1px solid var(--line)' }}>
        {rows.map((row) => (
          <Link key={row.key || row.to} to={row.to} style={resultStyle}>
            <span>
              <strong style={{ display: 'block', color: 'var(--ink)' }}>{row.label}</strong>
              {row.description && <span style={{ color: 'var(--muted)', fontSize: 13 }}>{row.description}</span>}
            </span>
            <span aria-hidden="true" style={{ color: 'var(--brass)', fontWeight: 800 }}>→</span>
          </Link>
        ))}
      </div>
    </section>
  )
}

export default function Search() {
  const [params, setParams] = useSearchParams()
  const [input, setInput] = useState(params.get('q') || '')
  const query = (params.get('q') || '').trim()
  const [loading, setLoading] = useState(false)
  const [dynamic, setDynamic] = useState({ players: [], referees: [], teams: [], competitions: [] })
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function run() {
      if (query.length < 2) {
        setDynamic({ players: [], referees: [], teams: [], competitions: [] })
        return
      }
      setLoading(true)
      setError('')

      const pattern = `%${query}%`
      const [playersResult, historicResult, refereesResult, teamsResult, competitionsResult] = await Promise.all([
        supabase.from('players').select('id, first_name, last_name, team:team_id(name)').limit(1000),
        supabase.from('historic_scorers').select('player_name, team_name, season').ilike('player_name', pattern).limit(100),
        supabase.from('referees').select('id, name').ilike('name', pattern).order('name').limit(20),
        supabase.from('teams').select('id, name, manager_name').or(`name.ilike.${pattern},manager_name.ilike.${pattern}`).order('name').limit(20),
        supabase.from('competitions').select('slug, name, season').ilike('name', pattern).order('name').limit(20),
      ])

      const failed = [playersResult, historicResult, refereesResult, teamsResult, competitionsResult].find((result) => result.error)
      if (failed) {
        if (!cancelled) setError('Search could not be completed. Please try again.')
        setLoading(false)
        return
      }

      const playerMap = new Map()
      for (const player of playersResult.data || []) {
        const name = `${player.first_name || ''} ${player.last_name || ''}`.trim()
        if (!playerMatches(name, query)) continue
        playerMap.set(name.toLowerCase(), {
          key: `current-${player.id}`,
          label: name,
          description: player.team?.name ? `Player · ${player.team.name}` : 'Player',
          to: `/players/${player.id}`,
        })
      }
      for (const player of historicResult.data || []) {
        const key = String(player.player_name || '').toLowerCase()
        if (!key || playerMap.has(key)) continue
        playerMap.set(key, {
          key: `historic-${key}`,
          label: player.player_name,
          description: player.team_name ? `Historical scorer · ${player.team_name}` : 'Historical scorer',
          to: `/scorers?player=${encodeURIComponent(player.player_name)}`,
        })
      }

      if (!cancelled) {
        setDynamic({
          players: Array.from(playerMap.values()).slice(0, 20),
          referees: (refereesResult.data || []).map((referee) => ({
            key: referee.id,
            label: referee.name,
            description: 'Referee',
            to: `/referees?ref=${encodeURIComponent(referee.name)}`,
          })),
          teams: (teamsResult.data || []).map((team) => ({
            key: team.id,
            label: team.name,
            description: team.manager_name ? `Team · Manager: ${team.manager_name}` : 'Team',
            to: `/teams/${team.id}`,
          })),
          competitions: (competitionsResult.data || []).map((competition) => ({
            key: competition.slug,
            label: competition.name,
            description: competition.season ? `Competition · ${competition.season}` : 'Competition',
            to: `/competitions/${competition.slug}`,
          })),
        })
      }
      setLoading(false)
    }
    run()
    return () => { cancelled = true }
  }, [query])

  const pages = useMemo(() => {
    if (query.length < 2) return []
    return SITE_PAGES.filter((page) => includes(page.label, query) || includes(page.description, query))
  }, [query])

  const total = pages.length + dynamic.players.length + dynamic.referees.length + dynamic.teams.length + dynamic.competitions.length

  function submit(event) {
    event.preventDefault()
    const next = input.trim()
    setParams(next ? { q: next } : {})
  }

  return (
    <div className="container" style={{ padding: '32px 20px 48px', maxWidth: 760 }}>
      <h1 style={{ fontSize: 30, marginBottom: 4 }}>Search</h1>
      <p style={{ color: 'var(--muted)', marginBottom: 22 }}>
        Find players, referees, teams, competitions and pages across the ECFA website.
      </p>

      <form onSubmit={submit} style={{ display: 'flex', gap: 8, marginBottom: 30 }}>
        <input
          type="search"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Search for a name or subject…"
          aria-label="Search the ECFA website"
          autoFocus
          style={inputStyle}
        />
        <button type="submit" style={buttonStyle}>Search</button>
      </form>

      {!query && <p style={{ color: 'var(--muted)' }}>Enter at least two letters to begin.</p>}
      {query.length === 1 && <p style={{ color: 'var(--muted)' }}>Enter one more letter to search.</p>}
      {loading && <p style={{ color: 'var(--muted)' }}>Searching…</p>}
      {error && <p style={{ color: '#B3261E' }}>{error}</p>}

      {!loading && !error && query.length >= 2 && (
        <>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 22 }}>
            {total === 0 ? `No results for “${query}”.` : `${total} result${total === 1 ? '' : 's'} for “${query}”.`}
          </p>
          <ResultGroup title="Players" rows={dynamic.players} />
          <ResultGroup title="Referees" rows={dynamic.referees} />
          <ResultGroup title="Teams and managers" rows={dynamic.teams} />
          <ResultGroup title="Competitions" rows={dynamic.competitions} />
          <ResultGroup title="Website sections" rows={pages} />
        </>
      )}
    </div>
  )
}

const headingStyle = {
  color: 'var(--brass)',
  fontSize: 15,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  marginBottom: 10,
}

const resultStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 16,
  padding: '12px 4px',
  borderBottom: '1px solid var(--line)',
}

const inputStyle = {
  flex: 1,
  minWidth: 0,
  padding: '12px 14px',
  border: '1px solid var(--line)',
  borderRadius: 6,
  fontSize: 16,
  background: '#fff',
}

const buttonStyle = {
  border: 0,
  borderRadius: 6,
  padding: '0 18px',
  background: 'var(--brass)',
  color: '#fff',
  fontWeight: 800,
  cursor: 'pointer',
}
