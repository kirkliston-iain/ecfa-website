import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { londonToday } from '../utils/publicMatches'
import { addDays, previousWeekend, weekendStart, weekendResults } from '../utils/weekendGraphics'
import { computeStandings } from '../utils/standings'
import MatchGraphic from './MatchGraphic'

const EMPTY=[]
const PLACEHOLDER={id:'weekend',status:'played'}
export default function WeekendGraphics({ matches }) {
  const [params,setParams]=useSearchParams()
  const [league,setLeague]=useState(null)
  const [error,setError]=useState('')
  const [page,setPage]=useState(0)
  const selected=params.get('weekend')
  const saturday=/^\d{4}-\d{2}-\d{2}$/.test(selected||'') && !Number.isNaN(Date.parse(selected)) ? weekendStart(selected) : previousWeekend(londonToday())
  const sunday=addDays(saturday,1)
  const type=params.get('type')==='table'?'table':'results'
  useEffect(()=>{let active=true;async function load(){try{
    const {data:comp,error:compError}=await supabase.from('competitions').select('id,name,season').eq('slug','appin-league').single();if(compError)throw compError
    const {data:stages,error:stageError}=await supabase.from('stages').select('id').eq('competition_id',comp.id).eq('stage_type','group');if(stageError)throw stageError
    const stageIds=stages.map(s=>s.id)
    const {data:members,error:memberError}=await supabase.from('stage_teams').select('team:team_id(id,name,logo_url)').in('stage_id',stageIds);if(memberError)throw memberError
    if(active)setLeague({...comp,stageIds,teams:[...new Map(members.filter(m=>m.team).map(m=>[m.team.id,m.team])).values()]})
  }catch{if(active)setError('Unable to load the league table. Please refresh and try again.')}}load();return()=>{active=false}},[])
  const weekend=useMemo(()=>weekendResults(matches.filter(f=>!f.is_historic),saturday),[matches,saturday])
  const tables=useMemo(()=>league?computeStandings(league.teams,matches.filter(f=>!f.is_historic && league.stageIds.includes(f.stage_id) && String(f.fixture_date).slice(0,10)<=sunday)):[],[matches,league,sunday])
  const pages=Math.max(1,Math.ceil(weekend.length/6))
  const pageIndex=Math.min(page,pages-1)
  const report=useMemo(()=>{
    const rows=type==='table'?tables:weekend.slice(pageIndex*6,pageIndex*6+6)
    const display=d=>new Date(`${d}T12:00:00`).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})
    return {type,start:saturday,end:sunday,season:league?.season,subtitle:type==='table'?league?.name||'ECFA League':`All competitions${pages>1?` · ${pageIndex+1} of ${pages}`:''}`,rows,badges:type==='table'?rows.map(r=>r.teamLogo):rows.flatMap(f=>[f.home_team?.logo_url,f.away_team?.logo_url]),page:pageIndex+1,displayStart:display(saturday),displayEnd:display(sunday)}
  },[type,tables,weekend,pageIndex,pages,saturday,sunday,league])
  function update(values){const next=new URLSearchParams(params);for(const [key,value] of Object.entries(values))next.set(key,value);setParams(next,{replace:true});setPage(0)}
  const seasonStart=league?.season?.slice(0,4)
  const outsideSeason=league && (sunday < `${seasonStart}-07-01` || saturday > `${Number(seasonStart)+1}-06-30`)
  return <section style={{padding:18,border:'1px solid var(--line)',borderRadius:8,margin:'20px 0 30px'}}><h2 style={{fontSize:22,marginTop:0}}>Share a weekend round-up</h2><p style={{fontSize:13,color:'var(--muted)'}}>Share all recorded results for Saturday and Sunday, or the league table calculated through the end of that Sunday. Defaults to the previous completed weekend.</p>
    <div style={{display:'flex',flexWrap:'wrap',gap:12,alignItems:'center'}}><label>Weekend <input type="date" value={saturday} max={londonToday()} onChange={e=>{if(e.target.value)update({weekend:weekendStart(e.target.value)})}}/></label><label>Graphic <select value={type} onChange={e=>update({type:e.target.value})}><option value="results">Weekend results</option><option value="table">League table after this weekend</option></select></label><button onClick={()=>update({weekend:previousWeekend(londonToday())})}>Previous weekend</button></div>
    <p style={{fontSize:13}}>Saturday {report.displayStart} – Sunday {report.displayEnd}</p>
    {outsideSeason?<p>Weekend round-up graphics currently cover the {league.season} season. Select a weekend within that season.</p>:type==='table'&&error?<p role="alert">{error}</p>:type==='table'&&!league?<p>Loading league table…</p>:type==='results'&&weekend.length===0?<p>No completed matches recorded for this weekend.</p>:<>
      {type==='table'&&<p style={{fontSize:12,color:'var(--muted)'}}>Reconstructed from results currently recorded up to {report.displayEnd}; later matches are excluded.</p>}
      {type==='results'&&pages>1&&<div style={{display:'flex',alignItems:'center',gap:12}}><button disabled={pageIndex===0} onClick={()=>setPage(p=>p-1)}>Previous image</button><span>{pageIndex+1} of {pages}</span><button disabled={pageIndex===pages-1} onClick={()=>setPage(p=>p+1)}>Next image</button></div>}
      <MatchGraphic fixture={PLACEHOLDER} scorers={EMPTY} report={report}/>
    </>}
  </section>
}
