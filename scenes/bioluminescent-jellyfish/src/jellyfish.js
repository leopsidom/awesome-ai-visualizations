import * as THREE from "three";
import { FOG } from "./glsl.js";

/**
 * A colony of jellyfish. Each animal is a Group holding:
 *   - a bell: a hemisphere whose vertices contract and flare in the vertex shader
 *   - tentacles: one LineSegments batch (all strands in a single draw call)
 * Bodies drift on slow orbits; everything else is GPU-side.
 */

const PALETTE = [
  { body: 0x1b6f8c, core: 0x66f5ff }, // arctic cyan
  { body: 0x6b2d8c, core: 0xff7ae0 }, // orchid
  { body: 0x0f7a63, core: 0x74ffc4 }, // sea glass
  { body: 0x8c4a1e, core: 0xffc27a }, // ember
  { body: 0x2a3f9e, core: 0x8fb4ff }, // cobalt
];

export function createColony(rng, fogUniforms, count = 9) {
  const group = new THREE.Group();
  const animals = [];
  const disposables = [];

  for (let i = 0; i < count; i++) {
    const animal = createJellyfish(rng, fogUniforms, disposables);
    group.add(animal.root);
    animals.push(animal);
  }

  return {
    group,

    update(time, delta) {
      for (const animal of animals) animal.update(time, delta);
    },

    dispose() {
      disposables.forEach((d) => d.dispose());
    },
  };
}

function createJellyfish(rng, fogUniforms, disposables) {
  const palette = rng.pick(PALETTE);
  const scale = rng.range(0.7, 2.3);
  const speed = rng.range(0.9, 1.6);
  const phase = rng.range(0, Math.PI * 2);

  const shared = {
    uTime: { value: 0 },
    uPhase: { value: phase },
    uSpeed: { value: speed },
  };

  const root = new THREE.Group();
  root.scale.setScalar(scale);

  const bell = createBell(palette, shared, fogUniforms);
  const tentacles = createTentacles(rng, palette, shared, fogUniforms);
  root.add(bell, tentacles);

  disposables.push(bell.geometry, bell.material, tentacles.geometry, tentacles.material);

  // Orbit parameters — a slow lateral wander plus a vertical bob.
  const orbit = {
    radius: rng.range(6, 52),
    angle: rng.range(0, Math.PI * 2),
    rate: rng.range(0.012, 0.05) * rng.sign(),
    baseY: rng.range(-8, 26),
    bob: rng.range(0.8, 2.6),
    bobRate: rng.range(0.18, 0.42),
    centerX: rng.range(-18, 18),
    centerZ: rng.range(-18, 18),
    spin: rng.range(0.03, 0.12) * rng.sign(),
  };

  return {
    root,

    update(time) {
      shared.uTime.value = time;

      const angle = orbit.angle + time * orbit.rate;
      // The bell pulse also drives a little forward surge in the swim path.
      const surge = Math.max(0, Math.sin(time * speed + phase)) * 0.35;

      root.position.set(
        orbit.centerX + Math.cos(angle) * (orbit.radius + surge),
        orbit.baseY + Math.sin(time * orbit.bobRate + phase) * orbit.bob + surge,
        orbit.centerZ + Math.sin(angle) * (orbit.radius + surge),
      );

      root.rotation.y = -angle + time * orbit.spin;
      root.rotation.z = Math.sin(time * 0.31 + phase) * 0.13;
      root.rotation.x = Math.cos(time * 0.27 + phase) * 0.11;
    },
  };
}

