import {useEffect,useState} from 'react'
import {supabase} from '../supabaseClient'

export default function FixtureResultOverride({fixture,onSaved}){
 const saved=fixture._resultOverride
 const [home,setHome]=useState(''),[away,setAway]=useState(''),[winner,setWinner]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('')
 useEffect(()=>{setHome(saved?.actual_home_score??fixture.home_score??'');setAway(saved?.actual_away_score??fixture.away_score??'');setWinner(saved?.winner_team_id||'');setMessage('')},[fixture.id,fixture.updated_at,fixture.home_score,fixture.away_score,saved])
 async function save(restore=false){
  if(busy)return
  if(!restore&&!winner){setMessage('Choose which team receives the 3–0 win.');return}
  if(home===''||away===''||![home,away].every(v=>Number.isInteger(Number(v))&&Number(v)>=0)){setMessage('Enter both actual scores as whole numbers, zero or more.');return}
  setBusy(true);setMessage('')
  const {error}=await supabase.rpc('set_fixture_result_override',{p_fixture_id:fixture.id,p_actual_home_score:Number(home),p_actual_away_score:Number(away),p_winner_team_id:restore?null:winner,p_expected_updated_at:fixture.updated_at})
  if(error){setMessage(error.message||'Could not save result override.');setBusy(false);return}
  await onSaved();setMessage(restore?'Actual result restored. Scorers retained.':'Official 3–0 result saved. Actual score and scorers retained.');setBusy(false)
 }
 if(fixture._overrideUnavailable)return <p role="alert" style={{fontSize:12}}>Result override controls unavailable. Refresh before editing the result.</p>
 if(!fixture.home_team||!fixture.away_team)return null
 return <details style={{margin:'12px 0',padding:12,border:'1px solid #c6ad69',borderRadius:8,background:'#faf7ee'}} open={saved?true:undefined}><summary style={{cursor:'pointer',fontSize:13,fontWeight:700,minHeight:32}}>Void result / award 3–0 {saved?'· active':''}</summary>
 <p style={{fontSize:12,lineHeight:1.5}}>Admin only. Keep the actual score here and enter scorers under Scorers &amp; cards. The public site and league table show only the official 3–0 result, with no void label. Save other fixture edits before using this control.</p>
 <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>{[[fixture.home_team.name,home,setHome],[fixture.away_team.name,away,setAway]].map(([label,value,set])=><label key={label} style={{fontSize:12,minWidth:0}}>{label} · actual goals<input type="number" min="0" step="1" value={value} onChange={e=>set(e.target.value)} style={{display:'block',width:'100%',padding:9,marginTop:4}}/></label>)}</div>
 <label style={{display:'block',fontSize:12,marginTop:10}}>Team receiving the official 3–0 win<select value={winner} onChange={e=>setWinner(e.target.value)} style={{display:'block',width:'100%',padding:10,marginTop:4}}><option value="">Choose team…</option>{[fixture.home_team,fixture.away_team].map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
 <div style={{display:'flex',flexWrap:'wrap',gap:8,marginTop:10}}><button type="button" disabled={busy} onClick={()=>save()} style={{padding:10,fontWeight:700}}>{busy?'Saving…':saved?'Save actual score / 3–0 override':'Void result — apply 3–0'}</button>{saved&&<button type="button" disabled={busy} onClick={()=>save(true)} style={{padding:10}}>Remove override &amp; restore actual result</button>}</div>{message&&<p role="status" style={{fontSize:12,lineHeight:1.5}}>{message}</p>}
 </details>
}
