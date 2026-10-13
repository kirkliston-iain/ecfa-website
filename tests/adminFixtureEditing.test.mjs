import assert from 'node:assert/strict'
import {fixtureMatchesFilters,fixtureStatusForSave} from '../src/utils/adminFixtureEditing.js'
const original={status:'played',fixture_date:'2026-10-10T10:00:00Z',home_score:2,away_score:1,home_team:{id:'h'},away_team:{id:'a'}}
const filters={status:'played',date:'2026-10-10',team:'h'},key=JSON.stringify(filters)
const draft={...original,status:'scheduled',fixture_date:'2026-10-20T10:00:00Z',_editFilterKey:key,_statusEdited:true}
assert(fixtureMatchesFilters(draft,filters,key))
assert(!fixtureMatchesFilters(draft,filters,'different filters'))
assert.equal(fixtureStatusForSave({...draft,fixture_date:original.fixture_date},Date.parse('2026-10-13')),'scheduled')
for(const status of ['scheduled','postponed','cancelled','played'])assert.equal(fixtureStatusForSave({...original,status,_statusEdited:true}),status)
assert.equal(fixtureStatusForSave({...original,status:'scheduled'},Date.parse('2026-10-13')),'played')
assert.equal(fixtureStatusForSave({...original,status:'scheduled',away_score:null}),'scheduled')
assert.equal(fixtureStatusForSave({...original,status:'scheduled',fixture_date:'2099-10-10'}),'scheduled')
console.log('Passed: edited status/date remain visible; changing filters applies them normally; explicit status survives old scores; score entry still auto-marks past fixtures played; incomplete/future results do not.')
