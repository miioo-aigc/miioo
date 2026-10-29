import * as THREE from './vendor/three.module.js';
import { createWindParticles } from './wind-particles.js?v=20261029-continuous-r3';

// One continuous photographic surface keeps stems and leaves connected.
// Local leaf motion fades out at its boundaries; the ground plate stays still.
const canvas = document.querySelector('#garden-canvas');
const stage = document.querySelector('#garden-stage');
const poster = document.querySelector('#garden-poster');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const narrow = matchMedia('(max-width:700px)');
let paused = reduced.matches, ready = false, lost = false, inView = true;
let renderer, scene, camera, garden, particles, mist, plantUniforms;
let photoWidth = 1672, photoHeight = 940, width = 1, height = 1;
let scale = 1, originX = 0, originY = 0, pixelRatio = Math.min(devicePixelRatio || 1, 1.5);
let raf = 0, lastFrame = 0, motionDelta = 0, time = 0, frameCount = 0, interactionCount = 0;
let stageRect = {left:0,top:0}, globalGust = 0, burstCooldown = 0;
const detailStates = [], samples = [];
let slowWindows = 0, fastWindows = 0, qualityCooldown = 0, sampleDuration = 0;
let rendererWidth = 0, rendererHeight = 0, qualityProbe = null;
const pointer = {x:.5,y:.6,fromX:.5,fromY:.6,distanceX:0,distanceY:0,moved:false,initialized:false};
const groups = [
  {root:[.17,.895],head:.34,phase:.7,fade:.795,amplitude:.105,stiffness:37,bend:0,velocity:0,gust:0},
  {root:[.37,.93],head:.65,phase:2.3,fade:.84,amplitude:.115,stiffness:49,bend:0,velocity:0,gust:0},
  {root:[.57,.975],head:.83,phase:4.1,fade:.925,amplitude:.20,stiffness:62,bend:0,velocity:0,gust:0},
  {root:[.77,.94],head:.65,phase:1.6,fade:.85,amplitude:.13,stiffness:48,bend:0,velocity:0,gust:0},
  {root:[.89,.94],head:.47,phase:3.5,fade:.855,amplitude:.13,stiffness:34,bend:0,velocity:0,gust:0},
];
// These boxes locate flexible regions; they never cut holes in the photo.
// Their displacement and twist vanish at every edge and at the attachment.
const details = [
  {name:'dandelion-head',box:[.180,.262,.264,.445],hinge:[.217,.445],group:0,kind:0,amplitude:.08,phase:1.2},
  {name:'white-flower-head',box:[.058,.36,.165,.449],hinge:[.125,.449],group:0,kind:0,amplitude:.065,phase:4.3},
  {name:'upper-curled-leaf',box:[.835,.397,.911,.526],hinge:[.851,.526],group:4,kind:1,amplitude:.24,phase:.8},
  {name:'middle-curled-leaf',box:[.802,.505,.869,.600],hinge:[.855,.600],group:4,kind:1,amplitude:.27,phase:2.7},
  {name:'lower-curled-leaf',box:[.846,.587,.902,.680],hinge:[.869,.680],group:4,kind:1,amplitude:.21,phase:4.2},
  {name:'left-green-leaf',box:[.147,.690,.215,.795],hinge:[.177,.795],group:0,kind:1,amplitude:.20,phase:5.6},
];
const plantVertex = `
attribute vec2 aPhoto;
varying vec2 vPhoto,vRootFade;
varying float vLighting;
uniform vec2 uPhotoSize,uRootFade[5],uHinges[6];
uniform vec4 uPlants[5],uDetails[6],uBoxes[6];
vec2 bendPoint(vec2 point,vec4 plant){
  vec2 root=vec2(plant.x,1.-plant.y)*uPhotoSize;
  float length=plant.z*uPhotoSize.y;
  float h=point.y-root.y;
  float t=clamp(h/length,0.,1.);
  float angle=plant.w*t;
  vec2 center;
  if(abs(plant.w)<.0001)center=vec2(length*plant.w*t*t*.5,length*t);
  else center=length*vec2(1.-cos(angle),sin(angle))/plant.w;
  vec2 offset=vec2(point.x-root.x,h-length*t);
  return root+center+vec2(cos(angle)*offset.x+sin(angle)*offset.y,-sin(angle)*offset.x+cos(angle)*offset.y);
}
void main(){
  vPhoto=aPhoto;vRootFade=vec2(0.);vLighting=1.;
  vec3 local=position;
  for(int i=0;i<6;i++){
    vec4 box=uBoxes[i];
    vec2 q=(aPhoto-box.xy)/(box.zw-box.xy);
    vec2 edge=smoothstep(vec2(0.),vec2(.30),q)*(1.-smoothstep(vec2(.70),vec2(1.),q));
    vec2 hinge=vec2(uHinges[i].x,1.-uHinges[i].y)*uPhotoSize;
    vec2 d=position.xy-hinge;
    float attachment=smoothstep(0.,(box.w-box.y)*uPhotoSize.y*.24,length(d));
    float weight=edge.x*edge.y*attachment;
    float angle=uDetails[i].x*weight;
    float twist=uDetails[i].y*weight;
    vec2 rotated=vec2(cos(angle)*d.x-sin(angle)*d.y,sin(angle)*d.x+cos(angle)*d.y);
    rotated.x*=cos(twist);
    local.xy+=rotated-d;
    local.z+=sin(twist)*d.x;
    vLighting+=sin(twist)*uDetails[i].z*.10;
  }
  vec2 bent=vec2(0.);
  for(int i=0;i<5;i++){
    float weight=1.;
    if(i>0)weight*=smoothstep(uPlants[i-1].x,uPlants[i].x,aPhoto.x);
    if(i<4)weight*=1.-smoothstep(uPlants[i].x,uPlants[i+1].x,aPhoto.x);
    bent+=bendPoint(local.xy,uPlants[i])*weight;
    vRootFade+=uRootFade[i]*weight;
  }
  // The photograph meets the static ground without sliding or double edges.
  float attachment=1.-smoothstep(vRootFade.x-.075,vRootFade.x,aPhoto.y);
  vec3 p=vec3(mix(position.xy,bent,attachment),mix(position.z,local.z,attachment));
  gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
}`;
const plantFragment = `
uniform sampler2D uPhoto,uMatte;
varying vec2 vPhoto,vRootFade;
varying float vLighting;
void main(){
  float alpha=texture2D(uMatte,vec2(vPhoto.x,1.-vPhoto.y)).a;
  alpha*=1.-smoothstep(vRootFade.x,vRootFade.y,vPhoto.y);
  if(alpha<.008)discard;
  vec3 color=texture2D(uPhoto,vec2(vPhoto.x,1.-vPhoto.y)).rgb;
  gl_FragColor=vec4(color*vLighting,alpha);
  #include <colorspace_fragment>
}`;

