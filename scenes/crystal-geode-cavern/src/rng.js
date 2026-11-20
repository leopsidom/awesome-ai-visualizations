/** Seeded PRNG so any cavity can be reproduced from its seed. */

export function makeRng(seed) {
  let a = seed >>> 0;
  const rng = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  rng.range = (min, max) => min + (max - min) * rng();
  rng.int = (min, max) => Math.floor(rng.range(min, max + 1));
  rng.pick = (arr) => arr[Math.floor(rng() * arr.length) % arr.length];
  rng.sign = () => (rng() < 0.5 ? -1 : 1);

  /**
   * Roughly normal, via the central limit theorem. Used wherever a uniform
   * spread reads as noise but a clustered one reads as growth — crystal sizes,
   * the scatter of a druse patch around its nucleation point.
   */
  rng.gauss = (mean = 0, deviation = 1) => {
    const sum = rng() + rng() + rng() + rng() + rng() + rng();
    return mean + (sum - 3) * 0.7071 * deviation;
  };

  return rng;
}

/** Six hex digits, used as the human-readable seed label. */
export function seedLabel(seed) {
  return (seed >>> 0).toString(16).padStart(8, "0").slice(-6);
}

export function randomSeed() {
  return (Math.random() * 0xffffffff) >>> 0;
}
