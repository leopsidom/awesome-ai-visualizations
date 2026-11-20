import { THREADS, AXIS, EVENTS, TODAY } from "./data.js";
import { clamp, prepare, schedule, locate, tauForU } from "./timeline.js";
import { createOverlay } from "./overlay.js";

/**
 * Groundswell — AI events from 1950 to today, ridden as a wave. After Mustafa
 * Suleyman's "The Coming Wave".
 *
 * Minor events scroll past like lyrics; each major event grows a story card out of
 * its marker and holds the timeline for a few seconds.
 *
 * Built against the threejs-* skills: fundamentals (renderer, camera, resize via
 * ResizeObserver, disposal), geometry (per-frame BufferGeometry updates, draw
 * ranges, shared marker geometry), materials (unlit MeshBasicMaterial so thread
 * colours match the HTML legend, additive beams), textures (CanvasTexture year
 * labels), animation (frame-rate-independent damping, procedural swell) and
 * interaction (Raycaster picking, keyboard, pointer scrubbing).
 *
 * This file owns playback state, input and the frame loop. It imports no Three.js
 * itself: the 3D world is loaded with a dynamic import, so if WebGL or the CDN is
 * unavailable the list, cards and axis still play.
 */

const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// The ride starts a little before 1950 and ends a little past today, where the wave rears up.
const U0 = -0.03;
const U1 = 1.03;
// With the event list showing, the 3D view is shifted right by this fraction of the
// stage width, so the "now" line sits clear of the list.
const VIEW_SHIFT = 0.13;
const WIDE_STAGE = 820; // px; below this the list spans the stage and nothing is shifted
const BOOT_FRAMES = 3; // frames drawn before the splash lifts
const BOOT_TIMEOUT = 6000; // ms; start without the 3D scene if it has not arrived by then

const $ = (id) => document.getElementById(id);
const stage = $("stage");
const view = $("view");
const boot = $("boot");
const playBtn = $("playBtn");

const model = prepare({ threads: THREADS, axis: AXIS, events: EVENTS });
const majors = model.events.filter((e) => e.tier === "major");
const lastYear = Math.floor(AXIS[AXIS.length - 1][0]);

// ---------------------------------------------------------- playback state --

const st = {
  playing: false,
  ended: false,
  tau: 0, // playback clock in seconds; it stops while a story card is open
  u: U0, // position on the axis
  time: 0, // wall clock for the swell, which never stops
  speed: 1,
  pauseSec: 5,
  autoPause: true,
  hold: 0, // seconds left on the open card
  holdTotal: 5,
  cur: -1, // index into `active` of the last event reached
  cardId: null,
  enabled: new Set(model.threads.map((t) => t.id)),
  active: [], // events on the enabled threads
  sch: null,
};

let world = null;
let shift = 0;

const overlay = createOverlay({
  model,
  majors,
  today: TODAY,
  onJump: jumpTo,
  onScrub: scrubTo,
  onThread: setThread,
});

// -------------------------------------------------------------- story card --

function openCard(e) {
  const p = world ? world.project(e.id) : null;
  const onStage = p && p.visible && p.x > 0 && p.x < stage.clientWidth && p.y > 0 && p.y < stage.clientHeight;
  overlay.openCard(e, onStage ? p : null);
  st.cardId = e.id;
  st.hold = st.holdTotal = st.pauseSec;
}

function closeCard() {
  if (!st.cardId) return;
  overlay.closeCard();
  st.cardId = null;
  st.hold = 0;
}

// --------------------------------------------------------------- transport --

function arrive(i, viaPlay) {
  st.cur = i;
  overlay.setCurrent(i);
  const e = st.active[i];
  // Auto-pause can be switched off for playback; a deliberate jump always opens the card.
  if (e && e.tier === "major" && (st.autoPause || !viaPlay)) openCard(e);
}

function jumpTo(id) {
  const i = st.active.findIndex((e) => e.id === id);
  if (i < 0) return;
  closeCard();
  st.ended = false;
  st.tau = st.sch.T[i];
  arrive(i, false);
  if (!st.playing) setPlaying(false);
}

function stepBy(d) {
  if (st.active.length) jumpTo(st.active[clamp(st.cur + d, 0, st.active.length - 1)].id);
}

function scrubTo(u) {
  closeCard();
  st.ended = false;
  st.tau = tauForU(st.sch, st.active, clamp(u, U0, U1), U0, U1);
  st.cur = locate(st.sch, st.active, st.tau, U0, U1).i;
  overlay.setCurrent(st.cur);
  if (!st.playing) setPlaying(false);
}

function restart() {
  closeCard();
  st.ended = false;
  st.tau = 0;
  st.cur = -1;
  overlay.setCurrent(-1);
  setPlaying(true);
}

function setPlaying(on) {
  if (on && st.ended) {
    restart();
    return;
  }
  st.playing = on;
  playBtn.textContent = on ? "Pause" : st.ended ? "Replay" : "Play";
}

/** Re-times the run for the enabled threads, keeping the current place on the axis. */
function rebuild() {
  st.active = model.events.filter((e) => st.enabled.has(e.thread));
  st.sch = schedule(st.active);
  overlay.setActive(st.active);
  if (st.cardId && !st.active.some((e) => e.id === st.cardId)) closeCard();
  st.tau = tauForU(st.sch, st.active, st.u, U0, U1);
  st.cur = locate(st.sch, st.active, st.tau, U0, U1).i;
  st.ended = false;
  world?.setEnabled(st.enabled);
  overlay.setCurrent(st.cur);
}

