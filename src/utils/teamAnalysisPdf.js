import { jsPDF } from 'jspdf'
import { TEAM_KITS } from './simulatorKits.js'

const ink = '#17232b', muted = '#52616b', pale = '#f0f3f6'
const fmt = n => Number(n).toFixed(1)
const clean = v => String(v ?? '').replace(/[–—]/g,'-').replace(/[’]/g,"'").replace(/[^\x20-\x7e\n]/g,'')
export function teamPackTheme(name) {
  const base = TEAM_KITS[name]
  const kit = ['The Mission','South East Saints','Ladywell Baptist Church'].includes(name) ? (base?.second || base) : base
  const colour = kit?.colour || '#224b65'
  return { colour, text: kit?.text || '#ffffff' }
}
export async function loadTeamBadge(url) {
  if (!url) return null
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(12000) })
    if (!response.ok) return null
    const blob = await response.blob()
    const bitmap = await createImageBitmap(blob)
    const canvas = document.createElement('canvas'); canvas.width = 240; canvas.height = 240
    const ctx = canvas.getContext('2d'), scale = Math.min(220/bitmap.width,220/bitmap.height)
    ctx.drawImage(bitmap,(240-bitmap.width*scale)/2,(240-bitmap.height*scale)/2,bitmap.width*scale,bitmap.height*scale)
    bitmap.close()
    return canvas.toDataURL('image/png')
  } catch { return null }
}
export function createTeamAnalysisPdf(r, badge = null) {
  const doc = new jsPDF({ orientation:'landscape', unit:'mm', format:'a4', compress:true })
  const theme = teamPackTheme(r.team.name), margin = 15, width = 267
  const period = r.options.label
  let y = 0, page = 0
  const font = (size=10,bold=false,colour=ink) => { doc.setFont('helvetica',bold?'bold':'normal');doc.setFontSize(size);doc.setTextColor(colour) }
  const text = (s,x,yy,size=10,bold=false,colour=ink) => {font(size,bold,colour);doc.text(Array.isArray(s)?s.map(clean):clean(s),x,yy)}
  function addPage(title, subtitle='') {
    if (page++) doc.addPage()
    doc.setFillColor(theme.colour);doc.rect(0,0,297,3,'F')
    text('ECFA / TEAM ANALYSIS',margin,12,8,true,muted)
    text(r.team.name,margin,24,18,true)
    if (badge) doc.addImage(badge,'PNG',263,6,20,20)
    text(doc.splitTextToSize(clean(`${period} | ${r.options.competition || 'All competitions'}`),240),margin,31,8,false,muted)
    text(title,margin,45,16,true)
    y=53
    if(subtitle) paragraph(subtitle,8)
  }
  function ensure(height=12) { if(y+height>190) addPage('Continued') }
  function paragraph(s,size=9) {
    font(size,false,muted)
    const lines=doc.splitTextToSize(clean(s),width)
    for(const line of lines){ensure(5);text(line,margin,y,size,false,muted);y+=4.8}
    y+=3
  }
  function heading(s) {ensure(16);y+=3;text(s,margin,y,11,true);y+=7}
  function table(headers, rows, widths) {
    const ws=widths || headers.map(()=>width/headers.length)
    function row(cells,header=false,index=0) {
      font(header?8:8,false)
      const lines=cells.map((v,i)=>doc.splitTextToSize(clean(v),ws[i]-5))
      const height=Math.max(8, Math.max(...lines.map(l=>l.length))*3.8+4)
      if(y+height>189){ addPage('Detailed analysis / continued'); if(!header)row(headers,true) }
      let x=margin
      doc.setFillColor(header?theme.colour:index%2?pale:'#ffffff');doc.rect(margin,y,width,height,'F')
      lines.forEach((line,i)=>{text(line,x+2.5,y+5,8,header,header?theme.text:ink);x+=ws[i]})
      y+=height
    }
    row(headers,true)
    if (!rows.length) {paragraph('No records are available for this selection.');return}
    rows.forEach((cells,i)=>row(cells,false,i));y+=5
  }
  function recordTable(rows) {
    table(['Name','P','W','D','L','Win %','GF','GA','GD'],rows.map(v=>[v.name,v.p,v.w,v.d,v.l,fmt(v.win)+'%',v.gf,v.ga,v.gd]),[99,18,18,18,18,30,22,22,22])
  }
  function bars(title, rows, suffix='', colour=theme.colour) {
    heading(title)
    if(!rows.length){paragraph('No recorded data.');return}
    const max=suffix==='%'?100:Math.max(1,...rows.map(v=>v.value))
    rows.forEach(v=>{ensure(11);font(8);const label=doc.splitTextToSize(clean(v.label),76);const h=Math.max(10,label.length*4+2);ensure(h)
      text(label,margin,y+3,8)
      doc.setFillColor(pale);doc.roundedRect(96,y-1,155,5,1,1,'F')
      if(v.value>0){doc.setFillColor(colour);doc.roundedRect(96,y-1,155*v.value/max,5,1,1,'F')}
      text(`${v.display ?? v.value}${suffix}`,256,y+3,8,true);y+=h
    });y+=3
  }
  function cards(items) {
    const cardW=(width-15)/4
    items.forEach(([label,value],i)=>{const x=margin+(i%4)*(cardW+5), yy=y+Math.floor(i/4)*27
      doc.setFillColor(pale);doc.roundedRect(x,yy,cardW,23,2,2,'F')
      text(value,x+4,yy+10,19,true);text(label,x+4,yy+18,8,false,muted)
    });y+=Math.ceil(items.length/4)*27+3
  }
  addPage('Performance at a glance','Results, patterns and player contributions from recorded ECFA matches.')
  cards([['Matches',r.stats.p],['Wins / draws / losses',`${r.stats.w} / ${r.stats.d} / ${r.stats.l}`],['Win rate',fmt(r.stats.win)+'%'],['Goal difference',r.stats.gd>0?'+'+r.stats.gd:r.stats.gd],['Goals scored',r.stats.gf],['Goals conceded',r.stats.ga],['Goals per match',r.stats.gfpg.toFixed(2)],['Clean sheets',r.stats.cs]])
  heading('Standout findings');r.findings.forEach(f=>paragraph(f))
  paragraph(`Coverage: ${r.bounds.start} to ${r.bounds.end}. Generated ${r.options.today}. Recent form: ${r.matches.slice(-8).map(f=>f.result).join(' ') || 'No matches'}.`)

  addPage('Attack, defence and consistency')
  cards([['Scoring matches',r.stats.scored],['Failed to score',r.stats.blank],['Conceded 2+',r.stats.conceded2],['Both teams scored',r.stats.btts],['Clean-sheet rate',r.stats.p?fmt(r.stats.cs/r.stats.p*100)+'%':'N/A'],['Conceded per match',r.stats.gapg.toFixed(2)],['Games with 3+ goals',r.stats.over25],['Scored in %',r.stats.p?fmt(r.stats.scored/r.stats.p*100)+'%':'N/A']])
  table(['Longest run within selection','Matches'],Object.entries({ 'Winning':r.streaks.winning,'Unbeaten':r.streaks.unbeaten,'Losing':r.streaks.losing,'Scoring':r.streaks.scoring,'Clean sheets':r.streaks.clean }),[225,42])
  const biggestWin=[...r.matches].filter(f=>f.result==='W').sort((a,b)=>(b.gf-b.ga)-(a.gf-a.ga)||b.gf-a.gf)[0]
  const biggestLoss=[...r.matches].filter(f=>f.result==='L').sort((a,b)=>(b.ga-b.gf)-(a.ga-a.gf)||b.ga-a.ga)[0]
  if(biggestWin)paragraph(`Biggest win: ${biggestWin.gf}-${biggestWin.ga} v ${biggestWin.opponent}, ${biggestWin.date}.`)
  if(biggestLoss)paragraph(`Heaviest defeat: ${biggestLoss.gf}-${biggestLoss.ga} v ${biggestLoss.opponent}, ${biggestLoss.date}.`)
  bars('Most common scorelines (team goals first)',r.scorelines.slice(0,6).map(v=>({label:v.name,value:v.p})))

  addPage('Form and monthly trends','Monthly totals reflect only matches inside the selected period.')
  recordTable(r.months)
  // Paired vector bars retain legibility when a season contains many matches.
  bars('Goals scored by month',r.months.map(v=>({label:v.name,value:v.gf})))
  bars('Goals conceded by month',r.months.map(v=>({label:v.name,value:v.ga})), '', '#8c4c49')
  addPage('Home, away and competitions','Home and away refer to fixture designation. League points below are match points before any deductions, not an official table.')
  recordTable(r.homeAway);heading('Competition records');recordTable(r.competitions)
  const leagues=r.competitions.filter(c=>/league/i.test(c.name)&&!/cup/i.test(c.name))
  if(leagues.length)paragraph(leagues.map(l=>`${l.name}: ${l.w*3+l.d} match points from ${l.p} games.`).join(' '))

  addPage('Venue performance','Compare win rates alongside sample sizes. Missing venue records are shown separately.')
  recordTable(r.venues)
  bars('Venue win rate',r.venues.filter(v=>v.name!=='Not recorded').map(v=>({label:`${v.name} (${v.p} games)`,value:v.win,display:fmt(v.win)})),'%')
  addPage('Results with each referee','Descriptive match results only. Differences do not establish referee influence; sample sizes and opponent strength matter.')
  recordTable(r.referees)
  bars('Referee win rate',r.referees.filter(v=>v.name!=='Not recorded').map(v=>({label:`${v.name} (${v.p} games)`,value:v.win,display:fmt(v.win)})),'%')

  addPage('Opponents: bogey teams and most joy')
  paragraph(r.joy&&r.joy.w>0?`Most joy: ${r.joy.name} (${r.joy.w} wins from ${r.joy.p}, ${fmt(r.joy.win)}%).`:'Most joy: no qualifying winning record with at least two meetings.')
  paragraph(r.bogey&&r.bogey.l>0?`Bogey team: ${r.bogey.name} (${r.bogey.l} losses from ${r.bogey.p}, ${fmt(r.bogey.win)}% win rate).`:'Bogey team: no qualifying losing record with at least two meetings.')
  recordTable(r.opponents)

  addPage('Individual scoring performance',`${r.recordedGoals} named-player goals across ${r.covered}/${r.stats.p} matches. Scoring matches are not appearances; missing scorers and own goals are not allocated to players.`)
  table(['Player','Goals','Scoring matches','2-goal games','3+ goal games','% named goals'],r.players.map(p=>[p.name,p.goals,p.scoringMatches,p.braces,p.hattricks,fmt(p.goals/Math.max(1,r.recordedGoals)*100)+'%']),[92,30,40,35,35,35])
  if(r.seasonScorers?.length){heading('Archived full-season scorer totals');paragraph('These separately recorded season totals can exceed fixture-linked goals. They cannot be broken down by opponent or month without a match record.');table(['Player','Season goals','Fixture-linked goals'],r.seasonScorers.map(p=>[p.name,p.goals,r.players.find(v=>v.name.trim().toLowerCase()===p.name.trim().toLowerCase())?.goals||0]),[177,45,45])}
  bars('Leading recorded scorers',r.players.slice(0,10).map(p=>({label:p.name,value:p.goals})))
  addPage('Player goals by opponent and competition','Every named scorer is included. These are fixture-linked goals within the selected period.')
  table(['Player','Opponent','Goals'],r.players.flatMap(p=>p.opponents.map(([opponent,goals])=>[p.name,opponent,goals])),[110,125,32])
  heading('Goals by competition')
  table(['Player','Competition','Goals'],r.players.flatMap(p=>p.competitions.map(([competition,goals])=>[p.name,competition,goals])),[110,125,32])
  if(!r.players.length)paragraph('No fixture-linked scorer records are available for this selection.')

  addPage('Recorded discipline','Current fixture-linked card records only. Historical card coverage is unavailable. A missing return cannot be treated as a confirmed card-free match.')
  const liveCount=r.matches.filter(f=>f.id.startsWith('live:')).length
  if(r.warnings.some(w=>w.includes('card figures are unavailable')) || !liveCount)paragraph('Card totals are unavailable for this selection.')
  else {
    cards([['Recorded yellows',r.yellow],['Recorded reds',r.red],['Live fixtures in selection',liveCount],['Matches with cards logged',new Set(r.cards.map(c=>c.fixture_id)).size]])
    const totals=new Map()
    r.cards.forEach(c=>{if(!totals.has(c.player))totals.set(c.player,{yellow:0,red:0});totals.get(c.player)[c.card_type]+=Number(c.card_count||0)})
    table(['Player','Yellow','Red'],[...totals].sort((a,b)=>b[1].red-a[1].red||b[1].yellow-a[1].yellow).map(([n,c])=>[n,c.yellow,c.red]),[187,40,40])
    heading('Recorded cards by referee')
    table(['Referee','Matches','Yellow','Red'],r.referees.map(ref=>{const rows=r.cards.filter(c=>(c.match.referee||'Not recorded')===ref.name);return [ref.name,ref.p,rows.filter(c=>c.card_type==='yellow').reduce((n,c)=>n+Number(c.card_count||0),0),rows.filter(c=>c.card_type==='red').reduce((n,c)=>n+Number(c.card_count||0),0)]}),[157,35,40,35])
    table(['Date','Opponent','Referee','Player','Card','Count'],r.cards.map(c=>[c.match.date,c.match.opponent,c.match.referee||'Not recorded',c.player,c.card_type,c.card_count]),[28,65,55,65,30,24])
  }

  addPage('Comparison with last season','Only this season and last season are used. Per-game rates avoid comparing totals across different match counts.')
  if(r.comparison){
    const c=r.comparison,s=r.stats
    paragraph(r.options.mode==='to-date'?`Last season comparison uses its first ${c.p} matches (up to the ${s.p} selected this season).`:r.options.mode==='month'?'Comparison uses the equivalent calendar month last season.':'Comparison uses the previous full season.')
    table(['Metric',r.previousSeason,r.options.season], [['Matches',c.p,s.p],['Win rate',fmt(c.win)+'%',fmt(s.win)+'%'],['Goals per match',c.gfpg.toFixed(2),s.gfpg.toFixed(2)],['Conceded per match',c.gapg.toFixed(2),s.gapg.toFixed(2)],['Clean-sheet rate',fmt(c.cs/c.p*100)+'%',s.p?fmt(s.cs/s.p*100)+'%':'N/A']], [147,60,60])
  }else paragraph('No comparison within the permitted two seasons is available for this selection.')
  heading('How to read this pack');r.warnings.forEach(w=>paragraph(w,8))

  addPage('Complete match register','Scores show team goals first. Shoot-out scores retain home-away order. W/D/L excludes shoot-out outcomes.')
  table(['Date','Opponent','H/A','Competition','Score','W/D/L','Venue','Referee / notes'],r.matches.map(f=>[f.date,f.opponent,f.designation,f.competition,`${f.gf}-${f.ga}`,f.result,f.venue||'Not recorded',[f.referee, f.extra?'AET':'',f.penalties?`Pens: ${f.shootout || 'recorded'}`:'',f.awarded?'Awarded / walkover':''].filter(Boolean).join(' / ')||'Not recorded']),[26,47,16,48,17,15,46,52])
  heading('Fixture-linked scoring register')
  table(['Date','Player','Opponent','Competition','Goals'],r.goals.map(g=>[g.date,g.player,g.opponent,g.competition,g.goals]),[28,70,70,75,24])
  const total=doc.getNumberOfPages()
  for(let n=1;n<=total;n++){doc.setPage(n);doc.setDrawColor('#d9e0e5');doc.line(margin,196,282,196);text('ECFA / Manager team pack',margin,202,8,false,muted);text(`${n} / ${total}`,268,202,8,false,muted)}
  doc.setProperties({title:`${r.team.name} - ${period} - Team analysis`,author:'ECFA',subject:'Team performance analysis'})
  return doc
}
export function teamPackFilename(r) { return `ecfa-${r.team.name}-${r.options.label}-${r.options.competition||'all-competitions'}`.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/-$/,'')+'.pdf' }
