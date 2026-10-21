import { test } from 'node:test'
import assert from 'node:assert/strict'
import { registrationSummary } from '../src/lib/registrationSummary.mjs'

test('returning to the same club retains both moves and counts distinct clubs', () => {
  const transfers = [
    { player_id: 'p', previous_team_id: 'mission', new_team_id: 'ses', transfer_date: '2026-10-15', date_basis: 'audit' },
    { player_id: 'p', previous_team_id: 'ses', new_team_id: 'mission', transfer_date: '2026-10-19', date_basis: 'confirmed' },
    { player_id: 'other', previous_team_id: 'x', new_team_id: 'y', transfer_date: '2026-10-19' },
  ]
  assert.deepEqual(registrationSummary('p', transfers, [], '2026-07-01'), { moves: 2, clubs: 2, unconfirmed: true })
})

test('squad evidence counts players without goals, with a season boundary', () => {
  const events = [
    { player_id: 'p', new_team_id: 'old', recorded_at: '2025-10-01T10:00:00Z', effective_date: '2025-10-01' },
    { player_id: 'p', previous_team_id: 'old', new_team_id: 'current', recorded_at: '2026-06-01T10:00:00Z', effective_date: '2026-06-01' },
    { player_id: 'p', new_team_id: 'current', recorded_at: '2026-10-21T10:00:00Z', effective_date: null },
  ]
  assert.deepEqual(registrationSummary('p', [], events, '2026-07-01'), { moves: 0, clubs: 1, unconfirmed: false })
})
