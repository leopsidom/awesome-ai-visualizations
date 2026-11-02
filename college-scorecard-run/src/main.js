import * as THREE from "three";

import { createCampus } from "./campus.js";
import { createGate, disposeGateShared, LANE_X } from "./gates.js";
import { createRunner } from "./runner.js";
import { createFx } from "./fx.js";
import { makeQuestion, FACTS } from "./data.js";
import { makeRng, seedLabel, randomSeed } from "./rng.js";
import { createAudio } from "./audio.js";

/**
 * Cohort — a lane-runner across a college quad at dusk, where every gate is a
 * question from the College Scorecard.
 *
 * Built against the threejs-* skills: fundamentals (renderer, camera, Timer,
 * resize via ResizeObserver, Object3D hierarchy, disposal), geometry (Lathe
 * gown, primitive kit-bashing, InstancedMesh confetti), materials (Standard,
 * Lambert, Basic for legible signage, ShaderMaterial sky), textures
 * (CanvasTexture banners and façades, sRGB, repeat-wrapped scrolling ground),
 * lighting (hemisphere fill + a shadow-casting key that follows the runner),
 * animation (procedural run cycle, damped springs, eased reveals) and
 * interaction (keyboard, pointer halves of the stage).
 */

const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const MAX_PIXEL_RATIO = 2;

// Reading time is the whole game. The next question appears the moment the
// last gate is passed, and the runner then has (GATE_SPACING − COMMIT) metres
// to read it and pick: 81 m, about 7.7 s at standard pace on normal, ~9.6 s on
// relaxed. Speed creeps up per gate but is capped well below the old pace.
const GATE_SPACING = 96; // world units between arches
const FIRST_GATE = 100;
const COMMIT = 15; // the lane locks this far before the arch, so the reveal is seen
const LOOKAHEAD = 3; // gates built ahead of the runner
const BASE_SPEED = { easy: 9.5, normal: 10.5, hard: 12 };
const SPEED_STEP = 0.22;
const SPEED_MAX = 17;
const LIVES = 3;

// ---------------------------------------------------------------- renderer --

const stage = document.getElementById("view");
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
renderer.setClearColor(0x2a2f4f, 1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 900);

// Sound (src/audio.js). Every call is a no-op until the first key or tap
// unlocks the AudioContext, and the game runs silently if files are missing.
const audio = createAudio();
const TICK = "sfx_lock_warning_loop";
const WIND = "sfx_gown_wind_loop";
const lanePan = (l) => (l < 0 ? 0 : l === 0 ? -0.6 : 0.6);
let ticking = false;

const runner = createRunner(scene, {
  onStep: (foot, v) =>
    audio.play("sfx_footstep_brick", {
      pan: (foot ? 0.12 : -0.12) + runner.x * 0.05,
      gain: 0.55 + 0.25 * Math.min(1, v / SPEED_MAX),
      rate: 0.95 + Math.random() * 0.1,
    }),
});
const fx = createFx(scene);

// ----------------------------------------------------------------- overlay --

const $ = (id) => document.getElementById(id);
const ui = {
  score: $("score"),
  best: $("best"),
  gate: $("gate"),
  streak: $("streak"),
  lives: $("lives"),
  pace: $("pace"),
  nextLabel: $("nextLabel"),
  ask: $("ask"),
  askSub: $("askSub"),
  optL: $("optL"),
  optR: $("optR"),
  result: $("result"),
  fact: $("fact"),
  difficulty: $("difficulty"),
  length: $("length"),
  topics: $("topics"),
  seed: $("seed"),
  mode: $("mode"),
  titleCard: $("titleCard"),
  endCard: $("endCard"),
  endTitle: $("endTitle"),
  endHonor: $("endHonor"),
  endScore: $("endScore"),
  endFact: $("endFact"),
  flash: $("flash"),
  pauseBtn: $("pauseBtn"),
  boot: $("boot"),
  tempo: $("tempo"),
  hud: $("hud"),
  hudGate: $("hudGate"),
  hudLock: $("hudLock"),
  hudLockBar: $("hudLockBar"),
  hudLockText: $("hudLockText"),
  hudAsk: $("hudAsk"),
  hudSub: $("hudSub"),
  hudL: $("hudL"),
  hudR: $("hudR"),
};

const BEST_KEY = "cohort-best";
let best = Number(localStorage.getItem(BEST_KEY) || 0);
ui.best.textContent = best.toLocaleString("en-US");

// -------------------------------------------------------------- game state --

