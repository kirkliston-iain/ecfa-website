import {computeStandings} from './standings.js'
import {ukDay} from './weekendRoundup.mjs'
export function roundupTables(fixtures,members,end,season){
 const leagueMembers=members.filter(m=>m.stage?.competition?.slug==='appin-league'&&String(m.stage?.competition?.season).replace('-','/')===season)
 const groups=new Map()
 for(const m of leagueMembers){const key=`${m.stage.id}:${m.group_id||''}`;if(!groups.has(key))groups.set(key,{stageId:m.stage.id,groupId:m.group_id,name:[m.stage.name,m.group?.name].filter(Boolean).join(' · '),teams:[]});if(m.team)groups.get(key).teams.push(m.team)}
 const tables=[...groups.values()].map(g=>({...g,rows:computeStandings([...new Map(g.teams.map(t=>[t.id,t])).values()],fixtures.filter(f=>f.hidden_from_public===false&&f.status==='played'&&f.home_score!=null&&f.away_score!=null&&f.stage?.id===g.stageId&&f.group_id===g.groupId&&ukDay(f.fixture_date)<=end))}))
 return tables.filter(t=>t.rows.some(r=>r.played>0))
}
