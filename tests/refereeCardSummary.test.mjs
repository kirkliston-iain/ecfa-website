import assert from 'node:assert/strict'
import { summariseRefereeCards } from '../src/utils/refereeCardSummary.mjs'
const matches = [
 {home:'Old team',away:'Other',yellow:2,red:1,cards:[{player_id:'p1',player:'Alex',team_id:'old',team:'Old team',type:'yellow',count:2},{player_id:'p1',player:'Alex',team_id:'old',team:'Old team',type:'red',count:1}]},
 {home:'Old team',away:'New team',yellow:1,red:0,cards:[{player_id:'p1',player:'Alex',team_id:'new',team:'New team',type:'yellow',count:1}]},
 {home:'Old team',away:'Other',yellow:0,red:0,cards:[]},
]
const summary = summariseRefereeCards(matches)
assert.equal(summary.games,3)
assert.equal(summary.total,4)
assert.equal(summary.yellowAverage,1)
assert.equal(summary.redAverage,1/3)
assert.equal(summary.average,4/3)
assert.equal(summary.players.length,2,'Transferred player retains the team at the time of each card')
assert.equal(summary.teams.find(t=>t.id==='old').games,3,'Zero-card games remain in team averages')
assert.equal(summary.teams.find(t=>t.id==='old').average,1)
assert.equal(summariseRefereeCards([]).average,null,'Unavailable games must not be shown as zero average')
assert.equal(summariseRefereeCards(matches.filter(m=>m.yellow+m.red===0)).average,0)
console.log('Referee card totals, transferred players, zero-card denominators and unavailable history passed.')

