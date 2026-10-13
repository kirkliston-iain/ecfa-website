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
export function predictionOpen(fixture, now = Date.now()) {
  return fixture.status === 'scheduled' && !!fixture.home_team && !!fixture.away_team && new Date(fixture.fixture_date).getTime() > now
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
