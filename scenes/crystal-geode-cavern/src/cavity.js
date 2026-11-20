import * as THREE from "three";

/**
 * The shape of the cavity, as plain JavaScript.
 *
 * A geode is a bubble in rock, so the wall is described in polar form: for any
 * unit direction, how far away is the rock. The shell mesh is displaced by this
 * function, and every crystal in the druse is rooted with it — which is exactly
 * why it lives here rather than in a shader. `fract(sin(x))` does not agree
 * bit-for-bit between CPU and GPU, so a shader-side copy would leave thousands
 * of crystals floating off the wall or buried in it. (The same lesson the
 * seafloor in `../../bioluminescent-jellyfish` had to learn.)
 *
 * The one other thing the cavity owns is the crack: the gap in the roof that
 * the daylight comes through. Both the shell (which drops those triangles) and
 * the druse (which must not grow across the opening) ask about it here.
 */

export const CAVITY = {
  /** Mean wall distance. Everything else in the scene is sized off this. */
  radius: 34,
  /** The waterline. Below it is drowned, so nothing is built down there. */
  poolY: -20,
};

const UP = new THREE.Vector3(0, 1, 0);

export function createCavity(rng) {
  // Three independent noise fields, decorrelated by an integer offset each.
  const wallSeed = rng.range(0, 512);
  const bumpSeed = rng.range(512, 1024);
  const crackSeed = rng.range(1024, 1536);

  // The crack sits high but never straight overhead — a vertical shaft would
  // light the floor and nothing else, and the beam would read as a cylinder
  // rather than a shaft. Off-axis, it rakes across the far wall.
  const crackDir = new THREE.Vector3(
    rng.gauss(0, 0.34),
    1,
    rng.gauss(0, 0.34),
  ).normalize();
  if (crackDir.y < 0.82) {
    crackDir.lerp(UP, 0.5).normalize();
  }

  const crackAngle = rng.range(0.23, 0.3);

  /** Distance to the rock along `dir` (which must be unit length). */
  function radiusAt(dir) {
    // Four octaves by hand rather than one fbm call, because they are not a
    // geometric series: the mid band is pushed hard on purpose. Broad swell
    // alone gives a smooth bladder that reads as fog once it is lit only by
    // bounce — it is the 5-to-10 unit lumps that give the wall a surface.
    const swell = fbm3(dir.x * 1.6 + wallSeed, dir.y * 1.6, dir.z * 1.6, 4);
    const lumps = fbm3(dir.x * 4.4, dir.y * 4.4 + bumpSeed, dir.z * 4.4, 3);
    const knobs = fbm3(dir.x * 11.0, dir.y * 11.0 + bumpSeed, dir.z * 11.0, 2);
    const grit = noise3(dir.x * 22.0, dir.y * 22.0, dir.z * 22.0 + bumpSeed, 0);

    return (
      CAVITY.radius *
      (1 +
        0.18 * (swell - 0.5) +
        0.11 * (lumps - 0.5) +
        0.045 * (knobs - 0.5) +
        0.018 * (grit - 0.5))
    );
  }

  /**
   * 1 well inside the opening, 0 on solid rock, ramping across the lip. The
   * threshold is modulated by noise so the hole comes out as a torn gap rather
   * than a drilled circle.
   */
  function crackAt(dir) {
    const cosine = Math.min(1, Math.max(-1, dir.dot(crackDir)));
    const theta = Math.acos(cosine);

    const wobble = 0.55 + 1.05 * fbm3(dir.x * 5.5 + crackSeed, dir.y * 5.5, dir.z * 5.5, 3);
    const edge = crackAngle * wobble;

    return smoothstep(edge, edge * 0.55, theta);
  }

  /** Where the beam enters, i.e. the middle of the opening. */
  function crackOrigin() {
    return crackDir.clone().multiplyScalar(radiusAt(crackDir));
  }

  /**
   * Where the beam lands: the point at which the axis through the crack crosses
   * the waterline. The hero crystals are grown here and the camera looks here,
   * so the one lit thing in the cavity is also the thing worth looking at.
   */
  function beamTarget() {
    const origin = crackOrigin();
    const travel = (origin.y - CAVITY.poolY) / crackDir.y;
    return origin.clone().addScaledVector(crackDir, -travel);
  }

  return { crackDir, crackAngle, radiusAt, crackAt, crackOrigin, beamTarget };
}

// ------------------------------------------------------------------ the field --

/**
 * Value noise on a 3D lattice. `salt` decorrelates the three fields above
 * without needing three separate hash constants.
 */
function noise3(x, y, z, salt) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);

  const fx = fade(x - ix);
  const fy = fade(y - iy);
  const fz = fade(z - iz);

  const c000 = hash3(ix, iy, iz, salt);
  const c100 = hash3(ix + 1, iy, iz, salt);
  const c010 = hash3(ix, iy + 1, iz, salt);
  const c110 = hash3(ix + 1, iy + 1, iz, salt);
  const c001 = hash3(ix, iy, iz + 1, salt);
  const c101 = hash3(ix + 1, iy, iz + 1, salt);
  const c011 = hash3(ix, iy + 1, iz + 1, salt);
  const c111 = hash3(ix + 1, iy + 1, iz + 1, salt);

  const x00 = c000 + (c100 - c000) * fx;
  const x10 = c010 + (c110 - c010) * fx;
  const x01 = c001 + (c101 - c001) * fx;
  const x11 = c011 + (c111 - c011) * fx;

  const y0 = x00 + (x10 - x00) * fy;
  const y1 = x01 + (x11 - x01) * fy;

  return y0 + (y1 - y0) * fz;
}

function fbm3(x, y, z, octaves) {
  let value = 0;
  let amp = 0.5;
  let scale = 1;

  for (let i = 0; i < octaves; i++) {
    value += amp * noise3(x * scale, y * scale, z * scale, i);
    scale *= 2.03;
    amp *= 0.5;
  }

  // Normalised back to roughly 0..1 — the missing octaves of a truncated
  // geometric series would otherwise leave fbm biased low.
  return value / (1 - Math.pow(0.5, octaves));
}

function hash3(x, y, z, salt) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177) + Math.imul(salt | 0, 1103515245);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const fade = (t) => t * t * (3 - 2 * t);

/** Exposed so the rock can be mottled with the same field that shapes it. */
export { fbm3 as fieldFbm };

function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}
