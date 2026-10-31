import assert from 'node:assert/strict'
import { normaliseMatches, analyseMatches, analyseScorers, resolveTeam } from '../server/ecfaAIRecords.mjs'
import { acceptQuestion } from '../api/ask-ecfa.js'
const fixture=(id,date,home,away,h,a,extra={})=>({id,fixture_date:date,status:'played',hidden_from_public:false,home_score:h,away_score:a,home_team:{name:home},away_team:{name:away},stage:{competition:{name:'Appin Sports League',season:'2026-27'}},...extra})
const live=[fixture('a','2026-10-24','St Marys Metropolitan Church','Liberton Church',2,3),fixture('b','2026-10-17','St Marys Metropolitan Church','Kirkliston Community Church',3,0),fixture('hidden','2026-10-25','St Marys Metropolitan Church','Kirkliston Community Church',99,1,{hidden_from_public:true}),fixture('future','2026-11-14','Liberton Church','Kirkliston Community Church',null,null,{status:'scheduled'}),fixture('pen','2026-10-31','St Marys Metropolitan Church','Liberton Church',1,1,{decided_by_penalties:true,home_penalty_score:4,away_penalty_score:5,stage:{competition:{name:'League Cup',season:'2026/27'}}})]
const historic=[{id:'old',fixture_date:'2025-09-01',season:'2025/26',competition_name:'League',home_team_name:'St Marys',away_team_name:'Liberton Church',home_goals:2,away_goals:4},{id:'dup',fixture_date:'2026-10-24',season:'2026/27',competition_name:'League',home_team_name:'St Marys',away_team_name:'Liberton Church',home_goals:2,away_goals:3}]
const rows=normaliseMatches(live,historic),today='2026-10-31'
assert.equal(rows.length,5)
assert.equal(resolveTeam('KCC',rows),'Kirkliston Community Church')
assert.throws(()=>resolveTeam('Hearts',rows),/No team/)
assert.equal(analyseMatches(rows,{season:'current'},today).totals.goals,10)
assert.equal(analyseMatches(rows,{season:'current'},today).totals.matches,3)
assert.equal(analyseMatches(rows,{season:'all'},today).totals.goals,16)
assert.equal(analyseMatches(rows,{season:'current',scope:'league'},today).totals.goals,8)
assert.equal(analyseMatches(rows,{season:'current',scope:'cup'},today).totals.goals,2)
const loss=analyseMatches(rows,{season:'all',team:'St Marys',result:'L',limit:1},today)
assert.equal(loss.matches[0].id,'pen');assert.equal(loss.totals.losses,3)
assert.equal(analyseMatches(rows,{season:'all',team:'St Marys',through:'2026-10-23',analysis:'streak'},today).streak.games,1)
assert.equal(analyseMatches(rows,{season:'all',team:'St Marys',analysis:'streak',longest:true},today).streak.games,1)
assert.equal(analyseMatches(rows,{season:'current',team:'St Marys',opponent:'Liberton',from:'2026-10-25'},today).totals.goalsFor,1)
assert.equal(analyseMatches(rows,{season:'current',status:'scheduled'},today).matches[0].id,'future')
const ranked=analyseMatches(rows,{season:'current',groupBy:'team',metric:'goalsAgainst',ascending:true},today)
assert.deepEqual(ranked.table.filter(r=>r.goalsAgainst===ranked.table[0].goalsAgainst).map(r=>r.name),['Kirkliston Community Church','Liberton Church'])
assert.equal(ranked.table[0].goalsAgainst,3)
assert.throws(()=>analyseMatches(rows,{through:'yesterday'},today),/YYYY/)
assert.equal(analyseMatches(rows,{season:'current',team:'St Marys',analysis:'biggest',result:'W'},today).matches[0].id,'b')
const scorerRows=[[{player_name:'Historical Player',team_name:'Liberton Church',goals:9,season:'2025/26'}],[{player:{first_name:'Current',last_name:'Player'},team:{name:'Liberton Church'},goals:4,fixture:live[0]},{player:{first_name:'Hidden',last_name:'Player'},team:{name:'Liberton Church'},goals:99,fixture:live[2]}]]
assert.equal(analyseScorers(scorerRows,{season:'current'},today).players[0].goals,4)
assert.match(analyseScorers(scorerRows,{season:'all',scope:'cup'},today).error,/league goals only/)
assert.throws(()=>acceptQuestion({question:'x'.repeat(501)}))
assert.throws(()=>acceptQuestion({question:{prompt:'injected'}}))
assert.equal(acceptQuestion({question:' Goals this season? '}),'Goals this season?')
console.log('ECFA AI data tools: public-only rows, deduplication, totals, scopes, dates, aliases, streaks, rankings, shootouts, future fixtures, scorer coverage and request validation passed')
