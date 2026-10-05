export function websiteForTeam(team) {
  if (!team?.team_website_url) return null
  return {
    name: team.team_website_label?.trim() || team.name,
    url: team.team_website_url,
    teamId: team.id,
  }
}
