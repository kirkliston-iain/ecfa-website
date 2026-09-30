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
