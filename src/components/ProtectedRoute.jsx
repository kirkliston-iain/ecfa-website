import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function ProtectedRoute({ children }) {
  const [session, setSession] = useState(undefined)
  const [mustChangePassword, setMustChangePassword] = useState(undefined)
  const location = useLocation()

  useEffect(() => {
    async function applySession(nextSession) {
      setSession(nextSession)
      if (!nextSession) {
        setMustChangePassword(false)
        return
      }
      const { data } = await supabase
        .from('admin_profiles')
        .select('must_change_password')
        .eq('id', nextSession.user.id)
        .maybeSingle()
      setMustChangePassword(!!data?.must_change_password)
    }

    supabase.auth.getSession().then(({ data }) => applySession(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      applySession(nextSession)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  if (session === undefined || mustChangePassword === undefined) return null
  if (!session) return <Navigate to="/admin" replace />
  if (mustChangePassword && location.pathname !== '/admin/change-password') {
    return <Navigate to="/admin/change-password" replace />
  }
  return children
}
