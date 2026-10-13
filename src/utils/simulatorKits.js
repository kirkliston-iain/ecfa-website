// Badge-inspired first colours; clash colours confirmed by the league.
const kit = (name, colour, text, trim, family, second = null) => ({ name, colour, text, trim, family, second })
const white = kit('White', '#f7f7f2', '#17232b', '#52616b', 'white')
export const TEAM_KITS = {
  'Barclay Viewforth Church': kit('Red', '#c82e2e', '#ffffff', '#ffffff', 'red'),
  'White Lightning Bruntsfield Church': kit('Red', '#c82e2e', '#ffffff', '#172747', 'red', white),
  'Carrubbers Church': kit('Dark green', '#096137', '#ffffff', '#cb3030', 'green', white),
  'Gorgie United Salvation Army': kit('Green', '#15833f', '#ffffff', '#ffffff', 'green'),
  'Kirkliston Community Church': kit('Black', '#171b20', '#ffffff', '#ffffff', 'black', white),
  'South East Saints': kit('Black', '#171b20', '#ffffff', '#d6b550', 'black', kit('Light blue', '#9ed5eb', '#102735', '#ffffff', 'light-blue')),
  'The Mission': kit('Black', '#171b20', '#ffffff', '#f5ecd4', 'black', kit('Red', '#c82e2e', '#ffffff', '#f5ecd4', 'red')),
  'Ladywell Baptist Church': kit('Yellow', '#f2e400', '#17232b', '#17232b', 'yellow', kit('Dark blue', '#172d64', '#ffffff', '#f2e400', 'navy')),
  'North Berwick Abbey Church': kit('Gold', '#c3a45b', '#17232b', '#b32632', 'yellow'),
  'Liberton Church': kit('Purple', '#7c36ac', '#ffffff', '#ffffff', 'purple'),
  'Murrayburn Church': kit('Navy blue', '#142d50', '#ffffff', '#d6b550', 'navy'),
  'St Marys Metropolitan Church': kit('Light blue', '#9ed5eb', '#102735', '#172d64', 'light-blue'),
}
export function simulatorKits(homeTeam, awayTeam) {
  let home = TEAM_KITS[homeTeam?.name] || kit('Red', '#c82e2e', '#ffffff', '#ffffff', 'red')
  let away = TEAM_KITS[awayTeam?.name] || kit('Blue', '#224bb3', '#ffffff', '#ffffff', 'blue')
  if (home.family === away.family) {
    // Keep Barclay red, Gorgie green and North Berwick gold in either venue order.
    if (['White Lightning Bruntsfield Church', 'Carrubbers Church', 'Ladywell Baptist Church'].includes(homeTeam?.name) && home.second) home = home.second
    else if (away.second) away = away.second
    else if (home.second) home = home.second
  }
  return [home, away]
}
