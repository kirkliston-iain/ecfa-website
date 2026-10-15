import { loadPublicMatches } from '../utils/publicMatches'
import { lastFiveForm } from '../utils/matchForm'
import { useEffect, useState } from 'react'
import { useSiteLogos } from '../contexts/SiteLogos'
import { supabase } from '../supabaseClient'
import { renderMatchGraphic, renderWeekendGraphic } from '../utils/matchGraphic'

export default function MatchGraphic({ fixture, scorers, report = null, onReady }) {
  const {siteLogo,sponsorLogo}=useSiteLogos()
  const [sponsors,setSponsors]=useState(null)
  const [format,setFormat]=useState('square')
  const [output,setOutput]=useState(null)
  const [error,setError]=useState('')
  const [message,setMessage]=useState('')
  const [busy,setBusy]=useState(false)
  const [form,setForm]=useState(null)
  const [formError,setFormError]=useState(false)
  useEffect(()=> {
    if(report)return
    let active=true;setForm(null);setFormError(false)
    loadPublicMatches().then(matches=>{if(active)setForm({home:lastFiveForm(matches,fixture.home_team,fixture),away:lastFiveForm(matches,fixture.away_team,fixture)})}).catch(()=>{if(active){setFormError(true);setForm({home:[],away:[]})}})
    return()=>{active=false}
  },[fixture,report])
  const league=siteLogo('ecfa')
  const appin=sponsorLogo('Appin Sports')
  useEffect(()=> { let active=true; supabase.from('sponsors').select('name,logo_url').eq('is_published',true).order('sort_order').then(({data,error})=> {if(active)setSponsors(error?[{name:'Appin Sports',logo_url:appin}]:data||[]) }); return ()=>{active=false} },[appin])
  const sponsorKey=JSON.stringify(sponsors)
  useEffect(()=> {
    let active=true; let url
    setOutput(null); setError(''); setMessage('')
    if(!sponsors || !scorers || (!report && !form)) return
    (report ? renderWeekendGraphic.bind(null,report) : renderMatchGraphic.bind(null,{...fixture,form:formError?null:form},scorers))({league,sponsors:sponsors.map(s=>({name:s.name,url:sponsorLogo(s.name)||s.logo_url}))},format==='story').then(result=> {
      if(!active)return
      url=URL.createObjectURL(result.blob); setOutput({...result,url})
    }).catch(()=>{if(active)setError('Unable to generate the image. Please refresh and try again.')})
    return ()=>{active=false;if(url)URL.revokeObjectURL(url)}
  },[fixture,scorers,report,form,formError,format,league,sponsorKey,appin])
  const filename=report ? `ecfa-${report.type}-${report.end}-${report.page || 1}-${format}.png` : `ecfa-${fixture.status==='played'?'result':'fixture'}-${fixture.id}-${format}.png`
  useEffect(() => { onReady?.(output ? { blob: output.blob, filename } : null) }, [output, filename, onReady])
  const shareUrl = `${window.location.origin}${report ? (report.sharePath || `/matchday-graphics?weekend=${report.start}&type=${report.type}`) : `/fixtures/${fixture.id}`}`
  async function shareLink() { try { if(navigator.share) await navigator.share({title:'ECFA match details',url:shareUrl,text:'View the full details on the ECFA website'}); else {await navigator.clipboard.writeText(shareUrl);setMessage('Website link copied.')} } catch(e) {if(e.name!=='AbortError')setMessage('Could not share the link. Please use Copy page link.')} }
  async function share() {
    if(!output)return
    const file=new File([output.blob],filename,{type:'image/png'})
    if(!navigator.canShare?.({files:[file]})) {setMessage('Image sharing is unavailable in this browser. Download the image and attach it to your chat.');return}
    setBusy(true)
    try {await navigator.share({files:[file],title:report ? `ECFA ${report.type} · ${report.end}` : `${fixture.home_team?.name} v ${fixture.away_team?.name}`,text:`Full details: ${shareUrl}`,url:shareUrl});setMessage('Image shared. Some apps omit links attached to images; use Share website link to send a clickable link.')} catch(e) {if(e.name!=='AbortError')setMessage('Sharing did not complete. You can download the image and attach it to your chat.')} finally {setBusy(false)}
  }
  return <section style={{margin:'24px 0',padding:18,border:'1px solid var(--line)',borderRadius:8}}><h2 style={{fontSize:20,marginTop:0}}>{report ? `Share ${report.type === 'fixtures' ? 'fixtures' : report.type === 'table' ? 'the league table' : 'weekend results'}` : 'Share a matchday graphic'}</h2><p style={{fontSize:13,color:'var(--muted)'}}>{report ? 'Share this graphic into your chats, or download it for a post.' : 'Send an ECFA fixture or result image to your own chats, or download it for a post.'}</p>
    <label>Image size <select value={format} onChange={e=>setFormat(e.target.value)}><option value="square">Square · 1080 × 1080</option><option value="story">Story · 1080 × 1920</option></select></label>
    {formError && !report && <p role="status" style={{fontSize:12}}>Form is temporarily unavailable; this graphic omits it.</p>}
    {error?<p role="alert">{error}</p>:!output?<p>Preparing your graphic…</p>:<><img src={output.url} alt={report ? `ECFA ${report.type} graphic preview` : `${fixture.home_team?.name} versus ${fixture.away_team?.name} ${fixture.status==='played'?'result':'fixture'} graphic preview`} style={{display:'block',width:'100%',maxWidth:420,margin:'18px auto',borderRadius:6}}/>
    {output.missing.length>0 && <p style={{fontSize:12}}>Some badges could not load; initials are shown instead.</p>}
    <div style={{display:'flex',flexWrap:'wrap',gap:10}}><button disabled={busy} onClick={share}>{busy?'Sharing…':'Share image + link'}</button><button disabled={busy} onClick={shareLink}>Share clickable website link</button><a href={output.url} download={filename} style={{padding:'8px 12px',border:'1px solid var(--brass)',borderRadius:5}}>Download image</a><button onClick={async()=>{try{await navigator.clipboard.writeText(report ? report.sharePath ? `${window.location.origin}${report.sharePath}` : `${window.location.origin}/matchday-graphics?weekend=${report.start}&type=${report.type}` : `${window.location.origin}/fixtures/${fixture.id}`);setMessage(report ? 'Page link copied.' : 'Match link copied.')}catch{setMessage(report ? `Page link: ${window.location.origin}/matchday-graphics?weekend=${report.start}&type=${report.type}` : `Match link: ${window.location.origin}/fixtures/${fixture.id}`)}}}>{report ? 'Copy page link' : 'Copy match link'}</button></div></>}
    <p role="status" style={{fontSize:13}}>{message}</p>
  </section>
}
