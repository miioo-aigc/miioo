// A photographic garden with GPU wind. The moss stays still; vegetation bends
// around its roots. Two draw calls, no per-frame geometry rebuilds or libraries.
const canvas = document.querySelector('#garden-canvas');
const stage = document.querySelector('#garden-stage');
const poster = document.querySelector('#garden-poster');
const preference = matchMedia('(prefers-reduced-motion: reduce)');
const narrow = matchMedia('(max-width: 700px)');
let paused = preference.matches;
let ready = false, lost = false, frame = 0, previous = 0, time = 0;
let width = 1, height = 1, imageWidth = 16, imageHeight = 9;
let ratio = Math.min(devicePixelRatio || 1, 1.5), quality = 1;
let drawScene, resizeGL;
let pointerX = -2, pointerY = -2, pointerPresence = 0;
let lastX = 0, lastY = 0, lastPointerTime = 0, pulseIndex = 0, pulseCount = 0;
const pulses = new Float32Array(32);
for (let i = 0; i < 8; i++) pulses[i * 4 + 3] = 10;
const bounds = { left: 0, top: 0, width: 1, height: 1 };
const imageRect = new Float32Array(4);
const frameTimes = [];
let slowWindows = 0, fastWindows = 0;
const vegetation = [
  [.221,.87,.38,.062,.8,.0072], [.114,.87,.43,.063,2.1,.0052],
  [.057,.88,.51,.074,4.4,.0062], [.178,.87,.43,.043,3.0,.0042],
  [.294,.89,.61,.084,1.4,.0026], [.397,.93,.75,.062,3.2,.0024],
  [.561,.96,.83,.071,1.0,.0031], [.634,.93,.78,.059,2.5,.0028],
  [.739,.91,.65,.073,5.3,.0028], [.851,.91,.44,.076,3.8,.0064],
  [.933,.94,.42,.061,1.9,.0053], [.978,.95,.67,.05,4.7,.0048],
];
const bends = new Float32Array(vegetation.length);

function announce() {
  window.dispatchEvent(new CustomEvent('garden-state', {
    detail: { paused, reduced: preference.matches, available: ready && !lost },
  }));
}

function setFallback(reason) {
  ready = false;
  cancelAnimationFrame(frame);
  canvas.dataset.status = 'fallback';
  canvas.dataset.reason = reason;
  canvas.classList.remove('ready');
  poster?.classList.remove('rendered');
  announce();
}

function layout() {
  const box = stage.getBoundingClientRect();
  bounds.left = box.left; bounds.top = box.top;
  width = bounds.width = Math.max(1, box.width);
  height = bounds.height = Math.max(1, box.height);
  // Desktop preserves the complete composition. On narrow screens crop the
  // sides instead of squeezing the garden into an unreadable horizontal strip.
  const photoHeight = narrow.matches ? height * .88 : height;
  const scale = (narrow.matches ? Math.max : Math.min)(width / imageWidth, photoHeight / imageHeight);
  imageRect[2] = imageWidth * scale;
  imageRect[3] = imageHeight * scale;
  imageRect[0] = (width - imageRect[2]) * (narrow.matches ? .25 : .5);
  imageRect[1] = height - imageRect[3];
  canvas.width = Math.round(width * ratio * quality);
  canvas.height = Math.round(height * ratio * quality);
  resizeGL?.();
  if (ready) drawScene?.();
}

function pointerMove(event) {
  if (paused || !ready || event.pointerType === 'touch') return;
  const x = (event.clientX - bounds.left - imageRect[0]) / imageRect[2];
  const y = (event.clientY - bounds.top - imageRect[1]) / imageRect[3];
  const now = event.timeStamp;
  const elapsed = now - lastPointerTime;
  if (elapsed > 4 && elapsed < 160 && y > .25 && y < .94 && x > 0 && x < 1) {
    const vx = (x - lastX) / Math.max(.012, elapsed / 1000);
    const vy = (y - lastY) / Math.max(.012, elapsed / 1000);
    const speed = Math.min(2.4, Math.hypot(vx, vy));
    if (speed > .07) {
      const offset = pulseIndex * 4;
      pulses[offset] = x; pulses[offset + 1] = y;
      pulses[offset + 2] = Math.sign(vx || vy || 1) * Math.min(speed, 1.5);
      pulses[offset + 3] = 0;
      pulseIndex = (pulseIndex + 1) % 8;
      canvas.dataset.interactions = String(++pulseCount);
    }
  }
  pointerX = x; pointerY = y; pointerPresence = 1;
  lastX = x; lastY = y; lastPointerTime = now;
}

