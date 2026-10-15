import assert from 'node:assert/strict'
import fs from 'node:fs'
const source=fs.readFileSync(new URL('../src/utils/publicMatches.js',import.meta.url),'utf8').replace("import { supabase } from '../supabaseClient'",'const supabase = null')
const {anniversaryMatches,londonToday}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))
const match=(date,status='played')=>({fixture_date:date,status,home_score:2,away_score:1})
assert.equal(londonToday(new Date('2026-07-01T23:30:00Z')),'2026-07-02')
let result=anniversaryMatches([match('2022-10-15'),match('2026-10-15'),match('2024-10-14'),match('2023-10-15','scheduled')],'2026-10-15','2026-10-15')
assert.equal(result.exact,true);assert.equal(result.matches.length,1)
result=anniversaryMatches([match('2024-12-31'),match('2024-01-03'),match('2024-01-05')],'2026-01-01','2026-10-15')
assert.equal(result.exact,false);assert.equal(result.matches.length,2)
assert.equal(anniversaryMatches([match('2020-02-29')],'2026-02-28','2026-10-15').matches.length,1)
console.log('On This Day: UK date, exact match, previous years, played-only, New Year and leap-day fallback passed')
