export const MAX_TEAM_LINKS = 5
export const TEAM_LINK_TYPES = ['Facebook', 'Instagram', 'X', 'Own Website', 'Other']

export function isValidTeamLinkUrl(url) {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' && Boolean(parsed.hostname) && !parsed.username && !parsed.password && !/\s/.test(url)
  } catch {
    return false
  }
}

export function inferTeamLinkType(url) {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '')
    if (host === 'facebook.com' || host.endsWith('.facebook.com') || host === 'fb.com') return 'Facebook'
    if (host === 'instagram.com' || host.endsWith('.instagram.com')) return 'Instagram'
    if (['x.com', 'twitter.com'].includes(host) || host.endsWith('.twitter.com') || host.endsWith('.x.com')) return 'X'
  } catch { /* Invalid legacy addresses are filtered out below. */ }
  return 'Own Website'
}

export function websitesForTeam(team) {
  if (!team) return []
  const links = Array.isArray(team.team_website_links)
    ? team.team_website_links
    : team.team_website_url ? [{ type: inferTeamLinkType(team.team_website_url), url: team.team_website_url }] : []
  return links.filter((link) => TEAM_LINK_TYPES.includes(link?.type) && isValidTeamLinkUrl(link?.url))
    .slice(0, MAX_TEAM_LINKS)
    .map((link) => ({ ...link, name: team.team_website_label?.trim() || team.name, teamId: team.id }))
}
