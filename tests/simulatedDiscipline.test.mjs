import assert from 'node:assert/strict'
import {disciplineEvidence,addSimulatedCards} from '../src/utils/simulatedDiscipline.js'
const f={status:'played',hidden_from_public:false,fixture_date:'2026-10-01',referee_name:'Ref A'}
const fixture={referee_name:'Ref A'},asOf=new Date('2026-10-13')
const rows=[{player_id:'p',card_type:'yellow',card_count:12,fixture:f},{player_id:'p',card_type:'red',card_count:1,fixture:f},{player_id:'p',card_type:'red',card_count:99,fixture:{...f,fixture_date:'2027-01-01'}},{player_id:'q',card_type:'yellow',card_count:99,fixture:{...f,hidden_from_public:true}}]
const d=disciplineEvidence(fixture,rows,[f],asOf)
assert.equal(d.players.get('p').yellow,12);assert.equal(d.players.get('p').red,1);assert(!d.players.has('q'));assert.equal(d.yellowMean,4)
let seed=2;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}
let cards=0,reds=0,picks={p:0,q:0}
for(let i=0;i<1000;i++){
 let minute=1
 const events=addSimulatedCards([{minute:89,goal:true,side:'home',scorer:{id:'p'},assist:{id:'q'}}],[[{id:'p',name:'P'},{id:'q',name:'Q'}],[]],d,random,()=>minute++)
 const dismissed=new Set()
 for(const e of events){if(e.card){assert(!dismissed.has(e.player.id));cards++;picks[e.player.id]++;if(e.card==='red'){reds++;dismissed.add(e.player.id)}}else{assert(!dismissed.has(e.scorer?.id));assert(!dismissed.has(e.assist?.id))}}
}
assert(cards>1000);assert(reds>0);assert(picks.p>picks.q)
assert.equal(addSimulatedCards([],[],{...d,referee:null},random,()=>1).length,0)
console.log('Passed: linked past card history only; referee rate; weighted player cards; second yellows and dismissals; no post-dismissal goals or assists; no assigned referee produces no cards.')