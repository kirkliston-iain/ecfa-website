import { useEffect, useState } from 'react'

export default function usePitchReport(enabled = true) {
  const [report, setReport] = useState(null)
  const [state, setState] = useState('loading')
  useEffect(() => {
    if (!enabled) return
    let active = true
    let controller
    async function load() {
      controller?.abort()
      controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 16000)
      try {
        const response = await fetch('/api/pitch-status', { signal: controller.signal })
        if (!response.ok) throw new Error('Unavailable')
        const data = await response.json()
        if (!data.updatedDate || !Array.isArray(data.pitches)) throw new Error('Invalid report')
        if (active) { setReport(data); setState('ready') }
      } catch {
        if (active) { setReport(null); setState('unavailable') }
      } finally { clearTimeout(timeout) }
    }
    load()
    const timer = setInterval(load, 300000)
    window.addEventListener('focus', load)
    return () => { active = false; clearInterval(timer); controller?.abort(); window.removeEventListener('focus', load) }
  }, [enabled])
  return { report, state }
}
