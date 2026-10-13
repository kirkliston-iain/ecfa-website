import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, createPredictionClient } from '../supabaseClient'
import { activePredictionWeek, inPredictionWeek, weekKey, predictionWindow, predictionOpen, validScore } from '../utils/weekendPredictions'
import './WeekendPredictions.css'
import { simulatorKits } from '../utils/simulatorKits'
import { MATCH_MINUTE_MS } from '../utils/matchMotion'
import { loadPredictionEvidence, simulatePrediction } from '../utils/predictionModel'
const MatchScene3D = lazy(() => import('../components/MatchScene3D'))

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
  const kits = useMemo(() => simulatorKits(fixture.home_team, fixture.away_team), [fixture.home_team.name, fixture.away_team.name])
  const [story, setStory] = useState([])
  const [evidence, setEvidence] = useState(null)
  const [evidenceLoading, setEvidenceLoading] = useState(true)
  const [evidenceError, setEvidenceError] = useState('')
  const [evidenceRetry, setEvidenceRetry] = useState(0)
  useEffect(() => {
    let cancelled = false
    setEvidenceLoading(true); setEvidenceError('')
    loadPredictionEvidence(supabase, fixture).then(data => { if(!cancelled) setEvidence(data) }).catch(() => { if(!cancelled) setEvidenceError('Could not load squad and form data. Please retry.') }).finally(() => { if(!cancelled) setEvidenceLoading(false) })
    return () => { cancelled = true }
  }, [fixture.id, evidenceRetry])
  const [minute, setMinute] = useState(0)
  const [running, setRunning] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [cameraMode, setCameraMode] = useState('broadcast')
  useEffect(() => {
    if (!running) return
    const timer = setInterval(() => setMinute(value => Math.min(90, value + 1)), MATCH_MINUTE_MS / speed)
    return () => clearInterval(timer)
  }, [running, speed])
  useEffect(() => { if (minute === 90) setRunning(false) }, [minute])
  const seen = story.filter(event => event.minute <= minute)
  const goals = seen.filter(event => event.goal)
  const home = goals.filter(event => event.side === 'home').length
  const away = goals.length - home
  const motm = useMemo(() => {
    const performances = new Map()
    const add = (player, side, points, kind) => {
      if (!player) return
      const record = performances.get(player.id) || { player, side, points: 0, goals: 0, assists: 0 }
      record.points += points
      if (kind) record[kind] += 1
      performances.set(player.id, record)
    }
    for (const event of story) {
      if (event.goal) { add(event.scorer, event.side, 3, 'goals'); add(event.assist, event.side, 2, 'assists') }
      else add(event.actor, event.side, 0.25)
    }
    return [...performances.values()].sort((a, b) => b.points - a.points || b.goals - a.goals || a.player.name.localeCompare(b.player.name))[0] || null
  }, [story])
  const latest = seen.at(-1)
  const name = latest?.side === 'home' ? fixture.home_team.name : fixture.away_team.name
  const person = player => player ? <Link to={`/players/${player.id}`}>{player.name}</Link> : null
  const message = minute === 90 ? 'Full time! Your fictional match prediction is in.' : latest
    ? latest.goal ? <>GOAL! {latest.scorer ? person(latest.scorer) : name}{latest.scorer ? ` for ${name}` : ''}.{latest.assist ? <> Assist: {person(latest.assist)}.</> : ' Unassisted.'}</>
    : <>{latest.actor ? person(latest.actor) : name}{latest.actor ? ` (${name})` : ''}: {['a shot saved by the keeper.', 'a dangerous attack cleared away.', 'a strike just wide of the post.'][latest.kind]}</>
    : minute ? 'Kick-off! Both sides settle into the game.' : 'The teams are ready. Press Play match to generate a prediction and kick off.'
  function play() {
    if(!evidence || evidenceLoading || evidenceError) return
    const prediction=simulatePrediction(evidence)
    setStory(prediction.events); setMinute(0); setRunning(true)
  }

  return <section className="wp-simulator" aria-label="Fictional match simulator">
    <div className="wp-scoreboard">
      {[fixture.home_team, fixture.away_team].map((team,index) => <div className="wp-scoreboard-team" key={team.id} style={{gridColumn:index ? 3 : 1,gridRow:1}}>
        <span className="wp-scoreboard-teamname"><Badge team={team} />{team.name}</span>
        {goals.some(event => event.side === (index ? 'away' : 'home')) && <ul className="wp-team-goals" aria-label={`${team.name} simulated scorers and assists`}>{goals.filter(event => event.side === (index ? 'away' : 'home')).map(event => <li key={event.minute}><span>⚽ {event.scorer ? person(event.scorer) : 'Unnamed scorer'} <b>{event.minute}′</b></span><small>{event.assist ? <>Assist: {person(event.assist)}</> : 'Unassisted'}</small></li>)}</ul>}
      </div>)}
      <strong style={{gridColumn:2,gridRow:1}}>{home} : {away}<small>{minute === 90 ? 'FT' : `${minute}′`}</small></strong>
    </div>
    {minute === 90 && motm && <div className="wp-motm" role="status"><b>⭐ Man of the Match</b><span>{person(motm.player)} · {motm.side === 'home' ? fixture.home_team.name : fixture.away_team.name}</span><small>{motm.goals > 0 && `${motm.goals} ${motm.goals === 1 ? 'goal' : 'goals'}`}{motm.goals > 0 && motm.assists > 0 && ' · '}{motm.assists > 0 && `${motm.assists} ${motm.assists === 1 ? 'assist' : 'assists'}`}{!motm.goals && !motm.assists && 'Standout performance'}</small></div>}
    {evidenceLoading && <p role="status">Preparing the match…</p>}
    {evidenceError && <p role="alert">Could not prepare the match. <button type="button" onClick={() => setEvidenceRetry(value=>value+1)}>Retry</button></p>}
    <div className="wp-stadium">
      <Suspense fallback={<div className="wp-scene3d wp-scene-loading" role="status">Preparing the 3D pitch…</div>}><MatchScene3D kits={kits} minute={minute} running={running} speed={speed} story={story} cameraMode={cameraMode} /></Suspense>
      <span className="wp-camera-tag">3D • {cameraMode === 'goal' ? 'Behind goal' : 'Broadcast'}</span>
      {latest?.goal && minute - latest.minute < 3 && <span className="wp-goal">GOAL!</span>}
    </div>
    <div className="wp-camera-controls" aria-label="Camera angle"><button type="button" aria-pressed={cameraMode === 'broadcast'} onClick={() => setCameraMode('broadcast')}>Broadcast</button><button type="button" aria-pressed={cameraMode === 'goal'} onClick={() => setCameraMode('goal')}>Behind goal</button></div>
    <p className="wp-commentary" role="status">{message}</p>
    <div className="wp-controls"><button type="button" onClick={play} disabled={running || evidenceLoading || !!evidenceError}>▶ {minute ? 'Play again' : 'Play match'}</button>{(running || minute > 0) && minute < 90 && <><button type="button" onClick={() => setRunning(value => !value)}>{running ? 'Pause' : 'Resume'}</button><button type="button" onClick={() => { setRunning(false); setMinute(90) }}>End game</button></>}<label>Speed <select value={speed} onChange={event => setSpeed(Number(event.target.value))}><option value="1">Normal</option><option value="3">Fast</option></select></label></div>

    {seen.length > 0 && <details><summary>Match highlights ({seen.length})</summary><ol className="wp-highlights">{seen.map(event => <li key={event.minute}><b>{event.minute}′</b> {event.side === 'home' ? fixture.home_team.name : fixture.away_team.name} — {event.goal ? <>⚽ {event.scorer ? person(event.scorer) : 'Goal'}{event.assist ? <> (assist: {person(event.assist)})</> : ' (unassisted)'}</> : <>{event.actor ? <>{person(event.actor)}: </> : ''}{['Shot saved', 'Attack cleared', 'Shot wide'][event.kind]}</>}</li>)}</ol></details>}

  </section>
}

