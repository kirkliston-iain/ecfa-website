import { nextSevenDays } from '../utils/upcomingGraphics'
import WeekendGraphics from '../components/WeekendGraphics'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { HistoryBack } from '../components/HistoryLinks'
import { loadPublicMatches, londonToday } from '../utils/publicMatches'

export default function MatchdayGraphics() {
  const [rows,setRows]=useState(null)
  const [error,setError]=useState('')
  const [params,setParams]=useSearchParams()
  const search=params.get('q')||''
  const [count,setCount]=useState(30)
  useEffect(()=>{let active=true;loadPublicMatches().then(data=>{if(active)setRows(data)}).catch(()=>{if(active)setError('Unable to load fixtures. Please refresh to try again.')});return()=>{active=false}},[])
  const today=londonToday()
  const matches=nextSevenDays(rows||[],today).filter(f=>`${f.home_team?.name} ${f.away_team?.name} ${f.fixture_date} ${f.competition_name}`.toLowerCase().includes(search.toLowerCase()))
  return <main className="container" style={{padding:'32px 20px 48px',maxWidth:850}}><HistoryBack/><h1>Matchday Graphics</h1><p style={{color:'var(--muted)'}}>Choose a game to create a branded fixture or full-time image, then share it into your chats.</p>{rows && <WeekendGraphics matches={rows} />}<h2 style={{fontSize:22}}>Individual match graphics</h2><p style={{fontSize:13,color:'var(--muted)'}}>Scheduled games in the next 7 days, including today.</p><label>Find a match <input type="search" placeholder="Team, date or competition" value={search} onChange={e=>{const next=new URLSearchParams(params); if(e.target.value)next.set('q',e.target.value);else next.delete('q');setParams(next,{replace:true});setCount(30)}} style={{width:'100%',maxWidth:440}}/></label>
    {error?<p role="alert">{error}</p>:!rows?<p>Loading matches…</p>:<><p>{matches.length} upcoming matches</p>{!matches.length&&<p>No scheduled matches found in the next 7 days.</p>}{matches.slice(0,count).map(f=><article key={f.id} style={{padding:'14px 0',borderBottom:'1px solid var(--line)'}}><div style={{color:'var(--muted)',fontSize:12}}>{String(f.fixture_date).slice(0,10)} · {f.competition_name} · {f.season}</div><strong>{f.home_team?.name} v {f.away_team?.name}</strong><div><Link to={`/fixtures/${f.id}?graphic=1#match-graphic`}>Create {f.status==='played'?'result':'fixture'} graphic →</Link></div></article>)}{count<matches.length&&<button style={{marginTop:16}} onClick={()=>setCount(c=>c+30)}>Show more matches</button>}</>}
  </main>
}