function setThread(id, on) {
  if (on) st.enabled.add(id);
  else st.enabled.delete(id);
  rebuild();
}

// ------------------------------------------------------------------- frame --

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

function step(dt) {
  st.time += dt * (REDUCED_MOTION ? 0.35 : 1);

  if (st.playing) {
    if (st.cardId) {
      // The timeline is held while a story card is open.
      st.hold -= dt;
      if (st.hold <= 0) closeCard();
    } else {
      const next = st.cur + 1;
      const tau = st.tau + dt * st.speed;
      if (next < st.active.length && tau >= st.sch.T[next]) {
        st.tau = st.sch.T[next];
        arrive(next, true);
      } else if (tau >= st.sch.end) {
        st.tau = st.sch.end;
        st.ended = true;
        setPlaying(false);
      } else {
        st.tau = tau;
      }
    }
  }

  st.u = locate(st.sch, st.active, st.tau, U0, U1).u;
  const u = clamp(st.u, 0, 1);
  overlay.setProgress(u, Math.min(lastYear, Math.floor(model.axis.toYear(u))));
  if (st.cardId) overlay.setHold(st.hold / st.holdTotal);

  if (world) {
    try {
      world.update({
        u: st.u,
        time: st.time,
        dt,
        curId: st.active[st.cur]?.id ?? null,
        focusId: st.cardId,
        shift,
      });
    } catch (err) {
      noWorld(err);
    }
  }
}

// ------------------------------------------------------------------ layout --

function layout() {
  const wide = stage.clientWidth > WIDE_STAGE && !stage.classList.contains("no-lyrics");
  shift = wide ? VIEW_SHIFT : 0;
  world?.resize();
  overlay.centre();
}

// The stage is observed, so it follows the panel as it slides away.
function setPanel(open) {
  document.body.classList.toggle("collapsed", !open);
}

// ------------------------------------------------------------------- input --

playBtn.addEventListener("click", () => setPlaying(!st.playing));
$("restartBtn").addEventListener("click", restart);
$("prevBtn").addEventListener("click", () => stepBy(-1));
$("nextBtn").addEventListener("click", () => stepBy(1));
$("speed").addEventListener("input", (ev) => {
  st.speed = Number(ev.target.value);
  $("speedOut").textContent = `${st.speed}x`;
});
$("pause").addEventListener("input", (ev) => {
  st.pauseSec = Number(ev.target.value);
  $("pauseOut").textContent = `${st.pauseSec} s`;
});
$("autoPause").addEventListener("change", (ev) => {
  st.autoPause = ev.target.checked;
});
$("showList").addEventListener("change", (ev) => {
  stage.classList.toggle("no-lyrics", !ev.target.checked);
  layout();
});
$("panelClose").addEventListener("click", () => setPanel(false));
$("panelOpen").addEventListener("click", () => setPanel(true));

window.addEventListener("keydown", (ev) => {
  const tag = ev.target?.tagName;
  if (ev.metaKey || ev.ctrlKey || ev.altKey || tag === "INPUT") return;
  if (tag === "BUTTON" && (ev.code === "Space" || ev.code === "Enter")) return;
  switch (ev.code) {
    case "Space":
      ev.preventDefault();
      setPlaying(!st.playing);
      break;
    case "ArrowRight":
      stepBy(1);
      break;
    case "ArrowLeft":
      stepBy(-1);
      break;
    case "KeyR":
      restart();
      break;
    case "KeyH":
      setPanel(document.body.classList.contains("collapsed"));
      break;
  }
});

// 3D markers: hover for the title, click to jump.
let lastPick = 0;
view.addEventListener("click", (ev) => {
  const id = world?.pick(ev.clientX, ev.clientY);
  if (id) jumpTo(id);
});
view.addEventListener("pointermove", (ev) => {
  if (!world) return;
  world.pointer(ev.clientX, ev.clientY);
  const now = performance.now();
  if (now - lastPick < 80) return;
  lastPick = now;
  const id = world.pick(ev.clientX, ev.clientY);
  const e = id ? model.events.find((x) => x.id === id) : null;
  view.style.cursor = e ? "pointer" : "";
  view.title = e ? `${e.label}: ${e.title}` : "";
});

// -------------------------------------------------------------------- loop --

async function loadWorld() {
  const { createWorld } = await import("./world.js");
  world = createWorld({ container: view, model, u0: U0, u1: U1 });
  world.setEnabled(st.enabled);
  layout();
}

let started = false;
let frames = 0;
let startAt = Infinity;
let rafId = 0;

function start() {
  if (started) return;
  started = true;
  boot.classList.add("gone");
  setTimeout(() => boot.remove(), 1200);
  setPlaying(true);
}

rebuild();
layout();
new ResizeObserver(layout).observe(stage);

// The splash lifts a few frames after the world has loaded, or failed to.
loadWorld()
  .catch(noWorld)
  .then(() => {
    startAt = frames + BOOT_FRAMES;
  });
setTimeout(start, BOOT_TIMEOUT);

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  step(dt);
  if (++frames >= startAt) start();
  rafId = requestAnimationFrame(frame);
}
rafId = requestAnimationFrame(frame);

// ----------------------------------------------------------------- cleanup --

window.addEventListener("pagehide", () => {
  cancelAnimationFrame(rafId);
  world?.dispose();
  world = null;
});
