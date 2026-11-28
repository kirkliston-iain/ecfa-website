import {compactScorers} from './weekendRoundup.mjs'
const ink='#102936',gold='#d9b75f',muted='#587080'
function loadImage(url){return new Promise(resolve=>{if(!url)return resolve(null);const img=new Image();img.crossOrigin='anonymous';const timer=setTimeout(()=>resolve(null),5000);img.onload=()=>{clearTimeout(timer);resolve(img)};img.onerror=()=>{clearTimeout(timer);resolve(null)};img.src=url})}
export async function renderRoundup(r,{logo,scorersAvailable=true,cardsAvailable=true,updated}={}){
 const scoring=compactScorers(r.players),tables=r.tables||[]
 const resultsHeight=90+r.matches.length*52
 const tablesHeight=Math.max(115,tables.reduce((sum,t)=>sum+90+t.rows.length*36,0))
 const scoreTop=410+resultsHeight+tablesHeight
 const height=scoreTop+640
 const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=height;const c=canvas.getContext('2d');if(!c)throw Error('Image creation unavailable')
 const badge=await loadImage(logo)
 const text=(value,x,y,size=24,color=ink,bold=false)=>{c.fillStyle=color;c.font=`${bold?'bold ':''}${size}px Arial, sans-serif`;c.fillText(String(value),x,y)}
 const fit=(value,x,y,width,size=25,color=ink,bold=false)=>{let label=String(value);while(size>14){c.font=`${bold?'bold ':''}${size}px Arial, sans-serif`;if(c.measureText(label).width<=width)break;size--}c.font=`${bold?'bold ':''}${size}px Arial, sans-serif`;while(c.measureText(label).width>width&&label.length)label=label.slice(0,-1);if(label!==String(value))label=label.slice(0,-1)+'…';text(label,x,y,size,color,bold)}
 c.fillStyle='#f4f3ed';c.fillRect(0,0,1080,height);c.fillStyle=ink;c.fillRect(0,0,1080,205);c.fillStyle=gold;c.fillRect(0,0,1080,10)
 if(badge)c.drawImage(badge,45,34,70,70)
 text('ECFA / THE WEEKEND IN NUMBERS',badge?135:45,65,25,gold,true);text('WEEKEND ROUNDUP',45,132,44,'#fff',true)
 const date=d=>new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})
 text(`${date(r.saturday)} – ${date(r.end)}  /  All competitions`,45,176,24,'#d9e6eb')
 const metrics=[[r.goals,'GOALS'],[r.matches.length,'PLAYED'],[r.wins,'TEAMS WON'],[r.draws,'DRAWS'],[r.clean,'CLEAN SHEETS'],[r.avg,'GOALS / GAME']]
 metrics.forEach(([v,l],i)=>{const x=45+i*168;c.fillStyle='#fff';c.fillRect(x,230,154,92);text(v,x+14,273,37,ink,true);fit(l,x+14,302,130,17,muted,true)})
 text(`${r.teamsPlayed} teams played · ${r.homeWins} home wins · ${r.awayWins} away wins · ${r.shootouts} shoot-out decisions`,45,360,22,ink,true)
 let y=399
 text('RESULTS THIS WEEKEND',45,y,26,ink,true);y+=43
 for(const f of r.matches){c.fillStyle='#fff';c.fillRect(45,y-24,990,46);fit(f.home_team?.name||'Home TBC',58,y+4,414,25,ink,true);text(`${f.h}–${f.a}`,500,y+4,26,ink,true);fit(f.away_team?.name||'Away TBC',588,y+4,432,25,ink,true);if(f.decided_by_penalties)text(`pens ${f.home_penalty_score}–${f.away_penalty_score}`,493,y+19,13,muted);y+=52}
 y+=25;text('ECFA APPIN SPORTS LEAGUE',45,y,26,ink,true);y+=29;text(`After ${date(r.end)} · all league results up to this date`,45,y,19,muted);y+=35
 if(!tables.length){text(r.tablesAvailable===false?'Table unavailable at this update':'No league results recorded yet',45,y,22,muted);y+=55}
 for(const t of tables){if(tables.length>1){text(t.name,45,y,22,ink,true);y+=30}
 c.fillStyle=ink;c.fillRect(45,y-22,990,34);[['#',58],['TEAM',100],['P',580],['W',642],['D',702],['L',762],['GF',819],['GA',877],['GD',934],['PTS',992]].forEach(([v,x])=>text(v,x,y,17,'#fff',true));y+=35
 t.rows.forEach((row,i)=>{c.fillStyle=i%2===0?'#fff':'#eaf0f2';c.fillRect(45,y-22,990,35);text(i+1,58,y,19,muted);fit(row.teamName,100,y,455,23,ink,true);[row.played,row.won,row.drawn,row.lost,row.goalsFor,row.goalsAgainst,row.goalDifference,row.points].forEach((v,j)=>text(v,[580,642,702,762,819,877,934,992][j],y,20,ink,j===7));y+=36});y+=22}
 y=Math.max(y+8,scoreTop)
 const panelY=y;c.fillStyle='#fff';c.fillRect(45,y,480,300);c.fillRect(545,y,490,300)
 text('TOP SCORERS THIS WEEKEND',61,y+35,22,ink,true);text('TOP-SCORING TEAMS',561,y+35,22,ink,true)
 const list=(rows,x)=>rows.forEach((p,i)=>{const yy=panelY+78+i*36;text(`#${p.rank}`,x+16,yy,18,muted);fit(p.name,x+59,yy,335,23,ink,true);text(p.goals,x+430,yy,24,ink,true)})
 if(scorersAvailable){list(scoring.featured,45);if(!r.players.length)text('Scorers not yet recorded',61,y+82,21,muted);let noteY=y+267;if(scoring.groupedSingles){text(`${scoring.groupedSingles} players scored once`,61,noteY,20,muted);noteY-=24}if(scoring.omittedMulti)text(`+ ${scoring.omittedMulti} more multi-goal scorers`,61,noteY,18,muted)}else text('Scorers unavailable',61,y+82,21,muted)
 list(r.teams.slice(0,5),545);text('Top 5 · ties share rank · all names online',61,y+292,16,muted)
 y+=326;c.fillStyle=ink;c.fillRect(45,y,990,80);text('CARDS RECORDED SO FAR',62,y+29,18,gold,true);text(cardsAvailable?`${r.yellow} YELLOW   /   ${r.red} RED   /   ${r.yellow+r.red} TOTAL`:'Card records unavailable',62,y+61,26,'#fff',true)
 y+=111;text('Late card entries update the next preview and download.',45,y,20,muted);y+=29
 text(scorersAvailable?`${r.recordedGoals} scorer goals recorded / ${r.goals} match goals. Scorers may be incomplete.`:'Scorer records unavailable at this update.',45,y,20,ink);y+=29
 text('Goals include extra time, exclude shoot-outs. Draws exclude shoot-out decisions.',45,y,18,muted);y+=29
 text('Single-goal scorers are grouped when needed. Full lists: ecfa-website.vercel.app/weekend-roundup',45,y,17,muted);y+=37
 text(`Updated ${new Date(updated).toLocaleString('en-GB',{timeZone:'Europe/London',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})} UK · Records so far`,45,y,18,muted)
 const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error('The image could not be created');return blob
}
