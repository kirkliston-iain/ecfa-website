import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { londonToday } from '../utils/publicMatches'
import { buildTeamAnalysis, normal, reportSeasons } from '../utils/teamAnalysis'
import { canDownloadTeamPacks, loadTeamAnalysisData } from '../utils/teamAnalysisData'
import { trackInteraction } from '../utils/webAnalytics'

const control = { padding:'11px 12px',border:'1px solid var(--line)',borderRadius:8,fontSize:15,width:'100%',background:'#fff',color:'var(--ink)',boxSizing:'border-box' }
const button = { padding:'12px 18px',border:0,borderRadius:8,background:'var(--ink)',color:'#fff',fontWeight:700,cursor:'pointer' }
export default function TeamReportDownload() {
  const today = londonToday(), seasons = reportSeasons(today)
  const [access,setAccess] = useState(null), [data,setData] = useState(null), [error,setError] = useState('')
  const [teamId,setTeamId] = useState(''), [mode,setMode] = useState('to-date'), [season,setSeason] = useState(seasons[0]), [month,setMonth] = useState(today.slice(0,7)), [competition,setCompetition] = useState('')
  const [working,setWorking] = useState(false)
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
    const names=new Set(data.matches.filter(f=>f.season===season).flatMap(f=>[normal(f.home),normal(f.away)]))
    return data.teams.filter(t=>names.has(normal(t.name))).sort((a,b)=>a.name.localeCompare(b.name))
  },[data,season])
  const team=teams.find(t=>t.id===teamId)
  const competitions=useMemo(()=>data&&team?[...new Set(data.matches.filter(f=>f.season===season&&(normal(f.home)===normal(team.name)||normal(f.away)===normal(team.name))).map(f=>f.competition))].sort():[],[data,team,season])
  const monthOptions=useMemo(()=>Array.from({length:12},(_,i)=>{
    const d=new Date(Date.UTC(Number(season.slice(0,4)),6+i,1));return d.toISOString().slice(0,7)
  }).filter(m=>m<=today.slice(0,7)),[season,today])
  const label=mode==='month'?`${new Date(month+'-01T12:00:00Z').toLocaleDateString('en-GB',{month:'long',year:'numeric'})}`:`${season} ${mode==='to-date'?'season to date':'season'}`
  const report=useMemo(()=>{
    if(!team||!data)return null
    try{return buildTeamAnalysis(data,team,{mode,season,month,today,competition,label})}catch{return null}
  },[team,data,mode,season,month,today,competition,label])
  async function download(){
    setWorking(true);setError('')
    try{
      if(!await canDownloadTeamPacks()) {setAccess(false);throw new Error('Please log in as a manager again.')}
      const {createTeamAnalysisPdf,loadTeamBadge,teamPackFilename}=await import('../utils/teamAnalysisPdf')
      const badge=await loadTeamBadge(team.logo_url)
      if(!badge)throw new Error('The team badge could not be loaded. Please try again so your pack includes the team logo.')
      if(!await canDownloadTeamPacks()){setAccess(false);throw new Error('Your manager session has ended. Please log in again.')}
      createTeamAnalysisPdf(report,badge).save(teamPackFilename(report))
      trackInteraction('download',`Team analysis PDF: ${team.name} / ${label} / ${competition||'All competitions'}`)
    }catch(err){setError(err.message||'The PDF could not be created.')}finally{setWorking(false)}
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
          <label>Team<select style={control} value={teamId} onChange={e=>{setTeamId(e.target.value);setCompetition('')}}><option value="">Choose a team</option>{teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
          <label>Report period<select style={control} value={mode} onChange={e=>{setMode(e.target.value);if(e.target.value==='to-date'){setSeason(seasons[0]);setMonth(today.slice(0,7));setCompetition('')}}}><option value="to-date">Current season to date</option><option value="month">Choose a month</option><option value="season">Choose a season</option></select></label>
          <label>Season<select style={control} disabled={mode==='to-date'} value={season} onChange={e=>{const s=e.target.value;setSeason(s);setCompetition('');setMonth(s===seasons[0]?today.slice(0,7):`${s.slice(0,4)}-07`)}}>{seasons.map(s=><option key={s}>{s}</option>)}</select></label>
          {mode==='month'&&<label>Month<select style={control} value={month} onChange={e=>setMonth(e.target.value)}>{monthOptions.map(m=><option key={m} value={m}>{new Date(m+'-01T12:00:00Z').toLocaleDateString('en-GB',{month:'long',year:'numeric'})}</option>)}</select></label>}
          <label>Competition<select style={control} value={competition} onChange={e=>setCompetition(e.target.value)}><option value="">All competitions</option>{competitions.map(c=><option key={c}>{c}</option>)}</select></label>
        </div>
        {report&&<div style={{marginTop:20}}>
          <div style={{display:'flex',gap:14,alignItems:'center'}}>{team.logo_url&&<img src={team.logo_url} alt={`${team.name} badge`} style={{width:52,height:52,objectFit:'contain'}}/>}<div><strong>{team.name}</strong><div>{label} · {competition||'All competitions'}</div></div></div>
          <p>{report.stats.p} matches · {report.stats.w} wins · {report.stats.d} draws · {report.stats.l} losses · {report.stats.gf}-{report.stats.ga} goals</p>
          <button style={button} onClick={download} disabled={working||!report.stats.p}>{working?'Creating your PDF…':'Download mobile-friendly PDF'}</button>
          {!report.stats.p&&<p>No completed matches are recorded for this selection. Choose another period or competition.</p>}
        </div>}
      </section>
      <h2>Inside your pack</h2>
      <p>Performance overview and commentary; attack and defence; form and monthly trends; home and away; competitions; venue and referee win rates; bogey teams and most successful opponents; player goals by opponent and competition; recorded discipline; last-season comparison; complete results and scoring registers.</p>
      <p style={{fontSize:13,color:'var(--muted)'}}>Only {seasons.join(' and ')} are available. Reports explain gaps in scorer and card coverage. Appearances, assists and other unrecorded statistics are not estimated.</p>
    </>}
  </div>
}
