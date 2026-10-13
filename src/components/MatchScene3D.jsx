import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { SVGRenderer, SVGObject } from 'three/addons/renderers/SVGRenderer.js'
import { supabase } from '../supabaseClient'
import { matchMotion, MATCH_MINUTE_MS } from '../utils/matchMotion'

export default function MatchScene3D({ kits, minute, running, speed, story, cameraMode }) {
  const host = useRef(null)
  const playback = useRef({ kits, minute, running, speed, story, cameraMode, updated:performance.now() })
  const [failed,setFailed]=useState(false)
  useEffect(()=>{playback.current={kits,minute,running,speed,story,cameraMode,updated:performance.now()}},[kits,minute,running,speed,story,cameraMode])
  useEffect(()=>{
    const container=host.current
    let renderer,software=false,fallbackFrame=0,fallbackLast=0
    try {
      const canvas=document.createElement('canvas')
      const context=canvas.getContext('webgl2',{antialias:true,alpha:false,powerPreference:'low-power'})
      if(!context)throw new Error('Graphics acceleration unavailable')
      renderer=new THREE.WebGLRenderer({canvas,context,antialias:true,alpha:false,powerPreference:'low-power'})
    } catch {
      software=true;renderer=new SVGRenderer();renderer.setQuality('high')
      // Project the same 3D geometry with the CPU when WebGL is unavailable.
      renderer.setAnimationLoop=(callback)=>{
        cancelAnimationFrame(fallbackFrame)
        if(!callback)return
        const frame=(time)=>{fallbackFrame=requestAnimationFrame(frame);if(time-fallbackLast>=40){fallbackLast=time;callback()}}
        fallbackFrame=requestAnimationFrame(frame)
      }
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1,2.5))
    renderer.setClearColor('#8bbecb')
    renderer.outputColorSpace=THREE.SRGBColorSpace
    container.appendChild(renderer.domElement)
    renderer.domElement.setAttribute('aria-label','3D football pitch with moving players')
    renderer.domElement.setAttribute('data-renderer',software ? 'software-3d' : 'webgl-3d')
    const scene=new THREE.Scene()
    scene.fog=new THREE.Fog('#8bbecb',160,330)
    scene.add(software ? new THREE.AmbientLight('#ffffff',.8) : new THREE.HemisphereLight('#ffffff','#44623a',2.5))
    const sun=new THREE.DirectionalLight('#fff3d4',software ? .8 : 2.2);sun.position.set(-40,75,30);scene.add(sun)
    const camera=new THREE.PerspectiveCamera(48,1,.1,500)
    let disposed=false
    const materials=new Set(),geometries=new Set(),textures=new Set()
    const material=(colour)=>{const m=new THREE.MeshLambertMaterial({color:colour});materials.add(m);return m}
    const geometry=(g)=>{geometries.add(g);return g}
    const white=material('#f7f5e9'),dark=material('#17232a'),skin=[material('#c58d65'),material('#84563c'),material('#e6b68c')]
    function box(parent,w,h,d,mat,x,y,z){const mesh=new THREE.Mesh(geometry(new THREE.BoxGeometry(w,h,d)),mat);mesh.position.set(x,y,z);parent.add(mesh);return mesh}
    box(scene,160,.7,110,material('#356447'),0,-.5,0).renderOrder=-100
    for(let stripe=0;stripe<12;stripe++)box(scene,105/12,.12,68,material(stripe%2 ? '#348549':'#3c9654'),-52.5+(stripe+.5)*105/12,0,0).renderOrder=-90
    function line(points,colour='#f7f5e9'){
      const geo=geometry(new THREE.BufferGeometry().setFromPoints(points.map(([x,y,z])=>new THREE.Vector3(x,y,z))))
      const mat=new THREE.LineBasicMaterial({color:colour});materials.add(mat)
      const object=new THREE.Line(geo,mat);scene.add(object);return object
    }
    const flat=(points)=>{const object=line(points.map(([x,z])=>[x,.1,z]));object.renderOrder=-80;return object}
    flat([[-52.5,-34],[52.5,-34],[52.5,34],[-52.5,34],[-52.5,-34]])
    flat([[0,-34],[0,34]])
    flat(Array.from({length:65},(_,i)=>[Math.cos(i*Math.PI/32)*9.15,Math.sin(i*Math.PI/32)*9.15]))
    for(const sign of [-1,1]){
      flat([[sign*52.5,-20.15],[sign*36,-20.15],[sign*36,20.15],[sign*52.5,20.15]])
      flat([[sign*52.5,-9.15],[sign*47,-9.15],[sign*47,9.15],[sign*52.5,9.15]])
      const x=sign*52.8,back=sign*56
      // Uprights, crossbar and a visible net cage.
      box(scene,.3,3.6,.3,white,x,1.8,-4);box(scene,.3,3.6,.3,white,x,1.8,4);box(scene,.3,.3,8.3,white,x,3.6,0)
      line([[x,3.6,-4],[back,3.6,-4],[back,3.6,4],[x,3.6,4]],'#dae5e3')
      for(let z=-4;z<=4;z+=.8)line([[x,3.6,z],[back,3.6,z],[back,.15,z]],'#b6cebf')
      for(let y=.2;y<=3.6;y+=.6){line([[back,y,-4],[back,y,4]],'#b6cebf');line([[x,y,-4],[back,y,-4]],'#b6cebf');line([[x,y,4],[back,y,4]],'#b6cebf')}
      box(scene,1.8,2,1.8,material('#b59025'),sign*53.8,1,-35)
    }
    // Small stadium stands and touchline boards give the scene depth.
    const stand=material('#657781'),seats=material('#233849')
    for(const z of [-45,45]){box(scene,124,3,8,stand,0,1,z);box(scene,124,2,6,stand,0,3,z+Math.sign(z)*3);for(let x=-57;x<58;x+=4)box(scene,2.5,.7,1.6,seats,x,4.4,z+Math.sign(z)*2)}
    const boards=[]
    for(const z of [-37,37])for(let x=-45;x<=45;x+=15){
      box(scene,13.5,4,.3,white,x,2.05,z)
      boards.push({x,z})
    }
    supabase.from('sponsors').select('id,name,logo_url').eq('is_published',true).order('sort_order').order('name').then(({data})=>{
      if(disposed || !data?.length)return
      const sponsors=data.filter(item=>item.logo_url && !/^kwik\s*fit$/i.test(item.name.trim()))
      if(!sponsors.length)return
      container.dataset.sponsorCount=String(sponsors.length)
      sponsors.forEach((sponsor,index)=>{
        const slots=boards.filter((_,i)=>i%sponsors.length===index)
        if(software){
          for(const slot of slots){
            const image=document.createElementNS('http://www.w3.org/2000/svg','image')
            image.setAttribute('href',sponsor.logo_url);image.setAttribute('x','-42');image.setAttribute('y','-17');image.setAttribute('width','84');image.setAttribute('height','34');image.setAttribute('preserveAspectRatio','xMidYMid meet');image.setAttribute('aria-label',`${sponsor.name} sponsor board`)
            const label=new SVGObject(image);label.renderOrder=100;label.position.set(slot.x,2.1,slot.z-Math.sign(slot.z)*.2);scene.add(label)
          }
          lastMinute=-1
          return
        }
        const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=300
        const ctx=canvas.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,1024,300)
        ctx.fillStyle='#14292a';ctx.font='bold 64px sans-serif';ctx.textAlign='center';ctx.fillText(sponsor.name,512,175,990)
        const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=renderer.capabilities.getMaxAnisotropy();textures.add(texture)
        const mat=new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide,fog:false});materials.add(mat)
        for(const slot of slots){const face=new THREE.Mesh(geometry(new THREE.PlaneGeometry(13.3,3.9)),mat);face.position.set(slot.x,2.05,slot.z-Math.sign(slot.z)*.16);if(slot.z>0)face.rotation.y=Math.PI;scene.add(face)}
        const image=new Image();image.crossOrigin='anonymous'
        image.onload=()=>{if(disposed)return;ctx.fillStyle='#ffffff';ctx.fillRect(0,0,1024,300);const scale=Math.min(990/image.width,274/image.height);const w=image.width*scale,h=image.height*scale;ctx.drawImage(image,(1024-w)/2,(300-h)/2,w,h);texture.needsUpdate=true;lastMinute=-1}
        image.src=sponsor.logo_url
        lastMinute=-1
      })
    }).catch(()=>{/* Plain boards remain if sponsors cannot load. */})
    const sphere=geometry(new THREE.SphereGeometry(.55,12,8)),head=geometry(new THREE.SphereGeometry(.55,8,6))
    const shadowGeo=geometry(new THREE.CircleGeometry(1,12)),shadowMat=new THREE.MeshBasicMaterial({color:'#152819',transparent:true,opacity:.28,depthWrite:false});materials.add(shadowMat)
    const players=[]
    for(let team=0;team<2;team++){
      const jersey=material(playback.current.kits[team].colour),trim=material(playback.current.kits[team].trim)
      for(let index=0;index<11;index++){
        const group=new THREE.Group();scene.add(group)
        const body=box(group,1.15,1.25,.65,jersey,0,2.3,0)
        const face=new THREE.Mesh(head,skin[index%3]);face.position.y=3.3;group.add(face)
        box(group,1.05,.55,.6,dark,0,1.4,0)
        const legs=[],arms=[]
        for(const sign of [-1,1]){
          const leg=new THREE.Group();leg.position.set(sign*.3,1.2,0);group.add(leg);box(leg,.3,.8,.3,trim,0,-.4,0);box(leg,.4,.25,.65,dark,0,-.9,.12);legs.push(leg)
          const arm=new THREE.Group();arm.position.set(sign*.8,2.7,0);group.add(arm);box(arm,.3,.8,.3,jersey,0,-.3,0);arms.push(arm)
        }
        // Shirt number on both front and back; same material colour as the kit label.
        if(!software){
        const numberCanvas=document.createElement('canvas');numberCanvas.width=64;numberCanvas.height=64;const ctx=numberCanvas.getContext('2d');ctx.fillStyle=playback.current.kits[team].text;ctx.font='bold 50px sans-serif';ctx.textAlign='center';ctx.fillText(String(index+1),32,53)
        const numberTex=new THREE.CanvasTexture(numberCanvas);textures.add(numberTex)
        const numberMat=new THREE.MeshBasicMaterial({map:numberTex,transparent:true,side:THREE.DoubleSide});materials.add(numberMat)
        for(const sign of [-1,1]){const number=new THREE.Mesh(geometry(new THREE.PlaneGeometry(.8,.85)),numberMat);number.position.set(0,2.3,sign*.335);group.add(number)}
        }
        const shadow=new THREE.Mesh(shadowGeo,shadowMat);shadow.renderOrder=-70;shadow.rotation.x=-Math.PI/2;shadow.position.y=.13;scene.add(shadow)
        players.push({group,shadow,legs,arms,body,index,team})
      }
    }
    const ball=new THREE.Mesh(sphere,white);scene.add(ball)
    const ballPatch=new THREE.Mesh(geometry(new THREE.IcosahedronGeometry(.56,0)),new THREE.MeshBasicMaterial({color:'#15212a',wireframe:true}));materials.add(ballPatch.material);ball.add(ballPatch)
    const ballShadow=new THREE.Mesh(shadowGeo,shadowMat);ballShadow.renderOrder=-70;ballShadow.rotation.x=-Math.PI/2;ballShadow.scale.setScalar(.6);ballShadow.position.y=.13;scene.add(ballShadow)
    let lastTime=performance.now(),lastMinute=-1,lastMode='',lastRunning=false
    function resize(){const width=container.clientWidth,height=container.clientHeight;renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();lastMode='';lastMinute=-1}
    const observer=new ResizeObserver(resize);observer.observe(container);resize()
    function lost(event){event.preventDefault();setFailed(true);renderer.setAnimationLoop(null)}
    renderer.domElement.addEventListener('webglcontextlost',lost)
    renderer.setAnimationLoop(()=>{
      const time=performance.now(),state=playback.current,dt=Math.min(.08,(time-lastTime)/1000);lastTime=time
      if(document.hidden)return
      if(!state.running && state.minute===lastMinute && state.cameraMode===lastMode && !lastRunning)return
      const clock=state.minute+(state.running ? Math.min(.999,(time-state.updated)/MATCH_MINUTE_MS*state.speed) : 0)
      const motion=matchMotion(Math.min(90,clock),state.story)
      const snap=state.minute===0 || !state.running && lastRunning
      for(let i=0;i<players.length;i++){
        const p=players[i],target=motion.players[i],before=p.group.position.clone()
        p.group.position.lerp(new THREE.Vector3(target.x,0,target.z),snap ? 1 : 1-Math.exp(-dt*7))
        const dx=p.group.position.x-before.x,dz=p.group.position.z-before.z
        const moving=state.running && Math.hypot(dx,dz)>.005
        if(moving)p.group.rotation.y=Math.atan2(dx,dz)
        const stride=moving ? Math.sin(clock*6+p.index)*.65 : 0
        p.legs[0].rotation.x=stride;p.legs[1].rotation.x=-stride;p.arms[0].rotation.x=-stride*.8;p.arms[1].rotation.x=stride*.8
        p.body.position.y=2.3+(moving ? Math.abs(Math.sin(clock*6+p.index))*.07 : 0)
        p.shadow.position.set(p.group.position.x,.13,p.group.position.z)
      }
      ball.position.set(motion.ball.x,motion.ball.y,motion.ball.z);ball.rotation.z=clock*2;ball.rotation.x=clock*1.6;ballShadow.position.set(motion.ball.x,.13,motion.ball.z)
      if(state.cameraMode==='goal'){
        camera.position.set(72,27,12);camera.lookAt(18,1,0)
      }else{
        // A close touchline view follows the action rather than fitting the stadium.
        const portrait=camera.aspect<1.3
        const focusX=THREE.MathUtils.clamp(motion.ball.x*.8,-36,36)
        const focusZ=motion.ball.z*.35
        camera.position.set(focusX+7,portrait ? 34 : 38,focusZ+(portrait ? 44 : 50))
        camera.lookAt(focusX,1,focusZ)
      }
      renderer.render(scene,camera)
      lastMinute=state.minute;lastMode=state.cameraMode;lastRunning=state.running
    })
    return ()=>{disposed=true;observer.disconnect();renderer.setAnimationLoop(null);renderer.domElement.removeEventListener('webglcontextlost',lost);geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());renderer.dispose?.();renderer.forceContextLoss?.();renderer.domElement.remove()}
  },[])
  return <div className="wp-scene3d" ref={host}>{failed && <p className="wp-3d-error" role="status">This browser could not display the 3D pitch. Try enabling hardware acceleration or another browser. You can still run the match and enter your predictions.</p>}</div>
}
