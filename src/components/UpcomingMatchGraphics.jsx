import { useCallback, useMemo, useState } from 'react'
import MatchGraphic from './MatchGraphic'
import { addDays, weekendStart } from '../utils/weekendGraphics'
import { londonToday } from '../utils/publicMatches'
const EMPTY=[]
const PLACEHOLDER={id:'weekend-fixtures',status:'scheduled'}
function PreparedMatch({fixture,onReady}) {
  const ready=useCallback(image=>onReady(fixture.id,image),[fixture.id,onReady])
  return <MatchGraphic fixture={fixture} scorers={EMPTY} onReady={ready}/>
}
export default function UpcomingMatchGraphics({matches}) {
  const today=londonToday()
  const day=new Date(`${today}T12:00:00Z`).getUTCDay()
  const [date,setDate]=useState(()=>day===0||day===6?weekendStart(today):addDays(weekendStart(today),7))
  const [prepare,setPrepare]=useState(false)
  const [images,setImages]=useState({})
  const [message,setMessage]=useState('')
  const [busy,setBusy]=useState(false)
  const [preview,setPreview]=useState(false)
  const end=addDays(date,1)
  const fixtures=useMemo(()=>matches.filter(f=>!f.is_historic&&f.status==='scheduled'&&String(f.fixture_date).slice(0,10)>=date&&String(f.fixture_date).slice(0,10)<=end).sort((a,b)=>String(a.fixture_date).localeCompare(String(b.fixture_date))),[matches,date,end])
  const ready=useCallback((id,image)=>setImages(prev=>({...prev,[id]:image})),[])
  const complete=fixtures.length>0&&fixtures.every(f=>images[f.id])
  const label=d=>new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})
  const report=useMemo(()=>({type:'fixtures',start:date,end,displayStart:`${label(date)} – ${label(end)}`,subtitle:'All weekend matches · All competitions',rows:fixtures,badges:fixtures.flatMap(f=>[f.home_team?.logo_url,f.away_team?.logo_url]),singleImage:true,showDates:true,sharePath:'/matchday-graphics'}),[fixtures,date,end])
  async function share(){
    if(!complete||busy)return
    const files=fixtures.map(f=>new File([images[f.id].blob],images[f.id].filename,{type:'image/png'}))
    if(!navigator.canShare?.({files})){setMessage('Your browser cannot share these images together. Download the individual graphics below and attach them to your chat.');return}
    setBusy(true)
    try{await navigator.share({files,title:'ECFA weekend match graphics'});setMessage(`Shared ${files.length} match graphics.`)}catch(e){if(e.name!=='AbortError')setMessage('Sharing did not complete. Try again or download the graphics below.')}finally{setBusy(false)}
  }
  return <section style={{padding:18,border:'1px solid var(--line)',borderRadius:8,margin:'20px 0'}}><h2>Weekend fixture graphics</h2><p>Share every match as separate images together, or share one image with all the weekend’s matches.</p><label>Weekend commencing <input type="date" value={date} onChange={e=>{if(e.target.value){setDate(weekendStart(e.target.value));setPrepare(false);setImages({});setMessage('')}}}/></label><p>{label(date)} – {label(end)} · {fixtures.length} scheduled matches</p>
    {!fixtures.length?<p>No scheduled matches for this weekend.</p>:<><div style={{display:'flex',flexWrap:'wrap',gap:10}}>{!prepare?<button onClick={()=>setPrepare(true)}>Prepare all individual match graphics</button>:<button disabled={!complete||busy} onClick={share}>{busy?'Sharing…':complete?`Share all ${fixtures.length} match graphics`:'Preparing match graphics…'}</button>}<button onClick={()=>setPreview(v=>!v)} aria-expanded={preview}>{preview?'Hide weekend image':'Create one image of all weekend matches'}</button></div><p role="status">{message}</p>{preview&&<MatchGraphic fixture={PLACEHOLDER} scorers={EMPTY} report={report}/>}{prepare&&<details><summary>Preview or download individual match graphics</summary>{fixtures.map(f=><PreparedMatch key={f.id} fixture={f} onReady={ready}/>)}</details>}</>}
  </section>
}
