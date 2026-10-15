import { useEffect, useState } from 'react'
const GOLD='#b28b38'
function loadImage(src) { return new Promise(resolve=>{if(!src)return resolve(null);const img=new Image();img.crossOrigin='anonymous';img.onload=()=>resolve(img);img.onerror=()=>resolve(null);img.src=src}) }
export default function ScorersGraphic({rows,season,competition,sponsors}) {
  const [preview,setPreview]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false)
  const count=season==='overall'?20:10
  const ranked=[...rows].sort((a,b)=>(competition==='League'?b.byCompetition.League-a.byCompetition.League:competition==='Cup'?b.byCompetition.Cup-a.byCompetition.Cup:b.goals-a.goals)||a.player_name.localeCompare(b.player_name)).slice(0,count)
  const key=JSON.stringify({ranked,season,competition,sponsors})
  useEffect(()=>{
    let active=true,url
    async function draw(){
      setPreview(null);setError('')
      try{
        const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d')
        canvas.width=1080;canvas.height=season==='overall'?1660:1160
        ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height)
        ctx.fillStyle='#171717';ctx.fillRect(0,0,1080,178)
        ctx.fillStyle='#ffffff';ctx.font='bold 55px Arial';ctx.fillText('ECFA GOALSCORERS',55,80)
        ctx.font='28px Arial';ctx.fillText(season==='overall'?'ALL-TIME TOP 20':season+' TOP 10',55,125)
        ctx.fillStyle=GOLD;ctx.fillRect(55,157,970,6)
        ctx.fillStyle='#555';ctx.font='25px Arial';ctx.fillText(competition==='all'?'All competitions':competition+' goals',55,222)
        const rowHeight=season==='overall'?61:76,top=265
        ranked.forEach((r,i)=>{
          const y=top+i*rowHeight
          if(i%2===0){ctx.fillStyle='#f7f5f0';ctx.fillRect(45,y-34,990,rowHeight)}
          ctx.fillStyle=GOLD;ctx.font='bold 27px Arial';ctx.fillText(String(i+1).padStart(2,'0'),62,y)
          ctx.fillStyle='#171717';ctx.font='bold 26px Arial'
          let name=r.player_name||'',max=540;while(ctx.measureText(name).width>max&&name.length>4)name=name.slice(0,-2)+'…'
          ctx.fillText(name,125,y)
          ctx.textAlign='right';ctx.font='bold 30px Arial';ctx.fillText(String(competition==='League'?r.byCompetition.League||0:competition==='Cup'?r.byCompetition.Cup||0:r.goals),995,y);ctx.textAlign='left'
        })
        const footer=canvas.height-155
        ctx.fillStyle='#171717';ctx.fillRect(0,footer,1080,155)
        ctx.fillStyle='#fff';ctx.font='22px Arial';ctx.fillText('Proudly supported by',55,footer+40)
        let x=55
        for(const sponsor of sponsors.slice(0,2)){
          const img=await loadImage(sponsor.logo_url)
          if(img){ctx.fillStyle='#fff';ctx.fillRect(x,footer+55,55,55);ctx.drawImage(img,x+3,footer+58,49,49)}
          ctx.fillStyle='#fff';ctx.font='bold 19px Arial'
          const parts=sponsor.name.split(' ');let line='',lines=[]
          parts.forEach(w=>{if(ctx.measureText(line+' '+w).width>300){lines.push(line);line=w}else line+=(line?' ':'')+w});lines.push(line)
          lines.slice(0,2).forEach((l,i)=>ctx.fillText(l,x+65,footer+78+i*23))
          x+=500
        }
        const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'))
        if(!blob)throw Error('Could not create image')
        if(active){url=URL.createObjectURL(blob);setPreview({url,blob})}
      }catch(e){if(active)setError('Unable to prepare the goalscorers graphic.')}
    }
    if(ranked.length)draw()
    return()=>{active=false;if(url)URL.revokeObjectURL(url)}
  },[key])
  async function share(){
    if(!preview)return
    const file=new File([preview.blob],filename,{type:'image/png'})
    if(!navigator.canShare?.({files:[file]})){setError('Sharing images is unavailable in this browser. Please download the graphic instead.');return}
    setBusy(true)
    try{await navigator.share({files:[file],title:'ECFA Goalscorers'})}catch(e){if(e.name!=='AbortError')setError('Sharing failed. You can download the image instead.')}finally{setBusy(false)}
  }
  const filename='ecfa-goalscorers-'+(season==='overall'?'all-time':season.replace('/','-'))+'.png'
  return <section style={{border:'1px solid var(--line)',borderRadius:8,padding:14,margin:'8px 0 22px'}}>
    <h2 style={{fontSize:18,margin:'0 0 6px'}}>Share goalscorers graphic</h2>
    <p style={{fontSize:12,color:'var(--muted)'}}>Top {count} · {season==='overall'?'All-time':season} · {competition==='all'?'All goals':competition} · includes sponsor logos</p>
    {preview&&<img src={preview.url} alt="Goalscorers share graphic preview" style={{width:'100%',maxWidth:320,display:'block',margin:'12px auto',borderRadius:5}}/>}
    {!preview&&!error&&<p>Preparing graphic…</p>}
    {error&&<p role="alert">{error}</p>}
    <div style={{display:'flex',gap:10,flexWrap:'wrap'}}><button disabled={!preview||busy} onClick={share}>{busy?'Sharing…':'Share graphic'}</button>{preview&&<a href={preview.url} download={filename} style={{padding:'8px 12px',border:'1px solid var(--brass)',borderRadius:5}}>Download graphic</a>}</div>
  </section>
}
