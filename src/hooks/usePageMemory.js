import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

// Each browser history entry keeps its own view, rather than sharing a single
// last-selected team or scroll position across different visits.
const pages = new Map()
function pageMemory(key) {
  if (!pages.has(key)) pages.set(key, { values: new Map(), scroll: null })
  return pages.get(key)
}

export function useRememberedState(name, initialValue) {
  const { key } = useLocation()
  const memory = pageMemory(key)
  const [value, setValue] = useState(() => memory.values.has(name)
    ? memory.values.get(name)
    : typeof initialValue === 'function' ? initialValue() : initialValue)
  useEffect(() => { memory.values.set(name, value) }, [memory, name, value])
  return [value, setValue]
}

export function useRememberedScroll(ready = true) {
  const { key } = useLocation()
  const navigationType = useNavigationType()
  const memory = pageMemory(key)
  const restored = useRef(false)
  const target = useRef(navigationType === 'POP' ? memory.scroll : null)
  const readyRef = useRef(ready)
  readyRef.current = ready

  useLayoutEffect(() => {
    function remember() {
      if (!readyRef.current) return
      // Don't overwrite the saved position while the returning view is loading.
      if (target.current && !restored.current) return
      memory.scroll = { x: window.scrollX, y: window.scrollY }
      if (restored.current) target.current = memory.scroll
    }
    window.addEventListener('scroll', remember, { passive: true })
    window.addEventListener('pagehide', remember)
    // Capture before a link navigates and the browser clamps the old page's scroll.
    document.addEventListener('click', remember, true)
    return () => {
      remember()
      window.removeEventListener('scroll', remember)
      window.removeEventListener('pagehide', remember)
      document.removeEventListener('click', remember, true)
    }
  }, [memory])

  useLayoutEffect(() => {
    if (!ready && target.current) restored.current = false
    if (!ready || restored.current || !target.current) return
    const { x, y } = target.current
    window.scrollTo({ left: x, top: y, behavior: 'instant' })
    // Apply after the browser's own history restoration as well.
    const frame = requestAnimationFrame(() => {
      window.scrollTo({ left: x, top: y, behavior: 'instant' })
      restored.current = true
    })
    return () => cancelAnimationFrame(frame)
  }, [ready, memory])
}
