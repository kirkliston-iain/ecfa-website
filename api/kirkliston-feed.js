const SUPABASE_URL='https://enzdsbzsgtwqoictiwam.supabase.co';
const SUPABASE_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVuemRzYnpzZ3R3cW9pY3Rpd2FtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkxODk5NzIsImV4cCI6MjEwNDc2NTk3Mn0.hm02pgtRZ1GoDihbXXZAgZ2-9LDpwkrc2GZnQjEtgNw';
const H={apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`};
async function q(path){const r=await fetch(`${SUPABASE_URL}/rest/v1/${path}`,{headers:H});if(!r.ok)throw new Error(`ECFA data ${r.status}`);return r.json()}
function standings(teams,fixtures){const t={};teams.forEach(x=>t[x.id]={team:x.name,logoUrl:x.logo_url,played:0,won:0,drawn:0,lost:0,gf:0,ga:0,points:0});fixtures.forEach(f=>{if(f.status!=='played'||f.home_score==null||f.away_score==null)return;const h=t[f.home_team_id],a=t[f.away_team_id];if(!h||!a)return;h.played++;a.played++;h.gf+=f.home_score;h.ga+=f.away_score;a.gf+=f.away_score;a.ga+=f.home_score;if(f.home_score>f.away_score){h.won++;h.points+=3;a.lost++}else if(f.home_score<f.away_score){a.won++;a.points+=3;h.lost++}else{h.drawn++;a.drawn++;h.points++;a.points++}});return Object.values(t).map(x=>({...x,goalDiff:x.gf-x.ga})).sort((a,b)=>b.points-a.points||b.goalDiff-a.goalDiff||b.gf-a.gf||a.team.localeCompare(b.team)).map((x,i)=>({position:i+1,...x}))}
export default async function handler(req,res){try{
 const teams=await q('teams?select=id,name,short_name,logo_url');
 const kirk=teams.find(t=>t.name==='Kirkliston Community Church');if(!kirk)throw new Error('Kirkliston team not found');
 const fixtures=await q('fixtures?select=id,stage_id,group_id,fixture_date,venue,home_team_id,away_team_id,home_score,away_score,status,hidden_from_public&hidden_from_public=eq.false&order=fixture_date.asc');
 const calendarEvents=await q('calendar_events?select=id,event_date,title,description&order=event_date.asc');
 const stages=await q('stages?select=id,competition_id,stage_type');
 const comps=await q('competitions?select=id,name,slug,season');
 const league=comps.find(c=>c.slug==='appin-league');
 const leagueStages=stages.filter(s=>s.competition_id===league?.id&&s.stage_type==='group');
 const leagueStageIds=leagueStages.map(s=>s.id);
 const stageTeams=leagueStageIds.length?await q(`stage_teams?select=team_id&stage_id=in.(${leagueStageIds.join(',')})`):[];
 const leagueTeamIds=[...new Set(stageTeams.map(x=>x.team_id))];
 const stageMap=Object.fromEntries(stages.map(s=>[s.id,s])),compMap=Object.fromEntries(comps.map(c=>[c.id,c])),teamMap=Object.fromEntries(teams.map(t=>[t.id,t]));
 const enriched=fixtures.map(f=>{const c=compMap[stageMap[f.stage_id]?.competition_id];return {...f,competition:c?.name||'',competitionSlug:c?.slug||'',homeTeam:teamMap[f.home_team_id]?.name||'',awayTeam:teamMap[f.away_team_id]?.name||''}});
 const own=enriched.filter(f=>f.home_team_id===kirk.id||f.away_team_id===kirk.id);
 const upcoming=own.filter(f=>f.status!=='played').map(f=>({date:f.fixture_date.slice(0,10),time:new Date(f.fixture_date).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/London'}),opponent:f.home_team_id===kirk.id?f.awayTeam:f.homeTeam,homeAway:f.home_team_id===kirk.id?'Home':'Away',venue:f.venue,competition:f.competition,type:'fixture'}));
 const lastFixtureDate=upcoming.reduce((m,f)=>f.date>m?f.date:m,'');
 const events=calendarEvents.filter(e=>!lastFixtureDate||e.event_date<=lastFixtureDate).map(e=>({date:e.event_date,time:'',opponent:e.title,homeAway:'Event',venue:e.description||'',competition:'',type:'event',title:e.title,description:e.description||''}));
 const feedItems=[...upcoming,...events].sort((a,b)=>a.date.localeCompare(b.date)||(a.type==='event'?-1:1));
 const form={};teams.forEach(t=>{form[t.name]=enriched.filter(f=>f.status==='played'&&(f.home_team_id===t.id||f.away_team_id===t.id)).sort((a,b)=>new Date(b.fixture_date)-new Date(a.fixture_date)).slice(0,5).map(f=>{const home=f.home_team_id===t.id,ts=home?f.home_score:f.away_score,os=home?f.away_score:f.home_score;return {date:f.fixture_date.slice(0,10),teamScore:ts,oppScore:os,outcome:ts>os?'W':ts<os?'L':'D'}})});
 const leagueFixtures=enriched.filter(f=>leagueStageIds.includes(f.stage_id));
 res.setHeader('Cache-Control','s-maxage=60, stale-while-revalidate=300');
 res.status(200).json({source:'ECFA',sourceUrl:'https://ecfa-website.vercel.app/',fetchedAt:new Date().toISOString(),fixtures:feedItems,standings:standings(teams.filter(t=>leagueTeamIds.includes(t.id)),leagueFixtures),form,teams:teams.map(t=>({name:t.name,shortName:t.short_name,logoUrl:t.logo_url}))});
}catch(e){res.status(500).json({error:e.message})}}