function announce(){
  canvas.dataset.motion=paused?'paused':'playing';
  window.dispatchEvent(new CustomEvent('garden-state',{detail:{paused,reduced:reduced.matches,available:ready&&!lost}}));
}
function fallback(reason){
  ready=false;cancelAnimationFrame(raf);
  if(qualityProbe){pixelRatio=qualityProbe.previousRatio;qualityProbe=null;qualityCooldown=20;}
  canvas.dataset.status='fallback';canvas.dataset.reason=reason;
  canvas.classList.remove('ready');poster?.classList.remove('rendered');announce();
}
function layout(shouldRender=true){
  stageRect=stage.getBoundingClientRect();width=Math.max(1,stageRect.width);height=Math.max(1,stageRect.height);
  const fitHeight=narrow.matches?height*.88:height;
  scale=(narrow.matches?Math.max:Math.min)(width/photoWidth,fitHeight/photoHeight);
  originX=(width-photoWidth*scale)*(narrow.matches?.25:.5);originY=height-photoHeight*scale;
  if(!renderer||!camera)return;
  // setPixelRatio already reallocates the drawing buffer; do not resize twice.
  if(renderer.getPixelRatio()!==pixelRatio)renderer.setPixelRatio(pixelRatio);
  if(width!==rendererWidth||height!==rendererHeight){
    renderer.setSize(width,height,false);rendererWidth=width;rendererHeight=height;
  }
  camera.left=0;camera.right=width;camera.top=height;camera.bottom=0;camera.updateProjectionMatrix();
  garden.scale.setScalar(scale);garden.position.set(originX,0,0);
  if(shouldRender&&ready&&!lost&&inView&&!document.hidden)render();
}
function createVegetation(photo,matte){
  const nx=144,ny=80,positions=[],uvs=[],indices=[];
  for(let row=0;row<=ny;row++){
    const v=.24+.76*row/ny;
    for(let col=0;col<=nx;col++){
      const u=col/nx;
      positions.push(u*photoWidth,(1-v)*photoHeight,5);uvs.push(u,v);
    }
  }
  for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
    const a=y*(nx+1)+x,b=a+nx+1;indices.push(a,b,a+1,b,b+1,a+1);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('aPhoto',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);
  plantUniforms={
    uPhoto:{value:photo},uMatte:{value:matte},uPhotoSize:{value:new THREE.Vector2(photoWidth,photoHeight)},
    uPlants:{value:groups.map(g=>new THREE.Vector4(g.root[0],g.root[1],g.root[1]-g.head,0))},
    uRootFade:{value:groups.map(g=>new THREE.Vector2(g.fade,g.root[1]+.018))},
    uHinges:{value:details.map(d=>new THREE.Vector2(...d.hinge))},
    uBoxes:{value:details.map(d=>new THREE.Vector4(...d.box))},
    uDetails:{value:details.map(d=>new THREE.Vector4(0,0,d.kind,0))},
  };
  for(const detail of details)detailStates.push({...detail,angle:0,velocity:0,twist:0});
  const material=new THREE.ShaderMaterial({uniforms:plantUniforms,vertexShader:plantVertex,fragmentShader:plantFragment,transparent:true,depthWrite:false,depthTest:false,side:THREE.DoubleSide,forceSinglePass:true});
  const mesh=new THREE.Mesh(geometry,material);mesh.name='continuous-vegetation';mesh.frustumCulled=false;mesh.renderOrder=4;
  garden.add(mesh);
}

