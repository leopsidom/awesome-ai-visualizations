import * as THREE from "three";

/**
 * House dust hanging in the window light. One `Points` system, moved entirely in
 * the vertex shader from a per-point seed, so the CPU touches a single uniform
 * per frame however many motes there are.
 *
 * Additive and warm: dust is only ever visible backlit, so it reads against the
 * dark lower half of the backdrop and quietly disappears against the bright top,
 * which is what real dust does.
 */

const FIELD = { radius: 26, height: 17, base: -1.5 };

export function createMotes(rng, { count = 900 } = {}) {
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

    size[i] = rng.range(1.1, 3.4);
    speed[i] = rng.range(0.05, 0.22);
    seed[i] = rng();
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(base, 3));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
  geometry.setAttribute("aSpeed", new THREE.BufferAttribute(speed, 1));
  geometry.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
  // Points move in the shader, so the static bounds have to be declared by hand.
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), FIELD.radius * 1.6);

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(0xffe6b8) },
      uOpacity: { value: 0.5 },
      uHeight: { value: FIELD.height },
      uBase: { value: FIELD.base },
      uViewHeight: { value: 800 },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uHeight;
      uniform float uBase;
      uniform float uViewHeight;

      attribute float aSize;
      attribute float aSpeed;
      attribute float aSeed;

      varying float vSeed;

      void main() {
        vec3 pos = position;

        // Wrap through the slab: mod() keeps the drift seamless.
        pos.y = uBase + mod(position.y + uTime * aSpeed, uHeight);

        // Lazy convection — dust in a still room never travels in a line.
        float swirl = uTime * 0.09 + aSeed * 6.2831;
        pos.x += sin(swirl) * (0.4 + aSeed * 1.4);
        pos.z += cos(swirl * 0.79) * (0.4 + aSeed * 1.4);

        vec4 mv = viewMatrix * modelMatrix * vec4(pos, 1.0);
        vSeed = aSeed;

        gl_PointSize = aSize * (uViewHeight * 0.0016) * (14.0 / max(1.0, -mv.z));
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uColor;
      uniform float uOpacity;

      varying float vSeed;

      void main() {
        // Round, soft-edged sprite — no texture needed.
        float d = length(gl_PointCoord - 0.5);
        float disc = smoothstep(0.5, 0.06, d);
        if (disc <= 0.001) discard;

        // A slow flicker as each mote tumbles through the light.
        float flicker = 0.55 + 0.45 * sin(uTime * 1.3 + vSeed * 52.0);

        gl_FragColor = vec4(uColor, disc * uOpacity * flicker);
      }
    `,
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;

  return {
    object: points,

    update(time) {
      material.uniforms.uTime.value = time;
    },

    /** Point size is in pixels, so it has to track the drawing buffer height. */
    setViewportHeight(height) {
      material.uniforms.uViewHeight.value = height;
    },

    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
