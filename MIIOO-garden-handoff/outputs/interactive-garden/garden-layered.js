import * as THREE from "./vendor/three.module.js";

const reduce=matchMedia("(prefers-reduced-motion: reduce)");
const pointer={x:0,y:0,previousX:0,active:false,down:false,grab:null,origin:0,start:0};
let renderer;
try {
 renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:"high-performance"});
 renderer.setClearColor(0);renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 const canvas=renderer.domElement;
 canvas.setAttribute("role","img");canvas.setAttribute("aria-label","摄影花园，拖动蒲公英、白花或橙花，松开后自然回弹。");
 document.body.append(canvas);
 const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1,1,1,-1,.1,20);camera.position.z=10;
 const group=new THREE.Group();scene.add(group);
 const loader=new THREE.TextureLoader();
 async function texture(url){const t=await loader.loadAsync(url);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());return t;}
 const specs=await (await fetch("assets/plants.json")).json();
 const textures=await Promise.all([texture("assets/garden-background-v2.png"),...specs.map(p=>texture(`assets/${p.name}.png`))]);
 const background=new THREE.Mesh(new THREE.PlaneGeometry(1536,1024),new THREE.MeshBasicMaterial({map:textures[0]}));
 group.add(background);
 const plants=specs.map((p,i)=>{
  const [x,y,w,h]=p.bounds;
  const geometry=new THREE.PlaneGeometry(w,h,16,48),attr=geometry.attributes.position;
  const base=attr.array.slice(),weights=new Float32Array(attr.count);
  for(let j=0;j<attr.count;j++){
   const imageY=y+h/2-base[j*3+1];
   weights[j]=Math.pow(THREE.MathUtils.clamp((p.root[1]-imageY)/(p.root[1]-p.head[1]),0,1.15),1.7);
  }
  const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({map:textures[i+1],transparent:true,depthWrite:false}));
  mesh.position.set(x+w/2-768,512-y-h/2,.1+i*.01);mesh.renderOrder=i+1;mesh.frustumCulled=false;group.add(mesh);
  return {...p,mesh,attr,base,weights,offset:0,velocity:0};
 });
 let width=innerWidth,height=innerHeight,scale=1;
 function release(){pointer.down=false;pointer.grab=null;}
 function resize(){
  width=innerWidth;height=innerHeight;renderer.setSize(width,height);
  camera.left=-width/2;camera.right=width/2;camera.top=height/2;camera.bottom=-height/2;camera.updateProjectionMatrix();
  scale=Math.max(width/1536,height/1024)*1.015;group.scale.setScalar(scale);group.position.y=(1024*scale-height)/2;
  pointer.active=false;release();
 }
 function update(e){
  const x=(e.clientX-width/2-group.position.x)/scale+768;
  if(!pointer.active)pointer.previousX=x;
  pointer.x=x;pointer.y=512-(height/2-e.clientY-group.position.y)/scale;pointer.active=true;
 }
 function nearest(){
  let best=null,dist=Infinity;
  for(const p of plants){const d=Math.hypot(pointer.x-p.head[0]-p.offset,pointer.y-p.head[1]);if(d<p.radius*1.5&&d<dist){best=p;dist=d;}}return best;
 }
 canvas.addEventListener("pointermove",update,{passive:true});
 canvas.addEventListener("pointerdown",e=>{update(e);pointer.down=true;pointer.grab=nearest();pointer.origin=pointer.x;pointer.start=pointer.grab?.offset||0;canvas.setPointerCapture(e.pointerId);});
 canvas.addEventListener("pointerup",release);canvas.addEventListener("lostpointercapture",release);
 canvas.addEventListener("pointercancel",()=>{release();pointer.active=false;});
 canvas.addEventListener("pointerleave",()=>{if(!pointer.down)pointer.active=false;});
 window.addEventListener("blur",()=>{release();pointer.active=false;});
 window.addEventListener("resize",resize);resize();
 let last=performance.now(),accumulator=0,time=0;
 document.addEventListener("visibilitychange",()=>{last=performance.now();accumulator=0;release();pointer.active=false;});
 function step(dt){
  time+=dt;
  const motion=THREE.MathUtils.clamp(pointer.x-pointer.previousX,-20,20);
  for(let i=0;i<plants.length;i++){
   const p=plants[i];let target=0;
   if(!reduce.matches){
    target=Math.sin(time*.65+i*1.6)*1.4/Math.sqrt(p.stiffness);
    if(pointer.grab===p)target+=THREE.MathUtils.clamp(pointer.start+pointer.x-pointer.origin,-65,65);
    else if(pointer.active){
     const dx=pointer.x-p.head[0],dy=pointer.y-p.head[1];
     const influence=Math.max(0,1-Math.hypot(dx,dy)/(p.radius*1.65));
     target+=THREE.MathUtils.clamp(dx*.4+motion*1.4,-30,30)*influence;
    }
   }
   const k=70*p.stiffness;
   p.velocity+=((target-p.offset)*k-p.velocity*9.5*Math.sqrt(p.stiffness))*dt;
   p.offset+=p.velocity*dt;
  }
  pointer.previousX=pointer.x;
 }
 function draw(now){
  requestAnimationFrame(draw);if(document.hidden)return;
  accumulator+=Math.min((now-last)/1000,.05);last=now;
  while(accumulator>=1/120){step(1/120);accumulator-=1/120;}
  for(const p of plants){
   const drop=p.offset*p.offset/(2*Math.max(70,p.root[1]-p.head[1]));
   for(let j=0;j<p.attr.count;j++)p.attr.setXY(j,p.base[j*3]+p.offset*p.weights[j],p.base[j*3+1]-drop*p.weights[j]);
   p.attr.needsUpdate=true;
  }
  renderer.render(scene,camera);
 }
 renderer.render(scene,camera);canvas.classList.add("ready");requestAnimationFrame(draw);
 document.body.dataset.garden="layered-ready";
}catch(error){
 console.error("Garden initialization failed",error);renderer?.domElement.remove();
 const notice=document.querySelector("#notice");notice.textContent="当前显示静态花园，交互暂不可用。";notice.classList.add("visible");
}
