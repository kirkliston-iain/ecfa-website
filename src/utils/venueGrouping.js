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
    .replace(/\s+/g, ' ')
    .trim()
}

export function isVenueLinkable(value) {
  const cleaned = cleanVenueName(value)
  return Boolean(cleaned) && !NON_VENUES.has(cleaned.toLocaleLowerCase('en-GB'))
}

export function venueHistoryUrl(venue) {
  const name = cleanVenueName(venue)
  return `/venues/${encodeURIComponent(venueGroupKey(venue))}?name=${encodeURIComponent(name)}`
}
