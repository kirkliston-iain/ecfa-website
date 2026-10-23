import { displayedScore, fullOutcomeNote } from './fixtureOutcome'

function image(url) {
  return new Promise(resolve => {
    if (!url) return resolve(null)
    const img = new Image(); img.crossOrigin = 'anonymous'
    const timer = setTimeout(() => resolve(null), 8000)
    img.onload = () => { clearTimeout(timer); resolve(img) }
    img.onerror = () => { clearTimeout(timer); resolve(null) }
    img.src = url
  })
}
function lines(ctx, text, width) {
  const result = []; let line = ''
  for (const word of String(text || '').split(/\s+/)) {
    const next = line ? `${line} ${word}` : word
    if (ctx.measureText(next).width > width && line) { result.push(line); line = word } else line = next
  }
  if (line) result.push(line)
  return result
}
export async function renderMatchGraphic(f, scorers, logos, story = false) {
  const canvas = document.createElement('canvas'); canvas.width = 1080; canvas.height = story ? 1920 : 1080
  const ctx = canvas.getContext('2d'); const h = canvas.height
  const assets = await Promise.all([image(logos.league), image(f.home_team?.logo_url), image(f.away_team?.logo_url), ...logos.sponsors.map(s => image(s.url))])
  const missing = []
  function logo(img, x, y, size, label) {
    if (img) { const scale = Math.min(size/img.width,size/img.height); ctx.drawImage(img,x-img.width*scale/2,y-img.height*scale/2,img.width*scale,img.height*scale) }
    else { ctx.fillStyle='#b48a38'; ctx.font='bold 30px Arial'; ctx.fillText(label.split(' ').map(w=>w[0]).slice(0,3).join(''),x,y+10); missing.push(label) }
  }
  function text(value,x,y,width,size=32,color='#fff',maxLines=5) {
    let wrapped
    do { ctx.font=`bold ${size}px Arial`; wrapped=lines(ctx,value,width); if(wrapped.length<=maxLines) break; size-=2 } while(size>12)
    ctx.fillStyle=color; wrapped.forEach((line,i) => ctx.fillText(line,x,y+i*size*1.25)); return wrapped.length*size*1.25
  }
  ctx.fillStyle='#131f29'; ctx.fillRect(0,0,1080,h)
  ctx.fillStyle='#b48a38'; ctx.fillRect(0,0,1080,14); ctx.fillRect(0,h-14,1080,14)
  ctx.textAlign='center'
  logo(assets[0],540,110,135,'ECFA')
  text('EDINBURGH CHURCHES',540,215,960,27); text('FOOTBALL ASSOCIATION',540,251,960,27)
  const offset = story ? 240 : 0
  const played=f.status==='played' && f.home_score!=null && f.away_score!=null
  text(played?'FULL TIME':f.status==='scheduled'?'MATCHDAY':String(f.status || 'FIXTURE').replaceAll('_',' ').toUpperCase(),540,315+offset,960,38,'#d5b65d')
  text([f.competition_name, f.round_name].filter(Boolean).join(' · '),540,363+offset,940,25,'#d9dee2',2)
  // A white badge tile preserves dark and transparent club crests on the navy graphic.
  for (const x of [245,835]) {
    ctx.fillStyle='#fff'; ctx.beginPath(); ctx.roundRect(x-80,385+offset,160,160,18); ctx.fill()
  }
  logo(assets[1],245,465+offset,130,f.home_team?.name || 'Home')
  logo(assets[2],835,465+offset,130,f.away_team?.name || 'Away')
  text(played?displayedScore(f):'v',540,490+offset,310,played?74:50)
  text(f.home_team?.name,245,573+offset,425,34,'#fff',2)
  text(f.away_team?.name,835,573+offset,425,34,'#fff',2)
  if(f.form) {
    for(const [values,x] of [[f.form.home,245],[f.form.away,835]]) {
      text('LAST 5 · LATEST →',x,638+offset,420,16,'#d9dee2',1)
      const items=[...Array(Math.max(0,5-values.length)).fill('—'),...values]
      items.forEach((value,i)=>{
        const bx=x-116+i*48
        ctx.fillStyle=({W:'#237747',D:'#a77813',L:'#b33838'})[value] || '#34434f'
        ctx.fillRect(bx,650+offset,40,36)
        ctx.fillStyle='#fff';ctx.font='bold 23px Arial';ctx.textAlign='center';ctx.fillText(value,bx+20,676+offset)
      })
    }
  }
  let y=725+offset+(story?120:0)
  if (played) {
    const note=fullOutcomeNote(f) || (f.penalty_winner_name ? `${f.penalty_winner_name} won on penalties` : '')
    if(note) y+=text(note,540,y,940,22,'#d5b65d',2)+8
    const home=scorers.filter(s=>s.team_id===f.home_team?.id || s.team_name===f.home_team?.name)
    const away=scorers.filter(s=>s.team_id===f.away_team?.id || s.team_name===f.away_team?.name)
    const label=s=>`${s.player_name || [s.player?.first_name,s.player?.last_name].filter(Boolean).join(' ')}${Number(s.goals)>1?` (${s.goals})`:''}`
    for(const [items,x] of [[home,245],[away,835]]) {
      const value=items.length?items.map(label).join(' · '):'No scorers recorded'
      let size=24; const available=h-255-y
      while(size>12) { ctx.font=`bold ${size}px Arial`; if(lines(ctx,value,430).length*size*1.25<=available)break; size-- }
      text(value,x,y,430,size,'#d9dee2',100)
    }
  } else {
    const date=f.fixture_date ? new Date(String(f.fixture_date).slice(0,10)+'T12:00:00').toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'long',year:'numeric'}) + (String(f.fixture_date).slice(11,16) && String(f.fixture_date).slice(11,16)!=='00:00' ? ` · ${String(f.fixture_date).slice(11,16)}` : '') : 'Date to be confirmed'
    y+=text(date,540,y,940,28,'#fff',2)+10
    text(f.venue || 'Venue to be confirmed',540,y,940,24,'#d9dee2',2)
  }
  if(f.referee_name) text(`Referee: ${f.referee_name}`,540,h-185,940,23,'#d9dee2',2)
  ctx.fillStyle='#fff'; ctx.fillRect(36,h-155,1008,100)
  const sponsorAssets=assets.slice(3); const count=logos.sponsors.length
  logos.sponsors.forEach((s,i)=> { const x=36+1008/count*(i+0.5); const img=sponsorAssets[i]; if(img) { const scale=Math.min((900/count)/img.width,76/img.height); ctx.drawImage(img,x-img.width*scale/2,h-105-img.height*scale/2,img.width*scale,img.height*scale) } else text(s.name,x,h-100,900/count,18,'#131f29',2) })
  text(`Full match details: ${'ecfa-website.vercel.app'}`,540,h-27,980,19,'#d5b65d')
  const blob=await new Promise((resolve,reject)=> { try { canvas.toBlob(b=>b?resolve(b):reject(new Error('Unable to create image.')), 'image/png') } catch(e) {reject(e)} })
  return {blob, missing}
}

