import assert from 'node:assert/strict'
import { buildTeamAnalysis, normaliseMatches, reportSeasons, periodBounds } from '../src/utils/teamAnalysis.js'
const options={mode:'to-date',season:'2026/27',today:'2026-11-02',label:'2026/27 season to date',competition:'',month:'2026-10'}
const team={name:'The Mission'}, stage={competition:{season:'2026/27',name:'League Cup'}}
const live=(id,date,opponent,hs,as,other={})=>({id,fixture_date:date,home_team:{name:'The Mission'},away_team:{name:opponent},home_score:hs,away_score:as,status:'played',stage,venue:'Gyle',referee_name:'Ref A',...other})
const historic=[{id:'h1',season:'2025/26',fixture_date:'2025-09-01',home_team_name:'Niddrie FC',away_team_name:'Liberton Church',home_goals:2,away_goals:0,competition_name:'League Cup',comment:'Gyle'}]
const matches=normaliseMatches([
 live('1','2026-09-01','Liberton Church',1,1,{decided_by_penalties:true,home_penalty_score:5,away_penalty_score:4}),
 live('2','2026-09-08','Liberton Church',2,1,{went_to_extra_time:true,home_extra_time_score:3,away_extra_time_score:2}),
 live('3','2026-10-01','Ladywell Baptist Church',0,2),live('4','2026-10-08','Ladywell Baptist Church',1,2),
 live('hidden','2026-10-10','X',9,0,{hidden_from_public:true}), live('future','2026-12-01','X',9,0),
 live('scheduled','2026-09-10','X',null,null,{status:'scheduled'})],historic)
const data={matches,scorers:[{fixtureId:'live:2',team:'The Mission',player:'John Smith',goals:2}],cards:[{fixture_id:'2',team:'The Mission',player:'John Smith',card_type:'yellow',card_count:1}],warnings:[]}
const r=buildTeamAnalysis(data,team,options)
assert.deepEqual(reportSeasons('2026-06-30'),['2025/26','2024/25'])
assert.deepEqual(reportSeasons('2026-07-01'),['2026/27','2025/26'])
assert.equal(r.stats.p,4);assert.equal(r.stats.w,1);assert.equal(r.stats.d,1);assert.equal(r.stats.l,2)
assert.equal(r.stats.gf,5);assert.equal(r.stats.ga,7);assert.equal(r.players[0].goals,2);assert.equal(r.yellow,1)
assert.equal(r.joy.name,'Liberton Church');assert.equal(r.bogey.name,'Ladywell Baptist Church')
assert.equal(r.comparison.p,1);assert.equal(r.comparison.w,1)
assert.equal(r.players[0].opponents[0][0],'Liberton Church')
const month=buildTeamAnalysis(data,team,{...options,mode:'month'})
assert.equal(month.stats.p,2);assert.equal(month.stats.gf,1);assert.equal(month.players.length,0)
assert.throws(()=>periodBounds({...options,season:'2024/25'}))
assert.throws(()=>periodBounds({...options,mode:'month',month:'2027-01'}))
assert.throws(()=>periodBounds({...options,mode:'month',month:'2025-10'}))
const duplicate=normaliseMatches([live('1','2026-09-01','Liberton Church',1,1)],[{id:'historic-copy',season:'2026/27',fixture_date:'2026-09-01',home_team_name:'Niddrie FC',away_team_name:'Liberton Church',home_goals:1,away_goals:1}])
assert.equal(duplicate.length,1)
console.log('Team analysis: season limits, month boundaries, alias matching, deduplication, hidden/future fixtures, extra time, shootouts, opponent rankings, scorer links and cards passed.')
