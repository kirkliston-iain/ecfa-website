import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { DEFAULT_SITE_LOGOS } from '../utils/siteLogos'

const defaultValue = { siteLogo: (key) => DEFAULT_SITE_LOGOS[key] || null, sponsorLogo: (name) => name === 'Appin Sports' ? '/sponsors/appin-sports.png' : null }
const SiteLogosContext = createContext(defaultValue)

export function SiteLogosProvider({ children }) {
  const [logos, setLogos] = useState(null)
  const [sponsors, setSponsors] = useState(null)
  useEffect(() => {
    let active = true
    let request = 0
    async function load() {
      const current = ++request
      const results = await Promise.allSettled([
        supabase.from('site_logos').select('id, logo_url'),
        supabase.from('sponsors').select('name, logo_url'),
      ])
      if (!active || current !== request) return
      const [site, sponsor] = results
      if (site.status === 'fulfilled' && !site.value.error) setLogos(Object.fromEntries((site.value.data || []).map((row) => [row.id, row.logo_url])))
      if (sponsor.status === 'fulfilled' && !sponsor.value.error) setSponsors(Object.fromEntries((sponsor.value.data || []).map((row) => [row.name, row.logo_url])))
    }
    load()
    window.addEventListener('ecfa-logos-changed', load)
    return () => { active = false; window.removeEventListener('ecfa-logos-changed', load) }
  }, [])

  const leagueLogo = logos === null ? DEFAULT_SITE_LOGOS.ecfa : logos.ecfa || null
  useEffect(() => {
    const blankIcon = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E'
    const icons = document.querySelectorAll('link[rel="icon"], link[rel="apple-touch-icon"]')
    icons.forEach((link) => {
      link.href = leagueLogo || blankIcon
      link.removeAttribute('type')
      link.removeAttribute('sizes')
    })
    // Future home-screen installs use the same logo as the website header.
    const manifest = document.querySelector('link[rel="manifest"]')
    if (!manifest || !URL.createObjectURL) return undefined
    const origin = window.location.origin
    const url = URL.createObjectURL(new Blob([JSON.stringify({
      name: 'Edinburgh Churches Football Association', short_name: 'ECFA',
      start_url: `${origin}/`, scope: `${origin}/`, display: 'standalone',
      background_color: '#ffffff', theme_color: '#b48a38',
      icons: leagueLogo ? [{ src: new URL(leagueLogo, origin).href, sizes: 'any', purpose: 'any' }] : [],
    })], { type: 'application/manifest+json' }))
    manifest.href = url
    return () => { URL.revokeObjectURL(url) }
  }, [leagueLogo])

  return <SiteLogosContext.Provider value={{
    siteLogo: (key) => logos === null ? DEFAULT_SITE_LOGOS[key] || null : logos[key] || null,
    sponsorLogo: (name) => sponsors === null ? defaultValue.sponsorLogo(name) : sponsors[name] || null,
  }}>{children}</SiteLogosContext.Provider>
}

export function useSiteLogos() { return useContext(SiteLogosContext) }
