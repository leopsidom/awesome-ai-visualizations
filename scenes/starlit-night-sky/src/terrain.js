import * as THREE from "three";
import { NOISE2 } from "./glsl.js";

/**
 * The ground: two near-black ridge lines wrapped on cylinders around the
 * observer. The jagged crest is carved in the fragment shader (discard above a
 * per-angle ridge height) rather than in geometry, so a coarse cylinder gives a
 * crisp silhouette. A faint cool rim traces each crest where the sky spills over.
 *
 * Opaque with depth write, so everything in the sky is correctly occluded below
 * the horizon; the nearer ridge sits in front of the farther for parallax depth.
 */
function ridgeLayer(radius, base, amp, freq, seed, tint) {
  // Vertical span runs well below the view up to a modest crest.
  const bottom = -30;
  const top = 24;
  const height = top - bottom;

  const geometry = new THREE.CylinderGeometry(radius, radius, height, 160, 1, true);
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: true,
    uniforms: {
      uBase: { value: base },
      uAmp: { value: amp },
      uFreq: { value: freq },
      uSeed: { value: seed },
      uTint: { value: new THREE.Color(tint) },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      ${NOISE2}

      uniform float uBase;
      uniform float uAmp;
      uniform float uFreq;
      uniform float uSeed;
      uniform vec3 uTint;

      varying vec2 vUv;

      void main() {
        // Two octaves of ridge — broad hills plus finer teeth.
        float a = vUv.x * uFreq + uSeed;
        float ridge = uBase
          + (fbm2(vec2(a, 0.0)) - 0.5) * uAmp
          + (fbm2(vec2(a * 3.1 + 5.0, 0.0)) - 0.5) * uAmp * 0.4;

        if (vUv.y > ridge) discard;

        // Near-black body, a touch of tint lifting toward the crest.
        float rim = smoothstep(ridge - 0.05, ridge, vUv.y);
        vec3 color = vec3(0.006, 0.009, 0.018) + uTint * rim * 0.5;
        color *= 0.5 + 0.5 * smoothstep(0.0, ridge, vUv.y); // slightly darker at the base

        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });

  const mesh = new THREE.Mesh(geometry, material);
  return { mesh, geometry, material };
}

export function createTerrain(rng) {
  const group = new THREE.Group();

  // Far haze-lit ridge, then a darker, taller ridge in front.
  const far = ridgeLayer(105, 0.66, 0.16, rng.range(5, 8), rng.range(0, 20), 0x1a2740);
  const near = ridgeLayer(70, 0.74, 0.26, rng.range(7, 11), rng.range(0, 20), 0x0d1526);

  far.mesh.renderOrder = -2;
  near.mesh.renderOrder = -1;
  group.add(far.mesh, near.mesh);

  return {
    group,
    update() {},
    dispose() {
      far.geometry.dispose();
      far.material.dispose();
      near.geometry.dispose();
      near.material.dispose();
    },
  };
}