const params = new URLSearchParams(location.search);
let seed = Number.parseInt(params.get("seed") ?? "", 36);
if (!Number.isFinite(seed)) seed = randomSeed();

let state = "title"; // title | running | paused | over
let rng;
let campus = null;
let gates = [];
let spawned = 0;
let total = 20;
let difficulty = "normal";
let enabled = [];
let recent = [];
let answered = 0;
let correct = 0;
let score = 0;
let streak = 0;
let bestStreak = 0;
let lives = LIVES;
let runZ = 0;
let speed = 0;
let lockedLane = -1;
let shownGate = null;
let facts = [];
let factIdx = 0;
let endAt = -1;
let graduated = false;
let shake = 0;
let elapsed = 0;
let tempo = 1;
let meterStart = 1; // distance to the lock line when the current question appeared
let meterText = "";
let holdUntil = 0; // keep the answered gate in the bar briefly after the arch

function readSettings() {
  difficulty = ui.difficulty.value;
  total = Number(ui.length.value);
  tempo = Number(ui.tempo.value) || 1;
  enabled = [...ui.topics.querySelectorAll("input:checked")].map((i) => i.value);
  if (!enabled.length) {
    ui.topics.querySelector('input[value="earn"]').checked = true;
    enabled = ["earn"];
  }
}

function shuffled(arr, r) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function showFact(sound = false) {
  // A soft bell as the card fades in, held back so it never lands on the verdict.
  if (sound) audio.play("sfx_fact_card", { delay: 0.9 });
  ui.fact.style.opacity = 0;
  const text = facts[factIdx % facts.length];
  factIdx++;
  setTimeout(() => {
    ui.fact.textContent = text;
    ui.fact.style.opacity = 1;
  }, 200);
  return text;
}

function spawnGates() {
  while (spawned < total && gates.filter((g) => !g.passed).length < LOOKAHEAD) {
    const q = makeQuestion(rng, enabled, difficulty, new Set(recent));
    if (!q) {
      total = spawned; // the chosen topics ran out of pairs at this difficulty
      break;
    }
    recent.push(...q.ids);
    recent = recent.slice(-10);
    const z = -(FIRST_GATE + spawned * GATE_SPACING);
    spawned++;
    gates.push(createGate(scene, renderer, q, spawned, z, COMMIT));
  }
}

function nextGate() {
  return gates.find((g) => !g.passed) ?? null;
}

/** Throw the old run away and lay out a new one from `seed`. */
function newRun(fresh) {
  if (fresh) {
    seed = randomSeed();
    const url = new URL(location.href);
    url.searchParams.set("seed", seed.toString(36));
    history.replaceState(null, "", url);
  }
  readSettings();
  rng = makeRng(seed);

  campus?.dispose();
  campus = createCampus(scene, renderer, makeRng(seed ^ 0x9e3779b9));
  for (const g of gates) g.dispose();
  gates = [];
  spawned = 0;
  recent = [];

  runner.reset();
  fx.reset();
  runZ = 0;
  speed = 0;
  answered = correct = score = streak = bestStreak = 0;
  lives = LIVES;
  lockedLane = -1;
  shownGate = null;
  holdUntil = 0;
  meterText = "";
  endAt = -1;
  graduated = false;

  facts = shuffled(FACTS, makeRng(seed + 7));
  factIdx = 0;
  showFact();

  spawnGates();
  ui.result.textContent = "Nothing answered yet.";
  ui.seed.textContent = seedLabel(seed);
  state = "title";
  ui.endCard.classList.add("hidden");
  ui.titleCard.classList.remove("hidden");
  refreshStats();
  refreshMode();

  setTick(null);
  audio.stop(WIND);
  audio.duck(false);
  audio.setMusic("title", 1.5);
}

function start() {
  if (state === "over") newRun(true);
  if (state !== "title") return;
  state = "running";
  ui.titleCard.classList.add("hidden");
  refreshMode();

  audio.play("sfx_matriculate");
  audio.setMusic("run", 0.5); // a one-beat crossfade at 120 BPM
}

function togglePause() {
  if (state === "running") state = "paused";
  else if (state === "paused") state = "running";
  else return;
  refreshMode();

  const paused = state === "paused";
  audio.play(paused ? "sfx_pause" : "sfx_resume");
  audio.duck(paused);
}

