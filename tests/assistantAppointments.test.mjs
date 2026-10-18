import assert from 'node:assert/strict'
import { needsAssistants, officialAllowed, proposeAssistants } from '../src/utils/appointmentMatching.js'
const fixture = { id: 'cup', round_name: 'Semi-Final', stage: { stage_type: 'knockout' }, home_team: { name: 'Home' }, away_team: { name: 'Away' } }
const slot = { venue: 'East Park', area: 'East' }
const settings = { refereeTeamBlocks: [{ referee: 'East', team: 'Home' }], refereePreferences: { East: 'East', West: 'West' }, refereeVenueOnly: { Limited: ['Other Park'] } }
const rules = { refereeTeamBlocks: [{ referee: 'West', team: 'Away' }], unavailableReferees: ['Unavailable'] }
assert.equal(needsAssistants(fixture), true)
for (const round_name of ['Quarter-Final', 'Preliminary Round', '']) assert.equal(needsAssistants({ ...fixture, round_name }), false)
assert.equal(needsAssistants({ ...fixture, stage: { stage_type: 'league' } }), false)
assert.equal(officialAllowed('East', fixture, slot, settings, rules), false)
assert.equal(officialAllowed('East', fixture, slot, settings, rules, true), true)
assert.equal(officialAllowed('West', fixture, slot, settings, rules), false)
assert.equal(officialAllowed('West', fixture, slot, settings, rules, true), true)
assert.equal(officialAllowed('Limited', fixture, slot, settings, rules, true), false)
assert.equal(officialAllowed('Unavailable', fixture, slot, settings, rules, true), false)
const refs = ['Main', 'East', 'West', 'Limited', 'Unavailable'].map(name => ({ name }))
const allocations = [{ fixtureId: 'cup', referee: 'Main' }]
const propose = (available) => proposeAssistants([fixture], allocations, refs, available, new Map([['cup', slot]]), settings, rules)[0]
const result = propose(refs.map(r => r.name))
assert.deepEqual(new Set([result.assistant1, result.assistant2]), new Set(['East', 'West']))
const short = propose(['Main', 'East', 'Limited', 'Unavailable'])
assert.equal([short.assistant1, short.assistant2].filter(Boolean).length, 1)
assert.ok([short.assistant1, short.assistant2].includes('East'))
const preferred = proposeAssistants([fixture], allocations, refs, ['Main', 'East', 'West'], new Map([['cup', slot]]), settings, rules)
assert.equal(new Set(preferred.flatMap(row => [row.referee, row.assistant1, row.assistant2])).size, 3)
console.log('Assistant appointment checks passed')
const second = { ...fixture, id: 'final', round_name: 'Final' }
const multiple = proposeAssistants([fixture, second], [{fixtureId:'cup',referee:'Main'}, {fixtureId:'final',referee:'OtherMain'}], [...refs,{name:'OtherMain'}], ['Main','OtherMain','East','West'], new Map([['cup',slot],['final',slot]]), settings, rules)
const names = multiple.flatMap(row => [row.referee,row.assistant1,row.assistant2]).filter(Boolean)
assert.equal(new Set(names).size,names.length)
assert.equal(names.length,4)
