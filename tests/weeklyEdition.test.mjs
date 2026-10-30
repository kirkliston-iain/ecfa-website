import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { buildWeeklyEdition, hasRefereeProfile, londonDate } from '../src/utils/weeklyEdition.mjs'
const edition = JSON.parse(await readFile(new URL('../src/data/weekly/2026-10-30.json',import.meta.url)))
assert.equal(edition.tables[0].rows.length,12)
assert.equal(edition.totals.leagueMatches,43)
assert.equal(edition.tables[0].rows.reduce((n,r)=>n+r.played,0),86)
assert.equal(edition.tables[0].rows.reduce((n,r)=>n+r.goalsFor,0),edition.totals.leagueGoals)
assert.equal(edition.tables[0].rows.reduce((n,r)=>n+r.goalsAgainst,0),edition.totals.leagueGoals)
assert.equal(edition.results.length,3)
assert.equal(edition.totals.weeklyGoals,24)
assert.equal(edition.tables[0].rows[0].teamName,'White Lightning')
assert.equal(edition.tables[0].rows[0].points,18)
assert.equal(edition.topScorers[0].name,'Daniel McKinley')
assert.equal(edition.topScorers[0].goals,13)
assert.equal(edition.nextFixtures.length,6)
assert(edition.nextFixtures.every(f=>londonDate(f.fixture_date)==='2026-10-31'))
assert.equal(edition.referee.name,'Chris Ashley')
assert.equal(hasRefereeProfile({name:'Photo only',photo_url:'/image.jpg'}),false)
assert.equal(hasRefereeProfile({survey_answers:[{answer:'  '}]}),false)
assert.equal(hasRefereeProfile({survey_answers:[{answer:'2026'}]}),true)
assert.equal(londonDate('2026-08-01T23:30:00Z'),'2026-08-02')
const a={id:'a',name:'A'},b={id:'b',name:'B'}
const comp={id:'league',slug:'appin-league',season:'2026-27',name:'League'}
const match={id:'valid',stage_id:'stage',group_id:'group',fixture_date:'2026-10-24T10:00:00Z',hidden_from_public:false,status:'played',home_score:2,away_score:0,home_team:a,away_team:b,stage:{competition:comp}}
const raw={competitions:[comp],stages:[{id:'stage',competition_id:'league',stage_type:'group',groups:[{id:'group',name:'Table'}]}],stage_teams:[a,b].map(team=>({stage_id:'stage',group_id:'group',team})),fixtures:[match,{...match,id:'hidden',hidden_from_public:true},{...match,id:'future',fixture_date:'2026-11-01T10:00:00Z'},{...match,id:'old',stage:{competition:{...comp,season:'2025-26'}}},{...match,id:'null',away_score:null}],fixture_scorers:[{fixture_id:'valid',player:{id:'p',first_name:'P',last_name:'One'},goals:2,team:a},{fixture_id:'hidden',player:{id:'p',first_name:'P',last_name:'One'},goals:99,team:a}],referees:[{name:'Photo only',photo_url:'/x.jpg'},{name:'Valid',about:'Public biography'}],news_stories:[],sponsors:[]}
const result=buildWeeklyEdition(raw,'2026-10-30')
assert.equal(result.totals.matches,1)
assert.equal(result.topScorers[0].goals,2)
assert.equal(result.referee.name,'Valid')
assert.equal(result.bestDefence[0].teamName,'A')
console.log('Weekly edition checks passed: live totals, cutoff, privacy, season isolation, scorer scope, London dates and referee eligibility.')
