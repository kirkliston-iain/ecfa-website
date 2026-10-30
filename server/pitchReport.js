export const SOURCE_URL = 'https://www.edinburghleisure.co.uk/sports-pitches/'

function plain(value) {
  return value.replace(/<[^>]*>/g, ' ').replace(/&#(x[\da-f]+|\d+);/gi, (_, n) => String.fromCodePoint(n[0].toLowerCase() === 'x' ? parseInt(n.slice(1), 16) : Number(n)))
    .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&rsquo;|&apos;/g, "'").replace(/\s+/g, ' ').trim()
}

export function parsePitchReport(html) {
  const section = html.match(/<section\b[^>]*class=["'][^"']*\bsportsPitches\b[^"']*["'][^>]*>([\s\S]*?)<\/section>/i)?.[1]
  const dateText = plain(html).match(/Updated:\s*(\d{1,2} [A-Za-z]+ \d{4})/i)?.[1]
  const date = dateText ? new Date(`${dateText} 12:00:00 GMT`) : null
  if (!section || !date || Number.isNaN(date.getTime())) throw new Error('Pitch report format not recognised')
  const pitches = []
  for (const row of section.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[1].matchAll(/<td\b([^>]*)>([\s\S]*?)<\/td>/gi)]
    const football = cells.find(c => /<span\b[^>]*>\s*Football\s*<\/span>/i.test(c[2]))
    if (!football || !cells[0]) continue
    const text = plain(football[2]).replace(/^Football\s*/i, '')
    // A red cell may mean that the venue has no football pitches at all.
    const status = /no football pitches/i.test(text) ? 'not-listed'
      : /sportsPitches--yes\b/.test(football[1]) ? 'playable'
      : /sportsPitches--no\b/.test(football[1]) ? 'unplayable'
      : /sportsPitches--other\b/.test(football[1]) ? 'referee' : 'unknown'
    pitches.push({ name: plain(cells[0][2]), status, comments: [text, plain(cells.at(-1)[2])].filter(Boolean).join(' · ') })
  }
  if (pitches.length < 5) throw new Error('Pitch report incomplete')
  return { sourceUrl: SOURCE_URL, updatedDate: date.toISOString().slice(0, 10), pitches }
}
