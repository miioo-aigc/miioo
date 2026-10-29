import * as THREE from "./vendor/three.module.js";
import {botanicalMaterial} from "./botanical-materials.js";

// Botanical meshes use root-relative coordinates. No photograph billboards.
export function createPlant(spec, index=0) {
 let seed=347+index*2191;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
 const group=new THREE.Group();group.name=spec.name;
 const buckets={},petalProfiles={},tufts=[],bladeProfiles={};
 const branches=[];let activeBranch=-1;
 function bucket(key){return buckets[key]??= {positions:[],colors:[],uvs:[]};}
 function tri(key,a,b,c,color,variation=.05){
  const data=bucket(key),shade=1+(random()-.5)*variation;
  for(const p of [a,b,c]){data.positions.push(p.x,p.y,p.z);data.colors.push(color.r*shade,color.g*shade,color.b*shade);data.uvs.push(...(p.surfaceUv??[0,0]));(data.branchIds??=[]).push(activeBranch);}
 }
 const color=hex=>new THREE.Color(hex);
 const green=color("#567227"),darkGreen=color("#263e13"),cream=color("#e6e1c7"),pollen=color("#bd8834");
 function tube(points,radius,endRadius,key="stem",tint=green,sides=7){
  const curve=new THREE.CatmullRomCurve3(points),steps=Math.max(5,Math.ceil(curve.getLength()/9));
  const frames=curve.computeFrenetFrames(steps,false);let previous;
  for(let j=0;j<=steps;j++){
   const t=j/steps,center=curve.getPointAt(t),r=THREE.MathUtils.lerp(radius,endRadius,Math.pow(t,.8))*(1+.035*Math.sin(t*13)),ring=[];
   for(let k=0;k<sides;k++){const a=k/sides*Math.PI*2,ridge=key==="stem"?1+.035*Math.cos(a*5+t*.7):1;ring.push(center.clone().addScaledVector(frames.normals[j],Math.cos(a)*r*ridge).addScaledVector(frames.binormals[j],Math.sin(a)*r*.91*ridge));}
   if(previous)for(let k=0;k<sides;k++){const n=(k+1)%sides;tri(key,previous[k],ring[k],ring[n],tint);tri(key,previous[k],ring[n],previous[n],tint);}
   previous=ring;
  }
 }
 function ball(center,r,key,tint,flatten=1){
  const geo=new THREE.IcosahedronGeometry(r,r<1?0:1),a=geo.attributes.position;
  for(let j=0;j<a.count;j+=3){const pts=[];for(let k=0;k<3;k++)pts.push(V(a.getX(j+k),a.getY(j+k)*flatten,a.getZ(j+k)).add(center));tri(key,...pts,tint,.15);}
  geo.dispose();
 }
 function leaf(base,angle,length,width,serrated=false){
  const direction=V(Math.cos(angle),Math.sin(angle),.13+(random()-.5)*.4).normalize(),side=V(-direction.y,direction.x,.1).normalize();
  const rows=18,cols=6,points=[];
  for(let j=0;j<=rows;j++){
   const t=j/rows,row=[],notch=serrated?(j%3===1?.57:1):1;
   for(let k=0;k<=cols;k++){const u=k/cols*2-1;const p=base.clone().addScaledVector(direction,length*t).addScaledVector(side,width*Math.pow(Math.sin(Math.PI*t),.8)*u*notch);p.z+=Math.sin(t*Math.PI)*length*.12+Math.abs(u)*width*.17;row.push(p);}
   row.forEach((p,k)=>{p.surfaceUv=[k/cols,t];});points.push(row);
  }
  for(let j=0;j<rows;j++)for(let k=0;k<cols;k++){const tint=green.clone().multiplyScalar(.7+.3*(1-Math.abs(k/cols*2-1)));tri("leaf",points[j][k],points[j+1][k],points[j+1][k+1],tint);tri("leaf",points[j][k],points[j+1][k+1],points[j][k+1],tint);}
  tube([base,base.clone().addScaledVector(direction,length*.5).add(V(0,0,length*.12)),base.clone().addScaledVector(direction,length)],.36,.08,"vein",green.clone().multiplyScalar(1.25),4);
 }
 function petal(center,direction,normal,length,width,tint,key="petal",notch=false){
  const side=new THREE.Vector3().crossVectors(normal,direction).normalize(),rows=length<4?4:14,cols=length<4?2:8,points=[];
  for(let j=0;j<=rows;j++){const t=j/rows,row=[];
   for(let k=0;k<=cols;k++){const u=k/cols*2-1,shape=Math.pow(Math.sin(Math.PI*t),notch?.58:.68);
    const tip=notch?1-.045*Math.exp(-u*u*25)*Math.pow(t,8):1;
    const p=center.clone().addScaledVector(direction,length*t*tip).addScaledVector(side,width*shape*u);
    p.addScaledVector(normal,length*(.12*Math.sin(t*Math.PI)-.11*t*t)+width*.2*u*u*shape+Math.min(.28,length*.025)*Math.cos(u*18)*shape);
    if(key.startsWith("narcissus-petal-")){
     const phase=petalProfiles[key].phase;
     p.addScaledVector(normal,length*(.035*Math.sin(phase)*t*t+.055*Math.sin(phase+u*2)*Math.pow(t,4))+width*.16*u*u*shape);
    }
    row.push(p);
   }row.forEach((p,k)=>{p.surfaceUv=[k/cols,t];});points.push(row);
  }
  const under=points.map(row=>row.map(p=>{const q=p.clone().addScaledVector(normal,-Math.min(.14,length*.025));q.surfaceUv=p.surfaceUv;return q;}));
  for(let j=0;j<rows;j++)for(let k=0;k<cols;k++){const t=j/rows,vein=(k%2===0?.97:1.03);const shade=tint.clone().multiplyScalar((.74+.26*Math.sin(t*Math.PI*.7))*vein);tri(key,points[j][k],points[j+1][k],points[j+1][k+1],shade,.025);tri(key,points[j][k],points[j+1][k+1],points[j][k+1],shade,.025);tri(key,under[j][k],under[j+1][k+1],under[j+1][k],shade);tri(key,under[j][k],under[j][k+1],under[j+1][k+1],shade);}
  for(let j=0;j<rows;j++)for(const k of [0,cols]){tri(key,points[j][k],under[j][k],under[j+1][k],tint);tri(key,points[j][k],under[j+1][k],points[j+1][k],tint);}
 }
 const h=spec.root[1]-spec.head[1],dx=spec.head[0]-spec.root[0],head=V(dx,h,0);
 const stemEnd=spec.name==="white-umbel"?head.clone().add(V(0,-38,-3)):head;
 const umbelStem=spec.name==="white-umbel",dandelionStem=spec.name==="dandelion";
 const baseRadius=umbelStem?2.25:dandelionStem?2.05:spec.name.includes("orange")?1.35:1.8;
 const stemTint=color(dandelionStem?"#728348":"#637b32");
 tube([V(),V(dx*.2-2.2,h*.3,-2),V(dx*.6+2,h*.7,1),stemEnd],baseRadius,umbelStem?1.25:dandelionStem?1.05:.85,"stem",stemTint,9);
 function daisy(center,radius,orange=false){
  const normal=V(.08,.65,1).normalize(),right=V(1,0,-.08).normalize(),up=new THREE.Vector3().crossVectors(normal,right).normalize();
  const count=orange?8:12,tint=color(orange?"#ffa600":"#eeeada");
  for(let ring=0;ring<(orange?1:2);ring++)for(let j=0;j<count;j++){
   const a=(j+ring*.47+(random()-.5)*.15)/count*Math.PI*2,d=right.clone().multiplyScalar(Math.cos(a)).addScaledVector(up,Math.sin(a));
   const base=center.clone().addScaledVector(normal,ring*.8),n=normal.clone().add(V(0,(random()-.5)*.3,0)).normalize();
   const length=radius*(.78+random()*.3)*(ring?.82:1);
   const key=spec.name==="white-daisy"?`daisy-petal-${ring*count+j}`:"petal";
   if(spec.name==="white-daisy"){
    // Each ray has a fixed attachment and its own bending state.
    const orthogonalNormal=n.clone().addScaledVector(d,-n.dot(d)).normalize();
    petalProfiles[key]={base,direction:d,normal:orthogonalNormal,length,phase:a+ring*1.7,softness:.82+.24*Math.sin(j*2.17+ring),angle:0,velocity:0};
   }
   petal(base,d,n,length,radius*(orange?.32:.16),tint,key,orange);
  }
  ball(center,radius*.19,"center",color(orange?"#854c0f":"#8f7626"),.7);
  for(let j=0;j<(orange?85:160);j++){const a=j*2.39996,r=Math.sqrt((j+.5)/(orange?85:160))*radius*.2;const p=center.clone().addScaledVector(right,Math.cos(a)*r).addScaledVector(up,Math.sin(a)*r).addScaledVector(normal,2.1+Math.sqrt(Math.max(0,1-r*r/(radius*radius*.045)))*1.2);ball(p,orange?.39:.48,"pollen",pollen);}
  for(let j=0;j<7;j++){const a=j/7*Math.PI*2,d=right.clone().multiplyScalar(Math.cos(a)).addScaledVector(up,Math.sin(a));petal(center.clone().addScaledVector(normal,-2),d,normal,radius*.42,radius*.055,darkGreen,"sepal");}
 }
 if(spec.name==="dandelion"){
  ball(head,5,"center",color("#6f653c"));
  const lines=bucket("filament");
  Object.assign(lines,{tuftBase:[],tuftTip:[],tuftPhase:[],hairFlex:[],tuftAngle:[]});
  function line(a,b,tint,tuft,flexA=0,flexB=0){
   for(const [i,p] of [a,b].entries()){
    lines.positions.push(p.x,p.y,p.z);lines.colors.push(tint.r,tint.g,tint.b);
    lines.tuftBase.push(...tuft.base);lines.tuftTip.push(...tuft.tip);
    lines.tuftPhase.push(tuft.phase);lines.hairFlex.push(i?flexB:flexA);lines.tuftAngle.push(0);
   }
  }
  const count=64;
  for(let j=0;j<count;j++){
   const y=1-2*(j+.5)/count,phi=j*2.399963,dir=V(Math.sqrt(1-y*y)*Math.cos(phi),y,Math.sqrt(1-y*y)*Math.sin(phi));
   const radius=34+random()*13,tip=head.clone().addScaledVector(dir,radius);
   tube([head.clone().addScaledVector(dir,5),head.clone().addScaledVector(dir,9)],.19,.11,"seed",color("#7d6944"),4);
   const base=head.clone().addScaledVector(dir,9);
   const tuft={base:base.toArray(),tip:tip.toArray(),direction:dir.clone(),phase:random()*Math.PI*2,softness:.78+random()*.45,angle:0,velocity:0,start:lines.tuftAngle.length};
   line(base,tip,cream.clone().multiplyScalar(.46+random()*.20),tuft);
   const u=new THREE.Vector3().crossVectors(dir,Math.abs(y)>.9?V(1):V(0,1)).normalize(),v=new THREE.Vector3().crossVectors(dir,u);
   for(let k=0;k<10;k++){const a=k/10*Math.PI*2+random()*.1,spread=8+random()*5,end=tip.clone().addScaledVector(dir,4+random()*2).addScaledVector(u,Math.cos(a)*spread).addScaledVector(v,Math.sin(a)*spread);const mid=tip.clone().lerp(end,.52).addScaledVector(dir,1);line(tip,mid,cream,tuft,0,.52);line(mid,end,cream,tuft,.52,1);}
   tuft.count=lines.tuftAngle.length-tuft.start;tufts.push(tuft);
  }
  for(let j=0;j<5;j++)leaf(V(0,3+random()*22,-3),.5+j*.65,38+random()*34,4+random()*3,true);
 }else if(spec.name==="white-umbel"){
  const hub=head.clone().add(V(0,-38,-3));
  ball(hub,2.3,"stem",green,1.5);
  const flowers=[[-29,19,-8,18],[-6,35,-12,18],[19,12,-5,19],[-15,-4,10,22],[19,-23,21,24]];
  for(const [j,f] of flowers.entries()){
   activeBranch=j;branches.push({base:hub.clone(),phase:j*1.73,softness:.85+j*.06,angle:0,velocity:0});
   const c=head.clone().add(V(f[0],f[1],f[2])),n=V(j===0?-.4:j===2?.4:.08,.25,1).normalize();
   const back=c.clone().addScaledVector(n,-4);
   tube([hub,hub.clone().lerp(back,.5).add(V(0,9,-3)),back],1.1,.65,"stem",color("#7b8a46"),9);
   ball(back,1.7,"sepal",green);
   const right=new THREE.Vector3().crossVectors(V(0,1,0),n).normalize(),up=new THREE.Vector3().crossVectors(n,right).normalize();
   for(let k=0;k<6;k++){
    const q=k/6*Math.PI*2+j*.37,d=right.clone().multiplyScalar(Math.cos(q)).addScaledVector(up,Math.sin(q));
    const key="narcissus-petal-"+j+"-"+k,length=f[3]*(.89+random()*.20);
    const direction=d.clone().addScaledVector(n,(k%2?.09:-.04)+Math.sin(j+k)*.045).normalize();
    const normal=n.clone().addScaledVector(direction,-n.dot(direction)).normalize();
    petalProfiles[key]={base:c.clone(),direction,normal,length,phase:q+j*.8,softness:.58+random()*.22,angle:0,velocity:0,windScale:.55};
    petal(c,direction,normal,length,f[3]*(.245+random()*.035),color("#eeeee3"),key);
   }
   const rings=[];
   for(let r=0;r<3;r++){
    const ring=[];
    for(let k=0;k<24;k++){const q=k/24*Math.PI*2;ring.push(c.clone().addScaledVector(n,1+r*1.5).addScaledVector(right,Math.cos(q)*(2+r*.8)).addScaledVector(up,Math.sin(q)*(2+r*.8)));}rings.push(ring);
   }
   for(let r=0;r<2;r++)for(let k=0;k<24;k++){const z=(k+1)%24;tri("corona",rings[r][k],rings[r+1][k],rings[r+1][z],color("#d8b541"));tri("corona",rings[r][k],rings[r+1][z],rings[r][z],color("#e4c44f"));}
   ball(c.clone().addScaledVector(n,1),1.65,"center",color("#6c6228"));
   ball(c.clone().addScaledVector(n,2),.5,"pollen",pollen);
  }
  activeBranch=-1;
  // Basal strap leaves: long parallel sides, shallow channel and tapered tips.
  const blades=[[-23,222,-60,-6,5.8],[-15,275,-24,-12,5.1],[-8,243,15,8,6.2],[0,292,37,-5,5.4],[10,235,66,5,6],[18,265,56,-14,4.8],[-18,185,-77,14,6.3],[6,204,-33,19,5.6],[22,179,88,9,5.5]];
  for(const [j,b] of blades.entries()){
   const bladeKey="blade-"+j,baseY=-5+j%3*3;
   bladeProfiles[bladeKey]={base:V(b[0],baseY,b[3]),length:b[1],phase:j*1.71,angle:0,velocity:0,tip:0,tipVelocity:0};
   const rows=[],unders=[],steps=26,cols=6;
   const tint=color(j%3===0?"#688b42":j%3===1?"#77964d":"#4e7938");
   for(let r=0;r<=steps;r++){
    const t=r/steps,center=V(b[0]+b[2]*Math.pow(t,1.65)+Math.sign(b[2])*12*Math.pow(t,5),baseY+b[1]*t-(j%3===0?49:29)*Math.pow(t,6),b[3]+Math.sin(t*Math.PI)*12);
    const width=b[4]*(.65+.35*Math.sin(t*Math.PI))*(1-Math.pow(t,9));
    const row=[],under=[];
    for(let k=0;k<=cols;k++){
     const u=k/cols*2-1,twist=(j%2?1:-1)*t*.65;
     const p=center.clone().add(V(u*width*Math.cos(twist),-u*width*.12,u*width*Math.sin(twist)+Math.abs(u)*width*.28));
     p.surfaceUv=[k/cols,t];row.push(p);
     const q=p.clone().add(V(0,0,-.18));q.surfaceUv=[k/cols,t];under.push(q);
    }rows.push(row);unders.push(under);
   }
   for(let r=0;r<steps;r++)for(let k=0;k<cols;k++){
    const shade=tint.clone().multiplyScalar(.88+.12*Math.cos((k/cols-.5)*Math.PI));
    tri(bladeKey,rows[r][k],rows[r+1][k],rows[r+1][k+1],shade,.015);
    tri(bladeKey,rows[r][k],rows[r+1][k+1],rows[r][k+1],shade,.015);
    tri(bladeKey,unders[r][k],unders[r+1][k+1],unders[r+1][k],shade,.015);
    tri(bladeKey,unders[r][k],unders[r][k+1],unders[r+1][k+1],shade,.015);
   }
   for(let r=0;r<steps;r++)for(const k of [0,cols]){
    tri(bladeKey,rows[r][k],unders[r][k],unders[r+1][k],tint);
    tri(bladeKey,rows[r][k],unders[r+1][k],rows[r+1][k],tint);
   }
  }
  for(let j=0;j<6;j++)leaf(V(-25+j*10,-5+j%3,12+j%2*5),.45+j*.43,32+j%3*12,2.2,false);
 }else {
  const orange=spec.name.startsWith("orange");daisy(head,orange?(index===3?27:23):38,orange);
  for(let j=0;j<(orange?3:4);j++){const t=.15+j*.13;leaf(V(dx*t,h*t,0),j%2?.58:2.55,(orange?17:27)+random()*12,orange?2.5:4,true);}
 }
 const materials={
  stem:new THREE.MeshStandardMaterial({vertexColors:true,roughness:.51,metalness:0}),
  filament:new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:.65}),
 };
 for(const [key,data] of Object.entries(buckets)){
  const isLeaf=key==="leaf"||key.startsWith("blade-");
  const isPetal=key==="petal"||key.startsWith("daisy-petal-")||key.startsWith("narcissus-petal-");
  const geometry=new THREE.BufferGeometry();geometry.setAttribute("position",new THREE.Float32BufferAttribute(data.positions,3));geometry.setAttribute("color",new THREE.Float32BufferAttribute(data.colors,3));
  if(isLeaf||isPetal)geometry.setAttribute("uv",new THREE.Float32BufferAttribute(data.uvs,2));
  if(key==="filament"){
   for(const [name,size] of Object.entries({tuftBase:3,tuftTip:3,tuftPhase:1,hairFlex:1,tuftAngle:1}))geometry.setAttribute(name,new THREE.Float32BufferAttribute(data[name],size));
   geometry.attributes.tuftAngle.setUsage(THREE.DynamicDrawUsage);
  }
  if(branches.length){
   geometry.setAttribute("branchId",new THREE.Float32BufferAttribute(data.branchIds,1));
   geometry.setAttribute("branchAngle",new THREE.Float32BufferAttribute(data.branchIds.map(()=>0),1).setUsage(THREE.DynamicDrawUsage));
  }
  if(key!=="filament"){
   geometry.computeVertexNormals();
   const attr=geometry.attributes.position,normals=geometry.attributes.normal,sums=new Map(),keys=[];
   for(let j=0;j<attr.count;j++){const k=[attr.getX(j),attr.getY(j),attr.getZ(j)].map(v=>Math.round(v*10000)).join(",");keys.push(k);if(!sums.has(k))sums.set(k,V());sums.get(k).add(V(normals.getX(j),normals.getY(j),normals.getZ(j)));}
   for(const n of sums.values())n.normalize();
   for(let j=0;j<attr.count;j++){const n=sums.get(keys[j]);normals.setXYZ(j,n.x,n.y,n.z);}
  }
  const material=isLeaf||isPetal?botanicalMaterial(isPetal?"petal":key.startsWith("blade-")?"strap":"leaf"):(materials[key]??materials.stem).clone();
  if(key==="corona")material.side=THREE.DoubleSide;
  if(spec.name==="white-umbel"){
   material.roughness=key==="stem"?.72:1;
   if(isPetal){material.bumpScale=.012;material.sheen=.07;material.specularIntensity=.22;}
   // Darken sheltered lower stems progressively instead of uniform black wires.
   if(key==="stem"){
    const colors=geometry.attributes.color,positions=geometry.attributes.position;
    for(let j=0;j<colors.count;j++){
     const light=.86+.14*THREE.MathUtils.smoothstep(positions.getY(j),h-40,h+15);
     colors.setXYZ(j,colors.getX(j)*light,colors.getY(j)*light,colors.getZ(j)*light);
    }
   }
  }
  const mesh=key==="filament"?new THREE.LineSegments(geometry,material):new THREE.Mesh(geometry,material);mesh.name=spec.name+"-"+key;mesh.frustumCulled=false;group.add(mesh);
  if(bladeProfiles[key])mesh.userData.blade=bladeProfiles[key];
  if(key==="filament")mesh.userData.tufts=tufts;
  if(branches.length)mesh.userData.branches=branches;
  if(petalProfiles[key])mesh.userData.petal=petalProfiles[key];
 }
 group.position.set(spec.root[0]-768,512-spec.root[1],20);
 group.userData={...spec,height:h,kind:"botanical-3d"};return group;
}
