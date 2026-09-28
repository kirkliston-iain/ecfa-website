import { supabase } from '../supabaseClient'

const SESSION_KEY = 'ecfa-web-visit'

function getVisitId() {
  const now = Date.now()
  try {
    const saved = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null')
    if (saved?.id && now - saved.lastSeen < 30 * 60 * 1000) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ id: saved.id, lastSeen: now }))
      return saved.id
    }
    const id = crypto.randomUUID()
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ id, lastSeen: now }))
    return id
  } catch {
    return crypto.randomUUID()
  }
}

export function recordVisit(seconds = 0) {
  const sessionId = getVisitId()
  supabase.rpc('record_web_session', { p_session_id: sessionId, p_active_seconds: Math.max(0, Math.min(30, Math.floor(seconds))) })
    .then(() => {})
}

export function trackInteraction(action, item) {
  supabase.rpc('record_web_interaction', { p_action: action, p_item: item })
    .then(() => {})
}
