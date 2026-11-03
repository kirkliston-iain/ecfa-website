import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { londonToday } from '../utils/publicMatches'
import { buildTeamAnalysis, normal, reportSeasons } from '../utils/teamAnalysis'
import { canDownloadTeamPacks, loadTeamAnalysisData } from '../utils/teamAnalysisData'
import { trackInteraction } from '../utils/webAnalytics'

const control = { padding:'11px 12px',border:'1px solid var(--line)',borderRadius:8,fontSize:15,width:'100%',background:'#fff',color:'var(--ink)',boxSizing:'border-box' }
const button = { padding:'12px 18px',border:0,borderRadius:8,background:'var(--ink)',color:'#fff',fontWeight:700,cursor:'pointer' }
export default function TeamReportDownload() {
  const today = londonToday(), seasons = reportSeasons(today)
  const [searchParams] = useSearchParams()
  const initialSeason = [...seasons,'all'].includes(searchParams.get('season')) ? searchParams.get('season') : seasons[0]
  const initialMode = searchParams.get('mode') === 'season' || initialSeason !== seasons[0] ? 'season' : 'to-date'
  const [access,setAccess] = useState(null), [data,setData] = useState(null), [error,setError] = useState('')
  const [teamId,setTeamId] = useState(''), [mode,setMode] = useState(initialMode), [season,setSeason] = useState(initialSeason), [month,setMonth] = useState(initialSeason === seasons[0] || initialSeason === 'all' ? today.slice(0,7) : `${initialSeason.slice(0,4)}-07`), [competition,setCompetition] = useState('')
  const [gameLimit,setGameLimit] = useState('')
  const [working,setWorking] = useState('')
  const [preview,setPreview] = useState(null)
  const previewUrls = useRef(new Set())
  useEffect(()=>()=>{previewUrls.current.forEach(url=>URL.revokeObjectURL(url));previewUrls.current.clear()},[])
  useEffect(()=>{
    let active=true
    async function check(){
      try { const allowed=await canDownloadTeamPacks();if(active){setAccess(allowed);if(!allowed)setData(null)} }
      catch(err){if(active){setAccess(false);setError(err.message)}}
    }
    check()
    const {data:listener}=supabase.auth.onAuthStateChange(()=>{setAccess(null);setData(null);window.setTimeout(check,0)})
    return()=>{active=false;listener.subscription.unsubscribe()}
  },[])
  useEffect(()=>{
    if(!access)return
    let active=true
    loadTeamAnalysisData(today).then(rows=>{if(active){setData(rows);setError('')}}).catch(err=>{if(active)setError(err.message)})
    return()=>{active=false}
  },[access,today])
  const teams=useMemo(()=>{
    if(!data)return []
    const names=new Set(data.matches.filter(f=>season==='all'||f.season===season).flatMap(f=>[normal(f.home),normal(f.away)]))
    return data.teams.filter(t=>names.has(normal(t.name))).sort((a,b)=>a.name.localeCompare(b.name))
  },[data,season])
  const team=teams.find(t=>t.id===teamId)
  const competitions=useMemo(()=>data&&team?[...new Set(data.matches.filter(f=>(season==='all'||f.season===season)&&(normal(f.home)===normal(team.name)||normal(f.away)===normal(team.name))).map(f=>f.competition))].sort():[],[data,team,season])
  const monthOptions=useMemo(()=>Array.from({length:season==='all'?24:12},(_,i)=>{
    const d=new Date(Date.UTC(Number((season==='all'?seasons[1]:season).slice(0,4)),6+i,1));return d.toISOString().slice(0,7)
  }).filter(m=>m<=today.slice(0,7)),[season,today])
  const gamesBySeason=useMemo(()=>{
    const counts=Object.fromEntries(reportSeasons(today).map(s=>[s,0]))
    if(data&&team)for(const f of data.matches){
      if(f.date<=today&&Object.hasOwn(counts,f.season)&&(normal(f.home)===normal(team.name)||normal(f.away)===normal(team.name))&&(!competition||f.competition===competition))counts[f.season]++
    }
    return counts
  },[data,team,competition,today])
  const maxGames=Math.min(500,season==='all'?Math.min(...Object.values(gamesBySeason)):gamesBySeason[season]||0)
  const selectedGameLimit=Math.min(maxGames,Number(gameLimit)||gamesBySeason[seasons[0]]||maxGames)
  const label=mode==='games'?`${season==='all'?'Both seasons':season} after ${selectedGameLimit} games${season==='all'?' each':''}`:mode==='month'?`${new Date(month+'-01T12:00:00Z').toLocaleDateString('en-GB',{month:'long',year:'numeric'})}`:season==='all'?`All seasons (${[...seasons].reverse().join(' + ')})`:`${season} ${mode==='to-date'?'season to date':'season'}`
  const report=useMemo(()=>{
    if(!team||!data)return null
    try{return buildTeamAnalysis(data,team,{mode,season,month,today,competition,label,gameLimit:selectedGameLimit})}catch{return null}
  },[team,data,mode,season,month,today,competition,label,selectedGameLimit])
  async function preparePdf(action){
    if(working||!report?.stats.p)return
    // Open during the click so mobile browsers do not block the viewer after awaits.
    let viewer=null
    setWorking(action);setError('')
    try{
      if(action==='view'){
        viewer=window.open('about:blank','_blank')
        if(viewer){viewer.opener=null;viewer.document.title='Preparing team PDF';viewer.document.body.textContent='Preparing your team analysis PDF…'}
      }
      if(!await canDownloadTeamPacks()) {setAccess(false);throw new Error('Please log in as a manager again.')}
      const {createTeamAnalysisPdf,loadTeamBadge,teamPackFilename}=await import('../utils/teamAnalysisPdf')
      const badge=await loadTeamBadge(team.logo_url)
      if(!badge)throw new Error('The team badge could not be loaded. Please try again so your pack includes the team logo.')
      if(!await canDownloadTeamPacks()){setAccess(false);throw new Error('Your manager session has ended. Please log in again.')}
      const pdf=createTeamAnalysisPdf(report,badge)
      if(action==='view'){
        const url=URL.createObjectURL(pdf.output('blob'))
        previewUrls.current.add(url)
        setPreview({url,report})
        if(viewer&&!viewer.closed)viewer.location.replace(url)
      }else pdf.save(teamPackFilename(report))
      trackInteraction(action==='view'?'view':'download',`Team analysis PDF: ${team.name} / ${label} / ${competition||'All competitions'}`)
    }catch(err){if(viewer&&!viewer.closed)viewer.close();setError(err.message||'The PDF could not be created.')}finally{setWorking('')}
  }
  return <div className="container" style={{maxWidth:920,padding:'30px 20px 48px'}}>
    <Link to="/downloads">← Downloads</Link>
    <h1 style={{marginBottom:8}}>Team download packs</h1>
    <p style={{color:'var(--muted)'}}>A phone-friendly portrait PDF with larger text, team colours, visual summaries and detailed performance analysis.</p>
    {error&&<p role="alert" style={{color:'#b3261e'}}>{error}</p>}
    {access===null?<p role="status">Checking manager access…</p>:!access?<section style={{padding:24,background:'#f0f3f6',borderRadius:12}}>
      <h2>Manager login required</h2><p>Log in with your manager code to choose a team and create a PDF pack.</p>
      <button style={button} onClick={()=>window.dispatchEvent(new Event('open-manager-gate'))}>Manager login</button>
    </section>:!data?<p role="status">Loading this season and last season's records…</p>:<>
      <section style={{padding:22,border:'1px solid var(--line)',borderRadius:12,background:'#fff'}}>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))',gap:16}}>
          <label>Team<select style={control} value={teamId} onChange={e=>{setTeamId(e.target.value);setCompetition('');setGameLimit('')}}><option value="">Choose a team</option>{teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
          <label>Report period<select style={control} value={mode} onChange={e=>{setMode(e.target.value);if(e.target.value==='to-date'){setSeason(seasons[0]);setMonth(today.slice(0,7));setCompetition('')}}}><option value="to-date">Current season to date</option><option value="games">After X games</option><option value="month">Choose a month</option><option value="season">Choose a season</option></select></label>
          <label>Season<select style={control} value={season} onChange={e=>{const s=e.target.value;setSeason(s);if(s!==seasons[0]&&mode==='to-date')setMode('season');setCompetition('');setMonth(s===seasons[0]||s==='all'?today.slice(0,7):`${s.slice(0,4)}-07`)}}>{seasons.map(s=><option key={s}>{s}</option>)}<option value="all">All — both seasons</option></select></label>
          {mode==='month'&&<label>Month<select style={control} value={month} onChange={e=>setMonth(e.target.value)}>{monthOptions.map(m=><option key={m} value={m}>{new Date(m+'-01T12:00:00Z').toLocaleDateString('en-GB',{month:'long',year:'numeric'})}</option>)}</select></label>}
          {mode==='games'&&<label>Number of games<select style={control} value={selectedGameLimit} disabled={!maxGames} onChange={e=>setGameLimit(e.target.value)}>
            {!maxGames?<option value={0}>Choose a team with completed games</option>:Array.from({length:maxGames},(_,i)=><option key={i+1} value={i+1}>{i+1} {i===0?'game':'games'}</option>)}
          </select></label>}
          <label>Competition<select style={control} value={competition} onChange={e=>{setCompetition(e.target.value);setGameLimit('')}}><option value="">All competitions</option>{competitions.map(c=><option key={c}>{c}</option>)}</select></label>
        </div>
        {mode==='games'&&team&&<p style={{fontSize:14,color:'var(--muted)',marginTop:16}}>{maxGames?`Counts the first ${selectedGameLimit} completed games ${season==='all'?'in each season':'of the selected season'}, using the competition filter above.`:'There are not enough recorded matches in the selected seasons and competition.'}</p>}
        {report&&<div style={{marginTop:20}}>
          <div style={{display:'flex',gap:14,alignItems:'center'}}>{team.logo_url&&<img src={team.logo_url} alt={`${team.name} badge`} style={{width:52,height:52,objectFit:'contain'}}/>}<div><strong>{team.name}</strong><div>{label} · {competition||'All competitions'}</div></div></div>
          <p>{report.stats.p} matches · {report.stats.w} wins · {report.stats.d} draws · {report.stats.l} losses · {report.stats.gf}-{report.stats.ga} goals</p>
          <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
            <button style={button} onClick={()=>preparePdf('view')} disabled={!!working||!report.stats.p}>{working==='view'?'Preparing preview…':'View PDF'}</button>
            <button style={{...button,background:'#fff',color:'var(--ink)',border:'1px solid var(--line)'}} onClick={()=>preparePdf('download')} disabled={!!working||!report.stats.p}>{working==='download'?'Creating your PDF…':'Download PDF'}</button>
          </div>
          {preview?.report===report&&<p role="status" style={{fontSize:14}}>PDF ready. <a href={preview.url} target="_blank" rel="noopener noreferrer">Open PDF viewer</a></p>}
          {!report.stats.p&&<p>No completed matches are recorded for this selection. Choose another period or competition.</p>}
        </div>}
      </section>
      <h2>Inside your pack</h2>
      <p>Performance overview and commentary; attack and defence; form and monthly trends; home and away; competitions; venue and referee win rates; opponent win rates and W/D/L records; Top 5 goalscorers and player goals by opponent and competition; recorded discipline; last-season comparison; complete results and scoring registers.</p>
      <p style={{fontSize:13,color:'var(--muted)'}}>Choose {seasons.join(' or ')}, or All to combine both seasons. Reports explain gaps in scorer and card coverage. Appearances, assists and other unrecorded statistics are not estimated.</p>
    </>}
  </div>
}
