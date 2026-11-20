/**
 * Seafloor height field, evaluated on the CPU.
 *
 * It lives in JS rather than in the vertex shader so that other systems (the
 * kelp bed) can root themselves at exactly the same height. A GPU-side copy of
 * the same noise would drift out of sync: fract(sin(x)) hashes are precision
 * sensitive and do not agree between JS and GLSL.
 */

export const FLOOR_Y = -16;

function hash21(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

function noise2(x, y) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;

  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);

  const a = hash21(ix, iy);
  const b = hash21(ix + 1, iy);
  const c = hash21(ix, iy + 1);
  const d = hash21(ix + 1, iy + 1);

  return (a + (b - a) * ux) * (1 - uy) + (c + (d - c) * ux) * uy;
}

function fbm(x, y) {
  let value = 0;
  let amp = 0.5;
  for (let i = 0; i < 5; i++) {
    value += amp * noise2(x, y);
    x *= 2.03;
    y *= 2.03;
    amp *= 0.5;
  }
  return value;
}

/** Dune height above FLOOR_Y, normalised roughly to 0..1. */
export function terrainRelief(x, z) {
  return fbm(x * 0.012, z * 0.012);
}

/** World-space Y of the seafloor under (x, z). */
export function terrainHeight(x, z) {
  return FLOOR_Y + terrainRelief(x, z) * 14 + fbm(x * 0.075, z * 0.075) * 1.6 - 8;
}
