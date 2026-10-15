import assert from 'node:assert/strict'
import {previousWeekend,weekendStart,weekendResults} from '../src/utils/weekendGraphics.js'
import {computeStandings} from '../src/utils/standings.js'
assert.equal(previousWeekend('2026-10-15'),'2026-10-10')
assert.equal(previousWeekend('2026-10-18'),'2026-10-10')
assert.equal(previousWeekend('2026-10-19'),'2026-10-17')
assert.equal(weekendStart('2026-10-11'),'2026-10-10')
const teams=[{id:'a',name:'A'},{id:'b',name:'B'}]
const fixture=(date,h,a,status='played')=>({fixture_date:date,home_team:teams[0],away_team:teams[1],home_score:h,away_score:a,status})
const matches=[fixture('2026-10-03',1,0),fixture('2026-10-10',2,2),fixture('2026-10-11',4,0,'postponed'),fixture('2026-10-17',0,9)]
assert.equal(weekendResults(matches,'2026-10-10').length,1)
const rows=computeStandings(teams,matches.filter(f=>f.fixture_date<='2026-10-11'))
assert.equal(rows[0].teamId,'a');assert.equal(rows[0].points,4);assert.equal(rows[0].played,2);assert.equal(rows[0].goalsFor,3)
console.log('Weekend dates, completed results and historical table cutoff passed')
