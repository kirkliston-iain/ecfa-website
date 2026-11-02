import { jsPDF } from 'jspdf'
import { TEAM_KITS } from './simulatorKits.js'
import { regularFont, boldFont } from './teamPackFonts.js'
import { summary } from './teamAnalysis.js'

const C = { ink:'#172a43', muted:'#566778', paper:'#f8fafc', line:'#dce5ed', green:'#138363', amber:'#c28a20', red:'#cb5260', teal:'#008b98', blue:'#3465ad' }
const pct = n => `${Number(n).toFixed(1)}%`
const fixed = n => Number(n).toFixed(2)
const clean = value => String(value ?? '').replace(/[–—]/g,'-').replace(/[^\x20-\xff\u2010-\u201f\u2022\n]/g,'')
const dateLabel = value => value ? new Date(`${value.slice(0,10)}T12:00:00Z`).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}) : 'Date not recorded'
const monthLabel = value => new Date(`${value}-01T12:00:00Z`).toLocaleDateString('en-GB',{month:'short',year:'2-digit'})
const mix = (hex,amount=.9) => '#'+hex.replace('#','').match(/../g).map(v=>Math.round(parseInt(v,16)*(1-amount)+255*amount).toString(16).padStart(2,'0')).join('')
const resultColour = result => ({W:C.green,D:C.amber,L:C.red}[result] || C.muted)
export const TEAM_PACK_PAGE = { width:144, height:240, bodyFont:13, tableFont:11.5 }
export function teamPackTheme(name) {
  const base = TEAM_KITS[name]
  const kit = ['The Mission','South East Saints','Ladywell Baptist Church'].includes(name) ? base?.second || base : base
  const primary = kit?.colour || C.blue
  const neutral = ['black','white','grey'].includes(kit?.family)
  return { colour:primary, text:kit?.text || '#fff', accent:neutral?'#c89435':primary, pale:mix(neutral?'#c89435':primary), dark:C.ink }
}
export async function loadTeamBadge(url) {
  if (!url) return null
  try {
    const response = await fetch(url, { signal:AbortSignal.timeout(12000) })
    if (!response.ok) return null
    const bitmap = await createImageBitmap(await response.blob())
    const canvas = document.createElement('canvas'); canvas.width=320; canvas.height=320
    const scale=Math.min(300/bitmap.width,300/bitmap.height)
    canvas.getContext('2d').drawImage(bitmap,(320-bitmap.width*scale)/2,(320-bitmap.height*scale)/2,bitmap.width*scale,bitmap.height*scale)
    bitmap.close()
    return canvas.toDataURL('image/png')
  } catch { return null }
}
export function createTeamAnalysisPdf(r,badge=null) {
  const {width:W,height:H}=TEAM_PACK_PAGE, M=10, CW=W-2*M, bottom=224
  const doc=new jsPDF({orientation:'portrait',unit:'mm',format:[W,H],compress:true,putOnlyUsedFonts:true})
  doc.addFileToVFS('TeamPack-Regular.ttf',regularFont);doc.addFont('TeamPack-Regular.ttf','TeamPack','normal')
  doc.addFileToVFS('TeamPack-Bold.ttf',boldFont);doc.addFont('TeamPack-Bold.ttf','TeamPack','bold')
  const theme=teamPackTheme(r.team.name)
  let y=0, page=0, section=''
  const font=(size=13,bold=false,colour=C.ink)=>{doc.setFont('TeamPack',bold?'bold':'normal');doc.setFontSize(size);doc.setTextColor(colour)}
  const text=(value,x,yy,size=13,bold=false,colour=C.ink,options={})=>{font(size,bold,colour);doc.text(Array.isArray(value)?value.map(clean):clean(value),x,yy,{lineHeightFactor:1.25,...options})}
  const lines=(value,width=CW,size=13,bold=false)=>{font(size,bold);return doc.splitTextToSize(clean(value),width)}
  const lineHeight=size=>size*.3528*1.25
  const fill=(colour,x,yy,w,h,radius=0)=>{doc.setFillColor(colour);if(radius)doc.roundedRect(x,yy,w,h,radius,radius,'F');else doc.rect(x,yy,w,h,'F')}
  function newPage(title=section,continuation=false) {
    if(page++)doc.addPage([W,H],'portrait')
    section=title
    fill('#ffffff',0,0,W,H);fill(theme.colour,0,0,W,3)
    text('ECFA / TEAM ANALYSIS',M,10,8.5,true,C.muted)
    const teamLines=lines(r.team.name,CW-18,9,true)
    text(teamLines,M,16,9,true)
    if(badge)doc.addImage(badge,'PNG',W-M-14,7,14,14)
    const titleLines=lines(title,CW,21,true)
    text(titleLines,M,31,21,true)
    y=31+(titleLines.length-1)*lineHeight(21)+8
    fill(theme.accent,M,y-2,17,1)
    y+=5
    if(continuation){text('CONTINUED',M,y,8.5,true,C.muted);y+=7}
  }
  function start(title) {if(page>1&&y<110){section=title;heading(title,35)}else newPage(title)}
  function ensure(h) {if(y+h>bottom)newPage(section,true)}
  function paragraph(value,{size=13,colour=C.muted,gap=5}={}) {
    const ls=lines(value,CW,size)
    for(const l of ls){ensure(lineHeight(size)+1);text(l,M,y,size,false,colour);y+=lineHeight(size)}
    y+=gap
  }
  function heading(title,keep=20) {const ls=lines(title,CW,14,true);ensure(keep+ls.length*6);text(ls,M,y+1,14,true);y+=ls.length*6+4}
  function callout(label,body,colour=theme.accent) {
    const labelLines=lines(label,CW-10,11,true), bodyLines=lines(body,CW-10,12.5)
    const height=10+labelLines.length*5+bodyLines.length*5.6
    ensure(height+4);fill(mix(colour,.92),M,y,CW,height,2);fill(colour,M,y,1.2,height)
    text(labelLines,M+5,y+7,11,true,colour)
    text(bodyLines,M+5,y+8+labelLines.length*5,12.5,false,C.ink)
    y+=height+5
  }
  function statTiles(items,{dark=false}={}) {
    const cardW=(CW-4)/2, cardH=29
    const height=Math.ceil(items.length/2)*(cardH+4)
    ensure(height)
    items.forEach(([label,value,colour],i)=>{
      const x=M+(i%2)*(cardW+4),yy=y+Math.floor(i/2)*(cardH+4)
      fill(dark?'#233c58':mix(colour||theme.accent,.93),x,yy,cardW,cardH,2)
      fill(colour||theme.accent,x,yy,cardW,1)
      text(value,x+4,yy+12,23,true,dark?'#fff':colour||C.ink)
      text(lines(label,cardW-8,10.5),x+4,yy+21,10.5,false,dark?'#d6e2ee':C.muted)
    });y+=height+2
  }
  function table(headers,rows,widths) {
    function draw(cells,head=false,index=0) {
      const ls=cells.map((v,i)=>lines(v,widths[i]-5,11.5,head))
      const h=Math.max(9.2,Math.max(...ls.map(v=>v.length))*5.1+4)
      if(y+h>bottom){newPage(section,true);if(!head)draw(headers,true)}
      fill(head?theme.dark:index%2?C.paper:'#ffffff',M,y,CW,h)
      let x=M
      ls.forEach((l,i)=>{text(l,x+2.5,y+6,11.5,head,head?'#fff':C.ink);x+=widths[i]})
      y+=h
    }
    ensure(24);draw(headers,true)
    if(!rows.length)paragraph('No records for this selection.')
    else rows.forEach((row,i)=>draw(row,false,i))
    y+=6
  }
  function resultStrip(matches) {
    const last=matches.slice(-10)
    heading(`Recent form / last ${last.length}`,19)
    if(!last.length)return paragraph('No completed matches.')
    last.forEach((f,i)=>{const x=M+i*(CW/10);fill(resultColour(f.result),x,y,10,10,1);text(f.result,x+5,y+6.8,12,true,'#fff',{align:'center'})})
    y+=17
    text('Oldest to newest  ·  W win  D draw  L loss',M,y,9.5,false,C.muted);y+=10
  }
  function legend(items) {
    let x=M
    items.forEach(([label,colour])=>{fill(colour,x,y-2.5,3,3);text(label,x+5,y,9.5,false,C.muted);font(9.5);x+=doc.getTextWidth(clean(label))+11})
    y+=7
  }
  function bars(rows,{max=null,suffix='',colours=null}={}) {
    const maximum=max||Math.max(1,...rows.map(row=>row.value))
    for(const row of rows){
      const ls=lines(row.label,CW-20,12,true),h=ls.length*5.4+10
      ensure(h);text(ls,M,y+1,12,true);text(row.display??`${row.value}${suffix}`,W-M,y+1,12,true,row.colour||C.ink,{align:'right'})
      const by=y+ls.length*5.4
      fill(C.paper,M,by,CW,4,1)
      if(row.value>0)fill(row.colour||colours||theme.accent,M,by,Math.max(.5,CW*Math.min(1,row.value/maximum)),4,1)
      y+=h
    }
  }
  function recordCards(rows,{ranked=false,compact=false}={}) {
    if(!rows.length)return paragraph('No recorded matches for this selection.')
    for(const [i,row] of rows.entries()){
      const ls=lines(`${ranked?`${i+1}. `:''}${row.name}`,CW-38,12.5,true),h=(compact?16:22)+ls.length*5.5
      ensure(h+4);fill(C.paper,M,y,CW,h,2)
      text(ls,M+4,y+7,12.5,true);text(pct(row.win),W-M-4,y+7,12.5,true,C.green,{align:'right'})
      const yy=y+7+ls.length*5.5
      text(compact?`${row.w}W   ${row.d}D   ${row.l}L`:`${row.p} played   ${row.w}W  ${row.d}D  ${row.l}L`,M+4,yy,11.5)
      if(!compact)text(`Goals ${row.gf}-${row.ga}   GD ${row.gd>0?'+':''}${row.gd}`,M+4,yy+6,11.5,false,C.muted)
      const barY=y+h-4, barW=CW-8
      fill(C.line,M+4,barY,barW,1.4)
      let x=M+4
      for(const [value,colour] of [[row.w,C.green],[row.d,C.amber],[row.l,C.red]]){if(value&&row.p){const w=barW*value/row.p;fill(colour,x,barY,w,1.4);x+=w}}
      y+=h+4
    }
  }
  function lineChart(series,labels,{max=100,height=49}={}) {
    const chartH=height,chartW=CW-13,x=M+12
    ensure(chartH+21)
    const top=y+3
    for(let tick=0;tick<=max;tick+=max/4){const yy=top+chartH-chartH*tick/max;doc.setDrawColor(C.line);doc.setLineWidth(.2);doc.line(x,yy,x+chartW,yy);text(Math.round(tick),x-2,yy+1,8.5,false,C.muted,{align:'right'})}
    for(const s of series){doc.setDrawColor(s.colour);doc.setLineWidth(.9);s.values.forEach((v,i)=>{const xx=x+(labels.length>1?i/(labels.length-1):.5)*chartW,yy=top+chartH-v/max*chartH;if(i){const px=x+(i-1)/(labels.length-1)*chartW,py=top+chartH-s.values[i-1]/max*chartH;doc.line(px,py,xx,yy)}doc.setFillColor(s.colour);doc.circle(xx,yy,.85,'F')})}
    labels.forEach((label,i)=>{if(i===0||i===labels.length-1||i===Math.floor(labels.length/2)){const xx=x+(labels.length>1?i/(labels.length-1):.5)*chartW;text(label,xx,top+chartH+6,9,false,C.muted,{align:'center'})}})
    y=top+chartH+14
  }

  // Cover: a narrow digital booklet, designed to fit a phone at page width.
  page++;fill(theme.dark,0,0,W,H);fill(theme.colour,0,0,W,5)
  fill(theme.accent,M,14,18,1.5);text('ECFA / MANAGER EDITION',M,24,10,true,'#d6e2ee')
  if(badge){fill('#fff',W-M-27,31,27,27,3);doc.addImage(badge,'PNG',W-M-26,32,25,25)}
  const teamLines=lines(r.team.name,CW-(badge?33:0),23,true)
  text(teamLines,M,39,23,true,'#fff')
  y=Math.max(65,39+(teamLines.length-1)*lineHeight(23)+13)
  text('TEAM ANALYSIS',M,y,12,true,theme.accent);y+=8
  const periodLines=lines(r.options.label,CW,13,true);text(periodLines,M,y,13,true,'#fff');y+=periodLines.length*6+2
  const compLines=lines(r.options.competition||'All competitions',CW,10.5);text(compLines,M,y,10.5,false,'#d6e2ee');y+=compLines.length*5+7
  statTiles([['Matches',r.stats.p,theme.accent],['Win rate',pct(r.stats.win),C.teal],['Wins / draws / losses',`${r.stats.w}-${r.stats.d}-${r.stats.l}`,theme.accent],['Goal difference',`${r.stats.gd>0?'+':''}${r.stats.gd}`,C.teal],['Goals scored',r.stats.gf,C.green],['Goals conceded',r.stats.ga,C.red]],{dark:true})
  text(`${dateLabel(r.bounds.start)} - ${dateLabel(r.bounds.end)}`,M,226,9.5,false,'#d6e2ee')

  start('The story so far')
  paragraph(`${r.stats.w} ${r.stats.w===1?'win':'wins'}, ${r.stats.d} ${r.stats.d===1?'draw':'draws'} and ${r.stats.l} ${r.stats.l===1?'defeat':'defeats'} from ${r.stats.p} matches. The team has scored ${r.stats.gf} and conceded ${r.stats.ga}, with ${fixed(r.stats.gfpg)} goals for and ${fixed(r.stats.gapg)} against per game.`)
  const bestVenue=r.venues.filter(v=>v.name!=='Not recorded'&&v.p>=2).sort((a,b)=>b.win-a.win||b.p-a.p)[0]
  if(bestVenue)callout('STRONGEST RECORDED VENUE',`${bestVenue.name}: ${bestVenue.w} wins from ${bestVenue.p} (${pct(bestVenue.win)}).`,C.teal)
  if(r.players.length)callout('LEADING RECORDED SCORER',`${r.players[0].name}: ${r.players[0].goals} goals in ${r.players[0].scoringMatches} scoring matches.`,theme.accent)
  callout('ATTACK AND DEFENCE',`${r.stats.scored} of ${r.stats.p} matches with a goal. ${r.stats.cs} clean ${r.stats.cs===1?'sheet':'sheets'}; ${r.stats.conceded2} games conceding two or more.`,C.blue)
  resultStrip(r.matches)

  start('Form & momentum')
  legend([['Overall win %',C.blue],['Last 6 games*',theme.accent]])
  const cumulative=r.matches.map((_,i)=>summary(r.matches.slice(0,i+1)).win)
  const rolling=r.matches.map((_,i)=>summary(r.matches.slice(Math.max(0,i-5),i+1)).win)
  lineChart([{values:cumulative,colour:C.blue},{values:rolling,colour:theme.accent}],r.matches.map((_,i)=>String(i+1)))
  paragraph('*Rolling form uses up to six matches. The horizontal axis is match number within your selection.',{size:10.5})
  if(r.matches.length>=2){
    const split=Math.floor(r.matches.length/2),a=summary(r.matches.slice(0,split)),b=summary(r.matches.slice(split))
    heading('First half vs second half',60)
    table(['Metric',`First ${a.p}`,`Last ${b.p}`],[['Win rate',pct(a.win),pct(b.win)],['Goals / game',fixed(a.gfpg),fixed(b.gfpg)],['Against / game',fixed(a.gapg),fixed(b.gapg)]],[58,33,33])
    const change=b.win-a.win
    paragraph(`Win rate ${change>=0?'rose':'fell'} by ${Math.abs(change).toFixed(1)} percentage points between the two parts of this selection.`,{size:12})
  }
  paragraph(`Longest runs in this selection: ${r.streaks.winning} wins, ${r.streaks.unbeaten} unbeaten, ${r.streaks.losing} defeats, ${r.streaks.scoring} scoring games and ${r.streaks.clean} clean sheets.`,{size:12})

  start('Goals & consistency')
  statTiles([['Scored / game',fixed(r.stats.gfpg),C.teal],['Conceded / game',fixed(r.stats.gapg),C.red],['Clean sheets',r.stats.cs,C.green],['Failed to score',r.stats.blank,C.amber]])
  const denomin=Math.max(1,r.stats.p)
  bars([{label:'Scored in a match',value:r.stats.scored/denomin*100,display:`${Math.round(r.stats.scored/denomin*100)}%`,colour:C.teal},{label:'Both teams scored',value:r.stats.btts/denomin*100,display:`${Math.round(r.stats.btts/denomin*100)}%`,colour:C.blue},{label:'Three or more total goals',value:r.stats.over25/denomin*100,display:`${Math.round(r.stats.over25/denomin*100)}%`,colour:theme.accent}],{max:100})
  const biggestWin=[...r.matches].filter(f=>f.result==='W').sort((a,b)=>(b.gf-b.ga)-(a.gf-a.ga)||b.gf-a.gf)[0]
  const biggestLoss=[...r.matches].filter(f=>f.result==='L').sort((a,b)=>(b.ga-b.gf)-(a.ga-a.gf)||b.ga-a.ga)[0]
  if(biggestWin)callout('BIGGEST WIN',`${biggestWin.gf}-${biggestWin.ga} v ${biggestWin.opponent} · ${dateLabel(biggestWin.date)}`,C.green)
  if(biggestLoss)callout('HEAVIEST DEFEAT',`${biggestLoss.gf}-${biggestLoss.ga} v ${biggestLoss.opponent} · ${dateLabel(biggestLoss.date)}`,C.red)
  start('Scorelines & margins')
  heading('How the results landed',25)
  const margins=[['Won by 3+',f=>f.gf-f.ga>=3],['Won by 2',f=>f.gf-f.ga===2],['Won by 1',f=>f.gf-f.ga===1],['Drawn',f=>f.gf===f.ga],['Lost by 1',f=>f.ga-f.gf===1],['Lost by 2',f=>f.ga-f.gf===2],['Lost by 3+',f=>f.ga-f.gf>=3]]
  table(['Match margin','Games','Share'],margins.map(([label,test])=>{const n=r.matches.filter(test).length;return [label,n,pct(n/Math.max(1,r.stats.p)*100)]}),[68,25,31])
  heading('Most common scorelines',25)
  table(['Team score first','Games'],r.scorelines.slice(0,6).map(v=>[v.name,v.p]),[98,26])

  start('Month by month')
  legend([['Goals for',C.teal],['Goals against',C.red]])
  const maximum=Math.max(1,...r.months.flatMap(m=>[m.gf,m.ga]))
  for(const month of r.months){
    ensure(46)
    text(monthLabel(month.name),M,y,14,true);text(`${month.w}W ${month.d}D ${month.l}L`,W-M,y,12,true,C.ink,{align:'right'});y+=8
    for(const [value,colour] of [[month.gf,C.teal],[month.ga,C.red]]){fill(C.paper,M,y,CW-14,4);if(value)fill(colour,M,y,(CW-14)*value/maximum,4);text(value,W-M,y+3.8,11,true,colour,{align:'right'});y+=7}
    text(`${pct(month.win)} win rate  ·  ${month.p} matches`,M,y+1,11.5,false,C.muted);y+=13
  }
  if(r.months.length){const best=[...r.months].sort((a,b)=>b.win-a.win||b.p-a.p)[0];callout('BEST MONTH BY WIN RATE',`${monthLabel(best.name)}: ${best.w} wins in ${best.p}, ${best.gf} scored and ${best.ga} conceded.`,C.teal)}

  start('Home, away & cups')
  paragraph('Home and away follow the fixture designation. Shared grounds may not represent a home advantage.',{size:12})
  recordCards(r.homeAway)
  heading('Each competition',45);recordCards(r.competitions)
  const leagues=r.competitions.filter(c=>/league/i.test(c.name)&&!/cup/i.test(c.name))
  for(const league of leagues)paragraph(`${league.name}: ${league.w*3+league.d} match points before deductions. This is not the official table.`,{size:11.5})

  start('Venue performance')
  paragraph('Win rates alongside match counts. Green, gold and red show wins, draws and losses.',{size:12})
  recordCards([...r.venues].sort((a,b)=>b.win-a.win||b.p-a.p),{ranked:true})

  start('Results by referee')
  paragraph('Each appointment is a small sample. These results describe the matches; they do not establish referee influence.',{size:12})
  recordCards([...r.referees].sort((a,b)=>b.win-a.win||b.p-a.p),{ranked:true})

  start('Who brings the joy?')
  paragraph('Win rate against each team. W = wins, D = draws, L = losses.',{size:12})
  recordCards([...r.opponents].sort((a,b)=>b.win-a.win||b.p-a.p||a.name.localeCompare(b.name)),{compact:true})

  start('Top 5 goalscorers')
  paragraph(`${r.recordedGoals} named-player goals across ${r.covered} of ${r.stats.p} matches. Scoring matches are not appearances.`,{size:12})
  bars(r.players.slice(0,5).map((p,i)=>({label:p.name,value:p.goals,colour:i===0?theme.accent:C.teal})))
  if(r.players.length){const topTwo=r.players.slice(0,2).reduce((n,p)=>n+p.goals,0);callout('SHARE OF NAMED-PLAYER GOALS',`The top two scorers account for ${pct(topTwo/Math.max(1,r.recordedGoals)*100)} of recorded named-player goals.`,C.blue)}

  start('Player scoring detail')
  paragraph('Every scorer, every recorded opponent and every competition within the selected period.',{size:12})
  for(const p of r.players){
    const details=[`${p.goals} goals · ${p.scoringMatches} scoring matches`,`${p.braces} two-goal games · ${p.hattricks} ${p.hattricks===1?'game':'games'} with 3+`,`${pct(p.goals/Math.max(1,r.recordedGoals)*100)} of named-player goals`,
      `Against: ${p.opponents.map(([name,goals])=>`${name} (${goals})`).join('; ')}.`,
      `Competitions: ${p.competitions.map(([name,goals])=>`${name} (${goals})`).join('; ')}.`]
    callout(p.name,details.join('\n'),theme.accent)
  }
  if(!r.players.length)paragraph('No fixture-linked scorer records for this selection.')
  if(r.seasonScorers?.length){heading(`Archived ${r.archiveSeason} totals`,35);paragraph('Separate full-season totals can exceed fixture-linked goals. Opponent and month breakdowns require a match record.',{size:12});table(['Player','Season','Linked'],r.seasonScorers.map(p=>[p.name,p.goals,p.linkedGoals??0]),[76,24,24])}

  start('Recorded discipline')
  const liveCount=r.matches.filter(f=>f.id.startsWith('live:')).length
  const cardsAvailable=liveCount&&!r.warnings.some(w=>w.includes('card figures are unavailable'))
  if(!cardsAvailable)paragraph('Card totals are unavailable for this selection. Historical card records are not held in these source tables.')
  else {
    statTiles([['Recorded yellow cards',r.yellow,C.amber],['Recorded red cards',r.red,C.red]])
    paragraph(`${new Set(r.cards.map(c=>c.fixture_id)).size} of ${liveCount} live fixtures have cards logged. A missing return does not confirm a card-free game.`,{size:12})
    const players=new Map()
    r.cards.forEach(c=>{if(!players.has(c.player))players.set(c.player,{yellow:0,red:0});if(c.card_type==='yellow'||c.card_type==='red')players.get(c.player)[c.card_type]+=Number(c.card_count||0)})
    heading('Cards by player',30)
    table(['Player','Y','R'],[...players].sort((a,b)=>b[1].red-a[1].red||b[1].yellow-a[1].yellow).map(([name,c])=>[name,c.yellow,c.red]),[84,20,20])
    heading('Cards by referee',30)
    table(['Referee','Y','R'],r.referees.map(ref=>{const records=r.cards.filter(c=>(c.match.referee||'Not recorded')===ref.name);return [ref.name,records.filter(c=>c.card_type==='yellow').reduce((n,c)=>n+Number(c.card_count||0),0),records.filter(c=>c.card_type==='red').reduce((n,c)=>n+Number(c.card_count||0),0)]}),[84,20,20])
    for(const c of r.cards)callout(`${c.player} · ${c.card_type.toUpperCase()} × ${c.card_count}`,`${dateLabel(c.match.date)} v ${c.match.opponent}\nReferee: ${c.match.referee||'Not recorded'}`,c.card_type==='red'?C.red:C.amber)
  }

  start(r.options.season==='all'?'Season breakdown':'Last-season comparison')
  if(r.options.season==='all'){paragraph('Combined totals in this pack cover both seasons. Their individual records are shown below.',{size:12});recordCards(r.seasons)}
  else if(r.comparison){const a=r.comparison,b=r.stats
    paragraph(r.options.mode==='to-date'?`Compare this selection with last season's first ${a.p} matches.`:r.options.mode==='month'?'Compare the same calendar month last season.':'Compare the two full seasons.',{size:12})
    table(['Metric',r.previousSeason,r.options.season],[['Matches',a.p,b.p],['Win rate',pct(a.win),pct(b.win)],['Goals / game',fixed(a.gfpg),fixed(b.gfpg)],['Against / game',fixed(a.gapg),fixed(b.gapg)],['Clean sheets %',pct(a.cs/a.p*100),b.p?pct(b.cs/b.p*100):'N/A']],[62,31,31])
    callout('THE CHANGE',`${Math.abs(b.win-a.win).toFixed(1)} percentage points ${b.win>=a.win?'higher':'lower'} win rate. ${fixed(b.gapg)} conceded per game versus ${fixed(a.gapg)} last season.`,b.win>=a.win?C.green:C.red)
  }else paragraph('No comparison within the permitted two seasons is available for this selection.')

  start('Match & scoring record')
  paragraph('Team score first. Shoot-out scores retain home-away order. Final match W/D/L includes extra time but excludes shoot-out outcomes.',{size:11.5})
  for(const f of r.matches){
    const titleLines=lines(f.opponent,CW-38,13,true)
    const detail=[`${dateLabel(f.date)} · ${f.designation}`,f.competition,`Venue: ${f.venue||'Not recorded'}`,`Referee: ${f.referee||'Not recorded'}`]
    if(f.extra)detail.push('After extra time')
    if(f.penalties)detail.push(`Shoot-out (home-away): ${f.shootout||'recorded'}`)
    if(f.awarded)detail.push('Awarded / walkover')
    const scorers=r.goals.filter(g=>g.fixtureId===f.id)
    detail.push(scorers.length?`Scorers: ${scorers.map(g=>`${g.player} (${g.goals})`).join('; ')}.`:f.gf===0?'No team goals.':'No linked scorer records.')
    const detailLines=detail.flatMap(value=>lines(value,CW-8,11.5))
    const h=13+titleLines.length*6+detailLines.length*5.2
    ensure(h+4);fill(C.paper,M,y,CW,h,2);fill(resultColour(f.result),M,y,1.3,h)
    text(titleLines,M+4,y+7,13,true)
    text(`${f.gf}-${f.ga} ${f.result}`,W-M-4,y+8,17,true,resultColour(f.result),{align:'right'})
    text(detailLines,M+4,y+10+titleLines.length*6,11.5,false,C.muted)
    y+=h+4
  }

  start('Data & definitions')
  r.warnings.filter(w=>!w.startsWith('Opponent highlights')).forEach(w=>paragraph(w,{size:11.5}))
  paragraph(`Generated ${dateLabel(r.options.today)}. Source: recorded ECFA website data.`,{size:10.5})
  const total=doc.getNumberOfPages()
  for(let p=1;p<=total;p++){
    doc.setPage(p)
    const dark=p===1
    doc.setDrawColor(dark?'#3b5168':C.line);doc.line(M,H-10,W-M,H-10)
    text('ECFA · TEAM ANALYSIS',M,H-5.5,8.5,true,dark?'#d6e2ee':C.muted)
    text(`${p} / ${total}`,W-M,H-5.5,8.5,false,dark?'#d6e2ee':C.muted,{align:'right'})
  }
  doc.setProperties({title:`${r.team.name} - ${r.options.label} - Team analysis`,author:'ECFA',subject:'Team performance analysis / mobile portrait edition'})
  return doc
}
export function teamPackFilename(r) {return `ecfa-${r.team.name}-${r.options.label}-${r.options.competition||'all-competitions'}`.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/-$/,'')+'.pdf'}
