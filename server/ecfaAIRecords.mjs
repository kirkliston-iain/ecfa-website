import { createClient } from '@supabase/supabase-js'
import { historicTeamName, HISTORIC_TEAM_ALIASES } from '../src/utils/historicTeams.js'
import { matchGoals, matchOutcome } from '../src/utils/askEcfa.mjs'

const PUBLIC_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVuemRzYnpzZ3R3cW9pY3Rpd2FtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkxODk5NzIsImV4cCI6MjEwNDc2NTk3Mn0.hm02pgtRZ1GoDihbXXZAgZ2-9LDpwkrc2GZnQjEtgNw'
export const todayLondon = () => new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
const norm = s => String(s || '').toLowerCase().replace(/[’']/g,'').replace(/[^a-z0-9]+/g,' ').trim()
const canon = s => norm(historicTeamName(s))
const seasonName = s => String(s || '').replace('-', '/')
const day = m => String(m.fixture_date || '').slice(0,10)
const sameTeam = (a,b) => canon(a) === canon(b)
const isLeague = m => /league/i.test(m.competition_name || '') && !/cup/i.test(m.competition_name || '')
export function normaliseMatches(live,historic) {
  const all = [...live.filter(m=>m.hidden_from_public===false).map(m=>({...m,season:seasonName(m.stage?.competition?.season),competition_name:m.stage?.competition?.name})), ...historic.map(m=>({...m,is_historic:true,status:'played',season:seasonName(m.season),home_score:m.home_goals,away_score:m.away_goals,home_team:{name:m.home_team_name},away_team:{name:m.away_team_name},venue:''}))]
  const seen = new Set()
  return all.filter(m=>{
    const key=[day(m),canon(m.home_team?.name),canon(m.away_team?.name),m.home_score,m.away_score].join('|')
    if(seen.has(key)) return false
    seen.add(key);return true
  }).sort((a,b)=>String(b.fixture_date).localeCompare(String(a.fixture_date)))
}
export function resolveTeam(input,matches) {
  if(!input) return ''
  const teams=[...new Set(matches.flatMap(m=>[m.home_team?.name,m.away_team?.name]).filter(Boolean).map(historicTeamName))]
  const aliases={...HISTORIC_TEAM_ALIASES,KCC:'Kirkliston Community Church',SES:'South East Saints',Chapel:'Charlotte Chapel',Liberton:'Liberton Church',Mission:'The Mission'}
  const alias=Object.entries(aliases).find(([a])=>norm(a)===norm(input))
  const target=alias?.[1] || input
  const exact=teams.find(t=>canon(t)===canon(target))
  if(exact) return exact
  const possible=teams.filter(t=>canon(t).includes(norm(target)))
  if(possible.length===1) return possible[0]
  throw new Error(possible.length ? `Please specify which team: ${possible.join(', ')}` : `No team named ${input} is in these records.`)
}
function matchView(m) {
 const [h,a]=matchGoals(m)
 return {id:m.id,date:m.fixture_date,season:m.season,competition:m.competition_name,home:historicTeamName(m.home_team?.name),away:historicTeamName(m.away_team?.name),score:m.status==='played'?`${h}-${a}`:null,status:m.status,venue:m.venue || null,referee:m.referee_name || null,penalties:m.decided_by_penalties?[m.home_penalty_score,m.away_penalty_score]:m.penalty_winner_name || null,url:`/fixtures/${m.id}`}
}
function scopeRows(matches,args,today) {
 const currentSeason = [...new Set(matches.map(m=>m.season).filter(Boolean))].sort().reverse()[0]
 const season = args.season === 'all' ? '' : args.season === 'current' || !args.season ? currentSeason : seasonName(args.season)
 const team=resolveTeam(args.team,matches),opponent=resolveTeam(args.opponent,matches)
 for(const key of ['from','through']) if(args[key] && (!/^\d{4}-\d{2}-\d{2}$/.test(args[key]) || Number.isNaN(Date.parse(args[key])))) throw Error('Use YYYY-MM-DD dates.')
 const rows=matches.filter(m=>(!season || m.season===season) && (!args.from || day(m)>=args.from) && (!args.through || day(m)<=args.through) && (!team || [m.home_team?.name,m.away_team?.name].some(t=>sameTeam(t,team))) && (!opponent || [m.home_team?.name,m.away_team?.name].some(t=>sameTeam(t,opponent))) && (!args.competition || norm(m.competition_name).includes(norm(args.competition).replace('brian latto','consolation'))) && (!args.scope || args.scope==='all' || (args.scope==='league'?isLeague(m):/cup/i.test(m.competition_name || ''))) && (!args.referee || norm(m.referee_name).includes(norm(args.referee))) && (!args.venue || norm(m.venue).includes(norm(args.venue))))
 return {rows,team,opponent,season:season || 'All recorded seasons',today}
}
export function analyseMatches(matches,args={},today=todayLondon()) {
 const selection=scopeRows(matches,args,today)
 const {team,opponent,season}=selection
 let rows=selection.rows.filter(m=>args.status==='scheduled'?m.status==='scheduled'&&day(m)>=today:m.status==='played'&&m.home_score!=null&&m.away_score!=null&&day(m)<=today)
 const sampleRows=rows
 const params=new URLSearchParams()
 if(team) params.set('team',team)
 if(opponent) params.set('opponent',opponent)
 if(season!=='All recorded seasons') params.set('season',season)
 if(args.scope && args.scope!=='all')params.set('scope',args.scope)
 if(args.competition)params.set('competition',args.competition)
 if(args.referee)params.set('referee',args.referee)
 if(args.venue)params.set('venue',args.venue)
 if(args.from)params.set('from',args.from)
 if(args.through)params.set('through',args.through)
 const sources=[{label:'Match history',to:`/matches?${params}`}]
 const scope={season,competitions:args.competition || args.scope || 'all',team:team || null,opponent:opponent || null,from:args.from || null,through:args.through || today,referee:args.referee || null,venue:args.venue || null}
 if(args.result && !team) throw Error('A win, draw or loss filter needs a team.')
 if(args.analysis==='streak' && !team) throw Error('Please name a team for a streak.')
 if(args.analysis==='streak') {
   let best=[],current=[]
   const accepted=args.streak==='wins'?['W']:args.streak==='losses'?['L']:['W','D']
   for(const m of [...rows].reverse()) { if(accepted.includes(matchOutcome(m,team))) { current.push(m);if(current.length>best.length)best=[...current] }else current=[] }
   const latest=[];for(const m of rows){if(!accepted.includes(matchOutcome(m,team)))break;latest.push(m)}
   const streak=args.longest?best.reverse():latest
   sources.unshift(...streak.slice(0,3).map(m=>({label:`${historicTeamName(m.home_team?.name)} v ${historicTeamName(m.away_team?.name)} · ${day(m)}`,to:`/fixtures/${m.id}`})))
   return {scope,streak:{type:args.streak || 'unbeaten',longest:Boolean(args.longest),games:streak.length,from:streak.length?day(streak[streak.length-1]):null,through:streak.length?day(streak[0]):null,recordBoundary:!args.longest&&streak.length===rows.length},matches:streak.slice(0,8).map(matchView),sources,coverage:'Recorded matches only. Penalty winners count as wins/losses; incomplete shootouts break streaks.'}
 }
 if(args.result)rows=rows.filter(m=>matchOutcome(m,team)===args.result)
 const totals={matches:rows.length,goals:0,goalsFor:0,goalsAgainst:0,wins:0,draws:0,losses:0,unknownOutcomes:0,cleanSheets:0}
 const groups=new Map()
 for(const m of rows) {
  const [h,a]=matchGoals(m);totals.goals+=h+a
  if(team){const home=sameTeam(m.home_team?.name,team);totals.goalsFor+=home?h:a;totals.goalsAgainst+=home?a:h;totals.cleanSheets+=(home?a:h)===0?1:0;const outcome=matchOutcome(m,team);totals[{W:'wins',D:'draws',L:'losses','?':'unknownOutcomes'}[outcome]]++}
  const names=args.groupBy==='competition'?[m.competition_name || 'Unrecorded']:args.groupBy==='season'?[m.season || 'Unrecorded']:args.groupBy==='referee'?[m.referee_name || 'Unrecorded']:args.groupBy==='venue'?[m.venue || 'Unrecorded']:args.groupBy==='team'?[m.home_team?.name,m.away_team?.name]:[]
  for(let name of names){if(!name)continue;if(args.groupBy==='team')name=historicTeamName(name);const row=groups.get(name)||{name,played:0,goals:0,goalsFor:0,goalsAgainst:0,wins:0,draws:0,losses:0,cleanSheets:0};row.played++;row.goals+=h+a
   if(args.groupBy==='team'){const home=sameTeam(m.home_team?.name,name);row.goalsFor+=home?h:a;row.goalsAgainst+=home?a:h;row.cleanSheets+=(home?a:h)===0?1:0;const outcome=matchOutcome(m,name);if(outcome!=='?')row[{W:'wins',D:'draws',L:'losses'}[outcome]]++}
   groups.set(name,row)
  }
 }
 totals.averageGoals=rows.length?Number((totals.goals/rows.length).toFixed(2)):0
 const metric=['played','goals','goalsFor','goalsAgainst','wins','draws','losses','cleanSheets'].includes(args.metric)?args.metric:'goalsFor'
 const table=[...groups.values()].map(row=>({...row,goalDifference:row.goalsFor-row.goalsAgainst,points:row.wins*3+row.draws})).sort((a,b)=>(args.ascending?a[metric]-b[metric]:b[metric]-a[metric]) || a.name.localeCompare(b.name))
 if(args.analysis==='biggest')rows=[...rows].sort((a,b)=>{const [ah,aa]=matchGoals(a),[bh,ba]=matchGoals(b);return args.metric==='goals'?(bh+ba)-(ah+aa):Math.abs(bh-ba)-Math.abs(ah-aa)})
 else if(args.order==='oldest' || args.status==='scheduled')rows=[...rows].reverse()
 if(args.result || args.analysis==='biggest' || args.status==='scheduled')sources.unshift(...rows.slice(0,3).map(m=>({label:`${historicTeamName(m.home_team?.name)} v ${historicTeamName(m.away_team?.name)} · ${day(m)}`,to:`/fixtures/${m.id}`})))
 const limit=Math.max(1,Math.min(20,Number(args.limit)||6))
 const tableLimit=Math.min(50,Number(args.limit)||20),cutoff=table[tableLimit-1]?.[metric]
 const visibleTable=table.filter((r,i)=>i<tableLimit || r[metric]===cutoff)
 return {scope,totals,table:visibleTable,tableTotal:table.length,matches:rows.slice(0,limit).map(matchView),sourceMatchCount:sampleRows.length,sources,coverage:'Public recorded results only; historical coverage may be incomplete. Extra-time final scores included; shootout goals excluded. Rankings are raw totals, not adjusted for games played. Tables computed here are statistical comparisons, not official standings.'}
}

export function createRecordReader(signal) {
 // Never use a service-role key: tools only see the same allowlisted fields as public visitors.
 const db=createClient('https://enzdsbzsgtwqoictiwam.supabase.co',process.env.SUPABASE_PUBLISHABLE_KEY || PUBLIC_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
 const cache=new Map()
 async function all(table,select,configure=q=>q) {
  const rows=[]
  for(let offset=0;;offset+=1000){const {data,error}=await configure(db.from(table).select(select)).order('id').range(offset,offset+999).abortSignal(signal);if(error)throw Error(`Public ${table} records are temporarily unavailable.`);rows.push(...(data||[]));if((data||[]).length<1000)return rows}
 }
 async function get(name) {
  if(cache.has(name))return cache.get(name)
  let promise
  if(name==='matches') promise=Promise.all([
    all('fixtures','id,fixture_date,status,hidden_from_public,venue,referee_name,home_score,away_score,went_to_extra_time,home_extra_time_score,away_extra_time_score,decided_by_penalties,home_penalty_score,away_penalty_score,home_team:home_team_id(name),away_team:away_team_id(name),stage:stage_id(competition:competition_id(name,season))',q=>q.eq('hidden_from_public',false)),
    all('historic_fixtures','id,season,competition_name,fixture_date,home_team_name,away_team_name,home_goals,away_goals,comment,penalty_winner_name,referee_name'),
  ]).then(([live,historic])=>normaliseMatches(live,historic))
  else if(name==='scorers') promise=Promise.all([
    all('historic_scorers','id,player_name,team_name,season,goals'),
    all('fixture_scorers','id,goals,player:player_id(id,first_name,last_name),team:team_id(name),fixture:fixture_id(id,fixture_date,status,hidden_from_public,stage:stage_id(competition:competition_id(name,season)))'),
  ])
  else if(name==='honours')promise=all('honours','id,season,competition,status,winner_name')
  else if(name==='referees')promise=all('referees','id,name,about,survey_answers')
  else if(name==='news')promise=all('news_stories','id,title,body,event_date,published_at',q=>q.eq('status','published'))
  else if(name==='teams')promise=all('teams','id,name,manager_name')
  else if(name==='sponsors')promise=all('sponsors','id,name,website_url',q=>q.eq('is_published',true))
  else throw Error('That public data source is unavailable.')
  cache.set(name,promise);return promise
 }
 return {get}
}
export function analyseScorers([historic,live],args={},today=todayLondon()) {
 const current=[...new Set(live.map(s=>seasonName(s.fixture?.stage?.competition?.season)).filter(Boolean))].sort().reverse()[0]
 const season=args.season==='all'?'':args.season==='current'||!args.season?current:seasonName(args.season)
 const scope=args.scope || 'all'
 const history=historic.filter(r=>!season||seasonName(r.season)===season)
 if(scope==='cup' && history.length) return {error:'Historical season-total scorer records cover league goals only. Cup-only historical player totals cannot be established from this source.',sources:[{label:'Goalscorers',to:'/goalscorers'}]}
 const historySeasons=new Set(history.map(r=>seasonName(r.season)))
 const rows=[...history.map(r=>({...r,competition:'League'})),...live.filter(r=>r.fixture?.hidden_from_public===false&&r.fixture.status==='played'&&String(r.fixture.fixture_date).slice(0,10)<=today&&(!season||seasonName(r.fixture.stage?.competition?.season)===season)&&!historySeasons.has(seasonName(r.fixture.stage?.competition?.season))).filter(r=>scope==='all'||(scope==='league'?isLeague({competition_name:r.fixture.stage?.competition?.name}):/cup/i.test(r.fixture.stage?.competition?.name || ''))).map(r=>({player_name:`${r.player?.first_name||''} ${r.player?.last_name||''}`.trim(),player_id:r.player?.id,team_name:r.team?.name,goals:Number(r.goals),season:seasonName(r.fixture.stage?.competition?.season)}))]
 const totals=new Map()
 for(const r of rows){if(args.team&&!canon(r.team_name).includes(norm(args.team)))continue;let name=r.player_name;if(/^(darron taylor|darron cairns|darran taylor)$/i.test(name))name='Darran Taylor';if(args.player&&!norm(name).includes(norm(args.player)))continue;const key=norm(name);if(!key)continue;const entry=totals.get(key)||{name,goals:0,teams:[],url:`/goalscorers?player=${encodeURIComponent(name)}`};entry.goals+=Number(r.goals)||0;const team=historicTeamName(r.team_name);if(team&&!entry.teams.includes(team))entry.teams.push(team);totals.set(key,entry)}
 const sorted=[...totals.values()].sort((a,b)=>b.goals-a.goals||a.name.localeCompare(b.name)),limit=Math.min(30,Math.max(1,args.limit||10)),cutoff=sorted[limit-1]?.goals
 return {season:season||'All recorded seasons',scope,players:sorted.filter((r,i)=>i<limit||r.goals===cutoff),coverage:history.length?'Historical scorer totals are league-only; newer live season totals follow the selected scope. These are recorded player goals, not all team goals.':'Recorded player goals in completed public fixtures; own/unattributed goals may not appear.',sources:[{label:'Goalscorers',to:`/goalscorers?season=${encodeURIComponent(season||'overall')}&competition=${scope==='league'?'League':scope==='cup'?'Cup':'all'}`} ]}
}
