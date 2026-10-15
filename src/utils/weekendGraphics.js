export function addDays(date, count) {
  const value=new Date(`${date}T12:00:00Z`);value.setUTCDate(value.getUTCDate()+count);return value.toISOString().slice(0,10)
}
export function weekendStart(date) {
  const day=new Date(`${date}T12:00:00Z`).getUTCDay()
  return addDays(date,-((day+1)%7))
}
export function previousWeekend(today) {
  const day=new Date(`${today}T12:00:00Z`).getUTCDay()
  return addDays(today,-(day || 7)-1)
}
export function weekendResults(matches, saturday) {
  const sunday=addDays(saturday,1)
  return matches.filter(f=>f.status==='played' && f.home_score!=null && f.away_score!=null && String(f.fixture_date).slice(0,10)>=saturday && String(f.fixture_date).slice(0,10)<=sunday).sort((a,b)=>String(a.competition_name).localeCompare(String(b.competition_name))||String(a.fixture_date).localeCompare(String(b.fixture_date)))
}
