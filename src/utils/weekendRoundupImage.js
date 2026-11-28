const ink='#102936',gold='#d9b75f',muted='#587080'
function loadImage(url){return new Promise(resolve=>{if(!url)return resolve(null);const img=new Image();img.crossOrigin='anonymous';const timer=setTimeout(()=>resolve(null),5000);img.onload=()=>{clearTimeout(timer);resolve(img)};img.onerror=()=>{clearTimeout(timer);resolve(null)};img.src=url})}
export async function renderRoundup(r,{logo,scorersAvailable=true,cardsAvailable=true,updated}={}){
 const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1520;const c=canvas.getContext('2d');if(!c)throw Error('Image creation unavailable')
 const badge=await loadImage(logo)
 c.fillStyle='#f4f3ed';c.fillRect(0,0,1080,1520);c.fillStyle=ink;c.fillRect(0,0,1080,240);c.fillStyle=gold;c.fillRect(0,0,1080,12)
 if(badge)c.drawImage(badge,48,40,88,88)
 const text=(value,x,y,size=26,color=ink,bold=false)=>{c.fillStyle=color;c.font=`${bold?'bold ':''}${size}px Arial, sans-serif`;c.fillText(String(value),x,y)}
 const fit=(value,x,y,width,size=28,color=ink,bold=false)=>{while(size>16){c.font=`${bold?'bold ':''}${size}px Arial, sans-serif`;if(c.measureText(value).width<=width)break;size--}let label=value;while(c.measureText(label).width>width&&label.length)label=label.slice(0,-1);if(label!==value)label=label.slice(0,-1)+'…';text(label,x,y,size,color,bold)}
 text('ECFA / WEEKEND IN NUMBERS',badge?158:48,70,28,gold,true);text('THE WEEKEND ROUNDUP',48,158,48,'#fff',true)
 const date=d=>new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})
 text(`${date(r.saturday)} – ${date(r.end)}  /  All competitions`,48,207,25,'#d9e6eb')
 const metrics=[[r.goals,'GOALS'],[r.matches.length,'MATCHES PLAYED'],[r.wins,'TEAMS WON'],[r.draws,'DRAWS'],[r.avg,'GOALS / MATCH'],[r.clean,'CLEAN SHEETS']]
 metrics.forEach(([value,label],i)=>{const x=48+(i%3)*334,y=273+Math.floor(i/3)*118;c.fillStyle='#fff';c.fillRect(x,y,316,100);text(value,x+18,y+47,43,ink,true);text(label,x+18,y+78,18,muted,true)})
 const panel=(title,x,y,w)=>{c.fillStyle='#fff';c.fillRect(x,y,w,382);text(title,x+20,y+39,23,ink,true);c.fillStyle=gold;c.fillRect(x+20,y+53,42,4)}
 panel('LEADING SCORERS',48,529,480);panel('TOP-SCORING TEAMS',548,529,484)
 const list=(rows,x,empty)=>{if(!rows.length){text(empty,x+20,635,21,muted);return}rows.slice(0,5).forEach((p,i)=>{const y=622+i*52;text(`#${p.rank}`,x+20,y,19,muted,true);fit(p.name,x+66,y,325,25,ink,true);text(p.goals,x+426,y,27,ink,true);if(p.clubs)fit(p.clubs,x+66,y+19,330,15,muted)})}
 list(scorersAvailable?r.players:[],48,scorersAvailable?'Scorers not yet recorded':'Scorers unavailable');list(r.teams,548,'Awaiting results')
 text('Top 5 shown · goals across this weekend · ties share rank',68,886,17,muted)
 if(r.topTies>1)text(`${r.topTies} players tied for top on ${r.players[0].goals} goals`,68,936,22,ink,true)
 else if(r.players.length)fit(`${r.players[0].name} leads on ${r.players[0].goals} goals`,68,936,944,26,ink,true)
 else text('Scoring race updates as names are added',68,936,23,ink,true)
 c.fillStyle=ink;c.fillRect(48,965,984,139);text('DISCIPLINE / RECORDED SO FAR',72,1001,21,gold,true)
 text(cardsAvailable?`${r.yellow} yellow`:'Unavailable',72,1059,37,'#f5d560',true);text(cardsAvailable?`${r.red} red`:'',400,1059,37,'#ffa9ac',true);text(cardsAvailable?`${r.yellow+r.red} total`:'',730,1059,37,'#fff',true)
 text('Late card entries update the next preview and download.',68,1145,21,muted)
 text(`${r.teamsPlayed} teams played  /  ${r.homeWins} home wins  /  ${r.awayWins} away wins`,68,1190,25,ink,true)
 text(`${r.notCompleted} fixtures not completed  /  ${r.shootouts} shoot-out decisions`,68,1228,23,ink)
 text(scorersAvailable?`${r.recordedGoals} scorer goals recorded / ${r.goals} match goals`:'Scorer records unavailable at this update',68,1278,22,ink,true)
 text('Scorer totals may be incomplete; own goals can explain differences.',68,1314,20,muted)
 text('Goals include extra time, exclude shoot-outs. Draws exclude shoot-out decisions.',68,1350,18,muted)
 c.fillStyle=gold;c.fillRect(48,1390,984,2);text(`Updated ${new Date(updated).toLocaleString('en-GB',{timeZone:'Europe/London',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})} UK · Records so far`,48,1431,19,muted)
 text('EDINBURGH CHURCHES FOOTBALL ASSOCIATION',48,1475,20,ink,true);text('ecfa-website.vercel.app',746,1475,19,muted)
 const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error('The image could not be created');return blob
}