function makeMist(){
  const uniforms={uTime:{value:0}};
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(photoWidth,photoHeight),new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,depthTest:false,uniforms,
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec2 vUv;uniform float uTime;
    void main(){vec2 p=vUv;float mask=exp(-pow(abs((p.x-.51)/.23),2.)-pow(abs((p.y-.28)/.12),2.));
    float w=sin(p.x*31.+p.y*19.-uTime*.37)*sin(p.y*42.+uTime*.17);
    gl_FragColor=vec4(.06,.12,.13,mask*(.012+.009*w));}`,
  }));
  mesh.position.set(photoWidth/2,photoHeight/2,1);mesh.renderOrder=2;garden.add(mesh);return uniforms;
}
function onPointer(event){
  if(!ready||paused||!inView||document.hidden||event.pointerType==='touch')return;
  const x=(event.clientX-stageRect.left-originX)/(photoWidth*scale);
  const y=(event.clientY-stageRect.top-originY)/(photoHeight*scale);
  if(!pointer.initialized){pointer.fromX=x;pointer.fromY=y;pointer.x=x;pointer.y=y;pointer.initialized=true;}
  // Accumulate every input event, including sub-4ms high-polling-rate mice.
  pointer.distanceX+=x-pointer.x;pointer.distanceY+=y-pointer.y;
  pointer.x=x;pointer.y=y;pointer.moved=true;
}
function segmentDistance(x,y,ax,ay,bx,by){
  const dx=bx-ax,dy=by-ay,t=THREE.MathUtils.clamp(((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy+.000001),0,1);
  return Math.hypot((x-ax-dx*t)*1.25,y-ay-dy*t);
}
function consumePointer(inputDt){
  if(!pointer.moved)return;
  const speed=Math.min(3,Math.hypot(pointer.distanceX,pointer.distanceY)/Math.max(inputDt,.008));
  const direction=Math.sign(pointer.distanceX||pointer.distanceY||1);
  if(speed>.02&&pointer.y>.24&&pointer.y<.97){
    for(const group of groups){
      const d1=segmentDistance(group.root[0],group.head,pointer.fromX,pointer.fromY,pointer.x,pointer.y);
      const d2=segmentDistance(group.root[0],group.head+(group.root[1]-group.head)*.5,pointer.fromX,pointer.fromY,pointer.x,pointer.y);
      const proximity=Math.exp(-Math.pow(Math.min(d1,d2)/.17,2));
      // Integrate input over real elapsed time, not the number of rendered frames.
      const impulse=direction*speed*proximity*Math.min(inputDt,.05)*3.6;
      group.gust=THREE.MathUtils.clamp(group.gust+impulse,-1.1,1.1);
    }
    interactionCount++;canvas.dataset.interactions=String(interactionCount);
    if(speed>.35&&burstCooldown<=0){particles?.burst(pointer.x,pointer.y,Math.min(speed,1.6),direction);burstCooldown=.18;}
  }
  pointer.fromX=pointer.x;pointer.fromY=pointer.y;pointer.distanceX=0;pointer.distanceY=0;pointer.moved=false;
}
function blow(){
  if(!ready)return;
  if(paused){paused=false;announce();start();}
  globalGust=1.35;groups.forEach((g,i)=>{g.gust+=.75+i*.07;});
  particles.burst(.22,.36,1.3,1);particles.burst(.85,.54,1.3,1);
  interactionCount++;canvas.dataset.interactions=String(interactionCount);
}
function animate(dt,inputDt){
  time+=dt;globalGust*=Math.exp(-dt*1.25);burstCooldown-=dt;consumePointer(inputDt);
  const envelope=.72+.28*Math.sin(time*.62)+.20*Math.sin(time*.23+1.5);
  const wind=.45+Math.sin(time*.59)*.62+Math.sin(time*.21+2)*.28+globalGust;
  const steps=Math.max(1,Math.ceil(dt/(1/120))),step=dt/steps;
  for(let i=0;i<groups.length;i++){
    const group=groups[i];
    const wave=Math.sin(time*1.58+group.phase)*.75+Math.sin(time*2.71+group.phase*1.4)*.25;
    const desired=wave*group.amplitude*envelope+group.gust*.22+globalGust*.09;
    const target=.28*Math.tanh(desired/.28);
    for(let s=0;s<steps;s++){group.velocity+=((target-group.bend)*group.stiffness-group.velocity*6.4)*step;group.bend+=group.velocity*step;}
    group.gust*=Math.exp(-dt*3.8);
  }
  // Neighboring branches share a coherent field even after opposing gusts.
  // Preserve the mean wind direction while softly limiting spatial shear.
  const meanBend=groups.reduce((sum,g)=>sum+g.bend,0)/groups.length;
  let maxAdjacentDelta=0;
  for(let i=1;i<groups.length;i++)maxAdjacentDelta=Math.max(maxAdjacentDelta,Math.abs(groups[i].bend-groups[i-1].bend));
  const spatialScale=maxAdjacentDelta>1e-6?.16*Math.tanh(maxAdjacentDelta/.16)/maxAdjacentDelta:1;
  for(let i=0;i<groups.length;i++)plantUniforms.uPlants.value[i].w=meanBend+(groups[i].bend-meanBend)*spatialScale;
  for(let i=0;i<detailStates.length;i++){
    const part=detailStates[i],group=groups[part.group];
    const desired=(Math.sin(time*(part.kind?3.5:2.7)+part.phase)*.7+Math.sin(time*5.4+part.phase)*.3)*(part.amplitude||0)*envelope+group.velocity*(part.kind?.16:.10);
    const target=.16*Math.tanh(desired/.16);
    for(let s=0;s<steps;s++){part.velocity+=((target-part.angle)*74-part.velocity*9.5)*step;part.angle+=part.velocity*step;}
    const twistTarget=part.kind?.24*Math.tanh((Math.sin(time*4.1+part.phase)*.30+group.velocity*.16)/.24):0;
    part.twist+=(twistTarget-part.twist)*(1.-Math.exp(-dt*9));
    // Bound the rendered angle too, so spring overshoot cannot fold the feathered edge.
    plantUniforms.uDetails.value[i].set(.14*Math.tanh(part.angle/.14),part.twist,part.kind,0);
  }
  mist.uTime.value=time;particles.update(time,dt,wind);
}
function render(){
  renderer.render(scene,camera);
}
function tick(now){
  raf=0;if(!ready||lost||paused||!inView||document.hidden)return;
  const raw=lastFrame?(now-lastFrame)/1000:0;lastFrame=now;
  // Spread a short missed frame across subsequent updates instead of making
  // plants and airborne pieces jump ahead in a single simulation step.
  if(raw>0){const bounded=Math.min(.05,raw);motionDelta=motionDelta?motionDelta+(bounded-motionDelta)*.25:bounded;}
  animate(motionDelta,raw);render();frameCount++;
  if(frameCount%12===0){canvas.dataset.frames=String(frameCount);canvas.dataset.time=time.toFixed(2);canvas.dataset.headOffset=(plantUniforms.uPlants.value[0].w*(groups[0].root[1]-groups[0].head)*photoHeight*scale*.5).toFixed(1);canvas.dataset.flying=String(particles.activeCount);canvas.dataset.drawCalls=String(renderer.info.render.calls);canvas.dataset.triangles=String(renderer.info.render.triangles);}
  if(raw>.001){
    // Count long visible stalls too, but cap outliers so one interruption
    // cannot dominate an entire quality decision.
    const interval=Math.min(raw*1000,1000);samples.push(interval);sampleDuration+=interval;
  }
  if(samples.length>=120||(samples.length>=24&&sampleDuration>=3000)){
    const sorted=samples.slice().sort((a,b)=>a-b),mean=samples.reduce((a,b)=>a+b)/samples.length;
    const cadence=sorted[Math.floor(sorted.length*.2)],p95=sorted[Math.floor(sorted.length*.95)];
    const missed=samples.filter(ms=>ms>cadence*1.45).length/samples.length;
    canvas.dataset.fps=(1000/mean).toFixed(1);canvas.dataset.frameMedian=sorted[Math.floor(sorted.length*.5)].toFixed(2);canvas.dataset.frameP95=p95.toFixed(2);canvas.dataset.pixelRatio=pixelRatio.toFixed(2);
    // Relative misses adapt to the display's cadence. A consistently slow
    // cadence could be either GPU saturation or a 30 Hz screen, so briefly
    // probe a lower ratio and keep it only when it measurably helps.
    if(qualityProbe){
      if(qualityProbe.settle>0)qualityProbe.settle--;
      else{
        const improved=mean<qualityProbe.referenceMean*.90&&qualityProbe.referenceMean-mean>2;
        if(!improved){pixelRatio=qualityProbe.previousRatio;layout();}
        canvas.dataset.qualityProbe=improved?'accepted':'reverted';
        qualityProbe=null;qualityCooldown=improved?2:20;slowWindows=0;fastWindows=0;
      }
    }else if(qualityCooldown>0&&missed<=.18){qualityCooldown--;slowWindows=0;fastWindows=0;}
    else{
      const slow=missed>.18||mean>27;
      if(slow){slowWindows++;fastWindows=0;}
      else if(missed<.04&&p95<cadence*1.3){fastWindows++;slowWindows=0;}
      else{slowWindows=0;fastWindows=0;}
      const ceiling=Math.min(devicePixelRatio||1,1.5);
      let nextRatio=pixelRatio;
      if(slowWindows>=2&&pixelRatio>.85){
        nextRatio=Math.max(.85,pixelRatio-.15);slowWindows=0;
        if(missed<=.18){
          qualityProbe={previousRatio:pixelRatio,referenceMean:mean,settle:1};
          canvas.dataset.qualityProbe='testing';
        }else qualityCooldown=2;
      }else if(fastWindows>=10&&pixelRatio<ceiling){
        nextRatio=Math.min(ceiling,pixelRatio+.1);fastWindows=0;qualityCooldown=2;
      }
      // Resizing clears the drawing buffer; draw the same pose immediately so
      // a quality change cannot expose a blank frame.
      if(nextRatio!==pixelRatio){pixelRatio=nextRatio;layout();}
    }
    samples.length=0;sampleDuration=0;
  }
  raf=requestAnimationFrame(tick);
}
function resetPointer(){pointer.initialized=false;pointer.moved=false;pointer.distanceX=0;pointer.distanceY=0;}
function start(){
  cancelAnimationFrame(raf);raf=0;lastFrame=0;motionDelta=0;samples.length=0;sampleDuration=0;
  if(!ready||lost||paused||!inView||document.hidden){
    if(qualityProbe){
      pixelRatio=qualityProbe.previousRatio;qualityProbe=null;qualityCooldown=20;
      if(renderer&&camera&&!lost)layout();
    }
    resetPointer();return;
  }
  raf=requestAnimationFrame(tick);
}
async function initialize(){
  renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();lost=true;fallback('context-lost');});
  canvas.addEventListener('webglcontextrestored',()=>{lost=false;ready=Boolean(renderer&&particles);if(ready){canvas.dataset.status='ready';canvas.classList.add('ready');poster?.classList.add('rendered');layout(false);render();announce();start();}});
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.setClearColor(0x000000);renderer.setPixelRatio(pixelRatio);
  scene=new THREE.Scene();camera=new THREE.OrthographicCamera(0,1,1,0,.1,4000);camera.position.z=2000;
  garden=new THREE.Group();scene.add(garden);
  const loader=new THREE.TextureLoader();
  const [photo,ground,matte]=await Promise.all([loader.loadAsync(new URL('./assets/neuralyn-garden.webp',import.meta.url).href),loader.loadAsync(new URL('./assets/garden-ground-plate.webp',import.meta.url).href),loader.loadAsync(new URL('./assets/garden-vegetation-alpha.webp',import.meta.url).href)]);
  for(const texture of [photo,ground]){texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());}
  photoWidth=photo.image.width;photoHeight=photo.image.height;
  const groundMesh=new THREE.Mesh(new THREE.PlaneGeometry(photoWidth,photoHeight),new THREE.MeshBasicMaterial({map:ground}));groundMesh.position.set(photoWidth/2,photoHeight/2,0);garden.add(groundMesh);
  mist=makeMist();
  createVegetation(photo,matte);
  particles=createWindParticles(garden,{width:photoWidth,height:photoHeight});particles.update(0,0,.5);
  ready=true;layout();render();canvas.classList.add('ready');poster?.classList.add('rendered');canvas.dataset.status='ready';canvas.dataset.engine=`Three.js r${THREE.REVISION}`;canvas.dataset.interactions='0';canvas.dataset.plantMeshes='1';canvas.dataset.deformation='continuous';canvas.dataset.frames='0';announce();start();
}
window.addEventListener('pointermove',onPointer,{passive:true});
window.addEventListener('blur',resetPointer);
window.addEventListener('scroll',()=>{stageRect=stage.getBoundingClientRect();},{passive:true});
window.addEventListener('garden-gust',blow);
window.addEventListener('garden-motion',event=>{paused=Boolean(event.detail?.paused);announce();start();});
reduced.addEventListener('change',()=>{paused=reduced.matches;announce();start();});
document.addEventListener('visibilitychange',()=>{resetPointer();start();});
new ResizeObserver(()=>layout()).observe(stage);narrow.addEventListener('change',()=>layout());
if('IntersectionObserver' in window){
  new IntersectionObserver(entries=>{
    const visible=entries[0].isIntersecting;
    if(visible===inView)return;
    inView=visible;stageRect=stage.getBoundingClientRect();resetPointer();start();
  },{threshold:0}).observe(stage);
}
canvas.dataset.status='loading';canvas.dataset.motion=paused?'paused':'playing';
initialize().catch(error=>{console.warn('Garden uses its static fallback.',error);fallback('initialization-failed');});
