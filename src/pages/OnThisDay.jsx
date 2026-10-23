import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { loadPublicMatches, londonToday, anniversaryMatches } from '../utils/publicMatches'
import { displayedScore } from '../utils/fixtureOutcome'
import { TeamHistoryLink, CompetitionHistoryLink, HistoryBack } from '../components/HistoryLinks'

function TeamBadgeLink({ team }) {
  const [failed, setFailed] = useState(false)
  const name = team?.name || 'Unknown team'
  const initials = name.split(/\s+/).slice(0, 2).map(word => word[0]).join('')
  return <TeamHistoryLink name={name} id={team?.id} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:3,textAlign:'center',fontSize:11,lineHeight:1.2,minWidth:0,overflowWrap:'anywhere'}}>
    {team?.logo_url && !failed ? <img src={team.logo_url} onError={() => setFailed(true)} alt="" style={{width:22,height:22,objectFit:'contain',flexShrink:0}}/> : <span aria-hidden="true" style={{width:22,height:22,borderRadius:'50%',display:'inline-flex',alignItems:'center',justifyContent:'center',background:'var(--ink)',color:'#fff',fontSize:10}}>{initials}</span>}
    <span>{name}</span>
  </TeamHistoryLink>
}

export default function OnThisDay() {
  const [date, setDate] = useState(londonToday())
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => { let active = true; loadPublicMatches().then(data => { if(active) setRows(data) }).catch(() => { if(active) setError('Unable to load history. Please refresh to try again.') }); return () => { active = false } }, [])
  const result = anniversaryMatches(rows || [], date)
  const ranked = [...result.matches].sort((a,b) => (Number(b.home_score)+Number(b.away_score))-(Number(a.home_score)+Number(a.away_score)))
  const featured = ranked[0]
  function matchCard(f, highlight = false) { return <article key={f.id} style={{ padding: '9px 10px', marginBottom: 7, border: '1px solid var(--line)', borderLeft: highlight ? '4px solid var(--brass)' : undefined, borderRadius: 10 }}>
    {highlight && <div style={{color:'var(--brass)',fontWeight:700,fontSize:9,letterSpacing:'.04em'}}>ARCHIVE HIGHLIGHT</div>}
    <p style={{fontSize:11,color:'var(--muted)',margin:'3px 0 7px'}}>{new Date(String(f.fixture_date).slice(0,10)+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})} · {Number(date.slice(0,4))-Number(String(f.fixture_date).slice(0,4))} years ago</p>
    <div style={{ display:'grid',gridTemplateColumns:'minmax(0,1fr) auto minmax(0,1fr)',gap:5,alignItems:'center',fontWeight:700 }}><TeamBadgeLink team={f.home_team}/><Link to={`/fixtures/${f.id}`} style={{color:'var(--brass)',fontSize:18,whiteSpace:'nowrap',textDecoration:'none'}} aria-label={`View ${f.home_team?.name} versus ${f.away_team?.name}`}>{displayedScore(f)}</Link><TeamBadgeLink team={f.away_team}/></div>
    <p style={{fontSize:11,margin:'6px 0 3px'}}><CompetitionHistoryLink name={f.competition_name} season={f.season}/></p>
    <Link to={`/fixtures/${f.id}`} style={{fontSize:11,textDecoration:'none',fontWeight:600}}>Match details →</Link>
  </article> }
  return <main className="container reading-page" style={{padding:'12px 14px 24px',maxWidth:760,fontSize:13}}><HistoryBack/><h1 style={{fontSize:23,margin:'8px 0 3px'}}>On This Day</h1><p style={{color:'var(--muted)',fontSize:13,margin:'0 0 11px'}}>Rediscover matches from across ECFA history.</p>
    <div style={{display:'flex',flexWrap:'wrap',alignItems:'center',gap:6}}><label style={{fontSize:12}}>Explore a date <input style={{fontSize:12,padding:'4px 6px',maxWidth:155}} type="date" value={date} onChange={e => { if(e.target.value) setDate(e.target.value) }} /></label> <button style={{fontSize:12,padding:'5px 9px'}} onClick={() => setDate(londonToday())}>Today</button></div>
    {error ? <p role="alert">{error}</p> : !rows ? <p>Loading the archive…</p> : <><h2 style={{fontSize:15,marginTop:13,marginBottom:7}}>{result.exact ? 'On this day in ECFA history' : 'This week in ECFA history'}</h2>{!result.exact && <p style={{color:'var(--muted)',fontSize:13}}>No recorded matches on this exact date. Here are matches within three days of it in previous years.</p>}{featured ? <>{matchCard(featured,true)}{ranked.length > 1 && <h2 style={{fontSize:14,margin:'12px 0 7px'}}>More from {result.exact ? 'this day' : 'this week'}</h2>}{ranked.slice(1).map(f => matchCard(f))}</> : <p>No recorded matches around this date yet. Try another date.</p>}</>}
  </main>
}
