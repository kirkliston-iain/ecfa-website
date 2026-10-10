import test from 'node:test'
import assert from 'node:assert/strict'
import { goalsBySeasonAndClub, londonDate } from '../src/lib/playerTransfers.mjs'

test('transfer season retains goals against the club represented at each match', () => {
  const previous = { id: 'old', name: 'Previous club' }
  const current = { id: 'new', name: 'New club' }
  const fixture = { stage: { competition: { season: '2026-27' } } }
  const rows = goalsBySeasonAndClub([
    { team: previous, goals: 2, fixture },
    { team: previous, goals: 1, fixture },
    { team: current, goals: 4, fixture },
    { team: previous, goals: 5, fixture: { stage: { competition: { season: '2025/26' } } } },
  ], '2026/27')
  assert.equal(rows.length, 3)
  assert.equal(rows.find((r) => r.season === '2026/27' && r.team.id === 'old').goals, 3)
  assert.equal(rows.find((r) => r.season === '2026/27' && r.team.id === 'new').goals, 4)
  assert.equal(rows.find((r) => r.season === '2025/26').goals, 5)
})

test('missing recorded club is not attributed to the player’s current club', () => {
  assert.equal(goalsBySeasonAndClub([{ goals: 1 }], '2026/27')[0].team.name, 'Team not recorded')
})

test('transfer default date is a London calendar date', () => {
  assert.match(londonDate(), /^\d{4}-\d{2}-\d{2}$/)
})
