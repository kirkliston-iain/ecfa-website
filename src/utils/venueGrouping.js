const NON_VENUES = new Set(['n/a', 'league decide', 'tbc', 'to be confirmed'])

export function cleanVenueName(value) {
  return String(value || '')
    .split(/\.\s+.*\bwon\b.*\bpenalt/i)[0]
    .trim()
}

export function venueGroupKey(value) {
  return cleanVenueName(value)
    .toLocaleLowerCase('en-GB')
    .replace(/[–—]/g, '-')
    .replace(/\s*-\s*3g$/i, '')
    .replace(/\s+(?:3g|grass|enclosure)$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function venueGroupLabel(value) {
  return cleanVenueName(value)
    .replace(/\s*-\s*3g$/i, '')
    .replace(/\s+(?:3g|grass|enclosure)$/i, '')
    .trim()
}

export function isVenueLinkable(value) {
  const cleaned = cleanVenueName(value)
  return Boolean(cleaned) && !NON_VENUES.has(cleaned.toLocaleLowerCase('en-GB'))
}

export function venueDateUrl(venue, fixtureDate) {
  const date = String(fixtureDate || '').slice(0, 10)
  return `/venues/${encodeURIComponent(venueGroupKey(venue))}?date=${encodeURIComponent(date)}&name=${encodeURIComponent(venueGroupLabel(venue))}`
}