function createBell(palette, shared, fogUniforms) {
  // Hemisphere: uv.y runs 0 at the apex to 1 at the bell margin.
  const geometry = new THREE.SphereGeometry(1, 56, 36, 0, Math.PI * 2, 0, Math.PI * 0.52);

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      ...shared,
      uBody: { value: new THREE.Color(palette.body) },
      uCore: { value: new THREE.Color(palette.core) },
      ...fogUniforms,
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uPhase;
      uniform float uSpeed;

      varying vec2 vUv;
      varying vec3 vNormalW;
      varying vec3 vWorld;

      void main() {
        vUv = uv;

        float margin = smoothstep(0.12, 1.0, uv.y);
        float pulse = sin(uTime * uSpeed + uPhase);

        vec3 pos = position;
        // Contract the rim inward and lift it — the classic jet-propulsion squeeze.
        pos.xz *= 1.0 - 0.24 * pulse * margin;
        pos.y += 0.30 * pulse * margin;
        // Fine ripple travelling down the bell.
        pos += normal * sin(uv.y * 11.0 - uTime * 1.7 + uPhase) * 0.014;

        vNormalW = normalize(mat3(modelMatrix) * normal);

        vec4 world = modelMatrix * vec4(pos, 1.0);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      ${FOG}

      uniform float uTime;
      uniform float uPhase;
      uniform float uSpeed;
      uniform vec3 uBody;
      uniform vec3 uCore;

      varying vec2 vUv;
      varying vec3 vNormalW;
      varying vec3 vWorld;

      void main() {
        vec3 view = normalize(cameraPosition - vWorld);
        float fresnel = pow(1.0 - abs(dot(view, normalize(vNormalW))), 2.2);

        float pulse = 0.5 + 0.5 * sin(uTime * uSpeed + uPhase);
        float ribs = pow(abs(sin(vUv.x * 3.14159265 * 18.0)), 7.0);
        float margin = smoothstep(0.70, 1.0, vUv.y);

        // Translucent jelly: a soft body fill thickest through the dome's shoulder,
        // plus fresnel at grazing angles, ribs, and a bright bell margin.
        float body = 0.35 + 0.65 * smoothstep(0.0, 0.55, vUv.y);

        vec3 color = uBody * (0.55 * body + 0.85 * fresnel);
        color += uCore * ribs * smoothstep(0.08, 0.85, vUv.y) * (0.35 + 0.65 * pulse);
        color += uCore * margin * (0.55 + 0.75 * pulse);
        color += uCore * 0.10 * body * (0.4 + 0.6 * pulse);

        float alpha = 0.18 * body + 0.55 * fresnel + 0.40 * margin + 0.22 * ribs;

        float dist = distance(cameraPosition, vWorld);
        alpha *= 1.0 - fogAmount(dist);

        gl_FragColor = vec4(color, alpha);
      }
    `,
  });

  return new THREE.Mesh(geometry, material);
}

function createTentacles(rng, palette, shared, fogUniforms) {
  const strands = 30;
  const joints = 20; // points per strand
  const segments = joints - 1;

  const positions = new Float32Array(strands * segments * 2 * 3);
  const along = new Float32Array(strands * segments * 2); // 0 at root, 1 at tip
  const seeds = new Float32Array(strands * segments * 2);

  let v = 0;

  for (let s = 0; s < strands; s++) {
    // Two kinds of appendage: thin trailing tentacles at the margin,
    // and a few short thick oral arms near the centre.
    const isOralArm = s % 5 === 0;
    const ringRadius = isOralArm ? rng.range(0.1, 0.32) : rng.range(0.86, 0.99);
    const length = isOralArm ? rng.range(1.6, 2.6) : rng.range(3.2, 6.5);
    const angle = (s / strands) * Math.PI * 2 + rng.range(-0.08, 0.08);
    const seed = rng();

    const rootX = Math.cos(angle) * ringRadius;
    const rootZ = Math.sin(angle) * ringRadius;
    const rootY = isOralArm ? -0.25 : -0.08;

    for (let j = 0; j < segments; j++) {
      for (const k of [j, j + 1]) {
        const t = k / segments;
        positions[v * 3 + 0] = rootX * (1.0 - t * 0.25);
        positions[v * 3 + 1] = rootY - t * length;
        positions[v * 3 + 2] = rootZ * (1.0 - t * 0.25);
        along[v] = t;
        seeds[v] = seed;
        v++;
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aAlong", new THREE.BufferAttribute(along, 1));
  geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      ...shared,
      uCore: { value: new THREE.Color(palette.core) },
      uBody: { value: new THREE.Color(palette.body) },
      ...fogUniforms,
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uPhase;
      uniform float uSpeed;

      attribute float aAlong;
      attribute float aSeed;

      varying float vAlong;
      varying float vSeed;
      varying vec3 vWorld;

      void main() {
        float t = aAlong;
        float slack = t * t;

        vec3 pos = position;

        // Lateral sway, phase-shifted down the strand so it whips rather than swings.
        pos.x += sin(uTime * 1.25 + aSeed * 6.2831 + t * 4.5) * 0.42 * slack;
        pos.z += cos(uTime * 1.05 + aSeed * 5.1 - t * 3.8) * 0.38 * slack;

        // Bell contraction snaps the strands taut, relaxation lets them bunch.
        float pulse = sin(uTime * uSpeed + uPhase);
        pos.y -= pulse * 0.35 * t;

        vAlong = t;
        vSeed = aSeed;

        vec4 world = modelMatrix * vec4(pos, 1.0);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      ${FOG}

      uniform float uTime;
      uniform vec3 uCore;
      uniform vec3 uBody;

      varying float vAlong;
      varying float vSeed;
      varying vec3 vWorld;

      void main() {
        // Light travels down the strand as a slow pulse of colour.
        float travel = pow(abs(sin(vAlong * 7.0 - uTime * 1.1 + vSeed * 6.2831)), 5.0);

        vec3 color = mix(uCore, uBody, vAlong) * (0.35 + 0.65 * travel);
        float alpha = (1.0 - vAlong) * 0.55 + travel * 0.45;

        float dist = distance(cameraPosition, vWorld);
        alpha *= 1.0 - fogAmount(dist);

        gl_FragColor = vec4(color, alpha);
      }
    `,
  });

  return new THREE.LineSegments(geometry, material);
}
