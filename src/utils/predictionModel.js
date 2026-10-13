import { disciplineEvidence, addSimulatedCards } from './simulatedDiscipline.js'
import { historicTeamName, HISTORIC_TEAM_ALIASES } from './historicTeams.js'
import { londonDay } from './weekendPredictions.js'

const clamp=(n,a,b)=>Math.max(a,Math.min(b,n))
const normalSeason=value=>String(value || '').replace(/-/g,'/')
export function competitionKey(name='') {
  const text=String(name).toLowerCase().replace(/[^a-z0-9]/g,'')
  if(text.includes('knockout'))return 'knockout-cup'
  if(text.includes('brianlatto')||text.includes('consolation'))return 'brian-latto-cup'
  if(text.includes('leaguecup'))return 'league-cup'
  if(text.includes('league'))return 'appin-league'
  return text
}
export function historyNames(teams) {
  const current=new Set(teams.map(t=>historicTeamName(t.name)))
  return [...new Set([...teams.map(t=>t.name),...Object.entries(HISTORIC_TEAM_ALIASES).filter(([,name])=>current.has(name)).map(([alias])=>alias)])]
}
async function fetchPages(query) {
  const rows=[]
  for(let from=0;;from+=1000){const {data,error}=await query().range(from,from+999);if(error)throw error;rows.push(...(data || []));if(!data || data.length<1000)return rows}
}
export async function loadPredictionEvidence(client,fixture,now=new Date()) {
  const teams=[fixture.home_team,fixture.away_team],ids=teams.map(t=>t.id)
  const asOf=new Date(Math.min(now.getTime(),new Date(fixture.fixture_date).getTime()))
  const names=historyNames(teams).map(name=>`"${name.replace(/\\/g,'\\\\').replace(/"/g,'\\"')}"`).join(',')
  const teamFilter=`home_team_id.in.(${ids.join(',')}),away_team_id.in.(${ids.join(',')})`
  const historyFilter=`${teamFilter},home_team_name.in.(${names}),away_team_name.in.(${names})`
  const [players,scorers,live,archive]=await Promise.all([
    fetchPages(()=>client.from('players').select('id,first_name,last_name,team_id').in('team_id',ids).order('id')),
    fetchPages(()=>client.from('fixture_scorers').select('fixture_id,player_id,team_id,goals,fixture:fixture_id(fixture_date,status,hidden_from_public,stage:stage_id(competition:competition_id(season)))').in('team_id',ids).order('id')),
    fetchPages(()=>client.from('fixtures').select('id,fixture_date,home_team_id,away_team_id,home_score,away_score,stage:stage_id(competition:competition_id(name,slug,season))').eq('status','played').eq('hidden_from_public',false).lt('fixture_date',asOf.toISOString()).or(teamFilter).order('fixture_date',{ascending:false}).order('id')),
    fetchPages(()=>client.from('historic_fixtures').select('id,source_fixture_id,season,fixture_date,competition_name,home_team_id,away_team_id,home_team_name,away_team_name,home_goals,away_goals').not('fixture_date','is',null).lte('fixture_date',londonDay(asOf)).or(historyFilter).order('fixture_date',{ascending:false}).order('id')),
  ])
  const [cards,refereeGames]=await Promise.all([
    fetchPages(()=>client.from('discipline_records').select('player_id,card_type,card_count,fixture:fixture_id!inner(fixture_date,status,hidden_from_public,referee_name)').eq('fixture.status','played').eq('fixture.hidden_from_public',false).lt('fixture.fixture_date',asOf.toISOString()).order('id')),
    fixture.referee_name ? fetchPages(()=>client.from('fixtures').select('id,fixture_date,status,hidden_from_public').eq('referee_name',fixture.referee_name).eq('status','played').eq('hidden_from_public',false).lt('fixture_date',asOf.toISOString()).order('id')) : [],
  ])
  return buildEvidence(fixture,{players,scorers,live,archive,cards,refereeGames},asOf)
}
export function buildEvidence(fixture,data,asOf=new Date()) {
  const teams=[fixture.home_team,fixture.away_team]
  const season=normalSeason(fixture.stage?.competition?.season)
  const comp=fixture.stage?.competition?.slug || competitionKey(fixture.stage?.competition?.name)
  const teamId=(id,name)=>teams.find(t=>t.id===id || historicTeamName(name)===historicTeamName(t.name))?.id || id
  const live=(data.live || []).map(f=>({id:f.id,date:new Date(f.fixture_date).getTime(),home:f.home_team_id,away:f.away_team_id,h:Number(f.home_score),a:Number(f.away_score),valid:f.home_score!=null&&f.away_score!=null,season:normalSeason(f.stage?.competition?.season),comp:f.stage?.competition?.slug || competitionKey(f.stage?.competition?.name)}))
  const liveIds=new Set(live.map(f=>f.id))
  const archive=(data.archive || []).filter(f=>!f.source_fixture_id || !liveIds.has(f.source_fixture_id)).map(f=>({id:f.id,date:Date.parse(`${String(f.fixture_date).slice(0,10)}T12:00:00Z`),home:teamId(f.home_team_id,f.home_team_name),away:teamId(f.away_team_id,f.away_team_name),h:Number(f.home_goals),a:Number(f.away_goals),valid:f.home_goals!=null&&f.away_goals!=null,season:normalSeason(f.season),comp:competitionKey(f.competition_name)}))
  const matches=[...live,...archive].filter(f=>f.valid&&Number.isFinite(f.date)&&f.date<asOf.getTime()).sort((a,b)=>b.date-a.date)
  const current=matches.filter(f=>f.season===season)
  const yearAgo=new Date(fixture.fixture_date);yearAgo.setUTCFullYear(yearAgo.getUTCFullYear()-1)
  const window=28*86400000
  const squads=teams.map(team=>{
    const goalTotals=new Map()
    for(const row of data.scorers || []) {
      const f=row.fixture
      if(row.team_id!==team.id || !f || f.status!=='played' || f.hidden_from_public!==false || new Date(f.fixture_date).getTime()>=asOf.getTime() || normalSeason(f.stage?.competition?.season)!==season)continue
      goalTotals.set(row.player_id,(goalTotals.get(row.player_id)||0)+Number(row.goals || 0))
    }
    // Current membership is authoritative: a transferred player stays with their new club.
    return (data.players || []).filter(p=>p.team_id===team.id).map(p=>({id:p.id,name:`${p.first_name || ''} ${p.last_name || ''}`.trim(),goals:goalTotals.get(p.id)||0})).filter(p=>p.name).sort((a,b)=>b.goals-a.goals || a.name.localeCompare(b.name))
  })
  const includesTeam=(match,team)=>match.home===team.id || match.away===team.id
  const direct=matches.filter(f=>(f.home===teams[0].id&&f.away===teams[1].id)||(f.home===teams[1].id&&f.away===teams[0].id)).slice(0,6)
  const competitions=teams.map(team=>{const rows=current.filter(f=>includesTeam(f,team)&&f.comp===comp);if(rows.length)return {rows,note:'Current season'};const historic=archive.filter(f=>f.valid&&includesTeam(f,team)&&f.comp===comp&&f.date<asOf.getTime()).sort((a,b)=>b.date-a.date);const latest=historic[0]?.season;return {rows:historic.filter(f=>f.season===latest),note:latest ? `${latest} (no current-season games yet)` : 'No recorded games'}})
  const factors=[
    {key:'meetings',label:'Previous meetings',home:teamStats(direct,teams[0]),away:teamStats(direct,teams[1]),note:'Last six recorded meetings'},
    {key:'form',label:'Current form',home:teamStats(current.filter(f=>includesTeam(f,teams[0])).slice(0,6),teams[0]),away:teamStats(current.filter(f=>includesTeam(f,teams[1])).slice(0,6),teams[1]),note:'Last six current-season games, all competitions'},
    {key:'competition',label:'Competition performance',home:teamStats(competitions[0].rows,teams[0]),away:teamStats(competitions[1].rows,teams[1]),note:`${fixture.stage?.competition?.name || 'This competition'}; ${teams[0].name}: ${competitions[0].note}; ${teams[1].name}: ${competitions[1].note}`},
    {key:'last-year',label:'Same period last year',home:teamStats(matches.filter(f=>includesTeam(f,teams[0])&&Math.abs(f.date-yearAgo.getTime())<=window),teams[0]),away:teamStats(matches.filter(f=>includesTeam(f,teams[1])&&Math.abs(f.date-yearAgo.getTime())<=window),teams[1]),note:'Games within four weeks either side of the same match date last year'},
  ]
  return {factors,squads,season,asOf:asOf.toISOString(),discipline:disciplineEvidence(fixture,data.cards || [],data.refereeGames || [],asOf)}
}
export function teamStats(matches,team) {
  let won=0,drawn=0,lost=0,gf=0,ga=0
  for(const f of matches){const home=f.home===team.id,forGoals=home ? f.h:f.a,against=home ? f.a:f.h;gf+=forGoals;ga+=against;if(forGoals>against)won++;else if(forGoals===against)drawn++;else lost++}
  return {played:matches.length,won,drawn,lost,gf,ga,points:won*3+drawn}
}
function pickWeighted(players,random,exclude=null) {
  const eligible=players.filter(p=>p.id!==exclude)
  if(!eligible.length)return null
  const weights=eligible.map(p=>1+Number(p.goals)*1.5),total=weights.reduce((a,b)=>a+b,0)
  let threshold=random()*total
  for(let i=0;i<eligible.length;i++){threshold-=weights[i];if(threshold<=0)return eligible[i]}
  return eligible.at(-1)
}
function poisson(mean,random){let product=1,k=0;const stop=Math.exp(-mean);do{product*=clamp(random(),1e-9,1-1e-9);k++}while(product>stop&&k<21);return k-1}
export function simulatePrediction(evidence,random=Math.random) {
  const pool=[...evidence.factors]
  for(let i=pool.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]]}
  const selected=pool.slice(0,3),omitted=pool[3]
  // Small samples are shrunk toward neutral ECFA scoring and points priors.
  const summarize=side=>selected.reduce((result,f)=>{const s=f[side],n=s.played;result.attack+=(s.gf+6)/(n+3)/3;result.defence+=(s.ga+6)/(n+3)/3;result.form+=(s.points+4.5)/(n+3)/3;return result},{attack:0,defence:0,form:0})
  const home=summarize('home'),away=summarize('away'),edge=Math.exp((home.form-away.form)*.2)
  const means=[clamp((home.attack+away.defence)/2*edge,.3,7),clamp((away.attack+home.defence)/2/edge,.3,7)]
  const scores=means.map(mean=>poisson(mean,random)),events=[],available=Array.from({length:89},(_,i)=>i+1)
  const takeMinute=()=>available.splice(Math.floor(random()*available.length),1)[0]
  for(let side=0;side<2;side++)for(let i=0;i<scores[side];i++){
    const scorer=pickWeighted(evidence.squads[side],random)
    const assist=random()<.8 ? pickWeighted(evidence.squads[side],random,scorer?.id) : null
    events.push({minute:takeMinute(),side:side ? 'away':'home',goal:true,kind:0,scorer,assist})
  }
  for(let i=0;i<7;i++){const side=random()<means[0]/(means[0]+means[1]) ? 0:1;events.push({minute:takeMinute(),side:side ? 'away':'home',goal:false,kind:Math.floor(random()*3),actor:pickWeighted(evidence.squads[side],random)})}
  const timeline=addSimulatedCards(events,evidence.squads,evidence.discipline,random,takeMinute)
  return {events:timeline.sort((a,b)=>a.minute-b.minute),selected,omitted,scores:[timeline.filter(e=>e.goal&&e.side==='home').length,timeline.filter(e=>e.goal&&e.side==='away').length],means}
}