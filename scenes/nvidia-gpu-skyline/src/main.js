import { GPUS, MARKETS, ARCHITECTURES } from "./data.js";
import { prepare, clamp, YEAR0, YEAR_END } from "./scales.js";
import { makeText, LANGS } from "./i18n.js";
import { createPanel } from "./panel.js";

/**
 * Tapeout: thirty years of NVIDIA GPUs as a skyline. Each of 135 GPUs is a tower,
 * placed by release date along x and by market in four lanes, coloured by its
 * architecture. Its height is transistors (log or linear), process node or power.
 *
 * Built against the threejs-* skills: fundamentals (renderer, camera, ResizeObserver
 * resize, disposal), geometry (one shared box and edge geometry scaled per tower),
 * materials (standard materials with emissive glow, transparency for the check status),
 * lighting (hemisphere fill plus a key light) and interaction (OrbitControls, Raycaster
 * picking, keyboard).
 *
 * This file owns the state, the playback clock, input and the frame loop. It imports
 * no Three.js itself: the world is loaded with a dynamic import, so if WebGL or the CDN
 * is unavailable the page and its panel still come up, with a notice.
 */

const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const YEARS_PER_SECOND = 1.3; // at 1x the build from 1995 takes about 24 s
const CLICK_SLOP = 5; // px a pointer may travel and still count as a click
const HOVER_EVERY = 40; // ms between hover picks
const BOOT_FRAMES = 3; // frames drawn before the splash lifts
const BOOT_TIMEOUT = 6000; // ms; lift the splash anyway if the world has not arrived
const LANG_KEY = "tapeout-lang";
// Below this stage width, or taller than this aspect, 1995–2025 does not fit at a readable
// size, so the camera follows the year by default. The panel's checkbox or F overrides it.
const NARROW_PX = 760;
const NARROW_ASPECT = 0.9;
const FOLLOW_HOLD = 1.2; // s the camera keeps settling after the year stops moving

const $ = (id) => document.getElementById(id);
const stage = $("stage");
const view = $("view");
const tip = $("tip");
const boot = $("boot");

const model = prepare({ gpus: GPUS, markets: MARKETS, architectures: ARCHITECTURES });

const st = {
  year: YEAR_END, // releases on or before this decimal year are standing
  playing: false,
  speed: 1,
  metric: "transistors", // or "process", "power"
  tscale: "log", // or "linear"; applies to transistors
  markets: new Set(MARKETS),
  arch: null, // the spotlit architecture
  milestones: true,
  follow: null, // camera follows the year: null = automatic (on when the stage is narrow)
  followOn: false, // the effective setting, mirrored to the panel
};
let narrow = false;

let tx = makeText(initialLang());
let world = null;

const panel = createPanel({
  model,
  on: {
    play: () => setPlaying(!st.playing),
    showAll: () => {
      setYear(YEAR_END);
      if (followOn()) world?.home(); // following: step back out to the whole skyline
    },
    home: () => world?.home(),
    year: (y) => {
      setYear(y);
      if (followOn()) world?.frameFollow();
    },
    follow: setFollow,
    speed: (v) => {
      st.speed = v;
      refresh();
    },
    metric: (m) => {
      st.metric = m;
      refresh();
    },
    tscale: setScale,
    lang: setLang,
    arch: setArch,
    market: (id, on) => {
      if (on) st.markets.add(id);
      else st.markets.delete(id);
      refresh();
    },
    milestones: (on) => {
      st.milestones = on;
      refresh();
    },
    panel: setPanel,
  },
});

// ------------------------------------------------------------------ state --

function initialLang() {
  let lang = null;
  try {
    lang = new URLSearchParams(location.search).get("lang") || localStorage.getItem(LANG_KEY);
  } catch {
    /* storage blocked: fall back to English */
  }
  return lang && /^zh/i.test(lang) ? "zh" : "en";
}

function setPlaying(on) {
  if (on && st.year >= YEAR_END) st.year = YEAR0; // play from the start once the build is complete
  st.playing = on;
  if (on && followOn()) world?.frameFollow();
  refresh();
}

function followOn() {
  return st.follow ?? narrow;
}

/** Turns following on or off for this visit, overriding the narrow-stage default. */
function setFollow(on) {
  st.follow = on;
  if (on && st.playing) world?.frameFollow();
  refresh();
}

function measureStage() {
  const w = stage.clientWidth;
  const h = stage.clientHeight;
  narrow = w > 0 && h > 0 && (w < NARROW_PX || w / h < NARROW_ASPECT);
}