/** The lock-warning tick: on inside 25 m of the lock line, faster and louder as it nears. */
function setTick(dist) {
  if (dist == null) {
    if (ticking) audio.stop(TICK, 0.08);
    ticking = false;
    return;
  }
  const k = THREE.MathUtils.clamp(1 - dist / 25, 0, 1);
  audio.loop(TICK, { rate: 1 + 0.6 * k, gain: 0.55 + 0.45 * k });
  ticking = true;
}

function refreshMode() {
  ui.mode.textContent = { title: "ready", running: "running", paused: "paused", over: "finished" }[state];
  ui.pauseBtn.textContent = state === "paused" ? "Resume" : "Pause";
}

function refreshStats() {
  ui.score.textContent = score.toLocaleString("en-US");
  ui.gate.textContent = `${answered} / ${total}`;
  const mult = 1 + Math.floor(streak / 3);
  ui.streak.textContent = streak ? `${streak} ×${mult}` : "0";
  ui.lives.innerHTML = "◆".repeat(lives) + `<span class="lost">${"◆".repeat(LIVES - lives)}</span>`;
}

function fillOpt(el, side, picked) {
  el.style.setProperty("--c", side.color);
  el.querySelector("b").textContent = side.title;
  el.querySelector("span").textContent = side.line;
  el.classList.toggle("pick", picked);
}

// ---- question bar (the strip above the 3D view)

function fillHud(el, side) {
  el.style.setProperty("--c", side.color);
  el.querySelector(".nm b").textContent = side.title;
  el.querySelector(".nm span").textContent = `${side.line} · ${side.tagline}`;
  el.querySelector(".val").textContent = "";
  el.classList.remove("win", "lose");
}

/** Highlight whichever lane the runner is heading for, before and after the lock. */
function hudPick(lane) {
  ui.hudL.classList.toggle("pick", lane === 0);
  ui.hudR.classList.toggle("pick", lane === 1);
  ui.optL.classList.toggle("pick", lane === 0);
  ui.optR.classList.toggle("pick", lane === 1);
}

function setMeter(text, frac, cls) {
  if (text !== meterText) {
    ui.hudLockText.textContent = text;
    meterText = text;
  }
  ui.hudLockBar.style.width = `${Math.round(THREE.MathUtils.clamp(frac, 0, 1) * 100)}%`;
  ui.hudLock.classList.toggle("soon", cls === "soon");
  ui.hudLock.classList.toggle("done", cls === "done");
}

/** Per frame: how far to the lock line for the gate being asked. */
function updateMeter() {
  const g = shownGate;
  if (!g || g.locked) {
    setTick(null); // showLock / resolve own the bar from here
    return;
  }
  if (state !== "running") {
    setTick(null);
    setMeter(state === "paused" ? "paused" : "pick a lane to start", 0, "");
    return;
  }
  const dist = Math.max(0, runZ - g.lockZ);
  const picked = runner.chosen >= 0;
  const text = `${picked ? "" : "pick a lane · "}locks in ${Math.ceil(dist)} m`;
  setMeter(text, 1 - dist / meterStart, dist < 25 ? "soon" : "");
  setTick(dist < 25 ? dist : null);
}

function showNext(g) {
  shownGate = g;
  ui.hud.classList.remove("locked");
  if (!g) {
    ui.nextLabel.textContent = "Next gate";
    ui.ask.textContent = answered >= total ? "Run complete" : "—";
    ui.askSub.textContent = "";
    return;
  }
  const q = g.question;
  ui.nextLabel.textContent = `Gate ${answered + 1} of ${total}`;
  ui.ask.textContent = q.metric.ask;
  ui.askSub.textContent = q.metric.sub;
  fillOpt(ui.optL, q.sides[0], false);
  fillOpt(ui.optR, q.sides[1], false);

  ui.hudGate.textContent = `Gate ${answered + 1} / ${total} · ${q.metric.tag}`;
  ui.hudAsk.textContent = q.metric.ask;
  ui.hudSub.textContent = q.metric.sub;
  fillHud(ui.hudL, q.sides[0]);
  fillHud(ui.hudR, q.sides[1]);
  hudPick(runner.chosen);
  meterStart = Math.max(1, runZ - g.lockZ);
  updateMeter();
  if (state === "running") audio.play("sfx_question_appear");
}

