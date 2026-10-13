const normal = value => String(value || '').trim().toLowerCase()
export function disciplineEvidence(fixture, cards, games, asOf) {
  const valid = f => f && f.status === 'played' && f.hidden_from_public === false && Date.parse(f.fixture_date) < asOf.getTime()
  const totals = new Map()
  let yellow = 0, red = 0
  for (const row of cards) {
    if (!valid(row.fixture)) continue
    const count = Number(row.card_count || 0)
    const type = normal(row.card_type)
    if (!['yellow','red'].includes(type)) continue
    const total = totals.get(row.player_id) || {yellow:0,red:0}
    total[type] += count; totals.set(row.player_id,total)
    if (fixture.referee_name && normal(row.fixture.referee_name) === normal(fixture.referee_name)) {
      if (type === 'yellow') yellow += count
      else red += count
    }
  }
  const n = games.filter(valid).length
  return { referee: fixture.referee_name || null, yellowMean: (yellow + 8) / (n + 4), redMean: (red + 0.4) / (n + 4), players: totals }
}
export function addSimulatedCards(events, squads, discipline, random, takeMinute) {
  if (!discipline?.referee) return events
  const cards = [], sentOff = new Set(), booked = new Set()
  const choose = type => {
    const pool = squads.flatMap((players,index)=>players.map(player=>({player,side:index ? 'away':'home'}))).filter(({player})=>!sentOff.has(player.id))
    const weights = pool.map(({player})=>1+Math.min(8,discipline.players.get(player.id)?.[type] || 0))
    let threshold=random()*weights.reduce((a,b)=>a+b,0)
    return pool.find((_,index)=>(threshold-=weights[index])<=0) || pool.at(-1)
  }
  // A bounded Poisson draw keeps extreme historical samples from dominating the game.
  const count = (mean,max) => {let product=1,n=0;do {product*=Math.max(1e-9,random());n++}while(product>Math.exp(-Math.min(mean,max)) && n<=max);return Math.min(max,n-1)}
  const requests = [...Array(count(discipline.yellowMean,8)).fill('yellow'), ...Array(count(discipline.redMean,2)).fill('red')].map(type=>({type,minute:takeMinute()})).sort((a,b)=>a.minute-b.minute)
  for(const request of requests){
    const chosen=choose(request.type);if(!chosen)break
    const secondYellow=request.type==='yellow' && booked.has(chosen.player.id)
    const card=secondYellow ? 'red' : request.type
    if(card==='red')sentOff.add(chosen.player.id);else booked.add(chosen.player.id)
    cards.push({...chosen,...request,card,secondYellow,goal:false})
  }
  const dismissedBefore=(player,minute)=>player && cards.some(c=>c.card==='red' && c.player.id===player.id && c.minute<minute)
  const remaining=events.filter(e=>!dismissedBefore(e.scorer || e.actor,e.minute)).map(e=>dismissedBefore(e.assist,e.minute)?{...e,assist:null}:e)
  return [...remaining,...cards].sort((a,b)=>a.minute-b.minute)
}