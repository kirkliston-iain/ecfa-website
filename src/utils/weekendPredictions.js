export function londonDay(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}
export function weekendKey(date = new Date()) {
  const day = new Date(`${londonDay(date)}T12:00:00Z`)
  const dow = day.getUTCDay()
  day.setUTCDate(day.getUTCDate() + (dow === 0 ? -1 : 6 - dow))
  return day.toISOString().slice(0, 10)
}
export function inWeekend(fixture, saturday) {
  if (!fixture.fixture_date) return false
  const sunday = new Date(`${saturday}T12:00:00Z`)
  sunday.setUTCDate(sunday.getUTCDate() + 1)
  return [saturday, sunday.toISOString().slice(0, 10)].includes(londonDay(new Date(fixture.fixture_date)))
}
export function weekKey(date = new Date()) {
  const day = new Date(`${londonDay(date)}T12:00:00Z`)
  day.setUTCDate(day.getUTCDate() - (day.getUTCDay() + 6) % 7)
  return day.toISOString().slice(0, 10)
}
function shiftDay(day, count) {
  const date = new Date(`${day}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + count)
  return date.toISOString().slice(0,10)
}
export function ukInstant(day, hour) {
  const wanted = Date.parse(`${day}T${String(hour).padStart(2,'0')}:00:00Z`)
  let utc = wanted
  for (let i=0;i<2;i++) {
    const parts = new Intl.DateTimeFormat('en-GB', {timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(utc))
    const values = Object.fromEntries(parts.map(p=>[p.type,p.value]))
    const represented = Date.UTC(Number(values.year),Number(values.month)-1,Number(values.day),Number(values.hour),Number(values.minute),Number(values.second))
    utc += wanted-represented
  }
  return utc
}
export function activePredictionWeek(date = new Date()) {
  const monday=weekKey(date)
  return date.getTime()<ukInstant(monday,5) ? shiftDay(monday,-7) : monday
}
export function inPredictionWeek(fixture, monday) {
  return !!fixture.fixture_date && weekKey(new Date(fixture.fixture_date)) === monday
}
export function predictionWindow(fixture) {
  if(!fixture.fixture_date) return {opens:Infinity,closes:-Infinity}
  const kickoff=new Date(fixture.fixture_date)
  const monday=weekKey(kickoff)
  const day=new Date(`${londonDay(kickoff)}T12:00:00Z`).getUTCDay()
  return {opens:ukInstant(monday,5),closes:[0,6].includes(day) ? ukInstant(shiftDay(monday,4),22) : kickoff.getTime()-12*60*60*1000}
}
export function predictionOpen(fixture, now = Date.now()) {
  const {opens,closes}=predictionWindow(fixture)
  return fixture.status === 'scheduled' && !!fixture.home_team && !!fixture.away_team && now>=opens && now<closes
}
export function validScore(value) {
  return /^\d{1,2}$/.test(String(value)) && Number(value) <= 20
}
// A new random story on each play. These are fictional highlights, not forecasts.
export function makeHighlights(random = Math.random) {
  const events = []
  for (let minute = 6; minute < 90; minute += 7 + Math.floor(random() * 8)) {
    events.push({ minute, side: random() < .5 ? 'home' : 'away', goal: random() < .28, kind: Math.floor(random() * 3) })
  }
  return events
}
