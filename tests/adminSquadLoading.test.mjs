import assert from 'node:assert/strict'
import fs from 'node:fs'
const source=fs.readFileSync('src/pages/AdminDashboard.jsx','utf8')
const toggle=source.slice(source.indexOf('  async function toggleExpanded('),source.indexOf('  async function refreshScorers('))
function setup(fail=false){
 let cache={},status={},scorers=0,cards=0,queries=[]
 const supabase={from(table){assert.equal(table,'players');return {select(){return this},eq(field,id){queries.push(id);return this},async order(){return fail?{error:{message:'Network unavailable'}}:{data:[{id:queries.at(-1)+'-player'}]}}}}}
 const update=(setter)=>fn=>setter(fn)
 const factory=new Function('supabase','squadsByFixture','setSquadsByFixture','setSquadLoadStatus','expandedFixture','setExpandedFixture','setScorerForm','setDisciplineForm','refreshScorers','refreshDiscipline',toggle+';return {toggleExpanded,loadFixtureSquads}')
 const actions=factory(supabase,cache,update(fn=>cache=fn(cache)),update(fn=>status=fn(status)),null,()=>{},()=>{},()=>{},async()=>scorers++,async()=>cards++)
 return {actions,read:()=>({cache,status,scorers,cards,queries})}
}
const fixture={id:'match',home_team:{id:'home'},away_team:{id:'away'}}
const success=setup(); await success.actions.toggleExpanded(fixture)
assert.equal(success.read().cache.match.home.length,1);assert.equal(success.read().cache.match.away.length,1)
assert.deepEqual(success.read().queries,['home','away']);assert.equal(success.read().scorers,1);assert.equal(success.read().cards,1)
const failed=setup(true);await failed.actions.toggleExpanded(fixture)
assert.equal(failed.read().cache.match,undefined);assert.match(failed.read().status.match,/retry/i)
await failed.actions.loadFixtureSquads(fixture);assert.equal(failed.read().queries.length,4)
console.log('PASS: opening match loads both squads, scorers and cards; failed squad requests remain retryable.')