function setYear(y) {
  st.playing = false;
  st.year = clamp(y, YEAR0, YEAR_END);
  refresh();
}

/** The scale switch also puts the height on transistors, the only measure it applies to. */
function setScale(scale) {
  st.tscale = scale;
  st.metric = "transistors";
  refresh();
}

/** Spotlights an architecture; the same one again, or null, clears it. */
function setArch(id) {
  st.arch = id && id !== st.arch ? id : null;
  refresh();
}

function setPanel(open) {
  document.body.classList.toggle("collapsed", !open);
}

function setLang(lang) {
  if (!LANGS.includes(lang) || lang === tx.lang) return;
  tx = makeText(lang);
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    /* storage blocked: the choice lasts for this visit */
  }
  try {
    const url = new URL(location.href);
    url.searchParams.set("lang", lang);
    history.replaceState(null, "", url);
  } catch {
    /* sandboxed viewer */
  }
  applyLang();
}

function applyLang() {
  document.documentElement.lang = tx.s.htmlLang;
  document.title = tx.s.docTitle;
  panel.setText(tx);
  world?.setText(tx);
  hideTip();
  hudKey = "";
  refresh();
}

function refresh() {
  st.followOn = followOn();
  panel.sync(st, tx);
  updateHud();
}

let hudKey = "";
function updateHud() {
  const done = st.year >= YEAR_END;
  let n = 0;
  for (const g of model.gpus) if (st.markets.has(g.market) && g.year <= st.year) n++;
  const year = done ? `${YEAR0}–${model.lastYear}` : String(Math.floor(st.year));
  const sub = tx.s.hud(n, tx.measure(st.metric, st.tscale));
  if (year + sub === hudKey) return;
  hudKey = year + sub;
  $("year").textContent = year;
  $("hudSub").textContent = sub;
}

