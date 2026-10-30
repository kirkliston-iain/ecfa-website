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
  const target = normal(aliases[key] || key)
  return report?.pitches?.find(p => normal(p.name) === target) || null
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
