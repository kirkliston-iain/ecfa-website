export const HISTORIC_TEAM_ALIASES = {
  'AC Oxgangs FC': 'AC Oxgangs',
  Broxburn: 'Broxburn Baptist Church',
  'Broxburn Baptist Church FC': 'Broxburn Baptist Church',
  'Barclay Viewforth FC': 'Barclay Viewforth Church',
  'Bingham FC': 'Hope Church',
  'Bristo Memorial FC': 'South East Saints',
  Carrubbers: 'Carrubbers Church',
  'Carrubbers FC': 'Carrubbers Church',
  Central: 'Liberton Church',
  'Central FC': 'Liberton Church',
  'Charlotte Chapel FC': 'Charlotte Chapel',
  'Gorgie United': 'Gorgie United Salvation Army',
  'Gorgie United FC': 'Gorgie United Salvation Army',
  Gorgie: 'Gorgie United Salvation Army',
  'Hope Church FC': 'Hope Church',
  'Kirkliston Community Church FC': 'Kirkliston Community Church',
  Ladywell: 'Ladywell Baptist Church',
  'Ladywell Baptist Church FC': 'Ladywell Baptist Church',
  Niddrie: 'The Mission',
  'Niddrie FC': 'The Mission',
  'Port Seton FC': 'Port Seton',
  'South East Saints FC': 'South East Saints',
  "St Columba's FC": 'St Columbas',
  "St Mary's Metropolitan FC": 'St Marys Metropolitan Church',
  'St Marys': 'St Marys Metropolitan Church',
  "St Marys Metropolitan Church's FC": 'St Marys Metropolitan Church',
  'The Mission FC': 'The Mission',
  'White Lightning': 'White Lightning Bruntsfield Church',
  'White Lightning FC': 'White Lightning Bruntsfield Church',
}

export function historicTeamName(name) {
  const cleaned = String(name || '').trim().replace(/\s+/g, ' ')
  return HISTORIC_TEAM_ALIASES[cleaned] || cleaned
}

export function previousTeamUrl(name) {
  return `/teams/previous/${encodeURIComponent(name)}`
}