export async function renderWeekendGraphic(report, logos, story = false) {
  const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=story?1920:1080
  const ctx=canvas.getContext('2d');const h=canvas.height
  const assets=await Promise.all([image(logos.league),...logos.sponsors.map(s=>image(s.url)),...report.badges.map(url=>image(url))])
  ctx.fillStyle='#131f29';ctx.fillRect(0,0,1080,h);ctx.fillStyle='#b48a38';ctx.fillRect(0,0,1080,12);ctx.fillRect(0,h-12,1080,12)
  function fit(text,x,y,width,size=28,color='#fff',align='left') {ctx.textAlign=align;do{ctx.font=`bold ${size}px Arial`;if(ctx.measureText(text).width<=width)break;size--}while(size>10);ctx.fillStyle=color;ctx.fillText(text,x,y)}
  function drawImage(img,x,y,w,height) {if(!img)return;const scale=Math.min(w/img.width,height/img.height);ctx.drawImage(img,x+(w-img.width*scale)/2,y+(height-img.height*scale)/2,img.width*scale,img.height*scale)}
  drawImage(assets[0],475,36,130,125)
  fit('EDINBURGH CHURCHES FOOTBALL ASSOCIATION',540,195,970,27,'#fff','center')
  fit(report.type==='fixtures'?'UPCOMING FIXTURES':report.type==='results'?'SATURDAY RESULTS':'LEAGUE TABLE',540,251,970,42,'#d5b65d','center')
  fit(report.subtitle,540,296,970,26,'#d9dee2','center')
  fit(report.type==='table'?`As at Saturday ${report.displayEnd} · ${report.season}`:report.type==='fixtures'?report.displayStart:report.displayStart,540,336,970,23,'#d9dee2','center')
  const top=385;const bottom=h-205;const space=bottom-top
  if(report.type==='table') {
    const columns=[530,588,646,704,762,820,886,974]
    const headers=['Pl','W','D','L','GF','GA','GD','Pts']
    fit('#',45,top,30,21);fit('Team',100,top,370,23)
    headers.forEach((label,i)=>fit(label,columns[i],top,50,22,'#d5b65d','center'))
    const rowHeight=Math.min(story?100:48,(space-45)/Math.max(1,report.rows.length))
    report.rows.forEach((row,i)=>{const y=top+44+i*rowHeight;ctx.fillStyle=i%2?'#1d2c38':'#172631';ctx.fillRect(32,y-28,1016,rowHeight-2);fit(String(i+1),48,y,35,22);drawImage(assets[1+logos.sponsors.length+i],94,y-26,32,32);fit(row.teamName,137,y,350,23)
      ;[row.played,row.won,row.drawn,row.lost,row.goalsFor,row.goalsAgainst,row.goalDifference,row.points].forEach((value,j)=>fit(String(value),columns[j],y,50,23,j===7?'#d5b65d':'#fff','center'))})
  } else {
    const rowHeight=Math.min(report.includeScorers ? (story?360:165) : (story?160:90),space/Math.max(1,report.rows.length))
    report.rows.forEach((f,i)=>{
      const y=top+i*rowHeight
      ctx.fillStyle=i%2?'#1d2c38':'#172631';ctx.fillRect(32,y-18,1016,rowHeight-5)
      fit(f.competition_name||'ECFA',540,y+6,900,Math.min(20,rowHeight*.23),'#d5b65d','center')
      drawImage(assets[1+logos.sponsors.length+i*2],45,y+16,40,40);drawImage(assets[2+logos.sponsors.length+i*2],995,y+16,40,40)
      fit(f.home_team?.name||'Home',100,y+(report.type==='fixtures'?35:45),350,Math.min(27,rowHeight*.32));fit(report.type==='fixtures'?(String(f.fixture_date).slice(11,16)||'TBC'):displayedScore(f),540,y+(report.type==='fixtures'?35:45),160,report.type==='fixtures'?24:Math.min(34,rowHeight*.4),'#fff','center');fit(f.away_team?.name||'Away',980,y+(report.type==='fixtures'?35:45),350,Math.min(27,rowHeight*.32),'#fff','right')
      const note=report.type==='fixtures'?[f.venue||'Venue TBC',f.referee_name?`Ref: ${f.referee_name}`:'Referee TBC'].join(' · '):fullOutcomeNote(f)
      if(report.includeScorers){
        for(const [team,x,align] of [[f.home_team,100,'left'],[f.away_team,980,'right']]){
          const scorers=(f.scorers||[]).filter(s=>s.team_id===team?.id)
          const text=scorers.length?scorers.map(s=>`${[s.player?.first_name,s.player?.last_name].filter(Boolean).join(' ') || 'Unnamed scorer'}${Number(s.goals)>1?` (${s.goals})`:''}`).join(' · '):'No scorers recorded'
          const available=rowHeight-95-(note?20:0)
          let size=20;let wrapped=[]
          do{ctx.font=`bold ${size}px Arial`;wrapped=lines(ctx,text,385);if(wrapped.length*size*1.2<=available)break;size--}while(size>10)
          ctx.fillStyle='#d9dee2';ctx.textAlign=align;wrapped.forEach((line,j)=>ctx.fillText(line,x,y+76+j*size*1.2))
        }
      }
      if(note)fit(note,540,y+rowHeight-(report.type==='fixtures'?25:28),900,16,'#d9dee2','center')
    })
  }
  ctx.fillStyle='#fff';ctx.fillRect(36,h-155,1008,100)
  logos.sponsors.forEach((s,i)=>{const count=logos.sponsors.length;const x=36+1008/count*i;const img=assets[1+i];if(img)drawImage(img,x+10,h-143,1008/count-20,76);else fit(s.name,x+1008/count/2,h-100,900/count,18,'#131f29','center')})
  fit(`More ECFA results: ${'ecfa-website.vercel.app'}`,540,h-27,980,19,'#d5b65d','center')
  const blob=await new Promise((resolve,reject)=>{try{canvas.toBlob(b=>b?resolve(b):reject(new Error('Unable to create image.')),'image/png')}catch(e){reject(e)}})
  return {blob,missing:[]}
}
