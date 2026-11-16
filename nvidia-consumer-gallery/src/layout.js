/**
 * Where everything sits and how fast the walk goes. No DOM and no Three.js.
 *
 * The gallery is one path, measured by `u` (world units along x). Each of the eight milestone
 * chapters gets the same length of path (CHAPTER), whatever span of years it covers, so the four
 * 1995–2001 milestones are not crowded and the twelve years from 2006 to 2018 do not drag. The
 * minor GPUs released between two milestones are spread evenly inside that chapter; the four after
 * the RTX 5090 get a shorter tail. The year counter interpolates real dates between neighbours.
 *
 * Travel time is per chapter and grows with how many minor GPUs it holds (4 s plus 0.32 s each,
 * capped at 16 s at 1×), so the scrolling list never moves faster than it can be read.
 */
import { GPUS } from "./data.js";

export const CHAPTER = 24;
const TAIL = CHAPTER * 0.6;
const AMP = 4, WAVE = (Math.PI * 2) / 70;   // the path's gentle S-curve

export const parseDate = (d) => { const [y, m = 6, day = 15] = d.split("-").map(Number); return new Date(y, m - 1, day).getTime(); };

GPUS.forEach((g, i) => { g.i = i; g.t = parseDate(g.date); });
export const HERO_IDX = GPUS.map((g, i) => (g.hero ? i : -1)).filter((i) => i >= 0);
export const HEROES = HERO_IDX.map((i) => GPUS[i]);
export const MINORS = GPUS.filter((g) => !g.hero);

HERO_IDX.forEach((hi, k) => {
  GPUS[hi].u = k * CHAPTER;
  const next = HERO_IDX[k + 1] ?? GPUS.length;
  const span = k + 1 < HERO_IDX.length ? CHAPTER : TAIL;
  const n = next - hi - 1;
  for (let j = 1; j <= n; j++) GPUS[hi + j].u = k * CHAPTER + (j / (n + 1)) * span;
});

export const U_START = -4;
export const U_END = (HERO_IDX.length - 1) * CHAPTER + TAIL + 2;

const chapterSec = HERO_IDX.map((hi, k) => Math.min(16, 4 + 0.32 * ((HERO_IDX[k + 1] ?? GPUS.length) - hi - 1)));
export const chapterOf = (u) => Math.max(0, Math.min(HERO_IDX.length - 1, Math.floor((u + 1e-6) / CHAPTER)));
/** Path units per second at 1× for position u. */
export const speedAt = (u) => { const k = chapterOf(Math.max(0, u)); return (k < HERO_IDX.length - 1 ? CHAPTER : TAIL) / chapterSec[k]; };
/** Total run time at 1×, story pauses excluded (for the README). */
export const RUN_SEC = chapterSec.reduce((a, b) => a + b, 0);

/** The calendar time shown at position u: linear between neighbouring releases. */
export function timeAt(u) {
  if (u <= 0) return GPUS[0].t;
  for (let i = 1; i < GPUS.length; i++) {
    if (GPUS[i].u >= u) { const a = GPUS[i - 1], b = GPUS[i]; return a.t + ((b.t - a.t) * (u - a.u)) / Math.max(1e-6, b.u - a.u); }
  }
  return GPUS[GPUS.length - 1].t;
}

/** Path point, tangent and visitor-side normal at u, as plain {x, z}. */
export const pathPoint = (u) => ({ x: u, z: AMP * Math.sin(u * WAVE) });
export function pathTangent(u) { const dz = AMP * WAVE * Math.cos(u * WAVE), l = Math.hypot(1, dz); return { x: 1 / l, z: dz / l }; }
export function pathNormal(u) { const t = pathTangent(u); return { x: -t.z, z: t.x }; }

/** Era-typical board for a minor GPU (Tapeout has no dimensions): [length mm, height mm, slots, cooler]. */
export function eraBoard(year) {
  if (year < 1999) return [175, 107, 1, "heatsink"];
  if (year < 2004) return [175, 107, 1, "smallfan"];
  if (year < 2018) return [267, 111, 2, "blower"];
  if (year < 2022) return [267, 116, 2, "axial"];
  return [304, 137, 3, "flowthrough"];
}
/** The board drawn for any GPU: the measured one for heroes, the era-typical one otherwise. */
export function boardOf(g) {
  if (g.hero) return { length: g.hero.length, height: g.hero.height, slots: g.hero.slots, cooling: g.hero.cooling };
  const [length, height, slots, cooling] = eraBoard(+g.date.slice(0, 4));
  return { length, height, slots, cooling };
}
