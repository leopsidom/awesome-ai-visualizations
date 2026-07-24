import * as THREE from "three";

/**
 * The star field: a single `Points` system whose ~6,000 stars twinkle, vary in
 * colour by temperature, and scale with distance in the vertex shader. Nothing
 * here moves on the CPU — the whole field is handed to the celestial group,
 * which wheels it slowly around the pole.
 *
 * `makeStarMaterial` and `assembleStars` are exported so the Milky Way band can
 * reuse the exact same shader and buffer layout.
 */

export const STAR_RADIUS = 300;

// Blackbody-ish colour ramp, cool amber → white → hot blue.
const STAR_STOPS = [
  [1.0, 0.71, 0.44],
  [1.0, 0.83, 0.62],
  [1.0, 0.95, 0.86],
  [1.0, 1.0, 1.0],
  [0.84, 0.9, 1.0],
  [0.69, 0.79, 1.0],
];

/** Pick a plausible star colour: a blue-white majority with a warm minority. */
export function sampleStarColor(rng, out = new THREE.Color()) {
  const idx = rng() < 0.14 ? rng() * 2.1 : 2.1 + rng() * 2.9;
  const i = Math.min(Math.floor(idx), STAR_STOPS.length - 2);
  const f = idx - i;
  const a = STAR_STOPS[i];
  const b = STAR_STOPS[i + 1];
  return out.setRGB(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f);
}

/** Uniform point in the shell at STAR_RADIUS. */
function randomDirection(rng, out = new THREE.Vector3()) {
  const u = rng() * 2 - 1;
  const theta = rng() * Math.PI * 2;
  const r = Math.sqrt(1 - u * u);
  return out.set(r * Math.cos(theta), u, r * Math.sin(theta));
}

export function makeStarMaterial(shared) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: shared.uTime,
      uScale: shared.uScale,
    },
    vertexShader: /* glsl */ `
      attribute vec3 aColor;
      attribute float aSize;
      attribute float aBright;
      attribute vec2 aTwinkle; // (phase, speed)

      uniform float uTime;
      uniform float uScale;

      varying vec3 vColor;
      varying float vBright;

      void main() {
        vColor = aColor;

        // Scintillation: a slow shimmer never dropping fully dark.
        float tw = 0.65 + 0.35 * sin(uTime * aTwinkle.y + aTwinkle.x);
        vBright = aBright * tw;

        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = clamp(aSize * uScale / -mv.z, 0.0, 26.0);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying float vBright;

      void main() {
        vec2 pc = gl_PointCoord - 0.5;
        float d = length(pc);
        if (d > 0.5) discard;

        // Sharp core over a soft halo — reads as a point light with glow.
        float core = smoothstep(0.5, 0.0, d);
        float halo = exp(-d * 7.0);
        float a = (core * 0.7 + halo * 0.5) * vBright;

        gl_FragColor = vec4(vColor, a);
      }
    `,
  });
}

/** Wrap parallel attribute arrays into a Points object with the star layout. */
export function assembleStars(count, positions, colors, sizes, brights, twinkles, material) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute("aBright", new THREE.BufferAttribute(brights, 1));
  geometry.setAttribute("aTwinkle", new THREE.BufferAttribute(twinkles, 2));
  geometry.setDrawRange(0, count);
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), STAR_RADIUS * 1.6);

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  return { points, geometry };
}

export function createStars(rng, shared, count = 6000) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const brights = new Float32Array(count);
  const twinkles = new Float32Array(count * 2);

  const dir = new THREE.Vector3();
  const col = new THREE.Color();

  for (let i = 0; i < count; i++) {
    randomDirection(rng, dir);
    positions[i * 3] = dir.x * STAR_RADIUS;
    positions[i * 3 + 1] = dir.y * STAR_RADIUS;
    positions[i * 3 + 2] = dir.z * STAR_RADIUS;

    sampleStarColor(rng, col);
    colors[i * 3] = col.r;
    colors[i * 3 + 1] = col.g;
    colors[i * 3 + 2] = col.b;

    // Many faint, a few brilliant.
    const b = Math.pow(rng(), 3);
    brights[i] = 0.18 + b * 1.3;
    sizes[i] = 0.5 + b * 1.9;

    twinkles[i * 2] = rng() * Math.PI * 2;
    twinkles[i * 2 + 1] = 0.5 + rng() * 2.4;
  }

  const material = makeStarMaterial(shared);
  const { points, geometry } = assembleStars(count, positions, colors, sizes, brights, twinkles, material);

  const group = new THREE.Group();
  group.add(points);

  return {
    group,
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
