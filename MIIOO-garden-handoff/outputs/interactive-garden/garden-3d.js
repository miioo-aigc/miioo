import * as THREE from "./vendor/three.module.js";
import {createPlant} from "./plant-models.js";
import {createAtmosphere} from "./atmosphere.js";

const reduce=matchMedia("(prefers-reduced-motion: reduce)");
const pointer={x:0,y:0,active:false,lastMove:0};
let renderer;
try {
 renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:"high-performance"});
 renderer.setClearColor(0);renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 const canvas=renderer.domElement;
 canvas.setAttribute("role","img");canvas.setAttribute("aria-label","三维植物花园，植物随微风轻摆，鼠标经过时带起一阵强风。");
 document.body.append(canvas);
 const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1,1,1,-1,.1,4000);camera.position.z=1800;
 const group=new THREE.Group();scene.add(group);
 scene.add(new THREE.HemisphereLight(0xb8d7d9,0x243610,.72));
 const key=new THREE.DirectionalLight(0xffe4b8,2.05);key.position.set(-350,650,450);scene.add(key);
 key.castShadow=true;key.shadow.mapSize.set(2048,2048);
 key.shadow.camera.left=-125;key.shadow.camera.right=125;key.shadow.camera.top=125;key.shadow.camera.bottom=-125;
 key.shadow.camera.near=1;key.shadow.camera.far=2000;key.shadow.bias=-.00003;key.shadow.normalBias=.06;
 scene.add(key.target);
 const rim=new THREE.DirectionalLight(0xb5dedb,1.65);rim.position.set(150,300,-400);scene.add(rim);
 const fill=new THREE.DirectionalLight(0x718a9b,.28);fill.position.set(500,50,700);scene.add(fill);
 const loader=new THREE.TextureLoader();
 async function texture(url){const t=await loader.loadAsync(url);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());return t;}
 const specs=await (await fetch("assets/plants.json")).json();
 const textures=await Promise.all([texture("assets/garden-background-v2.png"),]);
 const background=new THREE.Mesh(new THREE.PlaneGeometry(1536,1024),new THREE.MeshBasicMaterial({map:textures[0]}));
 background.material.onBeforeCompile=shader=>{
  shader.fragmentShader=shader.fragmentShader.replace("#include <opaque_fragment>",`
   float centerLight=exp(-pow((vMapUv.x-.51)/.22,2.0)-pow((vMapUv.y-.49)/.24,2.0));
   // The source photograph already contains dense fog. Reduce that baked veil
   // before adding sparse animated wisps; preserve the foreground below it.
   float fogRegion=exp(-pow((vMapUv.x-.51)/.25,2.0)-pow((vMapUv.y-.53)/.17,2.0));
   outgoingLight*=1.0-fogRegion*.60;
   outgoingLight*=1.0+centerLight*.16;
   #include <opaque_fragment>
  `);
 };
 group.add(background);
 const atmosphere=createAtmosphere();group.add(atmosphere.mesh);
 const plants=specs.map((p,i)=>{
  const mesh=createPlant(p,i);group.add(mesh);
  const bend={value:0},height={value:p.root[1]-p.head[1]};
  const petals=[],tufts=[];
  let branches=[];const branchGeometries=[],blades=[];
  const tuftTime={value:0},tuftWind={value:0};let tuftGeometry;
  mesh.traverse(child=>{
   if(!child.material)return;
   const petal=child.userData.petal;
   const blade=child.userData.blade;
   if(blade){blade.uniform={value:0};blade.tipUniform={value:0};blade.gust=0;blades.push(blade);}
   const filament=!!child.userData.tufts;
   const umbel=!!child.userData.branches;
   if(umbel){branches=child.userData.branches;branchGeometries.push(child.geometry);}
   if(filament){tufts.push(...child.userData.tufts);tuftGeometry=child.geometry;}
   if(petal){petal.uniform={value:0};petals.push(petal);}
   const surfaceShader=child.material.onBeforeCompile;
   const surfaceKey=child.material.customProgramCacheKey.bind(child.material);
   child.material.customProgramCacheKey=()=>surfaceKey()+ (blade?"-blade-v1":umbel?(petal?"-umbel-petal-v1":"-umbel-branch-v1"):filament?"-dandelion-tuft-v1":petal?"-independent-petal-v2":"-stem-arc-v2");
   child.material.onBeforeCompile=shader=>{
    surfaceShader.call(child.material,shader,renderer);
    if(blade){
     shader.uniforms.bladeBend=blade.uniform;shader.uniforms.bladeTip=blade.tipUniform;
     shader.uniforms.bladeBase={value:blade.base};shader.uniforms.bladeLength={value:blade.length};
     shader.vertexShader=`uniform float bladeBend,bladeTip,bladeLength;uniform vec3 bladeBase;
      float bladeAngle(float t){return bladeBend*t+bladeTip*t*t*t;}
      vec3 bladeRotate(vec3 p,float a){return vec3(cos(a)*p.x+sin(a)*p.y,-sin(a)*p.x+cos(a)*p.y,p.z);}
      vec3 bendBlade(vec3 p){
       float t=clamp((p.y-bladeBase.y)/bladeLength,0.0,1.0);
       vec3 center=bladeBase;
       for(int k=0;k<8;k++){float u=t*(float(k)+.5)/8.0;float a=bladeAngle(u);center+=vec3(sin(a),cos(a),0.0)*bladeLength*t/8.0;}
       return center+bladeRotate(vec3(p.x-bladeBase.x,0.0,p.z-bladeBase.z),bladeAngle(t));
      }
     `+shader.vertexShader;
    }
    if(umbel){
     shader.uniforms.branchBase={value:branches[0].base};
     shader.vertexShader="attribute float branchId;attribute float branchAngle;uniform vec3 branchBase;\n"+shader.vertexShader;
    }
    if(filament){
     shader.uniforms.tuftTime=tuftTime;shader.uniforms.tuftWind=tuftWind;
     shader.vertexShader=`
      attribute vec3 tuftBase;attribute vec3 tuftTip;
      attribute float tuftAngle;attribute float tuftPhase;attribute float hairFlex;
      uniform float tuftTime;uniform float tuftWind;
      vec3 tuftRotate(vec3 p,vec3 axis,float a){return p*cos(a)+cross(axis,p)*sin(a)+axis*dot(axis,p)*(1.0-cos(a));}
      vec3 bendTuft(vec3 p){
       vec3 direction=normalize(tuftTip-tuftBase);
       vec3 axis=cross(direction,normalize(vec3(1.0,.12,.18)));
       float exposure=length(axis);axis=exposure>.001?axis/exposure:vec3(0.0,0.0,1.0);
       // Attached seed stalk rotates as a unit; the fine free ends flutter separately.
       vec3 local=p-tuftTip;
       float flutter=(sin(tuftTime*22.0+tuftPhase+dot(local,vec3(.31,.17,.23)))
         +.35*sin(tuftTime*31.0+tuftPhase*2.3))*tuftWind*hairFlex*.075;
       local=tuftRotate(local,axis,flutter);
       return tuftBase+tuftRotate(tuftTip-tuftBase+local,axis,tuftAngle*exposure);
      }
     `+shader.vertexShader;
    }
    if(petal){
     shader.uniforms.petalAngle=petal.uniform;
     shader.uniforms.petalBase={value:petal.base};
     shader.uniforms.petalDirection={value:petal.direction};
     shader.uniforms.petalNormal={value:petal.normal};
     shader.uniforms.petalLength={value:petal.length};
     shader.vertexShader=`
      uniform float petalAngle;uniform float petalLength;
      uniform vec3 petalBase;uniform vec3 petalDirection;uniform vec3 petalNormal;
      vec3 petalRotate(vec3 v,float a){
       vec3 axis=normalize(cross(petalDirection,petalNormal));
       return v*cos(a)+cross(axis,v)*sin(a)+axis*dot(axis,v)*(1.0-cos(a));
      }
      vec3 bendPetal(vec3 p){
       vec3 relative=p-petalBase;
       float s=clamp(dot(relative,petalDirection),0.0,petalLength);
       float a=petalAngle*s/petalLength;
       float k=petalAngle/petalLength;
       // Circular centerline keeps length; root is attached, tip is free.
       vec3 centerline=petalDirection*s;
       if(abs(k)>.00001)centerline=petalDirection*sin(a)/k+petalNormal*(1.0-cos(a))/k;
       return petalBase+centerline+petalRotate(relative-petalDirection*s,a);
      }
     `+shader.vertexShader;
    }
    shader.uniforms.plantBend=bend;shader.uniforms.plantHeight=height;
    shader.vertexShader=`uniform float plantBend;uniform float plantHeight;varying float rootShade;
     float stemAngle(float y){return 2.0*plantBend/(plantHeight*plantHeight)*clamp(y,0.0,plantHeight*.72);}
     vec2 stemPosition(float y){
      float a=stemAngle(y);
      float k=2.0*plantBend/(plantHeight*plantHeight);
      if(abs(k)<0.000001)return vec2(0.0,y);
      return vec2((1.0-cos(a))/k,sin(a)/k);
     }
    `+shader.vertexShader;
    shader.fragmentShader="varying float rootShade;\n"+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace("#include <color_fragment>","#include <color_fragment>\ndiffuseColor.rgb*=rootShade;");
    shader.vertexShader=shader.vertexShader.replace("#include <begin_vertex>",`
     #include <begin_vertex>
     ${petal?"transformed=bendPetal(transformed);":""}
     ${filament?"transformed=bendTuft(transformed);":""}
     ${umbel?"if(branchId>-.5){vec3 q=transformed-branchBase;transformed=branchBase+vec3(cos(branchAngle)*q.x+sin(branchAngle)*q.y,-sin(branchAngle)*q.x+cos(branchAngle)*q.y,q.z);}":""}
     rootShade=mix(0.48,1.0,smoothstep(0.0,42.0,position.y));
     float anchor=clamp(position.y,0.0,plantHeight*.72);
     float angle=stemAngle(anchor);
     vec2 local=vec2(transformed.x,transformed.y-anchor);
     transformed.xy=stemPosition(anchor)+vec2(cos(angle)*local.x+sin(angle)*local.y,-sin(angle)*local.x+cos(angle)*local.y);
     ${blade?"transformed=bendBlade(position);":""}
    `);
    shader.vertexShader=shader.vertexShader.replace("#include <beginnormal_vertex>",`
     #include <beginnormal_vertex>
     ${petal?"objectNormal=petalRotate(objectNormal,petalAngle*clamp(dot(position-petalBase,petalDirection)/petalLength,0.0,1.0));":""}
     ${umbel?"if(branchId>-.5)objectNormal.xy=vec2(cos(branchAngle)*objectNormal.x+sin(branchAngle)*objectNormal.y,-sin(branchAngle)*objectNormal.x+cos(branchAngle)*objectNormal.y);":""}
     float normalAngle=stemAngle(position.y);
     objectNormal.xy=vec2(cos(normalAngle)*objectNormal.x+sin(normalAngle)*objectNormal.y,-sin(normalAngle)*objectNormal.x+cos(normalAngle)*objectNormal.y);
     ${blade?"objectNormal=bladeRotate(normal,bladeAngle(clamp((position.y-bladeBase.y)/bladeLength,0.0,1.0)));":""}
    `);
   };
  });
  if(branches.length)mesh.traverse(child=>{
   if(!child.isMesh)return;
   child.castShadow=true;child.receiveShadow=true;
   const depth=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,side:THREE.DoubleSide});
   depth.customProgramCacheKey=()=>child.userData.blade?"blade-depth-v1":child.userData.petal?"umbel-petal-depth-v1":"umbel-wind-depth-v1";
   depth.onBeforeCompile=shader=>{
    // Reuse exactly the visible branch and stem deformation in the shadow pass.
    const fragment=shader.fragmentShader;
    child.material.onBeforeCompile(shader);
    shader.fragmentShader=fragment;
   };
   child.customDepthMaterial=depth;
  });
  return {...p,mesh,bend,petals,tufts,tuftGeometry,tuftTime,tuftWind,branches,branchGeometries,blades,offset:0,velocity:0,gust:0};
 });
 let width=innerWidth,height=innerHeight,scale=1;
 function resetWind(){pointer.active=false;pointer.lastMove=0;for(const p of plants){p.gust=0;for(const b of p.blades)b.gust=0;}}
 function resize(){
  width=innerWidth;height=innerHeight;renderer.setSize(width,height);
  camera.left=-width/2;camera.right=width/2;camera.top=height/2;camera.bottom=-height/2;camera.updateProjectionMatrix();
  scale=Math.max(width/1536,height/1024)*1.015;group.scale.setScalar(scale);group.position.y=(1024*scale-height)/2;
  const umbel=plants.find(p=>p.name==="white-umbel");
  const focus=new THREE.Vector3(umbel.head[0]-768,512-umbel.head[1],20).multiplyScalar(scale).add(group.position);
  key.target.position.copy(focus);
  key.position.copy(focus).add(new THREE.Vector3(-350,650,450));
  key.shadow.camera.left=key.shadow.camera.bottom=-125*scale;
  key.shadow.camera.right=key.shadow.camera.top=125*scale;key.shadow.camera.updateProjectionMatrix();
  resetWind();
 }
 function update(e){
  const x=(e.clientX-width/2-group.position.x)/scale+768;
  const y=512-(height/2-e.clientY-group.position.y)/scale,now=performance.now();
  if(pointer.active&&now-pointer.lastMove<180&&!reduce.matches){
   const dx=x-pointer.x,dy=y-pointer.y,length2=dx*dx+dy*dy;
   const speed=Math.sqrt(length2)/Math.max(.008,(now-pointer.lastMove)/1000);
   if(length2>.01)for(const p of plants){
    const hx=p.head[0]+p.offset,hy=p.head[1];
    const t=THREE.MathUtils.clamp(((hx-pointer.x)*dx+(hy-pointer.y)*dy)/length2,0,1);
    const distance=Math.hypot(hx-pointer.x-t*dx,hy-pointer.y-t*dy);
    const influence=Math.pow(Math.max(0,1-distance/(p.radius*2.1)),1.4);
    const direction=Math.abs(dx)>.3?Math.sign(dx):(Math.sign(hx-x)||1);
    const strength=THREE.MathUtils.clamp(speed/700,0,1);
    const gust=direction*strength*influence*Math.min(34,(p.root[1]-p.head[1])*.16)/Math.sqrt(p.stiffness);
    if(Math.abs(gust)>Math.abs(p.gust))p.gust=gust;
    for(const leaf of p.blades){
     const lx=p.root[0]+leaf.base.x,ly=p.root[1]-leaf.length*.6;
     const u=THREE.MathUtils.clamp(((lx-pointer.x)*dx+(ly-pointer.y)*dy)/length2,0,1);
     const dist=Math.hypot(lx-pointer.x-u*dx,ly-pointer.y-u*dy);
     const local=direction*strength*Math.max(0,1-dist/100)*30;
     if(Math.abs(local)>Math.abs(leaf.gust))leaf.gust=local;
    }
   }
  }
  pointer.x=x;pointer.y=y;pointer.lastMove=now;pointer.active=true;
 }
 canvas.addEventListener("pointermove",update,{passive:true});
 canvas.addEventListener("pointercancel",()=>{pointer.active=false;});
 canvas.addEventListener("pointerleave",()=>{pointer.active=false;});
 window.addEventListener("blur",resetWind);
 window.addEventListener("resize",resize);resize();
 let last=performance.now(),accumulator=0,time=0;
 document.addEventListener("visibilitychange",()=>{last=performance.now();accumulator=0;resetWind();});
 function step(dt){
  time+=dt;
  for(let i=0;i<plants.length;i++){
   const p=plants[i];let target=0;
   if(!reduce.matches){
    const wind=Math.sin(time*.69+i*.32)*6.5+Math.sin(time*1.09+i*.85)*1.8;
    target=wind*Math.min(1,(p.root[1]-p.head[1])/190)/Math.sqrt(p.stiffness)+p.gust;
   }
   const daisy=p.name==="white-daisy";
   const dandelion=p.tufts.length>0;
   const umbel=p.branches.length>0;
   // Short pressure pulse with an underdamped, fast recovery for the daisy.
   const k=(daisy?105:dandelion?82:umbel?74:28)*p.stiffness;
   p.velocity+=((target-p.offset)*k-p.velocity*(daisy?9.5:dandelion?7.8:10.2)*Math.sqrt(p.stiffness))*dt;
   p.offset+=p.velocity*dt;
   for(const petal of p.petals){
    // Directional pressure and different stiffness keep rays from moving in unison.
    const wind=(p.offset*.12+p.gust*1.18)/19*(petal.windScale??1);
    const pressure=wind*(.30+.70*Math.abs(petal.direction.x));
    const flutter=Math.sin(time*16.0+petal.phase*3.1)*Math.min(.055,Math.abs(p.gust)*.0025);
    const targetAngle=reduce.matches?0:THREE.MathUtils.clamp(
     (-pressure*(.65+.35*petal.direction.x*Math.sign(wind))-.07*Math.abs(wind))*petal.softness+flutter,-.62,.62);
    const stiffness=440/petal.softness;
    petal.velocity+=((targetAngle-petal.angle)*stiffness-petal.velocity*17)*dt;
    petal.angle+=petal.velocity*dt;petal.uniform.value=petal.angle;
   }
   for(const tuft of p.tufts){
    const ambient=Math.sin(time*2.8+tuft.phase)*.024+Math.sin(time*5.1+tuft.phase*1.7)*.009;
    const pressure=(p.gust/34*.34-p.velocity*.0011)*tuft.softness;
    const targetAngle=reduce.matches?0:THREE.MathUtils.clamp(pressure+ambient,-.48,.48);
    tuft.velocity+=((targetAngle-tuft.angle)*(340/tuft.softness)-tuft.velocity*13)*dt;
    tuft.angle+=tuft.velocity*dt;
   }
   p.tuftTime.value=reduce.matches?0:time;
   for(const leaf of p.blades){
    const lengthRatio=leaf.length/240;
    const target=reduce.matches?0:(Math.sin(time*.85+leaf.phase*.23)*.045+Math.sin(time*1.4+leaf.phase)*.014+(p.gust*.4+leaf.gust)*.006)*lengthRatio;
    leaf.velocity+=((target-leaf.angle)*(75/lengthRatio)-leaf.velocity*8)*dt;leaf.angle+=leaf.velocity*dt;
    const tipTarget=reduce.matches?0:leaf.angle*.35+leaf.velocity*.025;
    leaf.tipVelocity+=((tipTarget-leaf.tip)*48-leaf.tipVelocity*7)*dt;leaf.tip+=leaf.tipVelocity*dt;
    leaf.uniform.value=leaf.angle;leaf.tipUniform.value=leaf.tip;
    leaf.gust*=Math.exp(-dt/.20);
   }
   for(const b of p.branches){
    const pressure=reduce.matches?0:p.gust*.0035*b.softness-p.velocity*.00035+Math.sin(time*1.6+b.phase)*.008;
    b.velocity+=((pressure-b.angle)*190/b.softness-b.velocity*12)*dt;b.angle+=b.velocity*dt;
   }
   p.tuftWind.value=reduce.matches?0:Math.min(1,.10+Math.abs(p.gust)/34);
   p.gust*=Math.exp(-dt/(daisy?.16:dandelion?.19:umbel?.23:.48));
  }
 }
 function draw(now){
  requestAnimationFrame(draw);if(document.hidden)return;
  accumulator+=Math.min((now-last)/1000,.05);last=now;
  while(accumulator>=1/120){step(1/120);accumulator-=1/120;}
  atmosphere.update(reduce.matches?0:time);
  for(const p of plants){
   p.bend.value=p.offset;
   for(const geometry of p.branchGeometries){
    const ids=geometry.attributes.branchId,angles=geometry.attributes.branchAngle;
    for(let i=0;i<ids.count;i++){const id=ids.getX(i);angles.array[i]=id>=0?p.branches[id].angle:0;}
    angles.needsUpdate=true;
   }
   if(p.tuftGeometry){
    const angles=p.tuftGeometry.attributes.tuftAngle;
    for(const tuft of p.tufts)angles.array.fill(tuft.angle,tuft.start,tuft.start+tuft.count);
    angles.needsUpdate=true;
   }
  }
  renderer.render(scene,camera);
 }
 renderer.render(scene,camera);document.body.dataset.modelCount=String(plants.length);canvas.classList.add("ready");requestAnimationFrame(draw);
 document.body.dataset.garden="botanical-3d-ready";
}catch(error){
 console.error("Garden initialization failed",error);renderer?.domElement.remove();
 const notice=document.querySelector("#notice");notice.textContent="当前显示静态花园，交互暂不可用。";notice.classList.add("visible");
}
