export function seasonNow(date = new Date()) { const year = date.getUTCFullYear() - (date.getUTCMonth() < 6 ? 1 : 0); return `${year}/${String(year+1).slice(-2)}` }
export const seasonKey = s => String(s || '').replace('-', '/')
export function teamScores(f, id) {
  const home = f.home_team?.id === id
  const hs = f.went_to_extra_time ? f.home_extra_time_score ?? f.home_score : f.home_score
  const as = f.went_to_extra_time ? f.away_extra_time_score ?? f.away_score : f.away_score
  return { gf: home ? hs : as, ga: home ? as : hs }
}
export function teamResult(f,id) {
  const {gf,ga}=teamScores(f,id)
  if(gf==null || ga==null)return null
  if(gf===ga && f.decided_by_penalties && f.home_penalty_score!=null && f.away_penalty_score!=null && f.home_penalty_score!==f.away_penalty_score) return (f.home_team?.id===id ? f.home_penalty_score>f.away_penalty_score : f.away_penalty_score>f.home_penalty_score)?'W':'L'
  return gf>ga?'W':gf<ga?'L':'D'
}
export function teamStats(fixtures,id) {
 const games=fixtures.filter(f=>f.status==='played' && (f.home_team?.id===id || f.away_team?.id===id) && teamResult(f,id)).sort((a,b)=>String(a.fixture_date).localeCompare(String(b.fixture_date)))
 let gf=0,ga=0,clean=0,w=0,d=0,l=0,run=0,bestRun=0
 for(const f of games){const s=teamScores(f,id),r=teamResult(f,id);gf+=Number(s.gf);ga+=Number(s.ga);if(Number(s.ga)===0)clean++;if(r==='W')w++;else if(r==='D')d++;else l++;run=r==='L'?0:run+1;bestRun=Math.max(bestRun,run)}
 const home=games.filter(f=>f.home_team?.id===id),away=games.filter(f=>f.away_team?.id===id)
 const winRate=rows=>rows.length?Math.round(rows.filter(f=>teamResult(f,id)==='W').length/rows.length*100):null
 return {games,gf,ga,clean,w,d,l,run,bestRun,form:games.slice(-5),winRate:winRate(games),homeRate:winRate(home),awayRate:winRate(away),homeGames:home.length,awayGames:away.length,avg:games.length?(gf/games.length).toFixed(1):'—'}
}
export function talkingPoints(stats,scorers,id){
 const points=[]
 if(stats.run>=2)points.push(`Unbeaten in ${stats.run} competitive matches. Best run this season: ${stats.bestRun}.`)
 if(stats.form.length){const wins=stats.form.filter(f=>teamResult(f,id)==='W').length;points.push(`${wins} ${wins===1?'win':'wins'} from the last ${stats.form.length} competitive matches.`)}
 const leader=scorers[0];if(leader){const target=(Math.floor(leader.goals/5)+1)*5;points.push(`${leader.name} leads the scoring on ${leader.goals} — ${target-leader.goals} away from ${target}.`)}
 if(stats.clean)points.push(`${stats.clean} clean ${stats.clean===1?'sheet':'sheets'} in ${stats.games.length} matches this season.`)
 if(!points.length)points.push('Your season story starts here. Talking points appear as results and scorers are recorded.')
 return points.slice(0,3)
}
