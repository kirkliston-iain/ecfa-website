export const PITCH_SOURCE_URL = 'https://www.edinburghleisure.co.uk/sports-pitches/'
const normal = value => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const aliases = {
  'roseburn': 'Roseburn Park', 'inverleith': 'Inverleith Park',
  'colinton mains': 'Colinton Mains Park', 'sighthill': 'Sighthill Public Park',
  'union': 'Union Park', 'wardie': 'Wardie Playing Fields', 'ratho': 'Ratho Playing Fields',
  'seafield': 'Seafield Recreation Ground', 'morgan': 'Morgan Playing Fields',
  gyle: 'Gyle Public Park', 'gyle park': 'Gyle Public Park', 'gyle grass': 'Gyle Public Park',
  'jack kane': 'Jack Kane Sports Centre', 'jack kane grass': 'Jack Kane Sports Centre',
  'saughton': 'Saughton Sports Complex 7’s & 11’s', 'saughton grass': 'Saughton Sports Complex 7’s & 11’s',
  'saughton enclosure': 'Saughton Sports Complex Grass Enclosure',
  'saughton grass enclosure': 'Saughton Sports Complex Grass Enclosure',
  'saughton sports complex enclosure': 'Saughton Sports Complex Grass Enclosure',
  'double hedges': 'Kirkbrae / Double Hedges', 'kirkbrae': 'Kirkbrae / Double Hedges',
  'cavalry park': 'Duddingston / Cavalry Park', 'duddingston': 'Duddingston / Cavalry Park',
  'king george iv park': 'Currie / King George IV Park', 'currie': 'Currie / King George IV Park',
  'paties road': 'Paties Road Enclosure', 'paties road pitch 2': 'Paties Road (Pitch 2)',
  'meggetland': 'Meggetland Sports Complex', 'kirkliston': 'Kirkliston Leisure Centre',
}
export function matchPitch(venue, report) {
  if (/\b[2345]\s*g\b|astro|artificial|synthetic/i.test(venue || '')) return null
  // Only exact names or known aliases; never guess between similarly named pitches.
  const key = normal(venue).replace(/\s+(?:pitch\s*)?\d+$/, '')
  // League policy: Newcraighall follows Gyle's status for every fixture there.
  const followsGyle = /^newcraig ?hall(?: (?:park|grass|playing fields|playing field|recreation ground|sports ground))?$/.test(key)
  const target = normal(followsGyle ? 'Gyle Public Park' : aliases[key] || key)
  const pitch = report?.pitches?.find(p => normal(p.name) === target) || null
  // Gyle-specific comments are not a direct report about Newcraighall.
  return followsGyle && pitch ? { ...pitch, name: 'Newcraighall', follows: 'Gyle', comments: '' } : pitch
}
export function ukDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}
export function reportCoversDate(report, fixtureDate, now = new Date()) {
  const updated = report?.updatedDate
  if (!/^\d{4}-\d{2}-\d{2}$/.test(updated || '')) return false
  const start = new Date(`${updated}T12:00:00Z`)
  if (start.getUTCDay() !== 5) return false
  const end = new Date(start); end.setUTCDate(end.getUTCDate() + 2)
  const sunday = end.toISOString().slice(0, 10)
  const today = ukDate(now)
  const day = fixtureDate?.slice(0, 10)
  return today >= updated && today <= sunday && day >= updated && day <= sunday
}

export const PITCH_STATUS_LABELS = { playable: 'Playable', unplayable: 'Unplayable', referee: 'Referee’s decision', unknown: 'Check with venue', 'not-listed': 'No football status listed', awaiting: 'Awaiting weekend update' }

// Shared by website badges and exported images so both use the same venue/date rules.
export function fixturePitchStatus(fixture, report, now = new Date()) {
  if (['played', 'postponed', 'cancelled'].includes(fixture.status) || !fixture.fixture_date || fixture.fixture_date.slice(0, 10) < ukDate(now)) return null
  const pitch = matchPitch(fixture.venue, report)
  if (!pitch) return null
  return { ...pitch, status: reportCoversDate(report, fixture.fixture_date, now) ? pitch.status : 'awaiting', updatedDate: report.updatedDate }
}
