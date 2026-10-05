import { websitesForTeam } from '../utils/teamWebsites'
import { trackInteraction } from '../utils/webAnalytics'

export default function TeamWebsiteLinks({ team, context }) {
  const links = websitesForTeam(team)
  if (!links.length) return null
  return <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', marginTop: 4 }}>
    {links.map((link, index) => <a key={`${link.teamId}-${index}`} href={link.url} target="_blank" rel="noopener noreferrer"
      aria-label={`${link.name} — ${link.type}`}
      onClick={() => trackInteraction('team_website_click', `${link.name} — ${link.type} — ${context}`)}
      style={{ color: 'var(--brass)', fontWeight: 700, fontSize: 14 }}>{link.type} ↗</a>)}
  </div>
}
