import * as THREE from "./vendor/three.module.js";

// Shared deterministic surface maps, in each individual leaf/petal’s coordinates.
// DataTexture keeps the model exporter independent of browser canvas APIs.
const cache = new Map();
function surface(kind) {
 if (cache.has(kind)) return cache.get(kind);
 const w=128,h=256, pigment=new Uint8Array(w*h*4),relief=new Uint8Array(w*h*4);
 let seed=91827;
 const noise=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const u=x/(w-1),v=y/(h-1),d=Math.abs(u-.5)*2,n=noise()-.5;
  const rib=Math.exp(-Math.pow((u-.5)*95,2));
  const branching=Math.pow(Math.max(0,Math.cos((v-d*.34)*Math.PI*30)),18);
  const veins=kind==="strap"?Math.pow(.5+.5*Math.cos(u*95+Math.sin(v*7)*.3),8)*.24:(kind==="leaf"||kind==="strap")?rib*.55+branching*.16:Math.pow(.5+.5*Math.cos(u*83+Math.sin(v*9)*.65),12)*.24;
  const mottling=Math.sin(u*27+v*17)*Math.sin(v*43-u*11)*.025;
  const shade=(kind==="leaf"||kind==="strap")?.76+v*.10+veins*.16+mottling+n*.035:.87+.10*v+veins*.12+mottling*.5+n*.02;
  const channels=(kind==="leaf"||kind==="strap")?[shade*.94,shade,shade*.87]:[shade,shade,shade*.98];
  const i=(y*w+x)*4;
  for(let c=0;c<3;c++)pigment[i+c]=Math.round(Math.min(1,channels[c])*255);
  pigment[i+3]=255;
  const bump=Math.round(128+veins*70+n*7);
  relief[i]=bump;relief[i+1]=Math.round(((kind==="leaf"||kind==="strap")?.63:.8)*255+n*9);relief[i+2]=bump;relief[i+3]=255;
 }
 function tex(data,srgb=false){const t=new THREE.DataTexture(data,w,h);t.colorSpace=srgb?THREE.SRGBColorSpace:THREE.NoColorSpace;t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;t.needsUpdate=true;return t;}
 const result={map:tex(pigment,true),detail:tex(relief)};cache.set(kind,result);return result;
}

export function botanicalMaterial(kind) {
 const leaf=kind==="leaf"||kind==="strap",maps=surface(kind);
 const material=new THREE.MeshPhysicalMaterial({
  vertexColors:true,side:THREE.DoubleSide,metalness:0,
  map:maps.map,roughnessMap:maps.detail,bumpMap:maps.detail,bumpScale:leaf?.16:.075,
  roughness:leaf?.9:1,sheen:leaf?.12:.22,sheenRoughness:.85,
  sheenColor:new THREE.Color(leaf?"#a5bc6c":"#f0dfc2"),
 });
 material.onBeforeCompile=shader=>{
  shader.vertexShader="varying vec2 botanicalUv;\n"+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace("#include <uv_vertex>","#include <uv_vertex>\nbotanicalUv=uv;");
  shader.fragmentShader="varying vec2 botanicalUv;\n"+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace("#include <opaque_fragment>",`
   // Thin tissue backlighting, evaluated from actual scene lights in view space.
   // This is a surface scattering approximation, not volumetric transmission.
   float tissue=${leaf?"0.16":"0.30"} * mix(0.45,1.0,smoothstep(0.0,0.65,botanicalUv.y));
   tissue*=mix(1.0,0.65,pow(abs(botanicalUv.x-0.5)*2.0,3.0));
   #if NUM_DIR_LIGHTS > 0
   for(int lightIndex=0;lightIndex<NUM_DIR_LIGHTS;lightIndex++){
    float backLight=pow(max(0.0,dot(-normal,directionalLights[lightIndex].direction)),1.5);
    outgoingLight+=diffuseColor.rgb*directionalLights[lightIndex].color*backLight*tissue;
   }
   #endif
   #include <opaque_fragment>
  `);
 };
 material.customProgramCacheKey=()=>"botanical-tissue-v1-"+kind;
 return material;
}
