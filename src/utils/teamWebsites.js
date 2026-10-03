export const teamWebsites = [
  {
    name: 'Kirkliston Community Church FC',
    url: 'https://kirkliston-football.vercel.app/',
    teamNames: ['Kirkliston Community Church', 'Kirkliston Community Church FC'],
  },
]

export function websiteForTeam(name) {
  return teamWebsites.find((website) => website.teamNames.includes(name))
}
