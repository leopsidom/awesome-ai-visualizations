import * as THREE from "three";
import { NOISE3 } from "./glsl.js";

/**
 * The atmosphere: a large inverted sphere carrying a vertical gradient from a
 * deep zenith to a slightly lifted horizon, plus one directional airglow low on
 * the horizon (roughly under the moon) and a faint band of high cloud.
 *
 * Fixed to the observer — it does NOT wheel with the stars — so the horizon
 * glow stays put while the constellations turn overhead.
 */
export function createSky(rng) {
  const geometry = new THREE.SphereGeometry(500, 48, 32);

  // A warm/cool airglow direction sitting just above the horizon.
  const glowAngle = rng.range(0, Math.PI * 2);
  const glowDir = new THREE.Vector3(Math.cos(glowAngle), 0.06, Math.sin(glowAngle)).normalize();

  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uZenith: { value: new THREE.Color(0x03040d) },
      uHorizon: { value: new THREE.Color(0x0b1430) },
      uGlow: { value: new THREE.Color(0x24406a) },
      uGlowDir: { value: glowDir },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      ${NOISE3}

      uniform float uTime;
      uniform vec3 uZenith;
      uniform vec3 uHorizon;
      uniform vec3 uGlow;
      uniform vec3 uGlowDir;

      varying vec3 vDir;

      void main() {
        vec3 dir = normalize(vDir);
        float up = clamp(dir.y, -1.0, 1.0);

        // Vertical gradient: horizon lift fading up into the zenith dark.
        float t = smoothstep(-0.05, 0.55, up);
        vec3 color = mix(uHorizon, uZenith, t);

        // Directional airglow — brightest low and toward uGlowDir.
        float toward = max(dot(dir, uGlowDir), 0.0);
        float low = smoothstep(0.35, -0.05, up);
        color += uGlow * pow(toward, 3.0) * low * 0.9;

        // A whisper of high cloud / atmospheric mottling so the sky is not flat.
        float clouds = fbm3(dir * 3.5 + vec3(0.0, 0.0, uTime * 0.006));
        color += vec3(0.012, 0.016, 0.028) * smoothstep(0.2, 0.9, clouds) * smoothstep(-0.1, 0.5, up);

        // Sink the very bottom to black so the ridge reads as solid ground.
        color *= smoothstep(-0.35, -0.02, up);

        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = -10;

  const group = new THREE.Group();
  group.add(mesh);

  return {
    group,
    glowDir,
    update(time) {
      material.uniforms.uTime.value = time;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
