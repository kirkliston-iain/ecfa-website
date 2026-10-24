import assert from 'node:assert/strict'
import { buildDisciplineHistory } from '../src/utils/disciplineHistory.js'
const card = (player, fixture, type, count, date = '2026-10-24') => ({
  player_id: player, fixture_id: fixture, card_type: type, card_count: count,
  fixture: { id: fixture, fixture_date: date },
})
const rows = buildDisciplineHistory([
  card('sent-off', 'match', 'yellow', 2),
  card('sent-off', 'match', 'red', 1),
  card('teammate', 'match', 'yellow', 1),
  card('older', 'old-match', 'yellow', 1, '2026-08-01'),
  card('unlinked', 'deleted-match', 'red', 1),
].map((row) => row.player_id === 'unlinked' ? { ...row, fixture: null } : row))
assert.equal(rows.length, 3, 'Only match-linked cards count')
assert.equal(rows.find((r) => r.playerId === 'sent-off').points, 4, 'Two yellows and a red count as four points')
assert.equal(rows.find((r) => r.playerId === 'teammate').points, 2, 'A teammate’s yellow still counts separately')
assert.equal(rows.reduce((sum, r) => sum + r.points, 0), 8)
assert.equal(rows.at(-1).id, 'old-match', 'Newest games first')
assert.equal(buildDisciplineHistory([card('p', 'f', 'yellow', 2)])[0].points, 4)
assert.deepEqual(buildDisciplineHistory([]), [])
console.log('Discipline history: dismissal points, team aggregation, dates and unlinked records passed')
