import * as THREE from "three";
import { NOISE3 } from "./glsl.js";

/** Soft radial-gradient sprite texture for the halo, built once on a canvas. */
function haloTexture() {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0.0, "rgba(220, 230, 255, 0.5)");
  g.addColorStop(0.25, "rgba(180, 200, 245, 0.2)");
  g.addColorStop(0.6, "rgba(120, 150, 220, 0.05)");
  g.addColorStop(1.0, "rgba(0, 0, 0, 0.0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * The moon: a self-shaded sphere on the celestial sphere, with procedural maria,
 * a phase terminator, and a billboarded halo that blooms in post.
 *
 * Because the moon wheels inside the tilted celestial group, a fixed object-space
 * light would point anywhere — often lighting the far side into a dark disc. So it
 * is lit in WORLD space from the view direction plus a fixed offset: the near face
 * always catches light, with a soft terminator biased to one limb.
 */
export function createMoon(rng) {
  const group = new THREE.Group();

  // Position on the sphere — high enough to clear the ridge, low enough to frame.
  const az = rng.range(0, Math.PI * 2);
  const el = rng.range(0.42, 0.82);
  const dist = 260;
  group.position.set(
    Math.cos(el) * Math.cos(az) * dist,
    Math.sin(el) * dist,
    Math.cos(el) * Math.sin(az) * dist,
  );

  // A fixed world-space nudge off the view direction sets which limb the shadow
  // falls on — different each sky, always a readable gibbous-to-half phase.
  const lightOffset = new THREE.Vector3(
    rng.sign() * rng.range(0.45, 0.75),
    rng.range(0.1, 0.4),
    rng.sign() * rng.range(0.3, 0.6),
  );

  const radius = 11;
  const geometry = new THREE.SphereGeometry(radius, 96, 96);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uLightOffset: { value: lightOffset },
      uSeed: { value: rng.range(0, 40) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorldNormal;
      varying vec3 vWorldPos;
      varying vec3 vObjPos;
      void main() {
        vObjPos = position;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorldPos = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      ${NOISE3}

      uniform vec3 uLightOffset;
      uniform float uSeed;

      varying vec3 vWorldNormal;
      varying vec3 vWorldPos;
      varying vec3 vObjPos;

      void main() {
        vec3 n = normalize(vWorldNormal);
        vec3 p = normalize(vObjPos) * 2.4 + uSeed;

        // Maria (dark plains) plus fine cratering, riding the object surface.
        float maria = smoothstep(0.45, 0.72, fbm3(p));
        float craters = fbm3(p * 6.0);
        float albedo = 0.92 - maria * 0.34 - (craters - 0.5) * 0.12;
        vec3 base = vec3(0.86, 0.86, 0.82) * albedo;

        // Light from the viewer, nudged so a terminator falls on one limb.
        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        vec3 lightDir = normalize(viewDir + uLightOffset);
        float lit = smoothstep(-0.15, 0.4, dot(n, lightDir));

        vec3 color = base * (0.08 + 0.92 * lit);
        color += vec3(0.03, 0.05, 0.09) * (1.0 - lit); // faint earthshine

        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });

  const disc = new THREE.Mesh(geometry, material);
  group.add(disc);

  // Halo — auto-billboarded sprite, additive so bloom catches it.
  const tex = haloTexture();
  const haloMaterial = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    opacity: 0.85,
  });
  const halo = new THREE.Sprite(haloMaterial);
  halo.scale.setScalar(radius * 6.5);
  group.add(halo);

  return {
    group,
    dispose() {
      geometry.dispose();
      material.dispose();
      haloMaterial.dispose();
      tex.dispose();
    },
  };
}
