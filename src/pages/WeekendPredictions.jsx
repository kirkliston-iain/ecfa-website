import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { inWeekend, londonDay, weekendKey, predictionOpen, validScore, makeHighlights } from '../utils/weekendPredictions'
import './WeekendPredictions.css'
import { simulatorKits } from '../utils/simulatorKits'

function Badge({ team }) {
  return team?.logo_url ? <img className="wp-badge" src={team.logo_url} alt="" /> : <span className="wp-badge wp-badge-fallback" aria-hidden="true">⚽</span>
}
function readEntry() {
  try {
    const saved = JSON.parse(localStorage.getItem('ecfa-predictions-entry') || 'null')
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(saved?.id || '')) return saved
  } catch { /* Storage can be unavailable. */ }
  return { id: crypto.randomUUID() }
}
function Simulator({ fixture }) {
  const kits = simulatorKits(fixture.home_team, fixture.away_team)
  const [story, setStory] = useState([])
  const [minute, setMinute] = useState(0)
  const [running, setRunning] = useState(false)
  const [speed, setSpeed] = useState(1)
  useEffect(() => {
    if (!running) return
    const timer = setInterval(() => setMinute(value => Math.min(90, value + 1)), 350 / speed)
    return () => clearInterval(timer)
  }, [running, speed])
  useEffect(() => { if (minute === 90) setRunning(false) }, [minute])
  const seen = story.filter(event => event.minute <= minute)
  const goals = seen.filter(event => event.goal)
  const home = goals.filter(event => event.side === 'home').length
  const away = goals.length - home
  const latest = seen.at(-1)
  const name = latest?.side === 'home' ? fixture.home_team.name : fixture.away_team.name
  const message = minute === 90 ? 'Full time! Your fictional match result is in.' : latest
    ? latest.goal ? `GOAL! ${name} find the net!` : `${name}: ${['a shot saved by the keeper.', 'a dangerous attack cleared away.', 'a strike just wide of the post.'][latest.kind]}`
    : minute ? 'Kick-off! Both sides settle into the game.' : 'The teams are ready. Press Play match to kick off.'
  function play() { setStory(makeHighlights()); setMinute(0); setRunning(true) }
  return <section className="wp-simulator" aria-label="Fictional match simulator">
    <div className="wp-scoreboard"><span><Badge team={fixture.home_team} />{fixture.home_team.name}<small className="wp-kit-label"><i style={{ background: kits[0].colour, borderColor: kits[0].trim }} />{kits[0].name}</small></span><strong>{home} : {away}<small>{minute === 90 ? 'FT' : `${minute}′`}</small></strong><span><Badge team={fixture.away_team} />{fixture.away_team.name}<small className="wp-kit-label"><i style={{ background: kits[1].colour, borderColor: kits[1].trim }} />{kits[1].name}</small></span></div>
    <div className={`wp-pitch ${running ? 'wp-playing' : ''}`} aria-hidden="true">
      <div className="wp-pitch-lines"><div className="wp-centre" /><div className="wp-box wp-box-home" /><div className="wp-box wp-box-away" /></div>
      {[0,1].flatMap(side => Array.from({ length: 11 }, (_, index) => <span key={`${side}-${index}`} className={`wp-player wp-player-${side}`} style={{ background: kits[side].colour, color: kits[side].text, borderColor: kits[side].trim, left: `${side ? 96 - (index ? 17 + (index % 4) * 9 : 0) : 4 + (index ? 17 + (index % 4) * 9 : 0)}%`, top: `${index === 0 ? 50 : 14 + (index % 5) * 18}%`, animationDelay: `${index * -.3}s` }}>{index + 1}</span>))}
      <span className="wp-ball" style={{ left: `${latest?.goal && minute - latest.minute < 3 ? latest.side === 'home' ? 97 : 3 : 50 + Math.sin(minute * .9) * 28}%`, top: `${50 + Math.cos(minute * .7) * 26}%` }}>⚽</span>
      {latest?.goal && minute - latest.minute < 3 && <span className="wp-goal">GOAL!</span>}
    </div>
    <p className="wp-commentary" role="status">{message}</p>
    <div className="wp-controls"><button type="button" onClick={play} disabled={running}>▶ {minute ? 'Play again' : 'Play match'}</button>{minute > 0 && minute < 90 && <button type="button" onClick={() => setRunning(value => !value)}>{running ? 'Pause' : 'Resume'}</button>}<label>Speed <select value={speed} onChange={event => setSpeed(Number(event.target.value))}><option value="1">Normal</option><option value="3">Fast</option></select></label></div>
    {seen.length > 0 && <details><summary>Match highlights ({seen.length})</summary><ol className="wp-highlights">{seen.map(event => <li key={event.minute}><b>{event.minute}′</b> {event.side === 'home' ? fixture.home_team.name : fixture.away_team.name} — {event.goal ? '⚽ Goal!' : ['Shot saved', 'Attack cleared', 'Shot wide'][event.kind]}</li>)}</ol></details>}
  </section>
}

