import assert from 'node:assert/strict'
import {roundup,ukDay,saturdayFor,weekendDay} from '../src/utils/weekendRoundup.mjs'
const t=id=>({id,name:`Team ${id}`})
const f=(id,date,h,a,hs,as,extra={})=>({id,fixture_date:date,status:'played',hidden_from_public:false,home_team:t(h),away_team:t(a),home_score:hs,away_score:as,...extra})
const fixtures=[f('s','2026-11-14T10:00:00Z','a','b',2,1),f('u','2026-11-15T10:00:00Z','c','d',0,0),f('p','2026-11-14T12:00:00Z','e','f',1,1,{went_to_extra_time:true,home_extra_time_score:2,away_extra_time_score:2,decided_by_penalties:true,home_penalty_score:4,away_penalty_score:3}),f('m','2026-11-11T10:00:00Z','a','b',20,0),f('h','2026-11-14T10:00:00Z','g','h',9,0,{hidden_from_public:true}),f('o','2026-11-14T10:00:00Z','g','h',null,null,{status:'postponed'})]
const scorers=[{fixture_id:'s',team_id:'a',goals:2,player:{id:'one',first_name:'Joe',last_name:'One'}},{fixture_id:'p',team_id:'e',goals:2,player:{id:'two',first_name:'Joe',last_name:'Two'}},{fixture_id:'m',goals:20,player:{id:'one',first_name:'Joe',last_name:'One'}}]
const r=roundup(fixtures,scorers,[{fixture_id:'s',card_type:'yellow',card_count:2},{fixture_id:'p',card_type:'red',card_count:1},{fixture_id:'m',card_type:'red',card_count:5}],'2026-11-14')
assert.equal(r.goals,7);assert.equal(r.matches.length,3);assert.equal(r.wins,2);assert.equal(r.draws,1);assert.equal(r.shootouts,1);assert.equal(r.clean,2);assert.equal(r.yellow,2);assert.equal(r.red,1);assert.equal(r.topTies,2);assert.equal(r.players[1].rank,1);assert.equal(r.recordedGoals,4);assert.equal(r.notCompleted,1);assert.equal(r.teamsPlayed,6);assert.equal(roundup([],[],[],'2026-11-14').goals,0);assert.equal(saturdayFor('2026-11-15'),'2026-11-14');assert.equal(weekendDay('2026-11-11T10:00:00Z'),false);assert.equal(ukDay('2026-08-15T23:30:00Z'),'2026-08-16');console.log('Weekend roundup: Saturday/Sunday, midweek exclusion, UK timezone, extra time, shoot-outs, draws, clean sheets, late cards, hidden/postponed fixtures, partial scoring and shared ranks passed')

const repeated=roundup([f('a','2026-11-14T10:00:00Z','a','b',2,0),f('b','2026-11-15T10:00:00Z','c','a',0,1)],[],[],'2026-11-14');assert.equal(repeated.wins,1);assert.equal(repeated.decisiveMatches,2);

const {compactScorers}=await import('../src/utils/weekendRoundup.mjs')
const many=[{name:'Top',goals:3,rank:1},{name:'Second',goals:2,rank:2},...Array.from({length:12},(_,i)=>({name:`One ${i}`,goals:1,rank:3}))]
assert.equal(compactScorers(many).featured.length,2);assert.equal(compactScorers(many).groupedSingles,12);assert.equal(compactScorers(many.slice(0,4)).featured.length,4);assert.equal(compactScorers(many.slice(2)).featured.length,0)
const {roundupTables}=await import('../src/utils/roundupTables.js')
const stage={id:'league',name:'League',competition:{slug:'appin-league',season:'2026/27'}}
const members=['a','b'].map(id=>({stage,group_id:'group',team:t(id)}))
const leagueFixture=(id,date,hs,as)=>({...f(id,date,'a','b',hs,as),stage,group_id:'group'})
const tables=roundupTables([leagueFixture('before','2026-11-11T10:00:00Z',2,0),leagueFixture('weekend','2026-11-14T10:00:00Z',1,1),leagueFixture('after','2026-11-21T10:00:00Z',0,5),{...leagueFixture('cup','2026-11-14T10:00:00Z',0,9),stage:{id:'cup'}},{...leagueFixture('hidden','2026-11-14T10:00:00Z',0,9),hidden_from_public:true}],members,'2026-11-15','2026/27')
assert.equal(tables.length,1);assert.equal(tables[0].rows[0].teamId,'a');assert.equal(tables[0].rows[0].points,4);assert.equal(tables[0].rows[0].played,2)
console.log('Compact top five, grouped single scorers and league table cutoff (including prior midweek, excluding future/cup/hidden results) passed')
