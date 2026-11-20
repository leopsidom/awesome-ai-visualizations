import * as THREE from "three";
import { FOG } from "./glsl.js";

/**
 * Two point systems, both animated entirely in the vertex shader:
 *   - marine snow: dull organic debris sinking through the column
 *   - motes: bioluminescent plankton rising in slow helices, twinkling
 * Positions are derived from a per-point seed, so the CPU touches nothing per frame.
 */

const FIELD = { radius: 120, height: 110 };

export function createParticles(rng, fogUniforms) {
  const group = new THREE.Group();

  const snow = createField(rng, fogUniforms, {
    count: 4200,
    sizeRange: [1.0, 2.6],
    speedRange: [0.35, 1.1],
    color: new THREE.Color(0x9fc4d8),
    opacity: 0.42,
    rising: false,
    twinkle: 0.0,
    blending: THREE.NormalBlending,
  });

  const motes = createField(rng, fogUniforms, {
    count: 900,
    sizeRange: [1.8, 5.0],
    speedRange: [0.15, 0.5],
    color: new THREE.Color(0x53ffe0),
    opacity: 1.0,
    rising: true,
    twinkle: 1.0,
    blending: THREE.AdditiveBlending,
  });

  group.add(snow, motes);

  return {
    group,

    update(time) {
      snow.material.uniforms.uTime.value = time;
      motes.material.uniforms.uTime.value = time;
    },

    /** Point size is in pixels, so it has to track the drawing buffer height. */
    setViewportHeight(height) {
      snow.material.uniforms.uViewHeight.value = height;
      motes.material.uniforms.uViewHeight.value = height;
    },

    dispose() {
      for (const field of [snow, motes]) {
        field.geometry.dispose();
        field.material.dispose();
      }
    },
  };
}

function createField(rng, fogUniforms, options) {
  const { count, sizeRange, speedRange, color, opacity, rising, twinkle, blending } = options;

  const base = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const speed = new Float32Array(count);
  const seed = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    // sqrt keeps the disc evenly filled instead of clumping at the centre.
    const radius = Math.sqrt(rng()) * FIELD.radius;
    const angle = rng.range(0, Math.PI * 2);

    base[i * 3 + 0] = Math.cos(angle) * radius;
    base[i * 3 + 1] = rng.range(0, FIELD.height);
    base[i * 3 + 2] = Math.sin(angle) * radius;

    size[i] = rng.range(sizeRange[0], sizeRange[1]);
    speed[i] = rng.range(speedRange[0], speedRange[1]);
    seed[i] = rng();
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(base, 3));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
  geometry.setAttribute("aSpeed", new THREE.BufferAttribute(speed, 1));
  geometry.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
  // Points move in the shader, so the static bounds have to be declared by hand.
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), FIELD.radius * 1.5);

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: color },
      uOpacity: { value: opacity },
      uHeight: { value: FIELD.height },
      uRising: { value: rising ? 1 : -1 },
      uTwinkle: { value: twinkle },
      uViewHeight: { value: 800 },
      ...fogUniforms,
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uHeight;
      uniform float uRising;
      uniform float uViewHeight;

      attribute float aSize;
      attribute float aSpeed;
      attribute float aSeed;

      varying float vSeed;
      varying float vDist;

      void main() {
        vec3 pos = position;

        // Wrap through the slab: mod() keeps drift seamless in both directions.
        pos.y = mod(position.y + uRising * uTime * aSpeed, uHeight) - uHeight * 0.35;

        // Lazy horizontal current, plus a helix for the rising motes.
        float swirl = uTime * 0.12 * uRising + aSeed * 6.2831;
        pos.x += sin(swirl) * (0.9 + aSeed * 2.2);
        pos.z += cos(swirl * 0.83) * (0.9 + aSeed * 2.2);

        vec4 mv = viewMatrix * modelMatrix * vec4(pos, 1.0);
        vDist = -mv.z;
        vSeed = aSeed;

        gl_PointSize = aSize * (uViewHeight * 0.0016) * (60.0 / max(1.0, vDist));
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      ${FOG}

      uniform float uTime;
      uniform vec3 uColor;
      uniform float uOpacity;
      uniform float uTwinkle;

      varying float vSeed;
      varying float vDist;

      void main() {
        // Round, soft-edged sprite — no texture needed.
        float d = length(gl_PointCoord - 0.5);
        float disc = smoothstep(0.5, 0.08, d);
        if (disc <= 0.001) discard;

        float pulse = mix(1.0, 0.35 + 0.65 * sin(uTime * 2.2 + vSeed * 40.0), uTwinkle);
        float alpha = disc * uOpacity * pulse * (1.0 - fogAmount(vDist));

        vec3 color = uColor * mix(1.0, 1.6, uTwinkle * pulse);

        gl_FragColor = vec4(color, alpha);
      }
    `,
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  return points;
}
