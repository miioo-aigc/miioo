import * as THREE from './vendor/three.module.js';

// A photographic surface, not a collection of fully modelled 3D plants.
// Rooted deformation fields move nearby image detail with damped spring physics.
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const anchors = [
  [.154,.69,.13,.39], [.185,.50,.11,.21],
  [.075,.40,.12,.24], [.288,.46,.11,.23],
  [.586,.54,.13,.30], [.765,.64,.13,.40],
  [.830,.57,.12,.31], [.920,.75,.15,.47],
  [.323,.18,.09,.13], [.677,.19,.09,.12], [.869,.28,.10,.15]
].map(([x,y,radius,height])=>({x,y,radius,height,offset:0,velocity:0}));
const pointer={x:-10,y:-10,px:-10,py:-10,active:false,down:false};
let renderer, geometry, mesh, camera, width=1,height=1,scale=1,imageWidth=1,imageHeight=1;
let last=performance.now(), accumulator=0, simulationTime=0;
let windGain=0;
const original = [];
const notice=document.querySelector('#notice');

try {
 renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
 renderer.setClearColor(0x000000);
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));
 renderer.domElement.setAttribute('aria-label','交互式摄影花园，移动鼠标轻拨植物，按住拖动后松开回弹。');
 renderer.domElement.setAttribute('role','img');
 document.body.append(renderer.domElement);
 camera=new THREE.OrthographicCamera(-1,1,1,-1,.1,20);
 camera.position.z=5;
 const scene=new THREE.Scene();
 const texture=await new THREE.TextureLoader().loadAsync('assets/garden-clean-v1.png');
 texture.colorSpace=THREE.SRGBColorSpace;
 texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
 geometry=new THREE.PlaneGeometry(1,1,160,108);
 const position=geometry.attributes.position;
 for(let i=0;i<position.count;i++) original.push(position.getX(i),position.getY(i));
 // Cache fixed root influence, avoiding per-frame exponential calculations.
 const weights=new Float32Array(position.count*anchors.length);
 for(let i=0;i<position.count;i++){
  const x=original[i*2]+.5,y=original[i*2+1]+.5;
  anchors.forEach((a,j)=>{
   const root=a.y-a.height,lateral=(x-a.x)/a.radius;
   if(y<root||y>a.y+a.radius||Math.abs(lateral)>1.6)return;
   const vertical=(y-a.y)/(a.height*.85);
   weights[i*anchors.length+j]=Math.exp(-3*lateral*lateral-1.6*vertical*vertical)*THREE.MathUtils.smoothstep(y,root,a.y);
  });
 }
 mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({map:texture}));
 mesh.frustumCulled=false;
 scene.add(mesh);

 function resize(){
  width=innerWidth;height=innerHeight;
  renderer.setSize(width,height);
  camera.left=-width/2;camera.right=width/2;camera.top=height/2;camera.bottom=-height/2;camera.updateProjectionMatrix();
  // Cover framing matches the static fallback. Small overscan hides parallax edges.
  scale=Math.max(width/1536,height/1024)*1.015;
  imageWidth=1536*scale;imageHeight=1024*scale;
  mesh.scale.set(imageWidth,imageHeight,1);
  mesh.position.y=(imageHeight-height)/2;
  pointer.active=false;
 }
 resize();
 window.addEventListener('resize',resize);
 function updatePointer(event){
  pointer.x=(event.clientX-width/2-mesh.position.x)/imageWidth+.5;
  pointer.y=(height/2-event.clientY-mesh.position.y)/imageHeight+.5;
  if(!pointer.active){pointer.px=pointer.x;pointer.py=pointer.y;}
  pointer.active=true;
 }
 const canvas=renderer.domElement;
 canvas.addEventListener('pointermove',updatePointer,{passive:true});
 canvas.addEventListener('pointerdown',event=>{
  updatePointer(event);pointer.down=true;
  canvas.setPointerCapture(event.pointerId);
 });
 function release(){pointer.down=false;}
 canvas.addEventListener('pointerup',release);
 canvas.addEventListener('lostpointercapture',release);
 canvas.addEventListener('pointercancel',()=>{release();pointer.active=false;});
 canvas.addEventListener('pointerleave',()=>{if(!pointer.down)pointer.active=false;});
 window.addEventListener('blur',()=>{release();pointer.active=false;});
 document.addEventListener('visibilitychange',()=>{last=performance.now();accumulator=0;pointer.active=false;release();});

 function step(dt){
  simulationTime+=dt;
  const speed=THREE.MathUtils.clamp((pointer.x-pointer.px)*80,-1,1);
  const enabled=!reducedMotion.matches;
  windGain=THREE.MathUtils.damp(windGain,enabled?1:0,4,dt);
  for(let i=0;i<anchors.length;i++){
   const a=anchors[i];
   const dx=pointer.x-a.x,dy=pointer.y-a.y;
   const distance=Math.hypot(dx,dy*.65);
   const influence=pointer.active?Math.max(0,1-distance/(a.radius*1.35)):0;
   // Target is bounded; integration at 120Hz keeps spring stable after pauses.
   const touch=(THREE.MathUtils.clamp(dx*1.5,-.08,.08)+speed*.018)*influence;
   const wind=Math.sin(simulationTime*.62+i*1.73)*.0013*windGain;
   const target=enabled?(touch*(pointer.down?1.8:1)+wind):0;
   a.velocity+=((target-a.offset)*95-a.velocity*11.5)*dt;
   a.offset+=a.velocity*dt;
  }
  pointer.px=pointer.x;pointer.py=pointer.y;
 }
 function draw(now){
  requestAnimationFrame(draw);
  if(document.hidden)return;
  accumulator+=Math.min((now-last)/1000,.05);last=now;
  while(accumulator>=1/120){step(1/120);accumulator-=1/120;}
  const targetX=pointer.active&&!reducedMotion.matches?-(pointer.x-.5)*3:0;
  mesh.position.x=THREE.MathUtils.lerp(mesh.position.x,targetX,.035);
  for(let i=0;i<position.count;i++){
   const x=original[i*2]+.5,y=original[i*2+1]+.5;
   let bend=0,drop=0;
   for(let j=0;j<anchors.length;j++){
    const a=anchors[j],weight=weights[i*anchors.length+j];
    bend+=a.offset*weight;
    drop+=a.offset*a.offset*weight*2;
   }
   position.setXY(i,x-.5+bend,y-.5-drop);
  }
  position.needsUpdate=true;
  renderer.render(scene,camera);
 }
 renderer.render(scene,camera);
 canvas.classList.add('ready');
 requestAnimationFrame(draw);
 // Read-only snapshot for checking load and simulation health without exposing secrets.
 window.gardenState=()=>({ready:true,mode:'photographic-mesh',reducedMotion:reducedMotion.matches,plants:anchors.length,width,height,finite:anchors.every(a=>Number.isFinite(a.offset)&&Number.isFinite(a.velocity)),maxBend:Math.max(...anchors.map(a=>Math.abs(a.offset)))});
} catch(error){
 console.error('Garden could not initialize:',error);
 if(renderer)renderer.domElement.remove();
 notice.textContent='当前显示静态花园。此设备暂未启用 WebGL 交互。';
 notice.classList.add('visible');
}
