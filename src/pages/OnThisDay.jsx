import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { loadPublicMatches, londonToday, anniversaryMatches } from '../utils/publicMatches'
import { displayedScore } from '../utils/fixtureOutcome'
import { TeamHistoryLink, CompetitionHistoryLink, HistoryBack } from '../components/HistoryLinks'

export default function OnThisDay() {
  const [date, setDate] = useState(londonToday())
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => { let active = true; loadPublicMatches().then(data => { if(active) setRows(data) }).catch(() => { if(active) setError('Unable to load history. Please refresh to try again.') }); return () => { active = false } }, [])
  const result = anniversaryMatches(rows || [], date)
  const ranked = [...result.matches].sort((a,b) => (Number(b.home_score)+Number(b.away_score))-(Number(a.home_score)+Number(a.away_score)))
  const featured = ranked[0]
  function matchCard(f, highlight = false) { return <article key={f.id} style={{ padding: 18, marginBottom: 14, border: '1px solid var(--line)', borderLeft: highlight ? '4px solid var(--brass)' : undefined, borderRadius: 8 }}>
    {highlight && <div style={{color:'var(--brass)',fontWeight:700,fontSize:12}}>FROM THE ECFA ARCHIVE</div>}
    <p style={{fontSize:12,color:'var(--muted)'}}>{new Date(String(f.fixture_date).slice(0,10)+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})} · {Number(date.slice(0,4))-Number(String(f.fixture_date).slice(0,4))} years ago</p>
    <div style={{ display:'grid',gridTemplateColumns:'1fr auto 1fr',gap:12,alignItems:'center',fontWeight:700 }}><TeamHistoryLink name={f.home_team?.name} id={f.home_team?.id}/><Link to={`/fixtures/${f.id}`} style={{color:'var(--brass)',fontSize:22}} aria-label={`View ${f.home_team?.name} versus ${f.away_team?.name}`}>{displayedScore(f)}</Link><TeamHistoryLink name={f.away_team?.name} id={f.away_team?.id}/></div>
    <p style={{fontSize:12}}><CompetitionHistoryLink name={f.competition_name} season={f.season}/></p>
    <Link to={`/fixtures/${f.id}`}>Explore this match →</Link>
  </article> }
  return <main className="container" style={{padding:'32px 20px 48px',maxWidth:850}}><HistoryBack/><h1>On This Day</h1><p style={{color:'var(--muted)'}}>Rediscover matches from across ECFA history.</p>
    <label>Explore a date <input type="date" value={date} onChange={e => { if(e.target.value) setDate(e.target.value) }} /></label> <button onClick={() => setDate(londonToday())}>Today</button>
    {error ? <p role="alert">{error}</p> : !rows ? <p>Loading the archive…</p> : <><h2 style={{fontSize:20,marginTop:24}}>{result.exact ? 'On this day in ECFA history' : 'This week in ECFA history'}</h2>{!result.exact && <p style={{color:'var(--muted)',fontSize:13}}>No recorded matches on this exact date. Here are matches within three days of it in previous years.</p>}{featured ? <>{matchCard(featured,true)}{ranked.length > 1 && <h2 style={{fontSize:18}}>More from {result.exact ? 'this day' : 'this week'}</h2>}{ranked.slice(1).map(f => matchCard(f))}</> : <p>No recorded matches around this date yet. Try another date.</p>}</>}
  </main>
}
