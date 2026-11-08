import { useEffect, useState } from 'react'
import './ChristmasTheme.css'
import { CHASE_SECONDS, FALLBACK_GRINCH_LINES } from '../utils/christmasChase.mjs'
import { loadGrinchLines } from '../utils/christmasChaseData'

// One-off 2026 celebration, inclusive of 28 December in Edinburgh.
export const CHRISTMAS_START = Date.parse('2026-12-01T00:00:00Z')
export const CHRISTMAS_END = Date.parse('2026-12-29T00:00:00Z')
export const christmasIsActive = (now = Date.now()) => now >= CHRISTMAS_START && now < CHRISTMAS_END

export function useChristmasTheme() {
  const [active, setActive] = useState(() => christmasIsActive())
  useEffect(() => {
    let timer
    const update = () => {
      window.clearTimeout(timer)
      const now = Date.now()
      setActive(christmasIsActive(now))
      const next = now < CHRISTMAS_START ? CHRISTMAS_START : CHRISTMAS_END
      if (now < next) timer = window.setTimeout(update, Math.min(next - now, 2147483647))
    }
    update()
    document.addEventListener('visibilitychange', update)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', update)
    }
  }, [])
  return active
}

export default function ChristmasTheme() {
  const [lines, setLines] = useState(FALLBACK_GRINCH_LINES)
  const [pass, setPass] = useState(0)
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem('ecfa-chase-dismissed-2026') === 'true' } catch { return false }
  })
  function dismissChase(value) {
    setDismissed(value)
    try { localStorage.setItem('ecfa-chase-dismissed-2026', String(value)) } catch { /* Dismiss still works without storage. */ }
  }
  const [paused, setPaused] = useState(() => {
    try { return sessionStorage.getItem('ecfa-christmas-paused') === 'true' } catch { return false }
  })
  useEffect(() => {
    let mounted = true
    const refresh = () => loadGrinchLines().then(value => { if (mounted) setLines(value) }).catch(() => { /* Keep the festive jokes if stats are unavailable. */ })
    refresh()
    const timer = window.setInterval(refresh, 5 * 60 * 1000)
    return () => { mounted = false; window.clearInterval(timer) }
  }, [])
  function toggleSnow() {
    setPaused(value => {
      try { sessionStorage.setItem('ecfa-christmas-paused', String(!value)) } catch { /* Storage can be disabled. */ }
      return !value
    })
  }
  return <>
    <div className={`christmas-effects${paused ? ' christmas-effects--paused' : ''}`}>
      {Array.from({ length: 36 }, (_, index) => <span key={index} aria-hidden="true" className="christmas-flake" style={{
        left: `${(index * 37.7) % 100}%`, '--size': `${3 + index % 5}px`,
        '--duration': `${12 + index % 13}s`, '--delay': `${-index * 1.9}s`,
        '--drift': `${(index % 2 ? 1 : -1) * (20 + index % 45)}px`,
      }}>{index % 4 === 0 ? '❄' : ''}</span>)}
      {!dismissed && <div className="christmas-chase" style={{ '--chase-seconds': `${CHASE_SECONDS}s` }} onAnimationIteration={event => {
        if (event.target === event.currentTarget) setPass(value => value + 1)
      }}>
        <div aria-hidden="true">
        <div className="grinch-bubble"><strong>THE GRINCH</strong><span>{lines[pass % lines.length]}</span></div>
        <svg className="christmas-grinch" viewBox="0 0 100 125" fill="none">
          <path className="grinch-leg grinch-leg--back" d="m44 85-16 24-17 2" stroke="#77ab35" strokeWidth="10" strokeLinecap="round" />
          <path className="grinch-leg" d="m57 86 17 19 15 2" stroke="#92c949" strokeWidth="10" strokeLinecap="round" />
          <path d="M26 69q23-27 42 0l3 23H25Z" fill="#bb2438" stroke="#6e1928" strokeWidth="2" />
          <path d="m28 88 40 0" stroke="#fff6df" strokeWidth="8" />
          <path d="m34 64-14 15-10-6m52-9 18-12 13 2" stroke="#92c949" strokeWidth="9" strokeLinecap="round" />
          <path d="m88 53 8-6m-6 7 7 1" stroke="#92c949" strokeWidth="3" strokeLinecap="round" />
          <path d="M20 32 14 24l14 2Q45 8 66 25l15-2-6 12 6 7-13 1Q50 69 29 47l-14-3 9-6Z" fill="#96ce43" stroke="#507c26" strokeWidth="2" />
          <path d="m31 34 13 3-11 3m26-4 12-5-3 8" fill="#f4dc68" stroke="#35511c" strokeWidth="2" />
          <path d="m29 28 16 7m12 0 14-9" stroke="#35511c" strokeWidth="4" strokeLinecap="round" />
          <path d="M32 45q15 15 33-5m-31 5-4-2m34-3 4-1" stroke="#35511c" strokeWidth="2.5" strokeLinecap="round" />
          <path d="m48 40 5-1 2 3" stroke="#507c26" strokeWidth="2" strokeLinecap="round" />
          <path d="M27 23Q38-6 65 8l12 14-21-7-4 9" fill="#c52e3f" stroke="#8f2434" strokeWidth="2" />
          <path d="m27 24 37 0" stroke="#fff6df" strokeWidth="7" strokeLinecap="round" />
          <circle cx="78" cy="22" r="6" fill="#fff6df" />
          <path d="m35 59 24 1" stroke="#fff6df" strokeWidth="6" strokeLinecap="round" />
        </svg>
        <div className="christmas-sleigh">
        <svg viewBox="0 0 310 100" width="240" height="78" fill="none">
          <path d="M100 66 Q168 88 250 38" stroke="#c6a250" strokeWidth="2" strokeDasharray="5 5" />
          <g stroke="#724329" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m174 44 30-5 11-17 11 3-9 11-5 14-28 5-12 17m28-20 8 14m8-42-2-15m2 10 10-8m-9 7-9-7" />
            <path d="m247 31 26-5 11-16 11 3-10 10-4 13-25 6-12 17m26-20 8 13m7-40-3-10m3 7 10-6" />
          </g>
          <circle cx="297" cy="13" r="4" fill="#b52236" />
          <path d="M20 56h64l15-16h12l-9 31H43Q25 71 20 56Z" fill="#b52236" stroke="#f1d07b" strokeWidth="3" />
          <path d="M35 74v11m48-14v14M20 85h76q16 0 19-12" stroke="#e1b854" strokeWidth="4" strokeLinecap="round" />
          <path d="M47 52q-19-28 2-32 21-4 21 32" fill="#527c57" />
          <path d="M67 53V36q14-15 25 0l7 17" fill="#c52e3f" />
          <circle cx="81" cy="26" r="10" fill="#f0cfb4" />
          <path d="M72 28q9 19 19 0" fill="white" />
          <path d="m70 20 12-17 15 20-16-6Z" fill="#c52e3f" />
          <circle cx="97" cy="23" r="4" fill="white" />
          <path d="M92 40 108 33" stroke="#c52e3f" strokeWidth="7" strokeLinecap="round" />
        </svg>
        </div>
        </div>
        <button type="button" className="christmas-scrooge" onClick={() => dismissChase(true)}>I'm a Scrooge — get rid of this <span aria-hidden="true">×</span></button>
      </div>}
    </div>
    <div className="christmas-greeting">
      <span><span aria-hidden="true">❄</span> Christmas at ECFA <span aria-hidden="true">❄</span></span>
      <button type="button" onClick={toggleSnow} aria-pressed={paused}>{paused ? 'Resume effects' : 'Pause effects'}</button>
      {dismissed && <button type="button" onClick={() => dismissChase(false)}>Bring Santa back</button>}
    </div>
  </>
}
