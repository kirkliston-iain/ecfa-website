import assert from 'node:assert/strict'
import {answerFromRecords,questionFilters} from '../server/recordAnswers.mjs'
const match=(id,date,home,away,h,a,extra={})=>({id,fixture_date:date,status:'played',home_team:{name:home},away_team:{name:away},home_score:h,away_score:a,season:'2026/27',competition_name:'Appin Sports League',...extra})
const matches=[match('a','2026-10-31','St Marys Metropolitan Church','Liberton Church',2,3,{referee_name:'Greg Healey',venue:'Gyle'}),match('b','2026-10-17','Kirkliston Community Church','St Marys Metropolitan Church',1,2),match('c','2026-10-10','St Marys Metropolitan Church','Liberton Church',3,0),match('d','2025-09-10','Liberton Church','St Marys Metropolitan Church',3,2,{season:'2025/26'}),match('f','2026-11-14','Kirkliston Community Church','Liberton Church',null,null,{status:'scheduled',competition_name:'League Cup'})]
const data={matches,referees:[{name:'Greg Healey',about:'Referee profile'}],scorers:[[],[{player:{first_name:'Dave',last_name:'Warnock'},team:{name:'Kirkliston Community Church'},goals:3,fixture:{...matches[0],hidden_from_public:false,stage:{competition:{name:'League',season:'2026/27'}}}}]],honours:[{status:'winner',winner_name:'St Marys',season:'2025/26',competition:'League'}]}
const reader={get:async key=>{assert(key in data,`Unexpected source ${key}`);return data[key]}}
const ask=q=>answerFromRecords(q,reader,{today:'2026-10-31'})
assert.match((await ask('How many goals have been scored this season in all competitions?')).text,/11 goals scored across 3 completed matches/)
assert.match((await ask('When did St Marys last lose?')).text,/31 October 2026/)
assert.match((await ask('When did St Marys last lose before 24 October 2026?')).text,/10 September 2025/)
assert.match((await ask('Summarise St Marys season')).text,/2 wins, 0 draws and 1 loss/)
assert.match((await ask('When did Liberton last beat Kirkliston?')).text,/No matching/)
assert.match((await ask('Who are the top scorers this season?')).text,/Dave Warnock: 3 goals/)
assert.match((await ask('How many goals has Dave Warnock scored this season?')).text,/Dave Warnock: 3 goals/)
assert.equal((await ask('How many goals has Bob Smith scored this season?')).supported,false)
assert.equal((await ask('How many goals does Bob Smith score?')).supported,false)
assert.equal((await ask('How many goals for Hearts this season?')).supported,false)
assert.match((await ask('How many trophies have St Marys won?')).text,/1 recorded trophy/)
assert.match((await ask('What is Kirkliston’s next fixture?')).text,/14 November 2026/)
assert.match((await ask('How many matches has referee Greg Healey officiated this season?')).text,/1 recorded match/)
assert.match((await ask('How many games at Gyle this season?')).text,/1 completed match/)
assert.match((await ask('How many goals per competition this season?')).text,/Appin Sports League: 11 goals/)
assert.equal(questionFilters('How many goals since 17 October 2026?',matches,'2026-10-31').from,'2026-10-17')
assert.equal(questionFilters('How many goals before yesterday?',matches,'2026-10-31').through,'2026-10-29')
assert.equal((await ask('How many games at Jack Kane 09:15?')).supported,false)
assert.equal((await ask('What is the weather in Paris?')).supported,false)
console.log('Free question answers: totals, summaries, named scorers, unknown names, dates, head-to-heads, honours, referees, venues, upcoming fixtures and honest limits passed')

assert.match((await ask('What was the previous meeting between Kirkliston and St Marys?')).text,/17 October 2026/)
assert.equal(questionFilters('Head to head St Marys and Liberton this season',matches,'2026-10-31').season,'current')
