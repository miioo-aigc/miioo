import * as THREE from './vendor/three.module.js';

// Small, double-sided botanical meshes. Both pools are instanced, so falling
// leaves and petals add only two draw calls regardless of the live count.
export function createWindParticles(group, { width, height }) {
  const unit = width / 1672;
  const capacity = 24;
  const dummy = new THREE.Object3D();
  let seed = 0x58ad31f2;
  let spawnClock = .6;
  let visible = true;
  let liveCount = 0;
  let disposed = false;
  const random = () => {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    return (seed >>> 0) / 4294967296;
  };
  const between = (a, b) => a + (b - a) * random();
  const smooth = (a, b, value) => {
    const t = THREE.MathUtils.clamp((value - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };

  function makeGeometry(petal) {
    const positions = [], uvs = [], indices = [];
    const lengthSegments = 14, widthSegments = 6;
    for (let row = 0; row <= lengthSegments; row++) {
      const v = row / lengthSegments;
      const silhouette = Math.pow(Math.max(.00001, Math.sin(Math.PI * v)), petal ? .57 : .88);
      const breadth = silhouette * (petal ? .36 + v * .39 : .58 - v * .14);
      for (let col = 0; col <= widthSegments; col++) {
        const cross = col / widthSegments * 2 - 1;
        const x = cross * breadth + Math.sin(v * Math.PI) * (petal ? .08 : .025);
        const y = (v - .5) * 2;
        // A raised midrib, cupped edges and a gently recurved tip give the
        // silhouettes actual thickness in lighting without extruded boxes.
        const z = Math.sin(v * Math.PI) * (petal ? .11 : .13)
          + cross * cross * Math.sin(v * Math.PI) * (petal ? .20 : .12)
          + Math.pow(v, 4) * (petal ? .18 : -.22);
        positions.push(x, y, z);
        uvs.push(col / widthSegments, v);
      }
    }
    for (let row = 0; row < lengthSegments; row++) {
      for (let col = 0; col < widthSegments; col++) {
        const a = row * (widthSegments + 1) + col, b = a + widthSegments + 1;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    geometry.setAttribute('aOpacity', new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('aTint', new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3).setUsage(THREE.DynamicDrawUsage));
    return geometry;
  }

  function makeMaterial(petal) {
    return new THREE.ShaderMaterial({
      transparent: true,
      side: THREE.DoubleSide,
      forceSinglePass: true,
      depthWrite: false,
      depthTest: false,
      toneMapped: false,
      uniforms: { uPetal: { value: petal ? 1 : 0 } },
      vertexShader: `
        attribute float aOpacity;
        attribute vec3 aTint;
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vTint;
        varying float vOpacity;
        void main() {
          vUv = uv;
          vTint = aTint;
          vOpacity = aOpacity;
          vNormal = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
          gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uPetal;
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vTint;
        varying float vOpacity;
        void main() {
          if (vOpacity < .008) discard;
          vec3 n = normalize(vNormal) * (gl_FrontFacing ? 1.0 : -1.0);
          vec3 key = normalize(vec3(-.45, .74, .82));
          float diffuse = max(dot(n, key), 0.0);
          float transmitted = pow(max(dot(-n, key), 0.0), 1.6);
          float rim = pow(1.0 - abs(n.z), 3.0);
          float edge = abs(vUv.x - .5) * 2.0;
          float midrib = exp(-pow((vUv.x - .5) * 35.0, 2.0));
          float branches = pow(max(0.0, sin(vUv.y * 43.0 - edge * 9.0)), 12.0) * (1.0 - edge);
          float veins = (midrib * .15 + branches * .05) * (1.0 - uPetal);
          float pigment = 1.0 - edge * .19 + veins + sin(vUv.y * 21.0) * .025;
          vec3 light = vec3(.33, .37, .29) + vec3(1.0, .92, .73) * diffuse * .69;
          light += vec3(.55, .61, .28) * transmitted * .22 + vec3(.32, .36, .23) * rim * .14;
          vec3 color = vTint * light * pigment;
          color += vTint * transmitted * (uPetal * .16);
          gl_FragColor = vec4(color, vOpacity);
          #include <colorspace_fragment>
        }
      `,
    });
  }

  const palettes = [
    [0x839344, 0x64792f, 0x9a9950, 0x69844a, 0xa29658].map(hex => new THREE.Color(hex)),
    [0xe8dfc0, 0xf4eacb, 0xe7b34a, 0xd29431, 0xffcc65, 0xd8d5b9].map(hex => new THREE.Color(hex)),
  ];
  const pools = [false, true].map((petal, kind) => {
    const geometry = makeGeometry(petal);
    const material = makeMaterial(petal);
    const mesh = new THREE.InstancedMesh(geometry, material, capacity);
    mesh.count = 0;
    mesh.name = petal ? 'windborne-petals' : 'windborne-leaves';
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.renderOrder = 40 + kind;
    const states = Array.from({ length: capacity }, () => ({}));
    group.add(mesh);
    return { mesh, geometry, material, states, kind, tintDirty: false };
  });

  // Emitter positions coincide with the flowers and leaves in the approved
  // photograph. Most natural debris starts at a plant rather than in the sky.
  const emitters = [
    [.22, .35, 1], [.12, .43, 1], [.17, .58, 1], [.29, .68, 0],
    [.85, .49, 0], [.86, .63, 0], [.93, .68, 1], [.56, .87, 1],
    [.64, .83, 1], [.08, .64, 0], [.76, .77, 0],
  ];

  function spawn(u, v, kind, strength = 0, direction = 1, initialAge = 0) {
    const pool = pools[kind];
    const index = pool.mesh.count;
    if (index >= capacity) return;
    pool.mesh.count++;
    const p = pool.states[index];
    p.opacity = undefined;
    // A resize can render between a burst and the next animation update.
    // Hide the reused slot until its new transform and opacity are ready.
    const opacity = pool.geometry.attributes.aOpacity;
    opacity.setX(index, 0);
    opacity.needsUpdate = true;
    p.age = initialAge;
    p.life = between(6.2, 9.4);
    p.x = (u + between(-.012, .012)) * width;
    p.y = (1 - v + between(-.007, .012)) * height;
    p.z = between(24, 110);
    p.vx = (between(-7, 15) + direction * strength * between(35, 64)) * unit;
    p.vy = (between(20, 44) + strength * between(15, 28)) * unit;
    p.size = (kind ? between(4.8, 8.5) : between(7.5, 12)) * unit;
    p.phase = between(0, Math.PI * 2);
    p.rotationX = between(-1.2, 1.2);
    p.rotationY = between(-1.5, 1.5);
    p.rotationZ = between(-Math.PI, Math.PI);
    p.spinX = between(.45, 1.3) * (random() < .5 ? -1 : 1);
    p.spinY = between(.55, 1.45) * (random() < .5 ? -1 : 1);
    p.spinZ = between(-.9, .9);
    p.buoyancy = (kind ? between(15, 25) : between(5, 16)) * unit;
    if (initialAge) {
      p.x += (between(12, 30) * initialAge) * unit;
      p.y += (between(12, 26) * initialAge) * unit;
    }
    const color = palettes[kind][Math.floor(random() * palettes[kind].length)];
    pool.geometry.attributes.aTint.setXYZ(index, color.r, color.g, color.b);
    pool.tintDirty = true;
    liveCount++;
  }

  // Staggered existing debris makes the first live frame feel alive, while
  // avoiding a synchronized burst when the page is opened.
  for (let i = 0; i < 10; i++) {
    const emitter = emitters[Math.floor(random() * emitters.length)];
    spawn(emitter[0], emitter[1], emitter[2], 0, 1, between(.8, 4.5));
  }

  function update(time, dt, wind = .5) {
    if (disposed || !visible) return;
    const step = Math.min(Math.max(dt, 0), .05);
    spawnClock += step;
    if (spawnClock >= .72 && liveCount < 19) {
      spawnClock %= .72;
      const emitter = emitters[Math.floor(random() * emitters.length)];
      spawn(emitter[0], emitter[1], emitter[2]);
    }
    const breeze = THREE.MathUtils.clamp(wind, -2.5, 2.5);
    for (const pool of pools) {
      const opacity = pool.geometry.attributes.aOpacity;
      let opacityDirty = false;
      let matrixDirty = false;
      for (let i = 0; i < pool.mesh.count;) {
        const p = pool.states[i];
        p.age += step;
        if (p.age >= p.life || p.x < -60 * unit || p.x > width + 60 * unit || p.y > height + 50 * unit) {
          // Keep active instances contiguous. A removed slot is never drawn,
          // and the moved particle is fully updated before the next render.
          const last = --pool.mesh.count;
          liveCount--;
          if (i !== last) {
            const tint = pool.geometry.attributes.aTint;
            pool.states[i] = pool.states[last];
            pool.states[last] = p;
            pool.states[i].opacity = undefined;
            tint.setXYZ(i, tint.getX(last), tint.getY(last), tint.getZ(last));
            pool.tintDirty = true;
          }
          continue;
        }
        const flowX = (breeze * 29 + Math.sin(time * 1.3 + p.phase) * 10) * unit;
        const flowY = p.buoyancy + (Math.sin(time * 1.7 + p.phase * 1.4) * 9 - p.age * .45) * unit;
        p.vx += (flowX - p.vx) * step * .82;
        p.vy += (flowY - p.vy) * step * .72;
        p.x += p.vx * step;
        p.y += p.vy * step;
        const entrance = smooth(0, .28, p.age);
        const exit = 1 - smooth(p.life - 1.7, p.life, p.age);
        const alpha = entrance * exit * (pool.kind ? .87 : .90);
        if (alpha !== p.opacity) {
          opacity.setX(i, alpha);
          p.opacity = alpha;
          opacityDirty = true;
        }
        const flutter = Math.sin(time * 3.7 + p.phase) * .25;
        dummy.position.set(p.x, p.y, p.z + Math.sin(time * .8 + p.phase) * 12 * unit);
        dummy.rotation.set(
          p.rotationX + p.age * p.spinX + flutter,
          p.rotationY + p.age * p.spinY,
          p.rotationZ + p.age * p.spinZ + Math.sin(time * 1.5 + p.phase) * .18,
        );
        // Fade only at the end; a leaf never turns into a billboard or point.
        dummy.scale.setScalar(p.size * (.94 + entrance * .06));
        dummy.updateMatrix();
        pool.mesh.setMatrixAt(i, dummy.matrix);
        matrixDirty = true;
        i++;
      }
      if (opacityDirty) opacity.needsUpdate = true;
      if (matrixDirty) pool.mesh.instanceMatrix.needsUpdate = true;
      if (pool.tintDirty) {
        pool.geometry.attributes.aTint.needsUpdate = true;
        pool.tintDirty = false;
      }
    }
  }

  return {
    update,
    burst(u, v, strength, direction = 1) {
      if (disposed || !visible) return;
      const force = THREE.MathUtils.clamp(Number(strength) || 0, 0, 2);
      const count = force > .95 ? 4 : force > .35 ? 3 : 2;
      for (let i = 0; i < count && liveCount < 36; i++) {
        spawn(THREE.MathUtils.clamp(u, .015, .985), THREE.MathUtils.clamp(v, .25, .94), random() < .52 ? 0 : 1, force, Math.sign(direction) || 1);
      }
      // Matrix updates remain owned by the main animation loop.
    },
    setVisible(value) {
      visible = Boolean(value);
      for (const pool of pools) pool.mesh.visible = visible;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const pool of pools) {
        group.remove(pool.mesh);
        pool.geometry.dispose();
        pool.material.dispose();
      }
      liveCount = 0;
    },
    get activeCount() { return liveCount; },
  };
}
