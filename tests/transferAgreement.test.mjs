import { test } from 'node:test'
import assert from 'node:assert/strict'
import { confirmTransferAgreement, transferSeasonStart } from '../src/lib/transferAgreement.mjs'

const move = { playerId: 'paul', playerName: 'Paul Clarkson', previousTeamId: 'ses', newTeamId: 'mission', date: '2026-10-19' }
function client({ transfers = [], previous, error = null } = {}) {
  return { from(table) {
    let rows = transfers
    const query = {
      select() { return this },
      eq(key, value) { if (table === 'player_transfers') rows = rows.filter(row => row[key] === value); return this },
      gte(key, value) { rows = rows.filter(row => row[key] >= value); return this },
      lte(key, value) { rows = rows.filter(row => row[key] <= value); return this },
      order() { return this }, limit() { return this },
      maybeSingle: async () => ({ data: previous ? { previous_team_id: previous } : null, error }),
      then(resolve, reject) { return Promise.resolve({ count: rows.length, error }).then(resolve, reject) },
    }
    return query
  } }
}
const priorMove = { player_id: 'paul', transfer_date: '2026-10-15', date_basis: 'audit' }

test('the first transfer saves without a popup', async () => {
  assert.equal(await confirmTransferAgreement(client(), move, () => assert.fail('Unexpected popup')), true)
})

test('Paul’s return prompts after the first move, even with an audit date and no statistics', async () => {
  let shown = 0
  const allowed = await confirmTransferAgreement(client({ transfers: [priorMove] }), move, message => {
    shown++
    assert.match(message, /Paul Clarkson has already moved once this season/)
    assert.match(message, /cannot move again unless it has been agreed by the league/)
    return false
  })
  assert.equal(shown, 1)
  assert.equal(allowed, false)
})

test('league agreement permits the move and later moves still prompt', async () => {
  const transfers = [priorMove, { ...priorMove, transfer_date: '2026-10-18' }]
  assert.equal(await confirmTransferAgreement(client({ transfers }), move, message => {
    assert.match(message, /already moved 2 times/)
    return true
  }), true)
})

test('removal and re-addition to another squad also checks previous moves', async () => {
  let shown = false
  assert.equal(await confirmTransferAgreement(client({ previous: 'ses', transfers: [priorMove] }), { ...move, previousTeamId: null }, () => { shown = true; return false }), false)
  assert.equal(shown, true)
})

test('restoring the same squad or a first registration does not prompt', async () => {
  const unexpected = () => assert.fail('Unexpected popup')
  assert.equal(await confirmTransferAgreement(client({ previous: 'mission', transfers: [priorMove] }), { ...move, previousTeamId: null }, unexpected), true)
  assert.equal(await confirmTransferAgreement(client(), { ...move, previousTeamId: null }, unexpected), true)
})

test('only this player’s earlier moves in this season cause a popup', async () => {
  const transfers = [{ player_id: 'other', transfer_date: '2026-10-15' }, { player_id: 'paul', transfer_date: '2026-06-30' }, { player_id: 'paul', transfer_date: '2026-10-20' }]
  assert.equal(await confirmTransferAgreement(client({ transfers }), move, () => assert.fail('Unexpected popup')), true)
  assert.equal(transferSeasonStart('2026-06-30'), '2025-07-01')
  assert.equal(transferSeasonStart('2026-07-01'), '2026-07-01')
})

test('a failed history check blocks saving instead of silently skipping the warning', async () => {
  await assert.rejects(confirmTransferAgreement(client({ error: { message: 'Offline' } }), move, () => assert.fail('Unexpected popup')), /Could not check transfer history/)
})