export default function WeekendPredictions() {
  const [fixtures, setFixtures] = useState([])
  const [week, setWeek] = useState(() => weekendKey())
  const [selected, setSelected] = useState('')
  const [scores, setScores] = useState({})
  const [entry] = useState(readEntry)
  const [submitted, setSubmitted] = useState({})
  const [crowd, setCrowd] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pollError, setPollError] = useState('')
  const [pollLoading, setPollLoading] = useState(true)
  const pollSequence = useRef(0)
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer) }, [])
  async function loadFixtures() {
    setLoading(true); setError('')
    const { data, error: failure } = await supabase.from('fixtures').select('id,fixture_date,status,home_score,away_score,home_team:home_team_id(id,name,logo_url),away_team:away_team_id(id,name,logo_url),stage:stage_id(competition:competition_id(name))').eq('hidden_from_public', false).gte('fixture_date', `${weekendKey()}T00:00:00Z`).order('fixture_date').order('id').range(0, 9999)
    if (failure) setError('Could not load the weekend fixtures. Please try again.')
    else setFixtures(data || [])
    setLoading(false)
  }
  useEffect(() => { loadFixtures() }, [])
  const weekends = useMemo(() => [...new Set([weekendKey(), ...fixtures.filter(f => f.fixture_date && [0,6].includes(new Date(`${londonDay(new Date(f.fixture_date))}T12:00:00Z`).getUTCDay())).map(f => weekendKey(new Date(f.fixture_date)))])].sort(), [fixtures])
  const games = useMemo(() => fixtures.filter(f => inWeekend(f, week)), [fixtures, week])
  const simulatable = games.filter(f => f.home_team && f.away_team && ['scheduled', 'played'].includes(f.status))
  const active = simulatable.find(f => f.id === selected) || simulatable[0]
  const open = games.filter(f => predictionOpen(f, now) && !submitted[f.id])
  async function loadPolls() {
    const sequence = ++pollSequence.current
    setPollLoading(true)
    if (!games.length) { setCrowd({}); setSubmitted({}); setPollLoading(false); return }
    const ids = games.map(f => f.id)
    const [totals, own] = await Promise.all([
      supabase.from('weekend_prediction_totals').select('*').in('fixture_id', ids),
      supabase.from('weekend_predictions').select('fixture_id,home_score,away_score').eq('entry_id', entry.id).in('fixture_id', ids),
    ])
    if (sequence !== pollSequence.current) return
    setPollLoading(false)
    if (totals.error || own.error) { setPollError('Community predictions could not be loaded. Please refresh before submitting.'); return }
    setPollError('')
    setCrowd(Object.fromEntries((totals.data || []).map(row => [row.fixture_id, row])))
    const saved = Object.fromEntries((own.data || []).map(row => [row.fixture_id, { home: String(row.home_score), away: String(row.away_score) }]))
    setSubmitted(saved)
  }
  useEffect(() => { loadPolls(); return () => { pollSequence.current += 1 } }, [games, entry.id])
  function change(id, side, value) { setScores(previous => ({ ...previous, [id]: { ...previous[id], [side]: value } })); setMessage('') }
  async function submit(event) {
    event.preventDefault(); setMessage('')
    if (pollLoading || pollError || saving) return
    const currentOpen = games.filter(f => predictionOpen(f) && !submitted[f.id])
    if (!currentOpen.length) { setMessage('There are no open games left to predict.'); return }
    if (currentOpen.some(f => !validScore(scores[f.id]?.home) || !validScore(scores[f.id]?.away))) { setMessage('Enter a score from 0 to 20 for both teams in every open game.'); return }
    try { localStorage.setItem('ecfa-predictions-entry', JSON.stringify(entry)) } catch { setMessage('Enable browser storage to submit and remember your predictions.'); return }
    setSaving(true)
    const { error: failure } = await supabase.from('weekend_predictions').insert(currentOpen.map(f => ({ fixture_id: f.id, entry_id: entry.id, home_score: Number(scores[f.id].home), away_score: Number(scores[f.id].away) })))
    if (failure) { setMessage('Predictions were not saved. A game may have kicked off or already been submitted. Refresh and try again.'); await loadPolls() }
    else { setSubmitted(previous => ({ ...previous, ...Object.fromEntries(currentOpen.map(f => [f.id, scores[f.id]])) })); setMessage('Your weekend predictions are saved. Good luck!'); await loadPolls() }
    setSaving(false)
  }
  return <div className="container wp-page">
    <div className="wp-intro"><span className="wp-kicker">ECFA • JUST FOR FUN</span><h1>Weekend Predictions</h1><p>A little matchday magic. Watch a fictional match, then have your say on the real games.</p></div>
    <label className="wp-week">Weekend <select value={week} onChange={event => { setWeek(event.target.value); setSelected(''); setMessage('') }}>{weekends.map(value => <option key={value} value={value}>{new Date(`${value}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year:'numeric' })}</option>)}</select></label>
    {loading ? <p role="status">Loading fixtures…</p> : error ? <p role="alert">{error} <button onClick={loadFixtures}>Retry</button></p> : <>
      <h2>Play the weekend</h2><p className="wp-muted">An arcade-style, computer vs computer simulation with random highlights. Fictional results only; real match records stay as they are. Cup predictions are for 90 minutes.</p>
      {active ? <><label className="wp-match-picker">Choose a match <select value={active.id} onChange={event => setSelected(event.target.value)}>{simulatable.map(f => <option key={f.id} value={f.id}>{f.home_team.name} v {f.away_team.name}</option>)}</select></label><Simulator key={`${week}-${active.id}`} fixture={active} /><Link to={`/fixtures/${active.id}`} className="wp-detail-link">View real match details →</Link></> : <p>No confirmed matches to simulate this weekend.</p>}
      <section className="wp-predictions"><h2>Your weekend picks</h2><p className="wp-muted">Enter scores for every open game and submit them together. No account needed. Entries are final and lock at each game's kick-off. This browser remembers your submitted scores. Community picks are an informal poll.</p>
      {pollError && <p role="alert">{pollError} <button type="button" onClick={loadPolls}>Retry</button></p>}
      {games.length === 0 ? <p>No games scheduled for this weekend. Choose another weekend above.</p> : <form onSubmit={submit}>
        <div className="wp-games">{games.map(f => {
          const saved = submitted[f.id]; const editable = predictionOpen(f, now) && !saved
          const values = saved || scores[f.id] || {}; const votes = crowd[f.id]
          return <article className="wp-game" key={f.id}>
            <div className="wp-game-meta"><Link to={`/fixtures/${f.id}`}>{f.stage?.competition?.name || 'ECFA match'} · {new Date(f.fixture_date).toLocaleString('en-GB', { timeZone:'Europe/London',weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit' })}</Link><span>{saved ? 'Submitted ✓' : editable ? 'Open' : f.status === 'scheduled' ? 'Locked' : f.status}</span></div>
            <div className="wp-pick"><Link to={f.home_team ? `/teams/${f.home_team.id}` : `/fixtures/${f.id}`}><Badge team={f.home_team} />{f.home_team?.name || 'Home team TBC'}</Link><div className="wp-score-inputs"><input type="number" inputMode="numeric" min="0" max="20" step="1" required={editable} disabled={!editable || saving || pollLoading || !!pollError} value={values.home ?? ''} onChange={event => change(f.id,'home',event.target.value)} aria-label={`${f.home_team?.name || 'Home team'} predicted score`} /><span>–</span><input type="number" inputMode="numeric" min="0" max="20" step="1" required={editable} disabled={!editable || saving || pollLoading || !!pollError} value={values.away ?? ''} onChange={event => change(f.id,'away',event.target.value)} aria-label={`${f.away_team?.name || 'Away team'} predicted score`} /></div><Link to={f.away_team ? `/teams/${f.away_team.id}` : `/fixtures/${f.id}`}><Badge team={f.away_team} />{f.away_team?.name || 'Away team TBC'}</Link></div>
            {f.status === 'played' && <p className="wp-result">Real result (90 minutes): {f.home_score} – {f.away_score}{saved && Number(saved.home) === f.home_score && Number(saved.away) === f.away_score ? ' · Exact score! 🎯' : ''}</p>}
            <p className="wp-crowd">{votes?.total ? `Community: Home ${Math.round(votes.home_wins / votes.total * 100)}% · Draw ${Math.round(votes.draws / votes.total * 100)}% · Away ${Math.round(votes.away_wins / votes.total * 100)}% (${votes.total} ${Number(votes.total) === 1 ? 'pick' : 'picks'})` : 'No community picks yet.'}</p>
          </article>
        })}</div>
        {open.length > 0 && <button className="wp-submit" disabled={saving || pollLoading || !!pollError}>{saving ? 'Saving…' : `Submit ${open.length} game predictions`}</button>}
        <p role="status">{message || (!open.length && games.length ? 'All games are submitted or closed for predictions.' : '')}</p>
      </form>}</section>
    </>}
  </div>
}
