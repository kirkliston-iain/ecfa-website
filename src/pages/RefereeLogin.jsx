import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { createRefereeClient, supabase } from '../supabaseClient'
import './RefereeProfiles.css'
const SESSION_KEY = 'ecfa-referee-session'
export default function RefereeLogin() {
  const [token, setToken] = useState(() => sessionStorage.getItem(SESSION_KEY) || '')
  const [code, setCode] = useState('')
  const [report, setReport] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!token) { setReport(null); return }
    let cancelled = false
    setBusy(true)
    createRefereeClient(token).rpc('referee_private_dashboard').then(({ data, error: failure }) => {
      if (cancelled) return
      setBusy(false)
      if (failure) { setError('Your session has expired or your code has been replaced. Please sign in again.'); sessionStorage.removeItem(SESSION_KEY); setToken('') }
      else { setReport(data); setError('') }
    })
    return () => { cancelled = true }
  }, [token])
  async function login(event) {
    event.preventDefault(); setBusy(true); setError('')
    const { data, error: failure } = await supabase.rpc('referee_code_login', { p_code: code.trim() })
    setBusy(false)
    if (failure || !data?.token) { setError('Code not recognised. Please check it or ask the league administrator for a new code.'); return }
    sessionStorage.setItem(SESSION_KEY, data.token); setToken(data.token); setCode('')
  }
  async function logout() {
    setBusy(true)
    const { error: failure } = await createRefereeClient(token).rpc('referee_code_logout')
    sessionStorage.removeItem(SESSION_KEY); setToken(''); setReport(null); setBusy(false)
    setError(failure ? 'Signed out on this device. The session will also expire automatically.' : '')
  }
  return <div className="container ref-area">
    <Link to="/referees">← Referees</Link><h1>{report ? 'My referee dashboard' : 'Referee login'}</h1>
    {!token && <form onSubmit={login} className="ref-panel"><p>Use the private login code issued to you by the league.</p><label className="ref-field">Your login code<input required autoComplete="off" type="password" value={code} onChange={(e) => setCode(e.target.value)} /></label><button className="ref-primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button></form>}
    {busy && token && <p role="status">Loading your dashboard…</p>}
    {error && <p role="alert">{error}</p>}
    {report && <><div className="ref-actions"><h2>{report.referee}</h2><button disabled={busy} onClick={logout}>Sign out</button></div><p className="ref-muted">{report.season?.replace('-', '/')} · Your recorded cards in completed games</p>
      <div className="ref-summary">{[['Games',report.games],['Yellow cards',report.yellow],['Red cards',report.red],['Total cards',Number(report.yellow)+Number(report.red)],['Cards per game',Number(report.cards_per_game).toFixed(2)]].map(([label,value]) => <div className="ref-panel" key={label}><small>{label}</small><strong>{value}</strong></div>)}</div>
      <p className="ref-muted">Average = recorded yellow and red cards ÷ completed games. Missing card records can affect this figure.</p>
      <h2>Cards by game</h2>{!report.matches.length && <p>No completed games recorded this season.</p>}
      {report.matches.map((match) => <Link className="ref-match" key={match.id} to={`/fixtures/${match.id}`}><span><strong>{match.home} v {match.away}</strong><small>{new Date(match.fixture_date).toLocaleDateString('en-GB')} · {match.home_score}–{match.away_score}</small></span><span>{match.yellow} yellow · {match.red} red</span></Link>)}
    </>}
  </div>
}
