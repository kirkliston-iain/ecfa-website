import test from 'node:test'
import assert from 'node:assert/strict'
import { honourFixtureId } from '../src/utils/honourFixtures.js'

const honour = { season: '2025/26', competition: 'Brian Latto Cup', status: 'winner', winner_name: 'Kirkliston Community Church FC' }
const archived = { id: 'archive-final', season: '2025/26', competition_name: 'ECFA Consolation Cup Final', home_team_name: 'Kirkliston Community Church', away_team_name: 'Ladywell Baptist Church', home_goals: 2, away_goals: 2 }
const live = { id: 'live-final', status: 'played', round_name: 'Final', home_score: 2, away_score: 2, home_team: { name: 'Kirkliston Community Church' }, away_team: { name: 'Ladywell Baptist Church' }, stage: { competition: { name: 'ECFA Brian Latto Cup', season: '2025/26' } } }

test('links archived cup finals using competition and team aliases, including penalty draws', () => {
  assert.equal(honourFixtureId(honour, [], [archived]), 'archive-final')
})
test('requires the same season, cup, team, and a completed final', () => {
  for (const change of [
    { season: '2024/25' }, { competition_name: 'ECFA League Cup Final' },
    { competition_name: 'ECFA Brian Latto Cup Semi-Final' }, { competition_name: 'ECFA Brian Latto Cup Quarter Final' },
    { home_team_name: 'Other club' }, { home_goals: null },
  ]) assert.equal(honourFixtureId(honour, [], [{ ...archived, ...change }]), null)
  for (const change of [{ status: 'scheduled' }, { hidden_from_public: true }, { round_name: 'Semi-Final' }, { away_score: null }]) {
    assert.equal(honourFixtureId(honour, [{ ...live, ...change }]), null)
  }
})
test('prefers a live final and refuses ambiguous matches', () => {
  assert.equal(honourFixtureId(honour, [live], [archived]), 'live-final')
  assert.equal(honourFixtureId(honour, [], [archived, { ...archived, id: 'second-final' }]), null)
  assert.equal(honourFixtureId(honour, [live, { ...live, id: 'second-live' }], [archived]), null)
})
test('does not infer a league-winning match or link void honours', () => {
  assert.equal(honourFixtureId({ ...honour, competition: 'League' }, [live], [archived]), null)
  assert.equal(honourFixtureId({ ...honour, status: 'void' }, [live], [archived]), null)
})
