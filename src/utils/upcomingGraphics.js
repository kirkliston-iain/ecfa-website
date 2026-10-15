import { addDays } from './weekendGraphics.js'
export function nextSevenDays(matches,today) {
  const end=addDays(today,7)
  return matches.filter(f=>!f.is_historic && f.status==='scheduled' && String(f.fixture_date).slice(0,10)>=today && String(f.fixture_date).slice(0,10)<end).sort((a,b)=>String(a.fixture_date).localeCompare(String(b.fixture_date)))
}
