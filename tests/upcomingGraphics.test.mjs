import assert from 'node:assert/strict'
import {nextSevenDays} from '../src/utils/upcomingGraphics.js'
const f=(date,status='scheduled')=>({fixture_date:date,status})
assert.deepEqual(nextSevenDays([f('2026-10-14'),f('2026-10-15'),f('2026-10-21T10:00:00Z'),f('2026-10-22'),f('2026-10-17','played'),f('2026-10-18','postponed')],'2026-10-15').map(f=>f.fixture_date),['2026-10-15','2026-10-21T10:00:00Z'])
console.log('Next 7 calendar days: today included, day 8 and non-scheduled games excluded')
