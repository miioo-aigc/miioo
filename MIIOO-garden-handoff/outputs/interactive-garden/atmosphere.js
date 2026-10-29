import * as THREE from "./vendor/three.module.js";

// Layered translucent mist behind the living plants, in photo coordinates.
export function createAtmosphere(){
 const clock={value:0};
 const material=new THREE.ShaderMaterial({
  transparent:true,depthWrite:false,uniforms:{mistTime:clock},
  vertexShader:`varying vec2 mistUv;void main(){mistUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
  fragmentShader:`
   varying vec2 mistUv;uniform float mistTime;
   float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
   float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
   float fbm(vec2 p){float n=0.0,a=.5;for(int i=0;i<4;i++){n+=noise(p)*a;p=p*2.03+vec2(17.3,9.2);a*=.5;}return n;}
   void main(){
    vec2 uv=mistUv;float t=mistTime;
    float side=tanh((uv.x-.5)*6.0);
    // Smooth outward advection avoids a seam where the two flows meet.
    float drift=sin(t*.055)*.10;
    vec2 flow=vec2(uv.x-side*drift,uv.y+t*.002);
    float broad=fbm(flow*vec2(6.0,8.0));
    float wisps=fbm(flow*vec2(15.0,12.0)+vec2(side*sin(t*.04)*.2,-t*.006)+broad*.8);
    float fine=fbm(uv*vec2(28.0,23.0)+vec2(-side*sin(t*.035)*.3,t*.004));
    float center=exp(-pow((uv.x-.51)/.24,2.0)-pow((uv.y-.53)/.12,2.0));
    float ribbonY=.47+.035*sin(uv.x*13.0-t*.12);
    float wings=exp(-pow((uv.x-.51)/.36,2.0)-pow((uv.y-ribbonY)/.055,2.0));
    float mask=smoothstep(.27,.40,uv.y)*(1.0-smoothstep(.73,.88,uv.y));
    float breath=.68+.20*sin(t*.43)+.12*sin(t*.19+1.4);
    float gaps=smoothstep(.34,.62,broad*.35+wisps*.65);
    float density=(center*.17+wings*.18)*gaps*mask*breath;
    vec3 tint=mix(vec3(.13,.21,.22),vec3(.35,.47,.48),fine*.6+wisps*.4);
    float glow=exp(-pow((uv.x-.51)/.18,2.0)-pow((uv.y-.53)/.18,2.0));
    tint+=vec3(.23,.28,.265)*glow;
    gl_FragColor=vec4(tint,density);
    #include <colorspace_fragment>
   }`,
 });
 const mesh=new THREE.Mesh(new THREE.PlaneGeometry(1536,1024),material);
 mesh.position.z=8;mesh.name="layered-outward-mist";
 return {mesh,update(time){clock.value=time;}};
}
