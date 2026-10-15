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
  const offset = story ? 180 : 0
  const played=f.status==='played' && f.home_score!=null && f.away_score!=null
  text(played?'FULL TIME':f.status==='scheduled'?'MATCHDAY':String(f.status || 'FIXTURE').replaceAll('_',' ').toUpperCase(),540,315+offset,960,38,'#d5b65d')
  text([f.competition_name, f.round_name].filter(Boolean).join(' · '),540,363+offset,940,25,'#d9dee2',2)
  logo(assets[1],245,465+offset,130,f.home_team?.name || 'Home')
  logo(assets[2],835,465+offset,130,f.away_team?.name || 'Away')
  text(played?displayedScore(f):'v',540,490+offset,310,played?74:50)
  text(f.home_team?.name,245,573+offset,425,34,'#fff',3)
  text(f.away_team?.name,835,573+offset,425,34,'#fff',3)
  let y=710+offset
  if (played) {
    const note=fullOutcomeNote(f) || (f.penalty_winner_name ? `${f.penalty_winner_name} won on penalties` : '')
    if(note) y+=text(note,540,y,940,22,'#d5b65d',2)+8
    const home=scorers.filter(s=>s.team_id===f.home_team?.id || s.team_name===f.home_team?.name)
    const away=scorers.filter(s=>s.team_id===f.away_team?.id || s.team_name===f.away_team?.name)
    const label=s=>`${s.player_name || [s.player?.first_name,s.player?.last_name].filter(Boolean).join(' ')}${Number(s.goals)>1?` (${s.goals})`:''}`
    for(const [items,x] of [[home,245],[away,835]]) {
      const value=items.length?items.map(label).join(' · '):'No scorers recorded'
      let size=24; const available=h-200-y
      while(size>12) { ctx.font=`bold ${size}px Arial`; if(lines(ctx,value,430).length*size*1.25<=available)break; size-- }
      text(value,x,y,430,size,'#d9dee2',100)
    }
  } else {
    const date=f.fixture_date ? new Date(String(f.fixture_date).slice(0,10)+'T12:00:00').toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'long',year:'numeric'}) + (String(f.fixture_date).slice(11,16) && String(f.fixture_date).slice(11,16)!=='00:00' ? ` · ${String(f.fixture_date).slice(11,16)}` : '') : 'Date to be confirmed'
    y+=text(date,540,y,940,28,'#fff',2)+10
    text(f.venue || 'Venue to be confirmed',540,y,940,24,'#d9dee2',2)
  }
  ctx.fillStyle='#fff'; ctx.fillRect(36,h-155,1008,100)
  const sponsorAssets=assets.slice(3); const count=logos.sponsors.length
  logos.sponsors.forEach((s,i)=> { const x=36+1008/count*(i+0.5); const img=sponsorAssets[i]; if(img) { const scale=Math.min((900/count)/img.width,76/img.height); ctx.drawImage(img,x-img.width*scale/2,h-105-img.height*scale/2,img.width*scale,img.height*scale) } else text(s.name,x,h-100,900/count,18,'#131f29',2) })
  text(window.location.host,540,h-27,980,19,'#d5b65d')
  const blob=await new Promise((resolve,reject)=> { try { canvas.toBlob(b=>b?resolve(b):reject(new Error('Unable to create image.')), 'image/png') } catch(e) {reject(e)} })
  return {blob, missing}
}
