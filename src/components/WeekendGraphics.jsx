import { useCallback, useEffect, useMemo, useState } from 'react'
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
  const includeScorers=params.get('scorers')==='1'
  const [scorerData,setScorerData]=useState(null)
  const [resultImage,setResultImage]=useState(null)
  const [tableImage,setTableImage]=useState(null)
  const [shareMessage,setShareMessage]=useState('')
  const receiveResults=useCallback(value=>setResultImage(value),[])
  const receiveTable=useCallback(value=>setTableImage(value),[])
  useEffect(()=>{let active=true;async function load(){try{
    const {data:comp,error:compError}=await supabase.from('competitions').select('id,name,season').eq('slug','appin-league').single();if(compError)throw compError
    const {data:stages,error:stageError}=await supabase.from('stages').select('id').eq('competition_id',comp.id).eq('stage_type','group');if(stageError)throw stageError
    const stageIds=stages.map(s=>s.id)
    const {data:members,error:memberError}=await supabase.from('stage_teams').select('team:team_id(id,name,logo_url)').in('stage_id',stageIds);if(memberError)throw memberError
    if(active)setLeague({...comp,stageIds,teams:[...new Map(members.filter(m=>m.team).map(m=>[m.team.id,m.team])).values()]})
  }catch{if(active)setError('Unable to load the league table. Please refresh and try again.')}}load();return()=>{active=false}},[])
  const weekend=useMemo(()=>weekendResults(matches.filter(f=>!f.is_historic),saturday).filter(f=>String(f.fixture_date).slice(0,10)===saturday),[matches,saturday])
  const tables=useMemo(()=>league?computeStandings(league.teams,matches.filter(f=>!f.is_historic && league.stageIds.includes(f.stage_id) && String(f.fixture_date).slice(0,10)<=saturday)):[],[matches,league,sunday])
  useEffect(()=>{let active=true
    if(!includeScorers)return
    setScorerData(null)
    const ids=weekend.map(f=>f.id)
    if(!ids.length){setScorerData({saturday,rows:[]});return}
    supabase.from('fixture_scorers').select('fixture_id,team_id,goals,player:player_id(first_name,last_name)').in('fixture_id',ids).then(({data,error})=>{if(active)setScorerData({saturday,rows:data||[],error:Boolean(error)})})
    return()=>{active=false}
  },[includeScorers,weekend,saturday])
  const perPage=includeScorers?3:6
  const pages=Math.max(1,Math.ceil(weekend.length/perPage))
  const pageIndex=Math.min(page,pages-1)
  const display=d=>new Date(`${d}T12:00:00`).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})
  const shared=useMemo(()=>({start:saturday,end:saturday,season:league?.season,displayStart:display(saturday),displayEnd:display(sunday)}),[saturday,sunday,league?.season])
  const report=useMemo(()=>{
    const rows=weekend.slice(pageIndex*perPage,pageIndex*perPage+perPage).map(f=>({...f,scorers:includeScorers?(scorerData?.rows||[]).filter(s=>s.fixture_id===f.id):[]}))
    return {...shared,type:'results',subtitle:`All competitions${pages>1?` · ${pageIndex+1} of ${pages}`:''}`,rows,badges:rows.flatMap(f=>[f.home_team?.logo_url,f.away_team?.logo_url]),page:pageIndex+1,includeScorers}
  },[weekend,pageIndex,perPage,pages,shared,includeScorers,scorerData])
  const tableReport=useMemo(()=>({...shared,type:'table',subtitle:league?.name||'ECFA League',rows:tables,badges:tables.map(r=>r.teamLogo)}),[shared,league?.name,tables])
  async function shareBoth(){
    if(!resultImage||!tableImage)return
    const files=[resultImage,tableImage].map(item=>new File([item.blob],item.filename,{type:'image/png'}))
    if(!navigator.canShare?.({files})){setShareMessage('Sharing two images is unavailable in this browser. Download each graphic and attach both to your chat.');return}
    try{await navigator.share({files,title:`ECFA Saturday round-up · ${shared.displayEnd}`});setShareMessage('Both graphics shared.')}catch(e){if(e.name!=='AbortError')setShareMessage('Sharing did not complete. You can download each graphic and attach both to your chat.')}
  }
  function update(values){const next=new URLSearchParams(params);for(const [key,value] of Object.entries(values))next.set(key,value);setParams(next,{replace:true});setPage(0)}
  const seasonStart=league?.season?.slice(0,4)
  const outsideSeason=league && (saturday < `${seasonStart}-07-01` || saturday > `${Number(seasonStart)+1}-06-30`)
  return <section style={{padding:18,border:'1px solid var(--line)',borderRadius:8,margin:'20px 0 30px'}}><h2 style={{fontSize:22,marginTop:0}}>Share Saturday results & table</h2><p style={{fontSize:13,color:'var(--muted)'}}>Create two graphics: (1) Saturday's recorded results from all competitions and (2) the league table after Saturday's matches. Select a Saturday below.</p>
    <div style={{display:'flex',flexWrap:'wrap',gap:12,alignItems:'center'}}><label>Saturday <input type="date" value={saturday} max={londonToday()} onChange={e=>{if(e.target.value)update({weekend:weekendStart(e.target.value)})}}/></label><label style={{display:'inline-flex',alignItems:'center',gap:6}}><input type="checkbox" checked={includeScorers} onChange={e=>update({scorers:e.target.checked?'1':'0'})}/>Include scorers on results</label><button onClick={()=>update({weekend:previousWeekend(londonToday())})}>Last Saturday</button></div>
    <p style={{fontSize:13}}>Saturday {report.displayStart} · {weekend.length} recorded {weekend.length===1?'result':'results'}</p>
    {outsideSeason?<p>Weekend round-up graphics currently cover the {league.season} season. Select a weekend within that season.</p>:<>
      <button disabled={!weekend.length||!league||Boolean(error)||!resultImage||!tableImage||(includeScorers&&(!scorerData||scorerData.saturday!==saturday||scorerData.error))} onClick={shareBoth}>Share Saturday results + league table</button>
      <p style={{fontSize:12,color:'var(--muted)',margin:'7px 0'}}>Shares 2 images: <strong>Saturday results{includeScorers?' with scorers':''}</strong> + <strong>league table</strong>. You can also share or download either graphic separately below.</p><p role="status" style={{fontSize:12}}>{shareMessage}</p>
      {weekend.length===0?<p>No completed Saturday matches recorded for this date.</p>:includeScorers&&(!scorerData||scorerData.saturday!==saturday)?<p>Loading scorers…</p>:includeScorers&&scorerData.error?<p role="alert">Unable to load scorers. Please turn the option off and on to retry.</p>:<>
        {pages>1&&<div style={{display:'flex',alignItems:'center',gap:12}}><button disabled={pageIndex===0} onClick={()=>setPage(p=>p-1)}>Previous results image</button><span>{pageIndex+1} of {pages}</span><button disabled={pageIndex===pages-1} onClick={()=>setPage(p=>p+1)}>Next results image</button></div>}
        {pages>1&&<p style={{fontSize:12}}>Saturday results span {pages} images. The share button sends the displayed results image (page {pageIndex+1}) plus the league table. Use the arrows to select another results page.</p>}
        <MatchGraphic fixture={PLACEHOLDER} scorers={EMPTY} report={report} onReady={receiveResults}/>
      </>}
      {error?<p role="alert">{error}</p>:!league?<p>Loading league table…</p>:<>
        <p style={{fontSize:12,color:'var(--muted)'}}>League table calculated from recorded matches through Saturday {shared.displayEnd}; later matches are excluded.</p>
        <MatchGraphic fixture={PLACEHOLDER} scorers={EMPTY} report={tableReport} onReady={receiveTable}/>
      </>}
    </>}
  </section>
}
