import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { createRefereeClient, supabase } from '../supabaseClient'
import './RefereeProfiles.css'
import { summariseRefereeCards } from '../utils/refereeCardSummary.mjs'
const SESSION_KEY = 'ecfa-referee-portal-session'
export default function RefereeLogin() {
  const [token, setToken] = useState(() => sessionStorage.getItem(SESSION_KEY) || '')
  const [code, setCode] = useState('')
  const [report, setReport] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [season, setSeason] = useState('all')
  const [refereeId, setRefereeId] = useState('')
  useEffect(() => {
    if (!token) { setReport(null); return }
    let cancelled = false
    setBusy(true)
    createRefereeClient(token).rpc('referee_portal_dashboard', { p_referee_id: refereeId || null }).then(({ data, error: failure }) => {
      if (cancelled) return
      setBusy(false)
      if (failure) { setError('Your referee session has expired. Please sign in again.'); sessionStorage.removeItem(SESSION_KEY); setToken('') }
      else { setReport(data); setError('') }
    })
    return () => { cancelled = true }
  }, [token, refereeId])
  async function login(event) {
    event.preventDefault(); setBusy(true); setError('')
    const { data, error: failure } = await supabase.rpc('referee_portal_login', { p_code: code.trim() })
    setBusy(false)
    if (failure || !data?.token) { setError('Code not recognised. Please check it or ask the league administrator for a new code.'); return }
    sessionStorage.setItem(SESSION_KEY, data.token); setToken(data.token); setCode('')
  }
  async function logout() {
    setBusy(true)
    const { error: failure } = await createRefereeClient(token).rpc('referee_portal_logout')
    sessionStorage.removeItem(SESSION_KEY); setToken(''); setReport(null); setBusy(false)
    setError(failure ? 'Signed out on this device. The session will also expire automatically.' : '')
  }
  const matches = (report?.matches || []).filter(match => season === 'all' || match.season === season)
  const summary = summariseRefereeCards(matches)
  const seasons = [...new Set([report?.since_season, report?.season?.replace('-', '/'), ...(report?.matches || []).map(m => m.season)].filter(Boolean))].sort().reverse()
  const average = value => value == null ? '—' : value.toFixed(2)
  const matchUrl = match => match.source === 'historic' ? '/archive?season=' + encodeURIComponent(match.season) : '/fixtures/' + match.id
  return <div className="container ref-area">
    <Link to="/referees">← Referees</Link><h1>{report ? 'Referee card dashboard' : 'Referee login'}</h1>
    {!token && <form onSubmit={login} className="ref-panel"><p>Enter the referee portal code to view card records and averages for all referees.</p><label className="ref-field">Your login code<input required autoComplete="off" type="password" value={code} onChange={(e) => setCode(e.target.value)} /></label><button className="ref-primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button></form>}
    {busy && token && <p role="status">Loading your dashboard…</p>}
    {error && <p role="alert">{error}</p>}
    {report && <><div className="ref-actions"><h2>{report.referee}</h2><button disabled={busy} onClick={logout}>Sign out</button></div>
      <p className="ref-muted">Available to referees signed in with the portal code · Recorded cards from {report.since_season} onwards.</p>
      <label className="ref-field">Referee<select disabled={busy} value={refereeId || report.referee_id} onChange={event => setRefereeId(event.target.value)}>{(report.referees || []).map(ref => <option key={ref.id} value={ref.id}>{ref.name}</option>)}</select></label>
      <label className="ref-field">Season<select value={season} onChange={event => setSeason(event.target.value)}><option value="all">All seasons since {report.since_season}</option>{seasons.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
      {report.history_notice && <p className="ref-muted" role="status">{report.history_notice}</p>}
      <div className="ref-summary">{[['Completed games',summary.games],['Yellow cards',summary.yellow],['Red cards',summary.red],['Total cards',summary.total],['Cards per game',average(summary.average)],['Yellow per game',average(summary.yellowAverage)],['Red per game',average(summary.redAverage)]].map(([label,value]) => <div className="ref-panel" key={label}><small>{label}</small><strong>{!summary.games && ['Yellow cards','Red cards','Total cards'].includes(label) ? '—' : value}</strong></div>)}</div>
      <p className="ref-muted">Averages include all linked completed games for the selected referee, including games with no recorded cards. Missing referee assignments or card entries can affect these figures.</p>
      <h2>Cards by player</h2>
      <CardTable rows={summary.players} kind="player" />
      <h2>Cards by team</h2>
      <CardTable rows={summary.teams} kind="team" />
      <h2>Cards by game</h2>{!matches.length && <p className="ref-muted">No linked completed games are available for this selection.</p>}
      {matches.map(match => <details className="ref-panel" key={match.source + match.id}><summary style={{cursor:'pointer'}}><strong>{match.home} v {match.away}</strong><small style={{display:'block',marginTop:4}}>{new Date(match.fixture_date).toLocaleDateString('en-GB')} · {match.season} · {match.yellow} yellow · {match.red} red</small></summary>
        <p className="ref-muted">{match.competition} · Result: {match.home_score}–{match.away_score} · <Link to={matchUrl(match)}>View match history →</Link></p>
        {!(match.cards || []).length ? <p className="ref-muted">No cards recorded for this game.</p> : <div className="ref-card-table-wrap"><table className="ref-card-table"><thead><tr><th>Player</th><th>Team</th><th>Card</th><th>Count</th></tr></thead><tbody>{match.cards.map(card => <tr key={card.id}><td>{card.player_id ? <Link to={'/players/'+card.player_id}>{card.player}</Link> : card.player}</td><td>{card.team_id ? <Link to={'/teams/'+card.team_id}>{card.team}</Link> : card.team}</td><td>{card.type === 'red' ? 'Red' : 'Yellow'}</td><td>{card.count}</td></tr>)}</tbody></table></div>}
      </details>)}
    </>}
  </div>
}
function CardTable({ rows, kind }) {
  if (!rows.length) return <p className="ref-muted">No recorded cards for this selection.</p>
  return <div className="ref-card-table-wrap"><table className="ref-card-table"><thead><tr><th>{kind === 'player' ? 'Player / team' : 'Team'}</th><th>Yellow</th><th>Red</th><th>Total</th>{kind === 'team' && <><th>Games</th><th>Per game</th></>}</tr></thead><tbody>{rows.map(row => <tr key={row.id + ':' + (row.team || row.name)}><td>{row.id ? <Link to={(kind === 'player' ? '/players/' : '/teams/')+row.id}>{row.name}</Link> : row.name}{kind === 'player' && <small style={{display:'block',marginTop:3}}>{row.team}</small>}</td><td>{row.yellow}</td><td>{row.red}</td><td><strong>{row.total}</strong></td>{kind === 'team' && <><td>{row.games}</td><td>{row.average == null ? '—' : row.average.toFixed(2)}</td></>}</tr>)}</tbody></table></div>
}
