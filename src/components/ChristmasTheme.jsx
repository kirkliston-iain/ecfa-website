import { useEffect, useState } from 'react'
import './ChristmasTheme.css'

// One-off 2026 celebration, inclusive of 28 December in Edinburgh.
export const CHRISTMAS_END = Date.parse('2026-12-29T00:00:00Z')
export const christmasIsActive = (now = Date.now()) => now >= Date.parse('2026-11-06T00:00:00Z') && now < CHRISTMAS_END

export function useChristmasTheme() {
  const [active, setActive] = useState(() => christmasIsActive())
  useEffect(() => {
    const update = () => setActive(christmasIsActive())
    const timer = window.setInterval(update, 30000)
    const expiry = window.setTimeout(update, Math.min(Math.max(CHRISTMAS_END - Date.now(), 0), 2147483647))
    document.addEventListener('visibilitychange', update)
    return () => {
      window.clearInterval(timer)
      window.clearTimeout(expiry)
      document.removeEventListener('visibilitychange', update)
    }
  }, [])
  return active
}

export default function ChristmasTheme() {
  const [paused, setPaused] = useState(() => {
    try { return sessionStorage.getItem('ecfa-christmas-paused') === 'true' } catch { return false }
  })
  function toggleSnow() {
    setPaused(value => {
      try { sessionStorage.setItem('ecfa-christmas-paused', String(!value)) } catch { /* Storage can be disabled. */ }
      return !value
    })
  }
  return <>
    <div className={`christmas-effects${paused ? ' christmas-effects--paused' : ''}`} aria-hidden="true">
      {Array.from({ length: 36 }, (_, index) => <span key={index} className="christmas-flake" style={{
        left: `${(index * 37.7) % 100}%`, '--size': `${3 + index % 5}px`,
        '--duration': `${12 + index % 13}s`, '--delay': `${-index * 1.9}s`,
        '--drift': `${(index % 2 ? 1 : -1) * (20 + index % 45)}px`,
      }}>{index % 4 === 0 ? '❄' : ''}</span>)}
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
    <div className="christmas-greeting">
      <span><span aria-hidden="true">❄</span> Christmas at ECFA <span aria-hidden="true">❄</span></span>
      <button type="button" onClick={toggleSnow} aria-pressed={paused}>{paused ? 'Resume effects' : 'Pause effects'}</button>
    </div>
  </>
}
