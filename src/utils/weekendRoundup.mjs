export function ukDay(value){if(!value)return '';return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value))}
export function saturdayFor(value){const date=new Date(`${value}T12:00:00Z`);date.setUTCDate(date.getUTCDate()-((date.getUTCDay()+1)%7));return date.toISOString().slice(0,10)}
export function weekendDay(value){const day=new Date(`${ukDay(value)}T12:00:00Z`).getUTCDay();return day===0||day===6}
export function finalScores(f){return f.went_to_extra_time&&f.home_extra_time_score!=null&&f.away_extra_time_score!=null?[Number(f.home_extra_time_score),Number(f.away_extra_time_score)]:[Number(f.home_score),Number(f.away_score)]}
export function roundup(fixtures,scorers,cards,saturday){
 const sunday=new Date(`${saturday}T12:00:00Z`);sunday.setUTCDate(sunday.getUTCDate()+1)
 const end=sunday.toISOString().slice(0,10)
 const weekend=fixtures.filter(f=>f.hidden_from_public===false&&ukDay(f.fixture_date)>=saturday&&ukDay(f.fixture_date)<=end)
 const matches=weekend.filter(f=>f.status==='played'&&f.home_score!=null&&f.away_score!=null)
 const ids=new Set(matches.map(f=>f.id)),players=new Map(),teams=new Map(),winners=new Set()
 let goals=0,wins=0,draws=0,shootouts=0,clean=0,homeWins=0,awayWins=0
 const results=matches.map(f=>{const [h,a]=finalScores(f);goals+=h+a;let winner=h>a?'home':a>h?'away':null
 if(h===a&&f.decided_by_penalties&&f.home_penalty_score!=null&&f.away_penalty_score!=null&&f.home_penalty_score!==f.away_penalty_score){winner=f.home_penalty_score>f.away_penalty_score?'home':'away';shootouts++}
 if(winner){wins++;winners.add((winner==='home'?f.home_team:f.away_team)?.id||`${f.id}:${winner}`);if(winner==='home')homeWins++;else awayWins++}else draws++
 if(h===0)clean++;if(a===0)clean++
 for(const [t,n] of [[f.home_team,h],[f.away_team,a]]){if(!t?.id)continue;const row=teams.get(t.id)||{id:t.id,name:t.name||'Team not recorded',logo:t.logo_url,goals:0};row.goals+=n;teams.set(t.id,row)}
 return{...f,h,a,winner}}).sort((a,b)=>ukDay(a.fixture_date).localeCompare(ukDay(b.fixture_date))||String(a.home_team?.name).localeCompare(String(b.home_team?.name)))
 let recordedGoals=0
 for(const s of scorers){if(!ids.has(s.fixture_id))continue;const n=Number(s.goals)||0;recordedGoals+=n;if(n<=0)continue;const name=`${s.player?.first_name||''} ${s.player?.last_name||''}`.trim();if(!name||/^(o\.?g\.?|own goal)$/i.test(name))continue;const key=s.player?.id||name.toLowerCase(),t=teams.get(s.team_id);const row=players.get(key)||{id:s.player?.id,name,goals:0,clubs:new Set()};row.goals+=n;if(t?.name)row.clubs.add(t.name);players.set(key,row)}
 let yellow=0,red=0;for(const c of cards){if(!ids.has(c.fixture_id))continue;const n=Math.max(0,Number(c.card_count)||0);if(c.card_type==='yellow')yellow+=n;else if(c.card_type==='red')red+=n}
 const rank=rows=>rows.sort((a,b)=>b.goals-a.goals||a.name.localeCompare(b.name)).map((r,i,all)=>({...r,rank:1+all.filter(x=>x.goals>r.goals).length}))
 const playerRows=rank([...players.values()].map(p=>({...p,clubs:[...p.clubs].join(', ')}))),teamRows=rank([...teams.values()])
 return{saturday,end,matches:results,goals,wins:winners.size,decisiveMatches:wins,draws,shootouts,clean,homeWins,awayWins,yellow,red,recordedGoals,players:playerRows,teams:teamRows,teamsPlayed:teams.size,notCompleted:weekend.length-matches.length,avg:matches.length?(goals/matches.length).toFixed(1):'0.0',topTies:playerRows.length?playerRows.filter(p=>p.goals===playerRows[0].goals).length:0}
}
