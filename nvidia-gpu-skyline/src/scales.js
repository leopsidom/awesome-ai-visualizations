/**
 * Where everything goes, with no DOM and no Three.js: the time axis, the market lanes,
 * the sub-rows inside a lane, the architecture bars, and the three height measures
 * with their scales.
 *
 * Time runs along +x, YEAR_UNITS world units a year from 1995. Lanes run along x and
 * step back along -z: console & embedded at the front and data center at the back, so
 * the tallest towers never hide the others.
 */

export const YEAR0 = 1995;
export const YEAR_END = 2026; // the build runs to here; the last release is Oct 2025
export const YEAR_UNITS = 2;
export const TOWER_HEIGHT = 13; // world units from the base to the top of a scale
export const BASE = 0.25; // every tower with a figure is at least this tall
export const STUB = 0.12; // a tower with no figure for the chosen measure

const SLOT_GAP = 0.55; // z between sub-rows in a lane
const LANE_GAP = 1.9; // z from the back row of one lane to the front row of the next
const MIN_GAP_YEARS = 0.25; // releases closer than this in one lane go to different sub-rows
const ERA_TAIL = 0.35; // years an architecture bar runs past its last release
const FRONT_MARGIN = 3.4; // room in front of the first lane for the bars and year labels
const BACK_MARGIN = 1.4;
const T_MAX = 208000; // B200 and B300, in millions of transistors

const log = Math.log10;

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const xOf = (year) => (year - YEAR0) * YEAR_UNITS;
export const X_END = xOf(YEAR_END + 0.2);

/** Decimal year of an ISO date. A month-only date ("1999-11") is placed mid-month. */
export function decimalYear(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const dayOfYear = (Date.UTC(y, m - 1, d || 15) - Date.UTC(y, 0, 1)) / 86400000;
  return y + dayOfYear / 365.25;
}

/** Each measure maps a value to 0..1 of TOWER_HEIGHT and lists the values to mark on its scale. */
export const METRICS = {
  transistors: {
    field: "transistors", // millions
    norm: (v, scale) => (scale === "linear" ? v / T_MAX : (log(v) - log(2)) / (log(T_MAX) - log(2))),
    ticks: (scale) => (scale === "linear" ? [50000, 100000, 150000, 200000] : [10, 100, 1000, 10000, 100000]),
  },
  process: {
    field: "nm", // smaller is taller
    norm: (v) => (log(600) - log(v)) / (log(600) - log(3)),
    ticks: () => [500, 180, 65, 28, 12, 4],
  },
  power: {
    field: "watts",
    norm: (v) => (log(v) - log(8)) / (log(1400) - log(8)),
    ticks: () => [10, 30, 100, 300, 1000],
  },
};

export function tickHeight(metric, value, scale) {
  return BASE + METRICS[metric].norm(value, scale) * TOWER_HEIGHT;
}

/** Height of a GPU's tower; a stub when the dataset has no figure for the measure. */
export function towerHeight(gpu, metric, scale) {
  const value = gpu[METRICS[metric].field];
  if (value == null) return STUB;
  return BASE + clamp(METRICS[metric].norm(value, scale), 0, 1.05) * TOWER_HEIGHT;
}

/**
 * Sorts the GPUs by date and places them, then lays out the lanes and the architecture
 * bars. Close releases in one lane are spread over sub-rows, first fit, so no two towers
 * touch. `markets` is the list of market ids, front to back.
 */
export function prepare({ gpus, markets, architectures }) {
  const list = gpus.map((g) => ({ ...g, year: decimalYear(g.date) })).sort((a, b) => a.year - b.year);
  list.forEach((g, i) => {
    g.i = i;
  });

  const depth = {};
  for (const id of markets) {
    const rows = [];
    for (const g of list) {
      if (g.market !== id) continue;
      let slot = rows.findIndex((last) => g.year - last >= MIN_GAP_YEARS);
      if (slot < 0) {
        slot = rows.length;
        rows.push(g.year);
      } else {
        rows[slot] = g.year;
      }
      g.slot = slot;
    }
    depth[id] = Math.max(1, rows.length);
  }

  let z = 0;
  const lanes = markets.map((id) => {
    const lane = {
      id,
      front: -z,
      back: -(z + (depth[id] - 1) * SLOT_GAP),
      count: list.filter((g) => g.market === id).length,
    };
    z += (depth[id] - 1) * SLOT_GAP + LANE_GAP;
    return lane;
  });
  const laneById = Object.fromEntries(lanes.map((l) => [l.id, l]));
  for (const g of list) {
    g.x = xOf(g.year);
    g.z = laneById[g.market].front - g.slot * SLOT_GAP;
  }

  // Architecture bars, first fit into rows, so families that overlap in time sit side by side.
  const eras = architectures
    .map((a) => {
      const own = list.filter((g) => g.arch === a.id);
      const first = own[0].year;
      const last = own[own.length - 1].year;
      return {
        ...a,
        start: first,
        end: last + ERA_TAIL,
        firstYear: Math.floor(first),
        lastYear: Math.floor(last),
        count: own.length,
      };
    })
    .sort((a, b) => a.start - b.start);
  const rowEnds = [];
  for (const e of eras) {
    let row = rowEnds.findIndex((end) => end <= e.start);
    if (row < 0) {
      row = rowEnds.length;
      rowEnds.push(e.end);
    } else {
      rowEnds[row] = e.end;
    }
    e.row = row;
  }

  return {
    gpus: list,
    lanes,
    laneById,
    eras,
    eraById: Object.fromEntries(eras.map((e) => [e.id, e])),
    colors: Object.fromEntries(architectures.map((a) => [a.id, a.color])),
    milestoneCount: list.filter((g) => g.milestone).length,
    lastYear: Math.floor(list[list.length - 1].year),
    zFront: FRONT_MARGIN,
    zBack: lanes[lanes.length - 1].back - BACK_MARGIN,
  };
}
