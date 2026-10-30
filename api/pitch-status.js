import { parsePitchReport, SOURCE_URL } from '../server/pitchReport.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  try {
    const response = await fetch(SOURCE_URL, { signal: AbortSignal.timeout(12000), headers: { Accept: 'text/html', 'User-Agent': 'ECFA-Pitch-Status/1.0 (+https://ecfa-website.vercel.app)' } })
    if (!response.ok) throw new Error('Source unavailable')
    const report = parsePitchReport(await response.text())
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300, must-revalidate')
    return res.status(200).json({ ...report, checkedAt: new Date().toISOString() })
  } catch {
    res.setHeader('Cache-Control', 'no-store')
    return res.status(503).json({ error: 'Pitch update temporarily unavailable', sourceUrl: SOURCE_URL })
  }
}
