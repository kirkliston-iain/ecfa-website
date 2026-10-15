import WeekendGraphics from '../components/WeekendGraphics'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { HistoryBack } from '../components/HistoryLinks'
import { loadPublicMatches } from '../utils/publicMatches'

export default function MatchdayGraphics() {
  const [rows,setRows]=useState(null)
  const [error,setError]=useState('')
  const [params,setParams]=useSearchParams()
  const search=params.get('q')||''
  const [count,setCount]=useState(30)
  useEffect(()=>{let active=true;loadPublicMatches().then(data=>{if(active)setRows(data)}).catch(()=>{if(active)setError('Unable to load fixtures. Please refresh to try again.')});return()=>{active=false}},[])
  const today=new Date().toISOString().slice(0,10)
  const ordered=[...(rows||[])].sort((a,b)=> { const upcoming=f=>f.status==='scheduled' && String(f.fixture_date).slice(0,10)>=today; if(upcoming(a)!==upcoming(b))return upcoming(a)?-1:1; return upcoming(a)?String(a.fixture_date).localeCompare(String(b.fixture_date)):String(b.fixture_date).localeCompare(String(a.fixture_date)) })
  const matches=ordered.filter(f=>['played','scheduled','postponed','cancelled'].includes(f.status) && `${f.home_team?.name} ${f.away_team?.name} ${f.fixture_date} ${f.competition_name} ${f.season}`.toLowerCase().includes(search.toLowerCase()))
  return <main className="container" style={{padding:'32px 20px 48px',maxWidth:850}}><HistoryBack/><h1>Matchday Graphics</h1><p style={{color:'var(--muted)'}}>Choose a game to create a branded fixture or full-time image, then share it into your chats.</p>{rows && <WeekendGraphics matches={rows} />}<h2 style={{fontSize:22}}>Individual match graphics</h2><label>Find a match <input type="search" placeholder="Team, date or competition" value={search} onChange={e=>{const next=new URLSearchParams(params); if(e.target.value)next.set('q',e.target.value);else next.delete('q');setParams(next,{replace:true});setCount(30)}} style={{width:'100%',maxWidth:440}}/></label>
    {error?<p role="alert">{error}</p>:!rows?<p>Loading matches…</p>:<><p>{matches.length} matches</p>{matches.slice(0,count).map(f=><article key={f.id} style={{padding:'14px 0',borderBottom:'1px solid var(--line)'}}><div style={{color:'var(--muted)',fontSize:12}}>{String(f.fixture_date).slice(0,10)} · {f.competition_name} · {f.season}</div><strong>{f.home_team?.name} v {f.away_team?.name}</strong><div><Link to={`/fixtures/${f.id}?graphic=1#match-graphic`}>Create {f.status==='played'?'result':'fixture'} graphic →</Link></div></article>)}{count<matches.length&&<button style={{marginTop:16}} onClick={()=>setCount(c=>c+30)}>Show more matches</button>}</>}
  </main>
}
