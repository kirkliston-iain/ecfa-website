export const coverageNote = 'Career totals use season scoring records. Opponents, competitions, home/away and match highlights use fixture-linked goals only and may cover fewer goals. Scoring matches are not appearances. Earlier season totals may exclude cups. Players with the same name may share historical records.'
export function packAnalytics(report) {
  const matches = report.matches.filter(m => m.goals > 0)
  const group = key => {
    const map = new Map()
    for (const m of matches) { const label = m[key] || 'Not recorded'; const row = map.get(label) || { label, goals: 0, games: 0 }; row.goals += m.goals; row.games++; map.set(label, row) }
    return [...map.values()].sort((a,b) => b.goals-a.goals || a.label.localeCompare(b.label))
  }
  const linkedGoals = matches.reduce((n,m)=>n+m.goals,0)
  const best = [...matches].sort((a,b)=>b.goals-a.goals || String(b.date).localeCompare(String(a.date)))[0]
  const bestSeason = [...report.summary].sort((a,b)=>b.goals-a.goals)[0]
  return { linkedGoals, scoringMatches: matches.length, braces: matches.filter(m=>m.goals===2).length, hatTricks: matches.filter(m=>m.goals>=3).length, best, bestSeason,
    opponents: group('opponent'), competitions: group('competition'), clubs: report.clubs || [],
    homeAway: group('homeAway').map(r=>({...r,label:r.label==='H'?'Home':r.label==='A'?'Away':'Unknown'})),
    outcomes: group('result'), months: group('month').sort((a,b)=>a.label.localeCompare(b.label)),
    seasonBars: [...report.summary].reverse().map(r=>({label:r.season,goals:r.goals})),
    highlights: [bestSeason && `Best recorded season: ${bestSeason.season} (${bestSeason.goals} goals).`, best && `Most goals in a linked match: ${best.goals} v ${best.opponent} (${best.date?.slice(0,10)}).`, matches.length ? `Results in linked scoring matches: wins ${matches.filter(m=>m.result==='Win').length}, draws ${matches.filter(m=>m.result==='Draw').length}, defeats ${matches.filter(m=>m.result==='Loss').length}.` : 'Fixture-linked scoring analysis is not available for this selection.'].filter(Boolean),
  }
}
