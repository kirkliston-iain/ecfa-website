export const MATCH_MINUTE_MS = 700
const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
const lerp = (a, b, t) => a + (b - a) * t
// World coordinates in metres: x runs between goals; z runs between touchlines.
export const FORMATION = [[-48,0],[-31,-23],[-34,-8],[-34,8],[-31,23],[-16,-21],[-19,-7],[-19,7],[-16,21],[-5,-10],[-5,10]]
export function matchMotion(minute, story) {
  const previous = [...story].reverse().find(event => event.minute <= minute)
  const next = story.find(event => event.minute > minute)
  const side = next?.side || previous?.side || 'home'
  const direction = side === 'home' ? 1 : -1
  const start = previous?.minute || 0
  const end = next?.minute || 90
  const phase = clamp((minute - start) / Math.max(1, end - start), 0, 1)
  const cycle = story.indexOf(next)
  const lane = Math.sin((cycle + 1) * 2.1) * 17
  // Build-up through defence, midfield and a forward. Each leg is a pass.
  const route = [[-30, lane*.4],[-19, -lane],[-4,lane],[17,-lane*.65],[35,lane*.3],[next?.goal ? 53 : 51,next?.goal ? 0 : (next?.kind===2 ? 6 : 2)]]
  const leg = Math.min(4, Math.floor(phase*5))
  const local = phase*5-leg
  let ball = {x:lerp(route[leg][0],route[leg+1][0],local)*direction,z:lerp(route[leg][1],route[leg+1][1],local),y:.55 + (leg===4 ? Math.sin(local*Math.PI)*2 : Math.sin(local*Math.PI)*.7)}
  const celebration = previous?.goal && minute - previous.minute < 1.3
  if (celebration) ball = { x: previous.side==='home' ? 53 : -53,z:0,y:.55 }
  if (minute===0) ball={x:0,z:0,y:.55}
  const players = [0,1].flatMap(team => {
    const attack = (team===0 && side==='home') || (team===1 && side==='away')
    const sign = team===0 ? 1 : -1
    const positions = FORMATION.map(([x,z],index) => {
      if (index===0) return {x:sign*clamp(-48+Math.max(0,ball.x*sign)*.035,-49,-46),z:clamp(ball.z*.18,-3,3)}
      const advance = attack ? phase*28 : -phase*12
      return {x:clamp(x*sign+advance*direction+(index>8 && attack ? 8 : 0),-46,46),z:clamp(z+ball.z*.24+Math.sin(minute*.75+index*1.7+team)*3,-29,29)}
    })
    // The nearest outfielder presses or receives; a second player supports the move.
    const nearest=positions.map((p,i)=>({i,d:(p.x-ball.x)**2+(p.z-ball.z)**2})).filter(p=>p.i>0).sort((a,b)=>a.d-b.d)
    if (minute>0 && !celebration) {
      const receiver = nearest[0].i
      positions[receiver]={x:clamp(ball.x-direction*(attack ? 1.3 : -2.3),-49,49),z:clamp(ball.z+(attack ? .7 : -1.3),-30,30)}
      if (attack) positions[nearest[1].i]={x:clamp(ball.x-direction*8,-46,46),z:clamp(ball.z+(nearest[1].i%2 ? 9 : -9),-29,29)}
    }
    if (celebration && ((team===0 && previous.side==='home') || (team===1 && previous.side==='away'))) {
      positions.forEach((p,i)=>{if(i>7){p.x=(previous.side==='home' ? 1 : -1)*38+Math.sin(i)*3;p.z=Math.cos(i)*4}})
    }
    return positions.map((position,index)=>({...position,team,index}))
  })
  return {ball,players,celebration}
}