function updateMetrics(dt) {
  frameTimes.push(dt * 1000);
  if (frameTimes.length < 120) return;
  const sorted = frameTimes.slice().sort((a, b) => a - b);
  const mean = frameTimes.reduce((sum, n) => sum + n, 0) / frameTimes.length;
  canvas.dataset.fps = (1000 / mean).toFixed(1);
  canvas.dataset.frameMedian = sorted[60].toFixed(2);
  canvas.dataset.frameP95 = sorted[113].toFixed(2);
  canvas.dataset.pixelRatio = (ratio * quality).toFixed(2);
  // Hysteresis: lower resolution only after sustained slow frames; wait much
  // longer to recover. These are browser frame intervals, not GPU timings.
  if (mean > 25) { slowWindows++; fastWindows = 0; }
  else if (mean < 18) { fastWindows++; slowWindows = 0; }
  else { slowWindows = 0; fastWindows = 0; }
  if (slowWindows >= 2 && quality > .62) {
    quality = Math.max(.62, quality - .18); slowWindows = 0; layout();
  } else if (fastWindows >= 10 && quality < 1) {
    quality = Math.min(1, quality + .12); fastWindows = 0; layout();
  }
  frameTimes.length = 0;
}

function updateBends() {
  const weather = .48 + .30 * Math.sin(time * .43) + .22 * Math.sin(time * .19 + 1.7);
  for (let i = 0; i < vegetation.length; i++) {
    const [x, root, head, , phase, amount] = vegetation[i];
    let gust = 0;
    for (let j = 0; j < 8; j++) {
      const offset = j * 4, age = pulses[offset + 3];
      if (age > 2) continue;
      const dx = (x - pulses[offset]) / .115;
      const dy = (head - pulses[offset + 1]) / .23;
      const stemY = (head + (root - head) * .46 - pulses[offset + 1]) / .18;
      const exposure = Math.max(Math.exp(-dx * dx - dy * dy), .7 * Math.exp(-dx * dx - stemY * stemY));
      gust += exposure * Math.sin(age * 10) * Math.exp(-age * 4.4) * pulses[offset + 2];
    }
    const ambient = (Math.sin(time * 1.15 + phase) * .56 + Math.sin(time * 2.17 + phase * 1.3) * .19) * (.42 + weather) * amount;
    bends[i] = ambient + Math.max(-1, Math.min(1, gust)) * .013;
  }
}

function tick(timestamp) {
  frame = 0;
  if (!ready || lost || paused || document.hidden) return;
  const rawDt = previous ? (timestamp - previous) / 1000 : 1 / 60;
  const dt = Math.min(rawDt, .05);
  previous = timestamp; time += dt;
  for (let i = 0; i < 8; i++) pulses[i * 4 + 3] += dt;
  pointerPresence *= Math.exp(-dt * .8);
  drawScene();
  if (rawDt > .001 && rawDt < .5) updateMetrics(rawDt);
  frame = requestAnimationFrame(tick);
}

function start() {
  cancelAnimationFrame(frame); previous = 0;
  if (ready && !lost && !paused && !document.hidden) frame = requestAnimationFrame(tick);
}

const vertexSource = `
attribute vec2 aPosition;
void main() { gl_Position = vec4(aPosition, 0.0, 1.0); }
`;

