import assert from 'node:assert/strict'
import { answerQuestion, matchOutcome, mentionedTeams } from '../src/utils/askEcfa.mjs'
const fixture = (id,date,home,away,h,a,extra={}) => ({id,fixture_date:date,status:'played',home_team:{name:home},away_team:{name:away},home_score:h,away_score:a,season:'2026/27',competition_name:'ECFA Appin Sports League',...extra})
const matches = [
 fixture('1','2026-10-24','St Marys Metropolitan Church','Liberton Church',1,2),
 fixture('2','2026-10-17','Kirkliston Community Church','St Marys Metropolitan Church',1,2),
 fixture('3','2026-10-10','St Marys Metropolitan Church','Liberton Church',3,0),
 fixture('4','2025-09-10','Liberton Church','St Marys Metropolitan Church',3,2,{season:'2025/26'}),
 fixture('5','2026-10-31','St Marys Metropolitan Church','Liberton Church',null,null,{status:'scheduled'}),
 fixture('6','2026-10-25','St Marys Metropolitan Church','Liberton Church',8,0,{hidden_from_public:true}),
].filter(m=>m.hidden_from_public!==true)
const options = {today:'2026-10-31'}
let result=answerQuestion('When did St Mary’s last lose?',matches,options)
assert.deepEqual(result.matches.map(m=>m.id),['1'])
assert.match(result.text,/24 October 2026/)
assert.match(result.context,/All recorded seasons/)
assert.deepEqual(mentionedTeams('When did Liberton last beat Kirkliston?',matches),['Liberton Church','Kirkliston Community Church'])
assert.deepEqual(answerQuestion('When did St Marys last lose before 2026-10-24?',matches,options).matches.map(m=>m.id),['4'])
assert.match(answerQuestion('What is St Marys unbeaten run?',matches,options).text,/0 consecutive/)
assert.match(answerQuestion('What is St Marys unbeaten run before 2026-10-24?',matches,options).text,/2 consecutive/)
assert.match(answerQuestion('How many games have St Marys won this season?',matches,options).text,/3 recorded games, 2 wins, 0 draws, 1 losses/)
assert.deepEqual(answerQuestion('When do St Marys play next?',matches,options).matches.map(m=>m.id),['5'])
assert.match(answerQuestion('Who has the best defence this season?',matches,options).context,/2026\/27/)
assert.match(answerQuestion('Who has the best defence this season?',matches,options).text,/Kirkliston Community Church: 2 goals conceded in 1 games/)
assert.match(answerQuestion('When did St Marys last lose in 2020?',matches,options).text,/date range yet/)
assert.match(answerQuestion('When did St Marys last lose?',matches,{...options,season:'2025/26'}).text,/10 September 2025/)
assert.match(answerQuestion('When did St Marys last lose in the cup?',matches,options).text,/No completed/)
assert.match(answerQuestion('Who won Eurovision?',matches,options).text,/cannot reliably answer/)
const pen = fixture('p','2026-10-30','St Marys Metropolitan Church','Liberton Church',1,1,{decided_by_penalties:true,home_penalty_score:3,away_penalty_score:4,competition_name:'League Cup'})
assert.equal(matchOutcome(pen,'St Marys Metropolitan Church'),'L')
assert.equal(matchOutcome({...pen,away_penalty_score:null},'St Marys Metropolitan Church'),'?')
assert.equal(matchOutcome({...pen,decided_by_penalties:false,is_historic:true,home_team_name:'St Marys',away_team_name:'Liberton Church',penalty_winner_name:'Liberton Church'},'St Marys Metropolitan Church'),'L')
assert.equal(matchOutcome({...pen,decided_by_penalties:false,went_to_extra_time:true,home_extra_time_score:3,away_extra_time_score:2},'Liberton Church'),'L')
assert.deepEqual(answerQuestion('When did St Marys last lose?',[...matches,pen],options).matches.map(m=>m.id),['p'])
assert.deepEqual(answerQuestion('When did St Marys last lose before yesterday?',[...matches,pen],options).matches.map(m=>m.id),['1'])
assert.match(answerQuestion('What is Kirkliston’s unbeaten run?',matches,options).text,/Kirkliston Community Church have/)
assert.match(answerQuestion('Who has the best defence this season?',matches.map(m=>({...m,season:m.season.replace('/', '-')})),options).text,/Kirkliston Community Church: 2/)
console.log('Ask ECFA: aliases, historical seasons, date cutoffs, future fixtures, head-to-head, scope, ranking, shootouts, extra time and unsupported questions passed')