function showLock(lane) {
  ui.nextLabel.textContent = `Gate ${answered + 1} of ${total} · locked`;
  ui.hud.classList.add("locked");
  hudPick(lane);
  setMeter(lane < 0 ? "🔒 locked · no lane picked" : "🔒 locked · run it through", 1, "done");
  setTick(null);
  audio.play(lane < 0 ? "sfx_lock_undeclared" : "sfx_lock_commit", { pan: lanePan(lane) });
  audio.play("sfx_columns_rise", { delay: 0.05 });
  // The numbers rise in the world now; show them in the bar as well.
  const q = shownGate?.question;
  if (q) {
    [ui.hudL, ui.hudR].forEach((el, i) => {
      el.querySelector(".val").textContent = q.sides[i].label;
      el.classList.add(i === q.answer ? "win" : "lose");
    });
  }
}

function nudgeLocked() {
  audio.play("sfx_lane_refused");
  ui.hudLock.classList.remove("nudge");
  void ui.hudLock.offsetWidth;
  ui.hudLock.classList.add("nudge");
}

function resolve(g, lane) {
  answered++;
  const q = g.question;
  const ok = lane === q.answer;
  const [L, R] = q.sides;
  const win = q.answer === 0 ? L : R;
  const lose = q.answer === 0 ? R : L;

  let verdict;
  if (ok) {
    correct++;
    streak++;
    bestStreak = Math.max(bestStreak, streak);
    const mult = 1 + Math.floor(streak / 3);
    const pts = 100 * mult + Math.round(speed * 2);
    score += pts;
    verdict = `<span class="verdict good">✓ Correct · +${pts}</span>`;
    fx.burst(new THREE.Vector3((lane === 0 ? -1 : 1) * LANE_X, 3, g.z), 90, -speed * 0.5);
    runner.cheer();
    audio.play("sfx_correct");
    audio.play("sfx_confetti_pop", { pan: lanePan(lane), delay: 0.04 });
    audio.play("sfx_cap_toss", { delay: 0.08, gain: 0.8 });
    // Every third in a row: the multiplier steps up, one semitone higher each level.
    if (streak % 3 === 0) audio.play("sfx_multiplier_up", { rate: 2 ** ((mult - 2) / 12), delay: 0.45 });
    ui.score.classList.remove("bump");
    void ui.score.offsetWidth;
    ui.score.classList.add("bump");
  } else {
    lives--;
    streak = 0;
    verdict =
      lane < 0
        ? `<span class="verdict bad">✗ Undeclared, no lane picked</span>`
        : `<span class="verdict bad">✗ Not this time</span>`;
    runner.stumble();
    audio.play(lane < 0 ? "sfx_undeclared" : "sfx_wrong");
    audio.play("sfx_stumble", { delay: 0.05 });
    audio.play("sfx_credit_lost", { delay: 0.15 });
    if (lives === 1) audio.play("sfx_last_credit_warning", { delay: 0.6 });
    if (!REDUCED_MOTION) shake = 0.45;
    ui.flash.classList.add("on");
    setTimeout(() => ui.flash.classList.remove("on"), 60);
  }

  setMeter(ok ? "✓ correct" : lane < 0 ? "✗ undeclared" : "✗ not this time", 1, ok ? "" : "done");
  holdUntil = elapsed + 0.9;

  ui.result.innerHTML =
    verdict +
    `<b style="color:var(--ink)">${win.title}</b> ${win.label} vs ${lose.title} ${lose.label}` +
    `<br><span style="color:var(--faint)">${q.metric.sub}</span>`;

  if (answered % 4 === 0) showFact(true);
  refreshStats();

  if (lives <= 0) {
    endAt = elapsed + 1.2;
    graduated = false;
  } else if (answered >= total) {
    endAt = elapsed + 1.4;
    graduated = true;
  }
  if (endAt > 0) audio.fadeMusic(1.1); // clear the floor for the end stinger
}

function honour(acc) {
  if (acc >= 0.9) return "Summa cum laude";
  if (acc >= 0.75) return "Magna cum laude";
  if (acc >= 0.6) return "Cum laude";
  return "With a degree, and that counts";
}

function finish() {
  state = "over";
  endAt = -1;
  refreshMode();

  setTick(null);
  audio.stop(WIND, 0.8);
  audio.stinger(graduated ? "music_win_commencement" : "music_lose_withdrawn");
  if (score > best && score > 0) audio.play("sfx_new_best", { delay: 1.5 });

  if (score > best) {
    best = score;
    localStorage.setItem(BEST_KEY, String(best));
    ui.best.textContent = best.toLocaleString("en-US");
  }
  const acc = answered ? correct / answered : 0;
  ui.endTitle.textContent = graduated ? "Commencement" : "Withdrawn";
  ui.endHonor.textContent = graduated ? honour(acc) : `Out of credits at gate ${answered} of ${total}`;
  ui.endScore.textContent =
    `Score ${score.toLocaleString("en-US")} · ${correct} of ${answered} right (${Math.round(acc * 100)}%)` +
    ` · best streak ${bestStreak}`;
  ui.endFact.textContent = facts[factIdx % facts.length];
  factIdx++;
  ui.endCard.classList.remove("hidden");

  if (graduated) {
    const p = runner.root.position;
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        fx.burst(new THREE.Vector3(p.x + (i - 1) * 3, 4, p.z - 6), 80, 0);
        audio.play(`sfx_confetti_pop_0${1 + (i % 2)}`, { pan: (i - 1) * 0.5 });
      }, i * 260);
    }
    runner.cheer();
    audio.play("sfx_cap_toss", { delay: 0.1 });
  }
}

