import * as THREE from "three";
import { NOISE3 } from "./glsl.js";
import { STAR_RADIUS, sampleStarColor, makeStarMaterial, assembleStars } from "./stars.js";

/**
 * The Milky Way: a dense drift of faint stars packed toward one great circle,
 * plus a translucent dust band glowing along the same axis with dark lanes cut
 * through it. Both share `axis`, so band stars and glow stay registered as the
 * whole thing wheels with the celestial group.
 */
export function createMilkyWay(rng, shared, bandCount = 9000) {
  // Galactic plane normal — tilted off the celestial pole for a natural sweep.
  const a = rng.range(0, Math.PI * 2);
  const tilt = rng.range(0.5, 0.9);
  const axis = new THREE.Vector3(
    Math.sin(tilt) * Math.cos(a),
    Math.cos(tilt),
    Math.sin(tilt) * Math.sin(a),
  ).normalize();

  const group = new THREE.Group();

  // --- band stars: uniform-on-sphere rejected toward the plane -------------
  const positions = new Float32Array(bandCount * 3);
  const colors = new Float32Array(bandCount * 3);
  const sizes = new Float32Array(bandCount);
  const brights = new Float32Array(bandCount);
  const twinkles = new Float32Array(bandCount * 2);

  const dir = new THREE.Vector3();
  const col = new THREE.Color();
  const width = 0.16; // angular half-thickness of the band (radians-ish)

  let placed = 0;
  let guard = 0;
  while (placed < bandCount && guard < bandCount * 60) {
    guard++;
    const u = rng() * 2 - 1;
    const theta = rng() * Math.PI * 2;
    const r = Math.sqrt(1 - u * u);
    dir.set(r * Math.cos(theta), u, r * Math.sin(theta));

    // Distance from the galactic plane; keep stars near it.
    const off = Math.abs(dir.dot(axis));
    if (rng() > Math.exp(-(off * off) / (width * width))) continue;

    positions[placed * 3] = dir.x * STAR_RADIUS;
    positions[placed * 3 + 1] = dir.y * STAR_RADIUS;
    positions[placed * 3 + 2] = dir.z * STAR_RADIUS;

    sampleStarColor(rng, col);
    colors[placed * 3] = col.r;
    colors[placed * 3 + 1] = col.g;
    colors[placed * 3 + 2] = col.b;

    // Distant unresolved stars: small and dim, with a rare bright accent.
    const b = Math.pow(rng(), 4);
    brights[placed] = 0.1 + b * 0.7;
    sizes[placed] = 0.32 + b * 1.1;

    twinkles[placed * 2] = rng() * Math.PI * 2;
    twinkles[placed * 2 + 1] = 0.4 + rng() * 2.0;
    placed++;
  }

  const starMaterial = makeStarMaterial(shared);
  const { points, geometry } = assembleStars(
    placed,
    positions,
    colors,
    sizes,
    brights,
    twinkles,
    starMaterial,
  );
  group.add(points);

  // --- nebula glow: additive dust on an inner shell ------------------------
  const glowGeometry = new THREE.SphereGeometry(STAR_RADIUS * 0.94, 64, 48);
  const glowMaterial = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: shared.uTime,
      uAxis: { value: axis },
      uColA: { value: new THREE.Color(0x2a3f6a) }, // cool dust
      uColB: { value: new THREE.Color(0x6a4d63) }, // faint warm core
      uStrength: { value: 0.85 },
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
      uniform vec3 uAxis;
      uniform vec3 uColA;
      uniform vec3 uColB;
      uniform float uStrength;

      varying vec3 vDir;

      void main() {
        vec3 dir = normalize(vDir);

        // Glow along the great circle perpendicular to uAxis.
        float off = abs(dot(dir, uAxis));
        float band = exp(-off * off * 28.0);
        if (band < 0.004) discard;

        vec3 p = dir * 4.0 + vec3(0.0, 0.0, uTime * 0.004);
        float clouds = fbm3(p);
        float bright = smoothstep(0.35, 0.95, clouds);

        // Dark dust lanes carved along the band.
        float lane = smoothstep(0.45, 0.72, fbm3(dir * 7.0 + 11.0));
        float density = band * bright * (1.0 - 0.7 * lane);

        vec3 color = mix(uColA, uColB, clouds * clouds);
        gl_FragColor = vec4(color, density * uStrength);
      }
    `,
  });

  const glow = new THREE.Mesh(glowGeometry, glowMaterial);
  glow.renderOrder = -5;
  group.add(glow);

  return {
    group,
    axis,
    dispose() {
      geometry.dispose();
      starMaterial.dispose();
      glowGeometry.dispose();
      glowMaterial.dispose();
    },
  };
}
