import { analyseMatches, analyseScorers, resolveTeam, todayLondon } from './ecfaRecords.mjs'
import { mentionedTeams, normalise, dateLabel, matchOutcome, matchGoals } from '../src/utils/askEcfa.mjs'
import { historicTeamName } from '../src/utils/historicTeams.js'
import handbook from './ecfaHandbook.json' with { type: 'json' }

const norm = normalise
const sameTeam = (a,b) => norm(historicTeamName(a)) === norm(historicTeamName(b))
const shift=(date,n)=>{const d=new Date(`${date}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}
const plural=(n,word)=>`${n.toLocaleString('en-GB')} ${n===1?word:word.endsWith('loss')||word.endsWith('match')?word+'es':word.endsWith('y')?word.slice(0,-1)+'ies':word+'s'}`
const source=(label,to)=>({label,to})
function dateTokens(question) {
 const rows=[]
 const patterns=[/\b\d{4}-\d{2}-\d{2}\b/g,/\b\d{1,2}\/\d{1,2}\/\d{4}\b/g,/\b\d{1,2}(?:st|nd|rd|th)?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+20\d{2}\b/gi]
 for(const pattern of patterns)for(const match of question.matchAll(pattern)){
  const raw=match[0];let date
  if(/^\d{4}-/.test(raw))date=raw
  else if(raw.includes('/')){const [d,m,y]=raw.split('/');date=`${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`}
  else {const value=new Date(`${raw.replace(/(\d)(st|nd|rd|th)/gi,'$1')} 12:00 UTC`);if(!Number.isNaN(value.getTime()))date=value.toISOString().slice(0,10)}
  if(!date||Number.isNaN(Date.parse(`${date}T12:00:00Z`))||new Date(`${date}T12:00:00Z`).toISOString().slice(0,10)!==date)throw Error('Please use a valid date, such as 24 October 2026 or 2026-10-24.')
  rows.push({date,index:match.index})
 }
 return rows.sort((a,b)=>a.index-b.index)
}
export function questionFilters(question,matches,today=todayLondon()) {
 const q=norm(question),withoutDates=question.replace(/\b\d{4}-\d{2}-\d{2}\b/g,'').replace(/\b\d{1,2}\/\d{1,2}\/\d{4}\b/g,'')
 const current=[...new Set(matches.map(m=>m.season?.replace('-','/')).filter(Boolean))].sort().reverse()[0]
 const match=withoutDates.match(/\b(20\d{2}|\d{2})\s*[/–-]\s*(20\d{2}|\d{2})\b/)
 const explicit=match?`${match[1].length===2?'20':''}${match[1]}/${match[2].slice(-2)}`:''
 const historical=/\b(last (?:lose|lost|loss|defeat|win|won|beat|draw|drew|play|played|meet|met|meeting)|last time|latest (?:loss|defeat)|most recent|previous meetings?|head to head|all time|ever|overall|history|longest|first (?:time|game|meeting))\b/.test(q)
 const filters={season:explicit || (/\b(this|current) season\b/.test(q)?'current':/\blast season\b/.test(q)?`${Number(current?.slice(0,4))-1}/${String(Number(current?.slice(0,4))).slice(-2)}`:historical?'all':'current'),scope:/\b(all competitions|across competitions)\b/.test(q)?'all':/\bcups?\b/.test(q)?'cup':/\bleague\b/.test(q)?'league':'all'}
 if(/knockout/.test(q))filters.competition='Knockout'
 else if(/league cup/.test(q))filters.competition='League Cup'
 else if(/brian latto|consolation/.test(q))filters.competition='Consolation'
 const teams=mentionedTeams(question,matches)
 if(teams.length>2)throw Error('Please name one team, or two teams for a comparison.')
 if(teams[0])filters.team=teams[0]
 if(teams[1])filters.opponent=teams[1]
 const dates=dateTokens(question)
 if(dates.length>2)throw Error('Please use one date or a start and end date.')
 if(dates.length===2){filters.from=dates[0].date;filters.through=dates[1].date;filters.season='all'}
 else if(dates.length===1){const date=dates[0].date;filters.season='all';if(/\bbefore\b/.test(q))filters.through=shift(date,-1);else if(/\b(after|since|from)\b/.test(q))filters.from=/\bafter\b/.test(q)?shift(date,1):date;else filters.from=filters.through=date}
 else if(/\bbefore yesterday\b/.test(q)){filters.through=shift(today,-2);filters.season=explicit||'all'}
 else if(/\bbefore today\b/.test(q)){filters.through=shift(today,-1);filters.season=explicit||'all'}
 else if(/\byesterday\b/.test(q)){filters.from=filters.through=shift(today,-1);filters.season='all'}
 else if(/\btoday\b/.test(q)&&!/\bup to today\b/.test(q)){filters.from=filters.through=today;filters.season='all'}
 else if(/\b(last|past|previous) \d+ days\b/.test(q)){const days=Number(q.match(/\b(?:last|past|previous) (\d+) days\b/)[1]);if(days>3660)throw Error('Please use a shorter date range.');filters.from=shift(today,-days+1);filters.season='all'}
 else if(/\bsince\b/.test(q)&&explicit){const earliest=matches.filter(m=>m.season?.replace('-','/')===explicit).map(m=>String(m.fixture_date).slice(0,10)).sort()[0];if(!earliest)throw Error(`No matches are recorded for ${explicit}.`);filters.from=earliest;filters.season='all'}
 else if(/\bin 20\d{2}\b/.test(q)&&!explicit){const year=q.match(/\bin (20\d{2})\b/)[1];filters.from=`${year}-01-01`;filters.through=`${year}-12-31`;filters.season='all'}
 else if(/\b(since|before|after)\b/.test(q)||(/\bbetween\b/.test(q)&&teams.length!==2))throw Error('Please include dates in the question, such as “since 1 August 2025” or “before 24 October 2026”.')
 return filters
}
function context(result) {
 const s=result.scope
 return `${s.season} · ${s.competitions==='all'?'All competitions':s.competitions==='league'?'League only':s.competitions==='cup'?'Cups only':s.competitions}${s.from?` · From ${dateLabel(s.from)}`:''}${s.through?` · Through ${dateLabel(s.through)}`:''}`
}
function matchText(m) {return `${m.home} ${m.score || 'v'} ${m.away} — ${dateLabel(String(m.date).slice(0,10))} (${m.competition})${Array.isArray(m.penalties)?`; penalties ${m.penalties.join('–')}`:''}`}
function response(text,result,extra={}) {return {text,matches:[],links:result?.sources||[source('Match history','/matches')],context:result?.scope?context(result):'Public ECFA records',mode:'records',...extra}}
function unsupported() {return response('I couldn’t match that question to a recorded statistic. Ask about results, goals, scorers, team form, unbeaten runs, previous meetings, upcoming fixtures or trophy winners. Include the team or player name and any dates.',null,{supported:false})}
function namedPlayer(question,[historic,live]) {
 const aliases={'darron taylor':'darran taylor','darron cairns':'darran taylor'}
 const names=[...new Set([...historic.map(p=>p.player_name),...live.map(p=>`${p.player?.first_name||''} ${p.player?.last_name||''}`.trim())].filter(Boolean))]
 const q=` ${norm(question)} `
 const matched=names.filter(name=>q.includes(` ${norm(name)} `))
 for(const [alias,name]of Object.entries(aliases))if(q.includes(` ${alias} `))matched.push(name)
 return [...new Set(matched.map(name=>aliases[norm(name)]||name))]
}
export async function answerFromRecords(question,reader,{today=todayLondon()}={}) {
 const matches=await reader.get('matches')
 const q=norm(question)
 let filters
 try{filters=questionFilters(question,matches,today)}catch(error){return response(error.message,null,{supported:false})}
 if(/\b(referee|referees|refereed|reffed|officiated)\b/.test(q)) {
  const refs=await reader.get('referees'),named=refs.filter(r=>q.includes(norm(r.name)))
  if(named.length===1)filters.referee=named[0].name
  if(/\b(how many|number of|total)\b/.test(q)&&/\b(games|matches)\b/.test(q)&&!filters.referee)return response('Please include the referee’s full name as shown on their profile.',null,{supported:false,links:[source('Referee profiles','/referees')]})
 }
 const bases=['Jack Kane','Saughton','Gyle','Peffermill','Newcraighall']
 const venue=bases.find(name=>q.includes(norm(name)))
 if(venue)filters.venue=venue
 if(/\b\d{1,2}:\d{2}\b/.test(question))return response('Kick-off-time filtering is not supported in this question box yet. Open match history to check the individual fixtures.',null,{supported:false})
 if(!filters.team&&/\b(?:for|by|against) (?!all\b|the\b|ecfa\b|our\b|this\b|last\b|current\b|each\b|every\b|season\b)[a-z]/.test(q)&&!/\b(by competition|by season)\b/.test(q))return response('I couldn’t match that team or player name. Please use the full name shown on the website.',null,{supported:false})
 if(/\b(trophies|trophy|honours|honors|champions|winner|winners|won the league|won the cup)\b/.test(q)) {
  if(!/\b(this|current|last) season\b/.test(q)&&!question.match(/\b(?:20\d{2}|\d{2})\s*[/–-]\s*(?:20\d{2}|\d{2})\b/))filters.season='all'
  const rows=await reader.get('honours'),selection=analyseMatches(matches,filters,today)
  const season=selection.scope.season
  const wins=rows.filter(r=>r.status==='winner'&&r.winner_name&&(!filters.team||sameTeam(r.winner_name,filters.team))&&(season==='All recorded seasons'||r.season?.replace('-','/')===season)&&(!filters.competition||norm(r.competition).includes(norm(filters.competition)))&&(filters.scope==='all'||(filters.scope==='league'?/league/i.test(r.competition)&&!/cup/i.test(r.competition):/cup/i.test(r.competition))))
  if(filters.from||filters.through)return response('Trophy winners are recorded by season. Please ask for a specific season or all-time honours; precise award dates aren’t recorded.',null,{supported:false,links:[source('Honours','/honours')]})
  const label=filters.team||'ECFA'
  return response(wins.length?`${label}: ${plural(wins.length,'recorded trophy')} in this selection.\n\n${wins.slice(0,20).map(r=>`${r.season} · ${r.competition} · ${historicTeamName(r.winner_name)}`).join('\n')}${wins.length>20?'\nView Honours for the complete list.':''}`:`No trophy winner is recorded for this selection.`,selection,{links:[source('Honours','/honours')]})
 }
 if(/\b(scorer|scorers|goalscorer|goalscorers|scored|goals)\b/.test(q)&&!/\b(conceded|defence|defense|attack|against|per game|per match|average|total goals|goals have been|goals were|goals scored across)\b/.test(q)) {
  const data=await reader.get('scorers'),players=namedPlayer(question,data)
  const personalName = !filters.team && /\b(?:has|have|did|does) (?!been\b).+ (?:scored|score)\b/.test(q)
  const isPlayerQuestion=players.length||personalName||/\b(who|top|leading|scorer|scorers|goalscorer|goalscorers|player|players)\b/.test(q)
  if(isPlayerQuestion){
   if(filters.from||filters.through)return response('Player scoring totals here are recorded by season. Please include a season or ask for all-time goals; use a player page for match-by-match scoring history.',null,{supported:false,links:[source('Goalscorers','/goalscorers')]})
   if(personalName&&!players.length)return response('I couldn’t match that player or team name. Please use the full name shown on the website.',null,{supported:false,links:[source('Goalscorers','/goalscorers'),source('Teams','/teams')]})
   if(players.length>1)return response('Please ask about one player at a time.',null,{supported:false})
   const count=Math.min(20,Number(q.match(/\btop (\d+)\b/)?.[1])||5)
   const result=analyseScorers(data,{season:filters.season,scope:filters.scope,team:filters.team,player:players[0],limit:count},today)
   if(result.error)return response(result.error,null,{supported:false,links:result.sources})
   const text=result.players.length?`${players[0]?'Recorded goals':'Leading recorded scorers'}${filters.team?` for ${filters.team}`:''}:\n\n${result.players.map(p=>`${p.name}: ${plural(p.goals,'goal')}${p.teams.length?` · ${p.teams.join(', ')}`:''}`).join('\n')}\n\n${result.coverage}`:'No matching player scoring records were found.'
   return response(text,null,{context:`${result.season} · ${result.scope==='all'?'All available scorer records':result.scope}`,links:result.sources,supported:true})
  }
 }
 if(/\b(next|upcoming|coming up|coming fixtures)\b/.test(q)) {
  const result=analyseMatches(matches,{...filters,status:'scheduled',limit:filters.team?3:8},today)
  return response(result.matches.length?`Upcoming fixtures (${result.totals.matches} recorded):\n\n${result.matches.map(m=>`${matchText(m)}${m.venue&&!/^(n\/?a|tbc|tbd)$/i.test(m.venue)?` · ${m.venue}`:''}`).join('\n')}`:'No upcoming fixtures are recorded for this selection.',result,{context:`${result.scope.season} · ${result.scope.competitions==='all'?'All competitions':result.scope.competitions} · Upcoming from ${dateLabel(today)}`})
 }
 if(filters.team&&/\b(unbeaten|undefeated|without losing|winning streak|losing streak|wins in a row|losses in a row)\b/.test(q)) {
  const result=analyseMatches(matches,{...filters,analysis:'streak',streak:/\b(winning|wins in a row)\b/.test(q)?'wins':/\b(losing|losses in a row)\b/.test(q)?'losses':'unbeaten',longest:/\blongest\b/.test(q)},today),s=result.streak
  return response(`${filters.team}: ${s.longest?'longest recorded':'current recorded'} ${s.type==='unbeaten'?'unbeaten run':s.type==='wins'?'winning run':'losing run'} of ${plural(s.games,'game')}.${s.games?` From ${dateLabel(s.from)} to ${dateLabel(s.through)}.`:''}${s.recordBoundary?' This reaches the start of the available records.':''}`,result)
 }
 const last=/\b(last|latest|most recent|previous meeting|last time|first meeting|first time)\b/.test(q)&&!/\blast season\b/.test(q)
 if(filters.team&&last){
  const result=analyseMatches(matches,{...filters,result:/\b(lose|lost|loss|defeat|beaten)\b/.test(q)?'L':/\b(win|won|beat|victory)\b/.test(q)?'W':/\b(draw|drew|drawn)\b/.test(q)?'D':undefined,order:/\bfirst\b/.test(q)?'oldest':'newest',limit:1},today)
  return response(result.matches.length?`The ${/\bfirst\b/.test(q)?'earliest':'most recent'} matching recorded result is:\n\n${matchText(result.matches[0])}.`:'No matching completed result was found in the available records.',result)
 }
 const ranking=/\b(best|worst|most|fewest|highest|lowest|biggest)\b/.test(q)
 if(ranking){
  if(/\b(biggest win|biggest defeat|highest scoring|biggest score)\b/.test(q)){
   const result=analyseMatches(matches,{...filters,analysis:'biggest',result:filters.team?/biggest defeat/.test(q)?'L':/biggest win/.test(q)?'W':undefined:undefined,metric:/highest scoring|biggest score/.test(q)?'goals':'goalsFor',limit:3},today)
   return response(result.matches.length?`Largest matching results:\n\n${result.matches.map(matchText).join('\n')}`:'No matching completed results are recorded.',result)
  }
  const metric=/defen[cs]e|conceded/.test(q)?'goalsAgainst':/\bwins|victories\b/.test(q)?'wins':/clean sheets/.test(q)?'cleanSheets':/\bplayed|games|matches\b/.test(q)?'played':'goalsFor'
  const ascending=(metric==='goalsAgainst'&&!/worst|most/.test(q))||/fewest|lowest/.test(q)
  const result=analyseMatches(matches,{...filters,team:undefined,opponent:undefined,groupBy:'team',metric,ascending,limit:5},today)
  const label={goalsAgainst:'goals conceded',goalsFor:'goals scored',wins:'wins',cleanSheets:'clean sheets',played:'games'}[metric]
  return response(result.table.length?`Recorded team comparison:\n\n${result.table.map(r=>`${r.name}: ${r[metric]} ${label} in ${plural(r.played,'game')}`).join('\n')}\n\nTotals are not adjusted for games played.`:'No completed results are available for this selection.',result)
 }
 if(/\b(how many|number of|total|average|per game|per match)\b/.test(q)&&/\b(goals|games|matches)\b/.test(q)) {
  const result=analyseMatches(matches,{...filters,...(/\b(each competition|per competition|by competition|breakdown)\b/.test(q)?{groupBy:'competition',metric:'goals',limit:20}:{})},today),t=result.totals
  if(!t.matches)return response('No completed, scored matches are recorded for this selection.',result)
  const goals=filters.team?/conceded|against|let in/.test(q)?t.goalsAgainst:t.goalsFor:t.goals
  let text
  if(result.table.length&&/\b(each competition|per competition|by competition|breakdown)\b/.test(q))return response(`${plural(t.goals,'goal')} across ${plural(t.matches,'completed match')}:\n\n${result.table.map(r=>`${r.name}: ${plural(r.goals,'goal')} in ${plural(r.played,'match')}`).join('\n')}`,result)
  if(filters.referee)return response(`${filters.referee}: ${plural(t.matches,'recorded match')} in this selection.`,result)
  if(/average|per game|per match/.test(q))text=`${filters.team?`${filters.team}: `:''}${(goals/t.matches).toFixed(2)} goals ${/conceded|let in/.test(q)?'conceded':'scored'} per game (${plural(goals,'goal')} across ${plural(t.matches,'completed match')}).`
  else if(filters.team&&/\b(won|wins|lost|losses|draws|drew|clean sheets)\b/.test(q))text=teamSummary(filters.team,t)
  else if(/\bgoals\b/.test(q))text=`${filters.team?`${filters.team}: `:''}${goals.toLocaleString('en-GB')} goals ${/conceded|let in/.test(q)?'conceded':'scored'} across ${plural(t.matches,'completed match')}.`
  else text=`${plural(t.matches,'completed match')} are recorded${filters.team?` for ${filters.team}`:''}, with ${plural(goals,'goal')}${filters.team?' scored':''}.`
  return response(text,result)
 }
 if(filters.team&&/\b(summary|summarise|summarize|overview|about|season|record|stats|statistics|head to head|meetings|form|results|doing|performed)\b/.test(q)) {
  const result=analyseMatches(matches,filters,today),t=result.totals
  if(!t.matches)return response('No completed, scored matches are recorded for this selection.',result)
  const selected=matches.filter(m=>m.status==='played'&&m.home_score!=null&&m.away_score!=null&&(filters.season==='all'||m.season?.replace('-','/')===result.scope.season)&&(!filters.from||String(m.fixture_date).slice(0,10)>=filters.from)&&String(m.fixture_date).slice(0,10)<=(filters.through||today)&&[m.home_team?.name,m.away_team?.name].some(n=>sameTeam(n,filters.team)))
  const form=result.matches.slice(0,5).map(m=>{const raw=selected.find(r=>r.id===m.id);return raw?matchOutcome(raw,filters.team):'?'}).reverse().join(' · ')
  return response(`${teamSummary(filters.team,t)}${filters.opponent?` Against ${filters.opponent}.`:''}${form?`\n\nRecent form, oldest to newest: ${form}.`:''}${result.matches.length?`\n\nLatest result: ${matchText(result.matches[0])}.`:''}`,result)
 }
 if(/\b(referee|referees|news|sponsors|manager|managers)\b/.test(q))return informationAnswer(q,filters,reader)
 if(/\b(rule|rules|transfer|cancellation|cancel|eligible|eligibility|registration|registered)\b/.test(q)){
  const stop=new Set(['what','when','which','where','does','about','have','with','from','that','this','there','rules','rule','the','are','can','for'])
  const terms=q.split(' ').filter(t=>t.length>2&&!stop.has(t)),ranked=handbook.pages.map(p=>({...p,score:terms.reduce((n,t)=>n+(p.text.toLowerCase().includes(t)?1:0),0)})).filter(p=>p.score>0).sort((a,b)=>b.score-a.score)
  return response(ranked.length?`The closest handbook sections are on page${ranked.length>1?'s':''} ${ranked.slice(0,3).map(p=>p.page).join(', ')}. Open the handbook below to read the full wording. Newer league notices may supersede the handbook.`:'No matching handbook section was found.',null,{links:[source(handbook.title,handbook.url)],supported:Boolean(ranked.length)})
 }
 return unsupported()
}
function teamSummary(team,t){return `${team}: ${plural(t.matches,'game')}, ${plural(t.wins,'win')}, ${plural(t.draws,'draw')} and ${plural(t.losses,'loss')}. ${plural(t.goalsFor,'goal')} scored, ${t.goalsAgainst} conceded and ${plural(t.cleanSheets,'clean sheet')}. Goal difference: ${t.goalsFor-t.goalsAgainst>0?'+':''}${t.goalsFor-t.goalsAgainst}.${t.unknownOutcomes?` ${t.unknownOutcomes} shootout outcomes are incomplete.`:''}`}
async function informationAnswer(q,filters,reader){
 const type=/referee/.test(q)?'referees':/news/.test(q)?'news':/sponsor/.test(q)?'sponsors':'teams'
 const rows=await reader.get(type)
 if(type==='news'){const recent=[...rows].sort((a,b)=>String(b.published_at).localeCompare(String(a.published_at))).slice(0,3);return response(recent.length?recent.map(r=>`${r.title}\n${String(r.body||'').slice(0,1200)}`).join('\n\n'):'No published news is recorded.',null,{links:[source('ECFA News','/news')]})}
 if(type==='sponsors')return response(rows.map(r=>r.name).join('\n')||'No published sponsors are recorded.',null,{links:[source('Sponsors','/sponsors')]})
 if(type==='teams'){const teams=rows.filter(r=>!filters.team||sameTeam(r.name,filters.team));return response(teams.map(r=>`${r.name}: ${r.manager_name||'manager not recorded'}`).join('\n'),null,{links:[source('Teams','/teams')]})}
 const refs=rows.filter(r=>q.includes(norm(r.name)))
 return response(refs.length?refs.map(r=>`${r.name}\n${r.about||'Open their public profile for their published information.'}`).join('\n\n'):`${rows.length} referee profiles are recorded. Open Referees to see their published information.`,null,{links:[source('Referee profiles','/referees')]})
}