// ------------------------------------------------------------------- input --

function chooseLane(l) {
  if (state === "title") start();
  if (state !== "running") return;
  const g = nextGate();
  if (g && g.locked) {
    nudgeLocked(); // committed until through the arch: say so
    return;
  }
  const prev = runner.chosen;
  runner.setLane(l);
  hudPick(l);
  if (l !== prev) audio.play("sfx_lane_swish", { pan: lanePan(l) });
}

window.addEventListener("keydown", (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  if (event.target instanceof HTMLSelectElement) return;
  if (event.target instanceof HTMLInputElement && event.target.type === "range") return; // arrows move the slider

  switch (event.code) {
    case "ArrowLeft":
    case "KeyA":
      event.preventDefault();
      chooseLane(0);
      break;
    case "ArrowRight":
    case "KeyD":
      event.preventDefault();
      chooseLane(1);
      break;
    case "Space":
    case "KeyP":
      event.preventDefault();
      if (state === "title" || state === "over") start();
      else togglePause();
      break;
    case "Enter":
      if (state === "title" || state === "over") start();
      break;
    case "KeyR":
      newRun(true);
      start();
      break;
    case "KeyH":
      document.body.classList.toggle("collapsed");
      break;
    case "KeyM":
      audio.toggleMute();
      break;
  }
});

renderer.domElement.addEventListener("pointerdown", (event) => {
  const rect = renderer.domElement.getBoundingClientRect();
  chooseLane(event.clientX - rect.left < rect.width / 2 ? 0 : 1);
});

const click = () => audio.play("sfx_ui_click");
$("startBtn").addEventListener("click", () => {
  click();
  start();
});
$("againBtn").addEventListener("click", () => {
  click();
  newRun(true);
  start();
});
$("restartBtn").addEventListener("click", () => {
  click();
  newRun(true);
  start();
});
ui.pauseBtn.addEventListener("click", togglePause); // has its own pause / resume cue

// ---- sound panel (side panel only, never over the scene)
const muteBtn = $("muteBtn");
const volIn = $("vol");
const musicIn = $("musicVol");
const audioStatus = $("audioStatus");
function refreshSound(status) {
  const on = audio.prefs.on;
  muteBtn.textContent = on ? "Sound: on" : "Sound: off";
  muteBtn.classList.toggle("off", !on);
  audioStatus.textContent = status ?? audio.status;
}
volIn.value = Math.round(audio.prefs.vol * 100);
musicIn.value = Math.round(audio.prefs.music * 100);
muteBtn.addEventListener("click", () => {
  audio.toggleMute();
  click();
});
volIn.addEventListener("input", () => audio.setVolume(volIn.value / 100));
musicIn.addEventListener("input", () => audio.setMusicVolume(musicIn.value / 100));
volIn.addEventListener("change", click);
audio.onStatus(refreshSound);

// Settings rebuild the waiting run straight away; mid-run they apply next time.
function onSettings() {
  click();
  if (state === "title") newRun(false);
  else ui.mode.textContent = "settings apply to the next run";
}
ui.difficulty.addEventListener("change", onSettings);
ui.length.addEventListener("change", onSettings);
ui.tempo.addEventListener("change", onSettings);
ui.topics.addEventListener("change", onSettings);

document.addEventListener("visibilitychange", () => {
  if (document.hidden) audio.suspend();
  if (document.hidden && state === "running") togglePause();
  if (!document.hidden) audio.resume();
});

// ------------------------------------------------------------------ resize --

function onResize() {
  const w = stage.clientWidth;
  const h = stage.clientHeight;
  if (!w || !h) return;
  camera.aspect = w / h;
  // A tall, narrow stage (phones, the collapsed layout) needs a wider lens to
  // keep both arches in frame.
  camera.fov = camera.aspect < 1 ? 72 : 55;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
  renderer.setSize(w, h);
}
new ResizeObserver(onResize).observe(stage);
onResize();