const fragmentSource = `
precision highp float;
uniform sampler2D uImage;
uniform vec2 uResolution, uSize;
uniform vec4 uRect;
uniform float uTime, uMotion, uPresence;
uniform vec2 uPointer;
uniform float uBends[12];
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.)),f.x),f.y);
}
float plant(vec2 uv, float rootX, float rootY, float headY, float spread, float bend) {
  float h = clamp((rootY-uv.y)/(rootY-headY), 0.0, 1.0);
  float side = exp(-pow(abs((uv.x-rootX)/spread), 8.0));
  float rooted = h*h*(3.0-2.0*h);
  return side*rooted*bend;
}
void main() {
  vec2 pixel = vec2(gl_FragCoord.x/uResolution.x,1.0-gl_FragCoord.y/uResolution.y)*uSize;
  vec2 uv = (pixel-uRect.xy)/uRect.zw;
  if (uv.x<0.0 || uv.x>1.0 || uv.y<0.0 || uv.y>1.0) { gl_FragColor=vec4(0.,0.,0.,1.); return; }
  float wind = 0.0;
  wind += plant(uv,.221,.87,.38,.062,uBends[0]);
  wind += plant(uv,.114,.87,.43,.063,uBends[1]);
  wind += plant(uv,.057,.88,.51,.074,uBends[2]);
  wind += plant(uv,.178,.87,.43,.043,uBends[3]);
  wind += plant(uv,.294,.89,.61,.084,uBends[4]);
  wind += plant(uv,.397,.93,.75,.062,uBends[5]);
  wind += plant(uv,.561,.96,.83,.071,uBends[6]);
  wind += plant(uv,.634,.93,.78,.059,uBends[7]);
  wind += plant(uv,.739,.91,.65,.073,uBends[8]);
  wind += plant(uv,.851,.91,.44,.076,uBends[9]);
  wind += plant(uv,.933,.94,.42,.061,uBends[10]);
  wind += plant(uv,.978,.95,.67,.05,uBends[11]);
  vec2 sampleUV = uv;
  // Each flower head shares one displacement; pointer motion cannot squeeze
  // its left and right halves in opposite directions. Roots remain fixed.
  sampleUV.x += wind*uMotion;
  vec3 color = texture2D(uImage,clamp(sampleUV,.001,.999)).rgb;
  float centerMoss=exp(-pow(abs((uv.x-.55)/.26),2.0)-pow(abs((uv.y-.89)/.10),2.0));
  color*=1.0+centerMoss*.13;
  float luminance=dot(color,vec3(.2126,.7152,.0722));
  color=mix(vec3(luminance),color,.92);
  // Sparse, dark moving mist. It never covers the headline or washes out the foliage.
  if (uv.y>.42 && uv.y<.91) {
    float mistMask=exp(-pow(abs((uv.x-.51)/.20),2.0)-pow(abs((uv.y-.73)/.13),2.0));
    vec2 flow=uv*vec2(8.,12.)+vec2(-uTime*.045,uTime*.009);
    float mist=noise(flow)*.65+noise(flow*2.13)*.35;
    mist=smoothstep(.38,.76,mist)*mistMask*.04;
    color+=vec3(.24,.43,.45)*mist;
  }
  vec2 pointerDist=(uv-uPointer)*vec2(1.,.72);
  float touchLight=exp(-dot(pointerDist,pointerDist)*55.)*uPresence*uMotion;
  color*=1.0+touchLight*.17;
  gl_FragColor=vec4(color,1.);
}
`;

const pollenVertex = `
precision highp float;
attribute vec4 aSeed;
uniform float uTime, uScale;
uniform vec2 uSize;
uniform vec4 uRect;
varying float vAlpha;
void main() {
  float age=fract(aSeed.z+uTime*(.009+aSeed.w*.004));
  vec2 uv=vec2(aSeed.x+sin(uTime*.23+aSeed.z*30.)*.018,.92-age*.51);
  vec2 p=(uRect.xy+uv*uRect.zw)/uSize;
  gl_Position=vec4(p.x*2.-1.,1.-p.y*2.,0.,1.);
  gl_PointSize=(1.0+aSeed.w*2.2)*uScale;
  vAlpha=sin(age*3.14159)*(.09+aSeed.w*.21);
}
`;
const pollenFragment = `
precision mediump float;
varying float vAlpha;
void main() {
  float distance=length(gl_PointCoord-.5)*2.;
  gl_FragColor=vec4(.75,.79,.69,(1.-smoothstep(.08,1.,distance))*vAlpha);
}
`;

