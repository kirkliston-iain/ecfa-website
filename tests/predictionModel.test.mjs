import assert from 'node:assert/strict'
import { buildEvidence, simulatePrediction, competitionKey } from '../src/utils/predictionModel.js'
const team=(id,name)=>({id,name})
const fixture={id:'future',fixture_date:'2026-10-17T10:00:00Z',home_team:team('h','Barclay Viewforth Church'),away_team:team('a','White Lightning Bruntsfield Church'),stage:{competition:{name:'ECFA League Cup',slug:'league-cup',season:'2026-27'}}}
const game=(id,home,away,h,a,date,slug='league-cup')=>({id,home_team_id:home,away_team_id:away,home_score:h,away_score:a,fixture_date:date,stage:{competition:{season:'2026-27',slug}}})
const players=[{id:'h1',team_id:'h',first_name:'Home',last_name:'Scorer'},{id:'h2',team_id:'h',first_name:'Home',last_name:'Mate'},{id:'a1',team_id:'a',first_name:'Away',last_name:'Scorer'},{id:'a2',team_id:'a',first_name:'Away',last_name:'Mate'},{id:'moved',team_id:'a',first_name:'Transferred',last_name:'Player'}]
const scorerFixture={fixture_date:'2026-10-03T10:00:00Z',status:'played',hidden_from_public:false,stage:{competition:{season:'2026-27'}}}
const scorers=[{player_id:'h1',team_id:'h',goals:12,fixture:scorerFixture},{player_id:'moved',team_id:'h',goals:7,fixture:scorerFixture},{player_id:'a1',team_id:'a',goals:3,fixture:scorerFixture},{player_id:'h2',team_id:'h',goals:100,fixture:{...scorerFixture,hidden_from_public:true}},{player_id:'a2',team_id:'a',goals:100,fixture:{...scorerFixture,stage:{competition:{season:'2025-26'}}}}]
const live=[game('recent','h','a',4,1,'2026-10-03T10:00:00Z'),game('recent2','a','h',0,3,'2026-10-10T10:00:00Z'),game('future-leak','h','a',20,0,'2026-10-20T10:00:00Z')]
const archive=[{id:'old',season:'2025/26',fixture_date:'2025-10-18',home_team_name:'White Lightning',away_team_name:'Barclay Viewforth FC',home_goals:1,away_goals:3,competition_name:'ECFA Kwik Fit League Cup'},{id:'duplicate',source_fixture_id:'recent',season:'2026/27',fixture_date:'2026-10-03',home_team_id:'h',away_team_id:'a',home_goals:4,away_goals:1,competition_name:'ECFA League Cup'}]
const evidence=buildEvidence(fixture,{players,scorers,live,archive},new Date('2026-10-13T15:00:00Z'))
assert.equal(evidence.factors[0].home.played,3);assert.equal(evidence.factors[1].home.played,2)
assert.equal(evidence.factors[2].home.won,2);assert.equal(evidence.factors[3].home.won,1)
assert.equal(evidence.squads[0].find(p=>p.id==='h1').goals,12)
assert.equal(evidence.squads[1].find(p=>p.id==='moved').goals,0)
assert(!evidence.squads[0].some(p=>p.id==='moved'))
assert.equal(evidence.squads[0].find(p=>p.id==='h2').goals,0)
assert.equal(evidence.squads[1].find(p=>p.id==='a2').goals,0)
assert.equal(competitionKey('Appin Edinburgh Churches Football League'),'appin-league')
assert.equal(competitionKey('ECFA Kwik Fit League Cup Final'),'league-cup')
let seed=42
const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}
const omitted=new Set();let homeGoals=0,awayGoals=0,favourite=0,other=0
for(let i=0;i<2000;i++){
 const run=simulatePrediction(evidence,random);assert.equal(run.selected.length,3);assert.equal(new Set(run.selected.map(f=>f.key)).size,3);assert(!run.selected.some(f=>f.key===run.omitted.key));omitted.add(run.omitted.key)
 for(const [j,e] of run.events.entries()) {assert(e.minute>=1&&e.minute<90);if(j)assert(e.minute>run.events[j-1].minute);const squad=evidence.squads[e.side==='home'?0:1];if(e.goal){assert(squad.some(p=>p.id===e.scorer.id));if(e.assist){assert(squad.some(p=>p.id===e.assist.id));assert.notEqual(e.scorer.id,e.assist.id)}if(e.side==='home'){if(e.scorer.id==='h1')favourite++;else other++}}}
 assert.equal(run.events.filter(e=>e.goal&&e.side==='home').length,run.scores[0]);assert.equal(run.events.filter(e=>e.goal&&e.side==='away').length,run.scores[1]);homeGoals+=run.scores[0];awayGoals+=run.scores[1]
}
assert.equal(omitted.size,4);assert(homeGoals>awayGoals);assert(favourite>other*4)
const empty=buildEvidence(fixture,{players:[],scorers:[],live:[],archive:[]},new Date('2026-10-13'))
assert(empty.factors.every(f=>!f.home.played&&!f.away.played));assert(simulatePrediction(empty).events.every(e=>!e.scorer&&!e.assist))
console.log('Passed: exactly three varied factors; stronger form affects scores; current scorers weighted; transfers and hidden/old-season goals excluded; alias history joined; duplicate/future games excluded; unique highlights and distinct teammate assists; neutral missing history.')