// -------------------------------------------------------------- camera rig --

const camPos = new THREE.Vector3(0, 4.6, 9.5);
const look = new THREE.Vector3();

function updateCamera(dt) {
  const idle = state === "title" || state === "over";
  const sway = idle ? Math.sin(elapsed * 0.35) * 2.2 : 0;
  const tx = runner.x * 0.55 + sway;
  camPos.x += (tx - camPos.x) * (1 - Math.exp(-5 * dt));
  camPos.y = idle ? 4.2 + Math.sin(elapsed * 0.25) * 0.4 : 4.6;
  camPos.z = runZ + 9.5;
  camera.position.copy(camPos);
  if (shake > 0) {
    camera.position.x += (Math.random() - 0.5) * shake;
    camera.position.y += (Math.random() - 0.5) * shake;
    shake *= Math.exp(-6 * dt);
    if (shake < 0.01) shake = 0;
  }
  look.set(runner.x * 0.35, 3.4, runZ - 16);
  camera.lookAt(look);
}

// -------------------------------------------------------------------- loop --

newRun(false);
updateCamera(0.016);
campus.update(runZ);

// Link every program before frame one, so the splash fades over a picture.
await renderer.compileAsync(scene, camera).catch(() => {});

const timer = new THREE.Timer();
timer.connect(document);
let framesDrawn = 0;
let paceDue = 0;
const BOOT_FRAMES = 3;

renderer.setAnimationLoop(() => {
  timer.update();
  const dt = Math.min(timer.getDelta(), 0.05);
  const live = state === "running";
  if (state !== "paused") elapsed += dt;

  if (live) {
    speed = Math.min(SPEED_MAX, BASE_SPEED[difficulty] + SPEED_STEP * answered) * tempo;
    runZ -= speed * dt;

    const g = nextGate();
    if (g) {
      if (!g.locked && runZ <= g.z + COMMIT) {
        lockedLane = runner.chosen;
        g.reveal(lockedLane);
        showLock(lockedLane);
      }
      if (g.locked && !g.passed && runZ <= g.z) {
        g.pass();
        if (lockedLane >= 0) audio.play("sfx_veil_burst", { pan: lanePan(lockedLane) });
        resolve(g, lockedLane);
      }
    }
    if (g !== shownGate && (!g || !g.locked) && elapsed >= holdUntil) showNext(nextGate());

    spawnGates();
    gates = gates.filter((gate) => {
      if (gate.passed && gate.z > runZ + 40) {
        gate.dispose();
        return false;
      }
      return true;
    });

    // Gown and wind follow the pace; the intense music layer comes in on the
    // last credit, the final quarter of the run, or at high speed, with a lift
    // while the lock tick is running. Both calls only act on a change.
    if (endAt < 0) {
      const v = speed / SPEED_MAX;
      audio.loop(WIND, { gain: 0.3 + 0.7 * v, rate: 0.9 + 0.3 * v });
      const tense = lives === 1 || answered >= total * 0.75 || speed >= 15;
      audio.setIntensity(tense ? (ticking ? 1.4 : 1) : 0);
    }

    if (endAt > 0 && elapsed >= endAt) finish();
  } else if (state === "title" && shownGate === null) {
    showNext(nextGate());
  }

  if (state !== "paused") {
    runner.update(dt, live ? speed : 0);
    runner.root.position.z = runZ;
    for (const gate of gates) gate.update(dt, elapsed, runZ);
    fx.update(dt);
  }
  updateMeter();

  campus.update(runZ);
  updateCamera(dt);
  renderer.render(scene, camera);

  paceDue -= dt;
  if (paceDue <= 0) {
    ui.pace.textContent = live ? `${speed.toFixed(1)} m/s` : "—";
    paceDue = 0.25;
  }

  framesDrawn++;
  if (framesDrawn === BOOT_FRAMES) {
    ui.boot.classList.add("gone");
    audio.play("sfx_boot_whoosh"); // only heard if sound was already unlocked
    setTimeout(() => ui.boot.remove(), 1200);
  }
});

// ----------------------------------------------------------------- cleanup --

window.addEventListener("pagehide", () => {
  renderer.setAnimationLoop(null);
  for (const g of gates) g.dispose();
  disposeGateShared();
  campus?.dispose();
  runner.dispose();
  fx.dispose();
  renderer.dispose();
  audio.dispose();
});
