import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parsePitchReport } from '../server/pitchReport.js'
import handler from '../api/pitch-status.js'
import { matchPitch, reportCoversDate } from '../src/utils/pitchStatus.js'

const row = (name, css, text = '', comment = '') => `<tr><td>${name}</td><td class="sportsPitches--titles">Pitch Status</td><td class="sportsPitches--${css}"><span>Football</span>${text}</td><td class="sportsPitches--yes"><span>Rugby</span></td><td>${comment}</td></tr>`
const html = `Updated: <strong>30 October 2026</strong><section class="sportsPitches"><table>${row('Gyle Public Park', 'yes')}${row('Roseburn Park', 'no', '', 'Waterlogged')}${row('Inverleith Park', 'other')}${row('Broughton High School Grass', 'no', 'No Football Pitches')}${row('Meggetland Sports Complex', 'other', 'Decision made on the day. Call venue.')}</table></section>`
const report = parsePitchReport(html)
assert.equal(report.updatedDate, '2026-10-30')
assert.deepEqual(report.pitches.map(p => p.status), ['playable', 'unplayable', 'referee', 'not-listed', 'referee'])
assert.equal(report.pitches[1].comments, 'Waterlogged')
assert.equal(matchPitch('Gyle', report).status, 'playable')
assert.equal(matchPitch('Gyle Pitch 1', report).name, 'Gyle Public Park')
for (const venue of ['Gyle 3G', 'Gyle 3 G', 'Gyle Astro', 'Unknown Park', 'Gyle Public Park 4G']) assert.equal(matchPitch(venue, report), null)
for (const status of ['playable', 'referee', 'unplayable', 'unknown', 'not-listed']) {
  const source = { ...report, pitches: [{ name: 'Gyle Public Park', status, comments: 'Gyle-specific note' }] }
  for (const venue of ['Newcraighall', 'Newcraighall Park', 'Newcraighall Playing Fields', 'Newcraig Hall', 'Newcraighall Pitch 1']) {
    const result = matchPitch(venue, source)
    assert.equal(result.status, status)
    assert.equal(result.follows, 'Gyle')
    assert.equal(result.name, 'Newcraighall')
    assert.equal(result.comments, '')
  }
  assert.equal(source.pitches[0].name, 'Gyle Public Park')
  assert.equal(source.pitches[0].comments, 'Gyle-specific note')
}
assert.equal(matchPitch('Newcraighall', { ...report, pitches: [] }), null)
assert.equal(matchPitch('Newcraighall 3G', report), null)
assert.equal(matchPitch('Newcraighall Astro', report), null)
const friday = new Date('2026-10-30T12:00:00Z')
for (const day of ['2026-10-30', '2026-10-31', '2026-11-01']) assert.equal(reportCoversDate(report, day, friday), true)
for (const day of ['2026-10-29', '2026-11-02', '2026-11-07']) assert.equal(reportCoversDate(report, day, friday), false)
assert.equal(reportCoversDate(report, '2026-10-31', new Date('2026-11-02T12:00:00Z')), false)
assert.equal(reportCoversDate({ ...report, updatedDate: '2026-10-23' }, '2026-10-31', friday), false)
assert.equal(reportCoversDate({ ...report, updatedDate: '2026-10-29' }, '2026-10-31', friday), false)
assert.throws(() => parsePitchReport('<html>Website unavailable</html>'))
assert.throws(() => parsePitchReport(html.replace('30 October 2026', 'invalid')))
let code, body, headers
const res = { setHeader(k,v) { headers[k]=v }, status(c) { code=c;return this }, json(b) { body=b;return this } }
const originalFetch = globalThis.fetch
try {
  headers = {}; globalThis.fetch = async () => ({ ok: true, text: async () => html })
  await handler({ method: 'GET' }, res)
  assert.equal(code, 200); assert.equal(body.pitches[0].status, 'playable'); assert.match(headers['Cache-Control'], /s-maxage=300/)
  headers = {}; globalThis.fetch = async () => { throw new Error('Timeout') }
  await handler({ method: 'GET' }, res)
  assert.equal(code, 503); assert.equal(headers['Cache-Control'], 'no-store'); assert.equal(body.pitches, undefined)
} finally { globalThis.fetch = originalFetch }
if (process.argv[2]) {
  const live = parsePitchReport(readFileSync(process.argv[2], 'utf8'))
  console.log('Live report:', live.updatedDate, live.pitches.length, 'venues; Gyle:', matchPitch('Gyle', live))
}
console.log('Pitch status checks passed')
