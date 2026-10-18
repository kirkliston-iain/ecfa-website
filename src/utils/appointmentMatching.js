// Keep as many fixtures staffed as possible while respecting each fixture's
// eligible referees. A later constrained game may displace a flexible choice.
export function matchReferees(fixtureOrder, candidatesByFixture) {
  const matchedReferees = new Map()
  const fixturesById = new Map(fixtureOrder.map((fixture) => [fixture.id, fixture]))

  function match(fixture, tried) {
    for (const candidate of candidatesByFixture.get(fixture.id) || []) {
      const name = candidate.referee.name
      if (tried.has(name)) continue
      tried.add(name)
      const previous = matchedReferees.get(name)
      if (!previous || match(fixturesById.get(previous), tried)) {
        matchedReferees.set(name, fixture.id)
        return true
      }
    }
    return false
  }

  fixtureOrder.forEach((fixture) => match(fixture, new Set()))
  return new Map([...matchedReferees].map(([name, fixtureId]) => [fixtureId, name]))
}

export function needsAssistants(fixture) {
  return fixture.stage?.stage_type === 'knockout'
    && /^(semi[\s-]*finals?|finals?)$/i.test((fixture.round_name || fixture.stage?.name || '').trim())
}

export function officialAllowed(name, fixture, slot, settings, weekRules, assistant = false) {
  if (weekRules.unavailableReferees?.includes(name)) return false
  const teams = [fixture.home_team?.name, fixture.away_team?.name].filter(Boolean)
  if (!assistant && [settings, weekRules].some((rules) => rules.refereeTeamBlocks?.some((rule) => rule.referee === name && teams.includes(rule.team)))) return false
  const venues = settings.refereeVenueOnly?.[name]
  return !venues || venues.includes(slot.venue)
}

// Referees have priority. Match the remaining pool to the assistant slots,
// retaining venue restrictions and area preferences, without team penalties.
export function proposeAssistants(fixtures, allocations, referees, available, slots, settings, weekRules) {
  const reserved = new Set(allocations.map((row) => row.referee).filter(Boolean))
  const positions = fixtures.filter(needsAssistants).flatMap((fixture) => [1, 2].map((number) => ({ id: `${fixture.id}:assistant${number}`, fixture, number })))
  const candidates = new Map(positions.map((position) => {
    const slot = slots.get(position.fixture.id)
    return [position.id, referees.filter((referee) => available.includes(referee.name) && !reserved.has(referee.name)
      && officialAllowed(referee.name, position.fixture, slot, settings, weekRules, true))
      .map((referee) => {
        const preference = settings.refereePreferences?.[referee.name] || 'Any'
        return { referee, score: preference === 'Any' ? 12 : preference === slot.area ? 35 : 0 }
      }).sort((a, b) => b.score - a.score)]
  }))
  const selected = matchReferees(positions, candidates)
  return allocations.map((row) => ({ ...row,
    assistant1: selected.get(`${row.fixtureId}:assistant1`) || '',
    assistant2: selected.get(`${row.fixtureId}:assistant2`) || '',
  }))
}