// ---------------------------------------------------------------- tooltip --

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
const esc = (v) => String(v).replace(/[&<>"]/g, (c) => ESCAPES[c]);
const STATUS_MARK = {
  verified: ["●", "#76b900"],
  corrected: ["●", "#76b900"],
  partial: ["◐", "#e0c341"],
  unverified: ["○", "#e57373"],
};

function gpuTip(g) {
  const s = tx.s;
  const rows = [
    [s.tip.market, s.marketNames[g.market]],
    [s.tip.process, g.nm ? `${g.nm} nm` : "—"],
    [s.tip.transistors, tx.transistors(g.transistors)],
    [s.tip.die, g.die ? `${g.die} mm²` : "—"],
    [s.tip.cores, g.cores ? tx.number(g.cores) : "—"],
    [s.tip.memory, tx.memory(g.memory, g.memType)],
    [s.tip.power, g.watts ? `${g.watts} W` : "—"],
    [s.tip.price, g.price ? tx.price(g.price) : "—"],
  ];
  const [mark, color] = STATUS_MARK[g.status] ?? STATUS_MARK.unverified;
  const note = tx.note(g);
  return (
    `<div class="h" style="border-color:${model.colors[g.arch]}">${esc(g.name)}</div>` +
    `<div class="s">${esc(tx.date(g.date))} · ${esc(g.arch)} · ${esc(g.chip)}</div>` +
    `<table>${rows.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join("")}</table>` +
    (note ? `<div class="f">${esc(note)}</div>` : "") +
    `<div class="v" style="color:${color}">${mark} ${esc(s.status[g.status])}</div>`
  );
}

function eraTip(e) {
  return (
    `<div class="h" style="border-color:${e.color}">${esc(e.id)}</div>` +
    `<div class="s">${esc(tx.s.era(e.count, e.firstYear, e.lastYear))}</div>`
  );
}

/** Places the tip beside the pointer, kept inside the stage so it never covers the panel. */
function showTip(html, clientX, clientY) {
  tip.innerHTML = html;
  tip.hidden = false;
  const r = stage.getBoundingClientRect();
  const x = clientX - r.left;
  const y = clientY - r.top;
  const w = tip.offsetWidth;
  const h = tip.offsetHeight;
  tip.style.left = `${x + 18 + w > r.width ? Math.max(4, x - w - 14) : x + 18}px`;
  tip.style.top = `${clamp(y - 10, 4, Math.max(4, r.height - h - 4))}px`;
}

function hideTip() {
  tip.hidden = true;
}

// ------------------------------------------------------------------ input --

let lastPick = 0;
let down = null;

function hover(hit, clientX, clientY) {
  world?.setHover(hit && hit.gpu != null ? hit.gpu : null);
  view.style.cursor = hit ? "pointer" : "";
  if (!hit) hideTip();
  else if (hit.gpu != null) showTip(gpuTip(model.gpus[hit.gpu]), clientX, clientY);
  else showTip(eraTip(model.eraById[hit.era]), clientX, clientY);
}

view.addEventListener("pointermove", (ev) => {
  if (!world) return;
  if (ev.buttons) {
    hover(null); // orbiting or panning: no tip
    return;
  }
  const now = performance.now();
  if (now - lastPick < HOVER_EVERY) return;
  lastPick = now;
  hover(world.pick(ev.clientX, ev.clientY), ev.clientX, ev.clientY);
});
view.addEventListener("pointerleave", () => hover(null));
view.addEventListener("pointerdown", (ev) => {
  down = ev.button === 0 ? [ev.clientX, ev.clientY] : null;
});
view.addEventListener("pointerup", (ev) => {
  if (!down || !world) return;
  const moved = Math.hypot(ev.clientX - down[0], ev.clientY - down[1]);
  down = null;
  if (moved > CLICK_SLOP) return;
  const hit = world.pick(ev.clientX, ev.clientY);
  // A click on a tower or a bar spotlights its architecture; on empty ground it clears.
  if (!hit) setArch(null);
  else setArch(hit.gpu != null ? model.gpus[hit.gpu].arch : hit.era);
});

window.addEventListener("keydown", (ev) => {
  const tag = ev.target?.tagName;
  if (ev.metaKey || ev.ctrlKey || ev.altKey || tag === "INPUT" || tag === "TEXTAREA") return;
  if (tag === "BUTTON" && (ev.code === "Space" || ev.code === "Enter")) return;
  switch (ev.code) {
    case "Space":
      ev.preventDefault();
      setPlaying(!st.playing);
      break;
    case "KeyL":
      setScale(st.tscale === "log" ? "linear" : "log");
      break;
    case "KeyR":
      world?.home();
      break;
    case "KeyF":
      setFollow(!followOn());
      break;
    case "Escape":
      setArch(null);
      break;
    case "KeyH":
      setPanel(document.body.classList.contains("collapsed"));
      break;
  }
});

// ------------------------------------------------------------------- loop --

function noWorld(err) {
  console.warn("3D scene unavailable:", err);
  try {
    world?.dispose();
  } catch {
    /* already broken; nothing more to release */
  }
  world = null;
  $("fallback").hidden = false;
}

async function loadWorld() {
  const { createWorld } = await import("./world.js");
  world = createWorld({ container: view, model, reducedMotion: REDUCED_MOTION });
  world.setText(tx);
}

let started = false;
let frames = 0;
let startAt = Infinity;
let rafId = 0;
let last = performance.now();
let seenYear = st.year;
let followHold = 0;

function start() {
  if (started) return;
  started = true;
  boot.classList.add("gone");
  setTimeout(() => boot.remove(), 1200);
}

function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (st.playing) {
    st.year = Math.min(YEAR_END, st.year + dt * YEARS_PER_SECOND * st.speed);
    if (st.year >= YEAR_END) {
      st.playing = false;
      panel.sync(st, tx);
    } else {
      panel.syncYear(st, tx);
    }
    updateHud();
  }
  if (world) {
    try {
      // Follow while the year moves (playing or scrubbing), then settle for a moment.
      if (st.playing || st.year !== seenYear) followHold = FOLLOW_HOLD;
      seenYear = st.year;
      if (followHold > 0) {
        followHold -= dt;
        if (followOn()) world.followYear(st.year, dt);
      }
      world.update(dt, st);
    } catch (err) {
      noWorld(err);
    }
  }
  if (++frames >= startAt) start();
  rafId = requestAnimationFrame(frame);
}

measureStage();
applyLang();
new ResizeObserver(() => {
  world?.resize();
  const was = narrow;
  measureStage();
  if (narrow !== was) refresh(); // the automatic follow setting may have flipped
}).observe(stage);

// The splash lifts a few frames after the world has loaded, or failed to.
loadWorld()
  .catch(noWorld)
  .then(() => {
    startAt = frames + BOOT_FRAMES;
  });
setTimeout(start, BOOT_TIMEOUT);
rafId = requestAnimationFrame(frame);

window.addEventListener("pagehide", () => {
  cancelAnimationFrame(rafId);
  world?.dispose();
  world = null;
});
