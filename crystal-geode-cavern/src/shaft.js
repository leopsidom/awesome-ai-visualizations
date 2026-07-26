import * as THREE from "three";

import { CAVITY } from "./cavity.js";
import { NOISE3 } from "./glsl.js";

/**
 * Daylight coming through the crack, and the dust that makes it visible.
 *
 * The beam is a hollow truncated cone drawn additively, with its brightness
 * driven by `abs(dot(normal, viewDir))`. That single term is the whole trick:
 * it peaks where the tube's surface faces the camera — down the middle of the
 * silhouette — and falls to nothing at the edges, and because the cone is drawn
 * double-sided the front and back walls both contribute and sum to something
 * that behaves like a volume. It is not a volumetric integral, but at a tenth
 * of the cost it is indistinguishable at this scale.
 *
 * The beam also *sweeps*, slowly, as though the sun outside were moving. That
 * is the scene's clock: it is what makes the cavity change rather than merely
 * drift, and the key light and the dust both take their direction from here so
 * the three stay locked together.
 */

const SPREAD = 1.35; // how much wider the beam is where it lands
const OVERSHOOT = 5; // carry it past the waterline so it never ends on a rim

export function createShaft(rng, cavity, fogUniforms) {
  const group = new THREE.Group();

  const origin = cavity.crackOrigin();
  const restDir = cavity.beamTarget().sub(origin).normalize();
  const length = origin.distanceTo(cavity.beamTarget()) + OVERSHOOT;
  // Narrower than the opening itself. A cone as wide as the crack fills half
  // the cavity and reads as fog; the eye wants a shaft.
  const topRadius = Math.sin(cavity.crackAngle) * CAVITY.radius * 0.62;

  // Where the beam is pointing right now. Read by the key light and the dust.
  const axis = restDir.clone();

  // Decorrelate the two sweep oscillators so the path never closes into an
  // obvious figure of eight.
  const swayPhase = rng.range(0, Math.PI * 2);
  const tiltPhase = rng.range(0, Math.PI * 2);

  // ------------------------------------------------------------------ beam --

  const geometry = new THREE.CylinderGeometry(
    topRadius,
    topRadius * SPREAD,
    length,
    48,
    1,
    true, // open — there is nothing to cap, and a cap would read as a lid
  );

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false, // additive light must not occlude what is behind it
    depthTest: true, // but the crystals must still occlude it
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(0xffeccd) },
      uStrength: { value: 0.8 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vViewPos;
      varying vec3 vViewNormal;
      varying vec3 vWorld;
      varying float vRise;

      void main() {
        // CylinderGeometry runs v from 0 at the base to 1 at the top, and the
        // top is the end parked in the crack — so vRise is "closeness to the
        // source", which is what the falloff wants.
        vRise = uv.y;

        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;

        vec4 mv = viewMatrix * world;
        vViewPos = mv.xyz;
        vViewNormal = normalMatrix * normal;

        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      ${NOISE3}

      uniform float uTime;
      uniform vec3 uColor;
      uniform float uStrength;

      varying vec3 vViewPos;
      varying vec3 vViewNormal;
      varying vec3 vWorld;
      varying float vRise;

      void main() {
        vec3 viewDir = normalize(-vViewPos);
        float facing = abs(dot(normalize(vViewNormal), viewDir));

        // Peaks down the middle of the tube, gone at the silhouette.
        float body = pow(facing, 2.6);

        // Brightest at the crack, thinning as it scatters into the cavity, and
        // cut softly at the very top so the cone does not begin on a hard ring.
        float along = mix(0.14, 1.0, vRise) * smoothstep(0.0, 0.12, vRise);
        along *= smoothstep(1.0, 0.93, vRise);

        // Streaks of denser dust drifting down the beam.
        float streak = gnFbm3(vec3(vWorld.xz * 0.16, vRise * 3.4 - uTime * 0.05));
        streak = 0.55 + 0.85 * streak;

        float intensity = body * along * streak * uStrength;

        gl_FragColor = vec4(uColor * intensity, intensity);
      }
    `,
  });

  const beam = new THREE.Mesh(geometry, material);
  group.add(beam);

  // ------------------------------------------------------------------ dust --

  const motes = createMotes(rng, {
    beamOrigin: origin,
    beamDir: restDir,
    beamRadius: topRadius * SPREAD,
    beamLength: length,
    fogUniforms,
  });
  group.add(motes.object);

  // ----------------------------------------------------------------- sweep --

  const quaternion = new THREE.Quaternion();
  const sway = new THREE.Quaternion();
  const tilt = new THREE.Quaternion();
  const tiltAxis = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);

  function aim(time) {
    // A shallow, slow arc — a couple of degrees a second at most. Enough that
    // the lit face of the cluster has changed by the time you look back.
    sway.setFromAxisAngle(UP, Math.sin(time * 0.035 + swayPhase) * 0.17);

    tiltAxis.copy(restDir).cross(UP).normalize();
    tilt.setFromAxisAngle(tiltAxis, Math.sin(time * 0.023 + tiltPhase) * 0.1);

    axis.copy(restDir).applyQuaternion(tilt).applyQuaternion(sway).normalize();

    // The cone's +Y end is the one in the crack, so it points back up the beam.
    quaternion.setFromUnitVectors(UP, axis.clone().negate());
    beam.quaternion.copy(quaternion);
    beam.position.copy(origin).addScaledVector(axis, length * 0.5);

    motes.setBeam(origin, axis);
  }

  aim(0);

  return {
    group,
    axis,
    origin,
    length,
    /** Half-width of the beam where it lands — the key light matches this. */
    coneRadius: topRadius * SPREAD,

    update(time) {
      aim(time);
      material.uniforms.uTime.value = time;
      motes.update(time);
      return axis;
    },

    setViewportHeight(height) {
      motes.setViewportHeight(height);
    },

    dispose() {
      geometry.dispose();
      material.dispose();
      motes.dispose();
    },
  };
}

// ------------------------------------------------------------------- the dust --

/**
 * Mineral dust hanging in the cavity. One `Points` system moved entirely in the
 * vertex shader, which also decides how lit each mote is by measuring its
 * distance from the beam axis — so the dust brightens and dims as the beam
 * sweeps across it, for the cost of two uniforms a frame.
 */
function createMotes(
  rng,
  { beamOrigin, beamDir, beamRadius, beamLength, fogUniforms, count = 1800 },
) {
  const base = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const seed = new Float32Array(count);

  const point = new THREE.Vector3();

  // An orthonormal frame across the beam, so the column of dust can be seeded
  // along the axis the light actually takes rather than straight down.
  const across = new THREE.Vector3(0, 1, 0).cross(beamDir);
  if (across.lengthSq() < 1e-6) across.set(1, 0, 0);
  across.normalize();
  const alsoAcross = beamDir.clone().cross(across).normalize();

  for (let i = 0; i < count; i++) {
    // Two thirds are seeded in the volume the beam sweeps through — dust is
    // everywhere, but points that can never be lit are points wasted.
    if (rng() < 0.66) {
      const along = rng() * beamLength;
      const radial = Math.sqrt(rng()) * beamRadius * 1.5;
      const angle = rng.range(0, Math.PI * 2);
      point
        .copy(beamOrigin)
        .addScaledVector(beamDir, along)
        .addScaledVector(across, Math.cos(angle) * radial)
        .addScaledVector(alsoAcross, Math.sin(angle) * radial);
    } else {
      const radius = Math.cbrt(rng()) * (CAVITY.radius * 0.82);
      const height = rng.range(-1, 1);
      const ring = Math.sqrt(Math.max(0, 1 - height * height));
      const angle = rng.range(0, Math.PI * 2);
      point.set(
        ring * Math.cos(angle) * radius,
        height * radius,
        ring * Math.sin(angle) * radius,
      );
    }

    if (point.y < CAVITY.poolY + 0.5) point.y = CAVITY.poolY + 0.5 + rng() * 6;

    base[i * 3 + 0] = point.x;
    base[i * 3 + 1] = point.y;
    base[i * 3 + 2] = point.z;

    size[i] = rng.range(0.9, 3.2);
    seed[i] = rng();
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(base, 3));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
  geometry.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
  // The points move in the shader, so the bounds have to be declared by hand.
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), CAVITY.radius * 1.2);

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(0xfff0d4) },
      uOpacity: { value: 0.5 },
      uViewHeight: { value: 800 },
      uBeamOrigin: { value: new THREE.Vector3() },
      uBeamDir: { value: new THREE.Vector3(0, -1, 0) },
      uBeamRadius: { value: beamRadius },
      uBeamLength: { value: beamLength },
      // Only the density is wanted: unlit dust is dimmed by distance, not
      // tinted by it — an additive sprite has no colour to fade toward.
      uFogDensity: fogUniforms.uFogDensity,
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uViewHeight;
      uniform vec3 uBeamOrigin;
      uniform vec3 uBeamDir;
      uniform float uBeamRadius;
      uniform float uBeamLength;
      uniform float uFogDensity;

      attribute float aSize;
      attribute float aSeed;

      varying float vSeed;
      varying float vLit;

      void main() {
        vec3 pos = position;

        // Bounded convection. Dust in a sealed cavity has nowhere to go, so it
        // wanders in place rather than travelling and wrapping.
        float phase = aSeed * 6.2831;
        float amp = 0.5 + aSeed * 2.6;
        pos.x += sin(uTime * 0.11 + phase) * amp;
        pos.y += sin(uTime * 0.083 + phase * 1.7) * amp * 0.55;
        pos.z += cos(uTime * 0.097 + phase * 1.3) * amp;

        // How far this mote is off the beam axis, and how far along it.
        vec3 rel = pos - uBeamOrigin;
        float along = dot(rel, uBeamDir);
        float radial = length(rel - uBeamDir * along);

        float inside = 1.0 - smoothstep(uBeamRadius * 0.3, uBeamRadius * 1.05, radial);
        inside *= step(0.0, along);
        inside *= 1.0 - smoothstep(uBeamLength * 0.75, uBeamLength * 1.1, along);

        vec4 mv = viewMatrix * modelMatrix * vec4(pos, 1.0);
        float dist = -mv.z;

        // Unlit dust is not invisible, just nearly so.
        float fogged = exp(-pow(uFogDensity * dist, 2.0));
        vLit = (0.05 + 0.95 * inside) * fogged;
        vSeed = aSeed;

        gl_PointSize = aSize * (uViewHeight * 0.0016) * (18.0 / max(1.0, dist));
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uColor;
      uniform float uOpacity;

      varying float vSeed;
      varying float vLit;

      void main() {
        // Round, soft-edged sprite — no texture needed.
        float d = length(gl_PointCoord - 0.5);
        float disc = smoothstep(0.5, 0.05, d);
        if (disc <= 0.001) discard;

        float flicker = 0.6 + 0.4 * sin(uTime * 1.4 + vSeed * 61.0);

        gl_FragColor = vec4(uColor, disc * vLit * flicker * uOpacity);
      }
    `,
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;

  return {
    object: points,

    setBeam(origin, direction) {
      material.uniforms.uBeamOrigin.value.copy(origin);
      material.uniforms.uBeamDir.value.copy(direction);
    },

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
