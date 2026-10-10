import test from 'node:test'
import assert from 'node:assert/strict'
import { teamHistoryUrl, matchHistoryUrl, competitionHistoryUrl, supportsMatchScorers, selectStreakMatches } from '../src/utils/historyLinks.js'

test('team links resolve current aliases and retain former club history', () => {
  assert.equal(teamHistoryUrl('White Lightning FC', null, [{ id: 'live', name: 'White Lightning Bruntsfield Church' }]), '/teams/live')
  assert.equal(teamHistoryUrl("St Columba's FC", null, []), '/teams/previous/St%20Columbas')
  assert.equal(teamHistoryUrl('', null, []), null)
})
test('filter URLs preserve names and omit overall filters', () => {
  const url = new URL(matchHistoryUrl({ team: 'A & B', opponent: 'Other FC', season: 'Overall', scope: 'all', result: 'W' }), 'https://example.test')
  assert.equal(url.searchParams.get('team'), 'A & B')
  assert.equal(url.searchParams.get('opponent'), 'Other FC')
  assert.equal(url.searchParams.has('season'), false)
  assert.equal(url.searchParams.get('result'), 'W')
})
test('competition routes normalize season separators and preserve archived seasons', () => {
  const competitions = [{ name: 'ECFA League Cup', slug: 'league-cup', season: '2026-27' }]
  assert.equal(competitionHistoryUrl('ECFA League Cup', '2026/27', competitions), '/competitions/league-cup')
  assert.equal(new URL(competitionHistoryUrl('ECFA League Cup', '2025/26', competitions), 'https://example.test').searchParams.get('season'), '2025/26')
  assert.equal(supportsMatchScorers('2025/26'), true)
  assert.equal(supportsMatchScorers('2023/24'), false)
})
test('streak drilldowns show supporting games, including ties and ended current runs', () => {
  const rows = ['W', 'D', 'L', 'W', 'W', 'L'].map((outcome, id) => ({ id, outcome })).reverse()
  const outcome = (row) => row.outcome
  assert.deepEqual(selectStreakMatches(rows, 'longestUnbeaten', outcome).map((row) => row.id), [4, 3, 1, 0])
  assert.deepEqual(selectStreakMatches(rows, 'longestWinning', outcome).map((row) => row.id), [4, 3])
  assert.deepEqual(selectStreakMatches(rows, 'currentWinning', outcome), [])
  assert.deepEqual(selectStreakMatches(rows, 'currentWinless', outcome).map((row) => row.id), [5])
})
