import * as THREE from "three";
import { NOISE2 } from "./glsl.js";

/**
 * Aurora: a few tall curtains bent onto an arc low in the northern sky. Each is
 * a flat plane wrapped onto a cylinder in the vertex shader (with a slow sway),
 * lit by vertical fbm "rays" that fade from green at the base to violet at the
 * top. Additive and fixed to the observer, not the star wheel.
 */
export function createAurora(rng, shared) {
  const group = new THREE.Group();
  const materials = [];
  const geometries = [];

  const baseAngle = rng.range(0, Math.PI * 2); // which way the curtains face
  const ribbons = 3;

  for (let i = 0; i < ribbons; i++) {
    const geometry = new THREE.PlaneGeometry(1, 1, 160, 16);
    geometries.push(geometry);

    const material = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: shared.uTime,
        uA0: { value: baseAngle + rng.range(-0.5, 0.5) },
        uArc: { value: rng.range(1.6, 2.4) },
        uRadius: { value: 150 + i * 16 },
        uBottom: { value: rng.range(6, 12) },
        uHeight: { value: rng.range(34, 52) },
        uSeed: { value: rng.range(0, 20) },
        uSpeed: { value: rng.range(0.05, 0.12) },
        uLow: { value: new THREE.Color(0x2bff9a) },
        uHigh: { value: new THREE.Color(0x7a5cff) },
        uStrength: { value: rng.range(0.35, 0.6) },
      },
      vertexShader: /* glsl */ `
        uniform float uTime;
        uniform float uA0;
        uniform float uArc;
        uniform float uRadius;
        uniform float uBottom;
        uniform float uHeight;
        uniform float uSeed;

        varying vec2 vUv;

        void main() {
          vUv = uv;
          float ang = uA0 + uv.x * uArc;

          // Gentle depth breathing and a lateral sway of the whole curtain.
          float rad = uRadius + sin(uv.x * 6.0 + uTime * 0.25 + uSeed) * 3.0;
          float sway = sin(uv.x * 3.0 - uTime * 0.2 + uSeed) * 0.04;
          ang += sway;

          float y = uBottom + uv.y * uHeight;
          vec3 pos = vec3(cos(ang) * rad, y, sin(ang) * rad);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        ${NOISE2}

        uniform float uTime;
        uniform float uSpeed;
        uniform float uSeed;
        uniform vec3 uLow;
        uniform vec3 uHigh;
        uniform float uStrength;

        varying vec2 vUv;

        void main() {
          // Vertical envelope: soft at both ends, brightest low.
          float fadeUp = smoothstep(1.0, 0.15, vUv.y);
          float fadeBottom = smoothstep(0.0, 0.1, vUv.y);
          float env = fadeUp * fadeBottom;

          // Drifting vertical rays.
          float drift = uTime * uSpeed;
          float folds = fbm2(vec2(vUv.x * 5.0 + uSeed, drift));
          float rays = fbm2(vec2(vUv.x * 26.0 + folds * 2.0, vUv.y * 1.2 - drift));
          float curtain = smoothstep(0.35, 0.8, rays);

          float alpha = env * curtain * uStrength;
          if (alpha < 0.002) discard;

          float mixT = clamp(pow(vUv.y, 1.3) + folds * 0.15, 0.0, 1.0);
          vec3 color = mix(uLow, uHigh, mixT);
          gl_FragColor = vec4(color, alpha);
        }
      `,
    });
    materials.push(material);

    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = -3;
    mesh.frustumCulled = false;
    group.add(mesh);
  }

  return {
    group,
    dispose() {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
    },
  };
}
