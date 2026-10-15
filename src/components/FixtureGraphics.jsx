import { useMemo, useState } from 'react'
import MatchGraphic from './MatchGraphic'
const EMPTY=[]
const FIXTURE={id:'fixtures',status:'scheduled'}
export default function FixtureGraphics({ fixtures, date }) {
  const [open,setOpen]=useState(false)
  const [page,setPage]=useState(0)
  const scheduled=useMemo(()=>fixtures.filter(f=>f.status==='scheduled'),[fixtures])
  const pages=Math.max(1,Math.ceil(scheduled.length/6))
  const index=Math.min(page,pages-1)
  const report=useMemo(()=>{
    const rows=scheduled.slice(index*6,index*6+6)
    const label=date?new Date(`${date}T12:00:00`).toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'}):'Upcoming fixtures'
    return {type:'fixtures',start:date,end:date,displayStart:label,displayEnd:label,subtitle:`All competitions${pages>1?` · ${index+1} of ${pages}`:''}`,rows,badges:rows.flatMap(f=>[f.home_team?.logo_url,f.away_team?.logo_url]),page:index+1,sharePath:'/#fixtures'}
  },[scheduled,index,pages,date])
  if(!scheduled.length)return null
  return <div style={{marginBottom:16}}><button onClick={()=>setOpen(v=>!v)} aria-expanded={open} style={{fontSize:12,padding:'7px 10px',border:'1px solid var(--brass)',borderRadius:5}}>{open?'Hide fixtures graphic':'Share fixtures graphic 🖼️'}</button>
    {open&&<>{pages>1&&<div style={{display:'flex',alignItems:'center',gap:10,marginTop:12}}><button disabled={index===0} onClick={()=>setPage(p=>p-1)}>Previous image</button><span>{index+1} of {pages}</span><button disabled={index===pages-1} onClick={()=>setPage(p=>p+1)}>Next image</button></div>}<MatchGraphic fixture={FIXTURE} scorers={EMPTY} report={report}/></>}
  </div>
}
