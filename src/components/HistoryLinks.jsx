import { createContext, useContext, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { teamHistoryUrl, competitionHistoryUrl } from '../utils/historyLinks'
import { isVenueLinkable, venueHistoryUrl } from '../utils/venueGrouping'

const Directory = createContext({ teams: [], competitions: [] })
export const historyLinkStyle = { color: 'inherit', textDecoration: 'underline', textDecorationColor: 'var(--brass)', textUnderlineOffset: 3 }

export function HistoryDirectory({ children }) {
  const [directory, setDirectory] = useState({ teams: [], competitions: [] })
  useEffect(() => {
    let cancelled = false
    Promise.all([supabase.from('teams').select('id, name'), supabase.from('competitions').select('name, slug, season')])
      .then(([teams, competitions]) => { if (!cancelled) setDirectory({ teams: teams.data || [], competitions: competitions.data || [] }) })
    return () => { cancelled = true }
  }, [])
  return <Directory.Provider value={directory}>{children}</Directory.Provider>
}

export function TeamHistoryLink({ name, id, children, style, ...props }) {
  const { teams } = useContext(Directory)
  const to = id ? `/teams/${id}` : teamHistoryUrl(name, null, teams)
  return to ? <Link to={to} style={{ ...historyLinkStyle, ...style }} {...props}>{children || name}</Link> : <span>{children || name || 'TBC'}</span>
}

export function PlayerHistoryLink({ name, id, children, style, ...props }) {
  const to = id ? `/players/${id}` : name ? `/goalscorers?player=${encodeURIComponent(name)}` : null
  return to ? <Link to={to} style={{ ...historyLinkStyle, ...style }} {...props}>{children || name}</Link> : <span>{children || name}</span>
}

export function CompetitionHistoryLink({ name, season, children, style }) {
  const { competitions } = useContext(Directory)
  return <Link to={competitionHistoryUrl(name, season, competitions)} style={{ ...historyLinkStyle, ...style }}>{children || name}</Link>
}

export function VenueHistoryLink({ name, children, style }) {
  return isVenueLinkable(name) ? <Link to={venueHistoryUrl(name)} style={{ ...historyLinkStyle, ...style }}>{children || name}</Link> : <span>{children || name}</span>
}

export function HistoryBack({ fallback = '/', children = '← Back' }) {
  const navigate = useNavigate()
  return <button type="button" onClick={() => window.history.state?.idx > 0 ? navigate(-1) : navigate(fallback)} style={{ border: 0, padding: 0, background: 'none', color: 'var(--brass)', font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer', marginBottom: 18 }}>{children}</button>
}