export default function WeekendPredictions() {
  const [fixtures, setFixtures] = useState([])
  const [week, setWeek] = useState(() => activePredictionWeek())
  const [selected, setSelected] = useState('')
  const [scores, setScores] = useState({})
  const [entry] = useState(readEntry)
  const predictionClient = useMemo(() => createPredictionClient(entry.id), [entry.id])
  const [serverOffset, setServerOffset] = useState(0)
  const [visibility, setVisibility] = useState({})
  const [submitted, setSubmitted] = useState({})
  const [crowd, setCrowd] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pollError, setPollError] = useState('')
  const [pollLoading, setPollLoading] = useState(true)
  const pollSequence = useRef(0)
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [clock, setNow] = useState(Date.now())
  const now = clock + serverOffset
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer) }, [])
  async function loadFixtures() {
    setLoading(true); setError('')
    const { data, error: failure } = await supabase.from('fixtures').select('id,fixture_date,status,home_score,away_score,home_team:home_team_id(id,name,logo_url),away_team:away_team_id(id,name,logo_url),stage:stage_id(competition:competition_id(id,name,slug,season))').eq('hidden_from_public', false).gte('fixture_date', `${activePredictionWeek()}T00:00:00Z`).order('fixture_date').order('id').range(0, 9999)
    if (failure) setError('Could not load the weekend fixtures. Please try again.')
    else setFixtures(data || [])
    setLoading(false)
  }
  useEffect(() => { loadFixtures() }, [])
  const weekends = useMemo(() => [...new Set([activePredictionWeek(), ...fixtures.filter(f => f.fixture_date).map(f => weekKey(new Date(f.fixture_date)))])].sort(), [fixtures])
  const games = useMemo(() => fixtures.filter(f => inPredictionWeek(f, week)), [fixtures, week])
  const simulatable = games.filter(f => f.home_team && f.away_team && ['scheduled', 'played'].includes(f.status))
  const active = simulatable.find(f => f.id === selected) || simulatable[0]
  const open = games.filter(f => predictionOpen(f, now) && !submitted[f.id])
  async function loadPolls(showLoading = true) {
    const sequence = ++pollSequence.current
    if (showLoading) setPollLoading(true)
    if (!games.length) { setCrowd({}); setSubmitted({}); setPollLoading(false); return }
    const ids = games.map(f => f.id)
    const {data, error: failure} = await predictionClient.rpc('prediction_summary', {p_fixture_ids:ids})
    if (sequence !== pollSequence.current) return
    setPollLoading(false)
    if (failure) { setPollError('Could not load prediction status. Please retry before submitting.'); return }
    setPollError('')
    if (data?.[0]?.server_now) setServerOffset(new Date(data[0].server_now).getTime() - Date.now())
    setCrowd(Object.fromEntries((data || []).filter(row => row.crowd).map(row => [row.fixture_id,row.crowd])))
    setVisibility(Object.fromEntries((data || []).map(row=>[row.fixture_id,row.can_view])))
    setSubmitted(Object.fromEntries((data || []).filter(row=>row.submitted).map(row=>[row.fixture_id,{home:String(row.submitted.home),away:String(row.submitted.away)}])))
  }
  const votingPhase = games.map(f => {const w=predictionWindow(f);return `${f.id}:${now<w.opens ? 'future' : now<w.closes ? 'open' : 'closed'}`}).join('|')
  useEffect(() => {
    loadPolls()
    const timer=setInterval(()=>loadPolls(false),30000)
    return () => { clearInterval(timer); pollSequence.current += 1 }
  }, [games, entry.id, votingPhase])

  function change(id, side, value) { setScores(previous => ({ ...previous, [id]: { ...previous[id], [side]: value } })); setMessage('') }
  async function submit(event) {
    event.preventDefault(); setMessage('')
    if (pollLoading || pollError || saving) return
    const currentOpen = games.filter(f => predictionOpen(f, Date.now()+serverOffset) && !submitted[f.id])
    if (!currentOpen.length) { setMessage('There are no open games left to predict.'); return }
    if (currentOpen.some(f => !validScore(scores[f.id]?.home) || !validScore(scores[f.id]?.away))) { setMessage('Enter a score from 0 to 20 for both teams in every open game.'); return }
    try { localStorage.setItem('ecfa-predictions-entry', JSON.stringify(entry)) } catch { setMessage('Enable browser storage to submit and remember your predictions.'); return }
    setSaving(true)
    const { error: failure } = await predictionClient.from('weekend_predictions').insert(currentOpen.map(f => ({ fixture_id: f.id, entry_id: entry.id, home_score: Number(scores[f.id].home), away_score: Number(scores[f.id].away) })))
    if (failure) { setMessage('Predictions were not saved. The deadline may have passed or an entry may already be submitted. Refresh and try again.'); await loadPolls() }
    else { setSubmitted(previous => ({ ...previous, ...Object.fromEntries(currentOpen.map(f => [f.id, scores[f.id]])) })); setMessage('Your predictions are saved. Good luck!'); await loadPolls() }
    setSaving(false)
  }
  return <div className="container wp-page">
    <div className="wp-intro"><span className="wp-kicker">ECFA • JUST FOR FUN</span><h1>Weekly Predictions</h1><p>A little matchday magic. Watch a fictional match, then have your say on the week’s real games.</p></div>
    <label className="wp-week">Week beginning <select value={week} onChange={event => { setWeek(event.target.value); setSelected(''); setMessage('') }}>{weekends.map(value => <option key={value} value={value}>{new Date(`${value}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year:'numeric' })}</option>)}</select></label>
    {loading ? <p role="status">Loading fixtures…</p> : error ? <p role="alert">{error} <button onClick={loadFixtures}>Retry</button></p> : <>
      <h2>Play the week’s games</h2><p className="wp-muted">Watch a fun 3D match featuring real squad names and fictional goals and assists. Choose a broadcast or behind-goal camera. Fictional results only; real match records stay as they are. Cup predictions are for 90 minutes.</p>
      {active ? <><label className="wp-match-picker">Choose a match <select value={active.id} onChange={event => setSelected(event.target.value)}>{simulatable.map(f => <option key={f.id} value={f.id}>{f.home_team.name} v {f.away_team.name}</option>)}</select></label><Simulator key={`${week}-${active.id}`} fixture={active} /><Link to={`/fixtures/${active.id}`} className="wp-detail-link">View real match details →</Link></> : <p>No confirmed matches to simulate this week.</p>}
      <section className="wp-predictions"><h2>Your weekly picks</h2><p className="wp-muted">Predictions open Monday at 5am. Weekend entries close Friday at 10pm; midweek entries close 12 hours before kick-off. All times are UK time. Submit every open game to reveal its live community percentages. After each deadline, final percentages are public. This browser remembers your entries; submitted scores are final.</p>
      {pollError && <p role="alert">{pollError} <button type="button" onClick={() => loadPolls()}>Retry</button></p>}
      {games.length === 0 ? <p>No games scheduled for this week. Choose another week above.</p> : <form onSubmit={submit}>
        <div className="wp-games">{games.map(f => {
          const saved = submitted[f.id]; const editable = predictionOpen(f, now) && !saved
          const values = saved || scores[f.id] || {}; const votes = crowd[f.id]
          const window = predictionWindow(f)
          const upcoming = now < window.opens
          const closed = now >= window.closes
          const formatTime = time => new Date(time).toLocaleString('en-GB', {timeZone:'Europe/London',weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})
          return <article className="wp-game" key={f.id}>
            <div className="wp-game-meta"><Link to={`/fixtures/${f.id}`}>{f.stage?.competition?.name || 'ECFA match'} · {new Date(f.fixture_date).toLocaleString('en-GB', { timeZone:'Europe/London',weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit' })}</Link><span>{saved ? 'Submitted ✓' : editable ? 'Open' : upcoming ? 'Not open yet' : 'Closed'}</span></div>
            <div className="wp-pick"><Link to={f.home_team ? `/teams/${f.home_team.id}` : `/fixtures/${f.id}`}><Badge team={f.home_team} />{f.home_team?.name || 'Home team TBC'}</Link><div className="wp-score-inputs">{editable ? <><input type="number" inputMode="numeric" min="0" max="20" step="1" required={editable} disabled={!editable || saving || pollLoading || !!pollError} value={values.home ?? ''} onChange={event => change(f.id,'home',event.target.value)} aria-label={`${f.home_team?.name || 'Home team'} predicted score`} /><span>–</span><input type="number" inputMode="numeric" min="0" max="20" step="1" required={editable} disabled={!editable || saving || pollLoading || !!pollError} value={values.away ?? ''} onChange={event => change(f.id,'away',event.target.value)} aria-label={`${f.away_team?.name || 'Away team'} predicted score`} /></> : <span className="wp-voting-state">{saved ? `${saved.home} – ${saved.away}` : upcoming ? 'Not open' : 'Closed'}</span>}</div><Link to={f.away_team ? `/teams/${f.away_team.id}` : `/fixtures/${f.id}`}><Badge team={f.away_team} />{f.away_team?.name || 'Away team TBC'}</Link></div>
            {f.status === 'played' && <p className="wp-result">Real result (90 minutes): {f.home_score} – {f.away_score}{saved && Number(saved.home) === f.home_score && Number(saved.away) === f.away_score ? ' · Exact score! 🎯' : ''}</p>}
            <p className="wp-deadline">{upcoming ? `Opens ${formatTime(window.opens)} (UK)` : closed ? `Closed ${formatTime(window.closes)} (UK)` : `Closes ${formatTime(window.closes)} (UK)`}</p>
            <p className="wp-crowd">{visibility[f.id] ? votes?.total ? `${closed ? 'Final picks' : 'Live picks'}: Home ${Math.round(votes.home_wins / votes.total * 100)}% · Draw ${Math.round(votes.draws / votes.total * 100)}% · Away ${Math.round(votes.away_wins / votes.total * 100)}% (${votes.total} ${Number(votes.total) === 1 ? 'pick' : 'picks'})` : closed ? 'No predictions were submitted before the deadline.' : 'No community picks yet.' : upcoming ? 'Live percentages are revealed after you submit during the voting window.' : closed ? 'Loading final percentages…' : 'Submit your predictions to reveal the live community percentages.'}</p>

          </article>
        })}</div>
        {open.length > 0 && <button className="wp-submit" disabled={saving || pollLoading || !!pollError}>{saving ? 'Saving…' : `Submit ${open.length} game predictions`}</button>}
        <p role="status">{message || (!open.length && games.length ? 'All games are submitted or closed for predictions.' : '')}</p>
      </form>}</section>
    </>}
  </div>
}