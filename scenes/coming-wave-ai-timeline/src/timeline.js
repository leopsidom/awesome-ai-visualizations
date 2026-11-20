/**
 * Timeline core: the hybrid time axis and the playback schedule.
 * No DOM and no Three.js, so it runs (and is tested) in plain Node.
 */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const parts = (iso) => iso.split("-").map(Number);

/** "2017-06-12" -> 2017.45 */
export function decYear(iso) {
  const [y, m, d] = parts(iso);
  return y + (m - 1 + (d - 1) / 31) / 12;
}

/** Before 2010 only the year is shown: those dates are good to the year, not the day. */
export function label(iso) {
  const [y, m] = parts(iso);
  return y < 2010 ? String(y) : `${MONTHS[m - 1]} ${y}`;
}

/** "2026-11-11" -> "11 Nov 2026" */
export function longDate(iso) {
  const [y, m, d] = parts(iso);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** Piecewise-linear axis. `knots` are [year, u] pairs with u running 0..1. */
export function makeAxis(knots) {
  const segment = (v, k) => {
    let i = 0;
    while (i < knots.length - 2 && v > knots[i + 1][k]) i++;
    return i;
  };
  const map = (v, from, to) => {
    const i = segment(v, from);
    const a = knots[i];
    const b = knots[i + 1];
    return a[to] + ((v - a[from]) / (b[from] - a[from])) * (b[to] - a[to]);
  };
  return { knots, toU: (year) => map(year, 0, 1), toYear: (u) => map(u, 1, 0) };
}

/** Sorts the events by date and gives each its axis position, label and thread colour. */
export function prepare({ threads, axis: knots, events: raw }) {
  const axis = makeAxis(knots);
  const threadById = {};
  threads.forEach((t, index) => {
    threadById[t.id] = { index, ...t };
  });
  const events = raw
    .map((e) => ({ ...e }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  events.forEach((e, index) => {
    const thread = threadById[e.thread];
    e.index = index;
    e.year = decYear(e.date);
    e.u = axis.toU(e.year);
    e.label = label(e.date);
    e.color = thread.color;
    e.threadName = thread.name;
  });
  return { events, threads: threads.map((t) => threadById[t.id]), threadById, axis };
}

/**
 * The second at which each event is reached. Gaps are proportional to distance on
 * the axis, then clamped: sparse decades must not drag and dense years must stay
 * readable.
 */
export function schedule(evs, opts = {}) {
  const o = { secPerU: 45, min: 1.7, max: 3.4, lead: 2.5, tail: 4, ...opts };
  const T = [];
  let t = o.lead;
  evs.forEach((e, i) => {
    if (i > 0) t += clamp((e.u - evs[i - 1].u) * o.secPerU, o.min, o.max);
    T.push(t);
  });
  return { T, lead: o.lead, tail: o.tail, end: (T.length ? T[T.length - 1] : 0) + o.tail };
}

/**
 * Playback time -> { i, f, u }: the last event reached (-1 before the first), the
 * progress from it to the next, and the position on the axis.
 */
export function locate(sch, evs, tau, u0, u1) {
  const T = sch.T;
  const n = T.length;
  if (!n) return { i: -1, f: 0, u: u0 };
  if (tau < T[0]) {
    const f = clamp(tau / T[0], 0, 1);
    return { i: -1, f, u: u0 + (evs[0].u - u0) * f };
  }
  let i = n - 1;
  for (let k = 0; k < n - 1; k++) {
    if (tau < T[k + 1]) {
      i = k;
      break;
    }
  }
  if (i === n - 1) {
    const f = clamp((tau - T[i]) / sch.tail, 0, 1);
    return { i, f, u: evs[i].u + (u1 - evs[i].u) * f };
  }
  const f = (tau - T[i]) / (T[i + 1] - T[i]);
  return { i, f, u: evs[i].u + (evs[i + 1].u - evs[i].u) * f };
}

/** Inverse of locate(): used for scrubbing, and to re-time after a thread is toggled. */
export function tauForU(sch, evs, u, u0, u1) {
  const T = sch.T;
  const n = T.length;
  if (!n) return 0;
  if (u < evs[0].u) {
    const d = evs[0].u - u0;
    return T[0] * (d > 0 ? clamp((u - u0) / d, 0, 1) : 0);
  }
  for (let k = 0; k < n - 1; k++) {
    if (u < evs[k + 1].u) {
      const d = evs[k + 1].u - evs[k].u;
      return T[k] + (d > 0 ? (u - evs[k].u) / d : 0) * (T[k + 1] - T[k]);
    }
  }
  const d = u1 - evs[n - 1].u;
  return T[n - 1] + sch.tail * (d > 0 ? clamp((u - evs[n - 1].u) / d, 0, 1) : 0);
}
