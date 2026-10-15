import assert from 'node:assert/strict'
import { lastFiveForm } from '../src/utils/matchForm.js'
const home={id:'a',name:'Team A'},away={id:'b',name:'Team B'}
const match=(id,date,h,a,extra={})=>({id,fixture_date:date,status:'played',home_score:h,away_score:a,home_team:home,away_team:away,...extra})
const fixture={id:'target',fixture_date:'2026-10-17T10:00:00Z'}
const rows=[match('old','2026-08-01',0,1),match('1','2026-09-01',1,0),match('2','2026-09-05',1,1),match('3','2026-09-10',0,1),match('4','2026-10-01',0,0,{decided_by_penalties:true,home_penalty_score:5,away_penalty_score:4}),match('5','2026-10-10',1,1,{went_to_extra_time:true,home_extra_time_score:1,away_extra_time_score:2}),match('future','2026-10-24',5,0),match('same','2026-10-17',5,0),match('unplayed','2026-10-15',5,0,{status:'postponed'})]
assert.deepEqual(lastFiveForm(rows,home,fixture),['W','D','L','W','L'])
assert.deepEqual(lastFiveForm(rows,away,fixture),['L','D','W','L','W'])
assert.deepEqual(lastFiveForm([],home,fixture),[])
console.log('Last-five order, cutoff, away outcomes, penalties, extra time and missing history passed')