async function initialize() {
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
  if (!gl) { setFallback('webgl-unavailable'); return; }
  const resources = [];
  function program(vertex, fragment) {
    const shaders = [gl.VERTEX_SHADER,gl.FRAGMENT_SHADER].map((type,index) => {
      const shader=gl.createShader(type);
      gl.shaderSource(shader,index===0?vertex:fragment); gl.compileShader(shader);
      if (!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
      return shader;
    });
    const p=gl.createProgram(); shaders.forEach(s=>gl.attachShader(p,s)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    shaders.forEach(s=>gl.deleteShader(s)); resources.push(p); return p;
  }
  function locations(p,names) { return Object.fromEntries(names.map(name=>[name,gl.getUniformLocation(p,name)])); }
  const main=program(vertexSource,fragmentSource);
  const mainU=locations(main,['uImage','uResolution','uSize','uRect','uTime','uMotion','uPresence','uPointer','uBends[0]']);
  const particles=program(pollenVertex,pollenFragment);
  const pollenU=locations(particles,['uTime','uScale','uSize','uRect']);
  const mesh=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,mesh);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
  const mainAttribute=gl.getAttribLocation(main,'aPosition');
  const seeds=new Float32Array(36*4);
  for (let i=0;i<36;i++) {
    seeds[i*4]=.08+((i*.61803398875)%1)*.84;
    seeds[i*4+1]=0; seeds[i*4+2]=(i*.381966)%1; seeds[i*4+3]=(i*.75487)%1;
  }
  const points=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,points); gl.bufferData(gl.ARRAY_BUFFER,seeds,gl.STATIC_DRAW);
  const pointAttribute=gl.getAttribLocation(particles,'aSeed');
  const image=new Image(); image.src=new URL('./assets/neuralyn-garden.webp',import.meta.url).href;
  await image.decode();
  imageWidth=image.naturalWidth; imageHeight=image.naturalHeight;
  const texture=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,texture);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,image);
  resizeGL=()=>gl.viewport(0,0,canvas.width,canvas.height);
  drawScene=()=>{
    updateBends();
    gl.disable(gl.BLEND); gl.useProgram(main);
    gl.bindBuffer(gl.ARRAY_BUFFER,mesh); gl.enableVertexAttribArray(mainAttribute);
    gl.vertexAttribPointer(mainAttribute,2,gl.FLOAT,false,0,0);
    gl.uniform1i(mainU.uImage,0);
    gl.uniform2f(mainU.uResolution,canvas.width,canvas.height);
    gl.uniform2f(mainU.uSize,width,height); gl.uniform4fv(mainU.uRect,imageRect);
    gl.uniform1f(mainU.uTime,time); gl.uniform1f(mainU.uMotion,paused?0:1);
    gl.uniform1f(mainU.uPresence,pointerPresence); gl.uniform2f(mainU.uPointer,pointerX,pointerY);
    gl.uniform1fv(mainU['uBends[0]'],bends); gl.drawArrays(gl.TRIANGLES,0,6);
    gl.disableVertexAttribArray(mainAttribute);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA); gl.useProgram(particles);
    gl.bindBuffer(gl.ARRAY_BUFFER,points); gl.enableVertexAttribArray(pointAttribute);
    gl.vertexAttribPointer(pointAttribute,4,gl.FLOAT,false,0,0);
    gl.uniform1f(pollenU.uTime,time); gl.uniform1f(pollenU.uScale,ratio*quality);
    gl.uniform2f(pollenU.uSize,width,height); gl.uniform4fv(pollenU.uRect,imageRect);
    gl.drawArrays(gl.POINTS,0,36); gl.disableVertexAttribArray(pointAttribute);
  };
  lost=false; ready=true; layout();
  canvas.dataset.status='ready'; canvas.dataset.drawCalls='2'; canvas.dataset.interactions='0';
  canvas.classList.add('ready'); poster?.classList.add('rendered');
  announce(); start();
}

window.addEventListener('pointermove',pointerMove,{passive:true});
window.addEventListener('blur',()=>{lastPointerTime=0;pointerPresence=0;});
document.addEventListener('pointerleave',()=>{lastPointerTime=0;pointerPresence=0;});
window.addEventListener('scroll',()=>{const box=stage.getBoundingClientRect();bounds.top=box.top;bounds.left=box.left;},{passive:true});
window.addEventListener('garden-motion',event=>{
  paused=Boolean(event.detail?.paused);
  for (let i=0;i<8;i++) pulses[i*4+3]=10;
  canvas.dataset.motion=paused?'paused':'playing';
  if (ready) drawScene(); announce(); start();
});
preference.addEventListener('change',()=>{
  paused=preference.matches;
  canvas.dataset.motion=paused?'paused':'playing';
  if (ready) drawScene(); announce(); start();
});
document.addEventListener('visibilitychange',()=>{
  lastPointerTime=0; frameTimes.length=0; start();
});
canvas.addEventListener('webglcontextlost',event=>{
  event.preventDefault(); lost=true; setFallback('context-lost');
});
canvas.addEventListener('webglcontextrestored',()=>{
  initialize().catch(error=>{console.warn('Garden restored to its static image.',error);setFallback('context-restore-failed');});
});
new ResizeObserver(layout).observe(stage);
narrow.addEventListener('change',layout);
canvas.dataset.motion=paused?'paused':'playing';
canvas.dataset.status='loading';
initialize().catch(error=>{
  console.warn('Garden is using its static image.',error);
  setFallback('initialization-failed');
});
