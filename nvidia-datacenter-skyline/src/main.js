/**
 * The AI Factory: NVIDIA's 19 data-center GPUs as racks in a data hall.
 *
 * One rack per GPU, in release order along an aisle. Height is the chosen measure (log),
 * depth is memory, glow and floor heat are board power, colour is architecture, and how
 * solid a rack is says how well its row was checked. Focusing a rack (click, tap, ← →, or
 * playback) glides the camera to it and zooms a detail card out of the rack.
 *
 * Everything is in this one module: state, scene, camera rig, detail card, panel, input and
 * the frame loop. Strings and formats come from i18n.js, the data from data.js.
 */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CSS2DRenderer, CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import { GPUS } from "./data.js";
import { LANGS, makeText } from "./i18n.js";

// Racks are coloured on one NVIDIA-green ramp by the value of the chosen measure: deep green for the
// smallest, NVIDIA green in the middle, pale lime for the largest. The ramp runs on the log of the value,
// so the early racks stay distinguishable even when the heights are linear.
const RAMP = [new THREE.Color("#2f8a3a"), new THREE.Color("#76b900"), new THREE.Color("#c8f56a")];
const ramp = (t, out = new THREE.Color()) =>
  t < 0.5 ? out.lerpColors(RAMP[0], RAMP[1], t * 2) : out.lerpColors(RAMP[1], RAMP[2], (t - 0.5) * 2);
const MEASURE_KEYS = ["transistors", "memory", "watts", "cores"];
const H_MIN = 0.8, H_MAX = 12; // rack height range in world units (log scale runs H_MIN..H_MAX)
const H_FLOOR = 0.25; // linear scale: the smallest racks keep this height so they can still be seen and clicked
const SLOT = 2.4, WIDTH = 1.3, FOV = 40;
// Playback gives every GPU the same slot, so every card is held for the same time; the year counter
// moves between release dates inside each slot. At 1× a run of 19 GPUs takes about 48 s.
const SLOT_SEC = 2.5;
const END = 2025.99;
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------- language
const LANG_KEY = "ai-factory-lang";
function initialLang() {
  const q = new URLSearchParams(location.search).get("lang");
  if (LANGS.includes(q)) return q;
  const saved = localStorage.getItem(LANG_KEY);
  if (LANGS.includes(saved)) return saved;
  return navigator.language?.toLowerCase().startsWith("zh") ? "zh" : "en";
}
let T = makeText(initialLang());

// ---------------------------------------------------------------- data and scales
const toYear = (d) => { const [y, m, dd] = d.split("-").map(Number); return y + (m - 1 + ((dd ?? 15) - 1) / 30) / 12; };
GPUS.forEach((g, i) => { g.t = toYear(g.date); g.i = i; });
const N = GPUS.length;
const range = (k) => { const v = GPUS.map((g) => g[k]).filter((x) => x != null); return [Math.min(...v), Math.max(...v)]; };
const R = Object.fromEntries(MEASURE_KEYS.map((k) => [k, range(k)]));
const logN = (k, v) => { const [a, b] = R[k]; return (Math.log(v) - Math.log(a)) / (Math.log(b) - Math.log(a)); };
/** Rack height for a measure on the current scale; null when the GPU has no figure. */
const heightOf = (g, k) => {
  if (g[k] == null) return null;
  if (S.scale === "log") return H_MIN + (H_MAX - H_MIN) * logN(k, g[k]);
  return Math.max(H_FLOOR, (H_MAX * g[k]) / R[k][1]);
};
const depthOf = (g) => 0.9 + 2.6 * Math.sqrt(g.memory / R.memory[1]);
const heatOf = (g) => (g.watts == null ? 0 : logN("watts", g.watts));
const shortName = (g) => g.name.replace("Tesla ", "").replace(" (Blackwell Ultra)", "");

// ---------------------------------------------------------------- renderer and scene
const stage = $("stage");
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setClearColor(0x000000, 0);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
stage.prepend(renderer.domElement);
const labelR = new CSS2DRenderer();
// z-index 1 makes the label layer its own stacking context, so the labels (which CSS2DRenderer
// depth-sorts with large z-indexes) stay under the detail card.
labelR.domElement.style.cssText = "position:absolute;inset:0;pointer-events:none;z-index:1";
renderer.domElement.after(labelR.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog("#0b140c", 90, 230);
const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 500);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = !reduced;
controls.maxPolarAngle = Math.PI * 0.49;
controls.minDistance = 8;
controls.maxDistance = 190;
scene.add(new THREE.HemisphereLight("#e4f5d8", "#1a2416", 1.0));
const key = new THREE.DirectionalLight("#ffffff", 1.9);
key.position.set(-20, 40, 30);
scene.add(key);

const X0 = -((N - 1) * SLOT) / 2;
const xOf = (i) => X0 + i * SLOT;

// floor, aisle stripe and year marks
const hallW = N * SLOT + 40;
const floor = new THREE.Mesh(new THREE.PlaneGeometry(hallW, 60), new THREE.MeshStandardMaterial({ color: "#111d12", roughness: 0.9, transparent: true, opacity: 0.6, depthWrite: false }));
floor.rotation.x = -Math.PI / 2;
scene.add(floor);
const grid = new THREE.GridHelper(hallW, Math.round(hallW / 1.2), "#2c4524", "#1a2b17");
grid.position.y = 0.002;
scene.add(grid);
const aisle = new THREE.Mesh(new THREE.PlaneGeometry(N * SLOT + 6, 0.12), new THREE.MeshBasicMaterial({ color: "#76b900", transparent: true, opacity: 0.5 }));
aisle.rotation.x = -Math.PI / 2;
aisle.position.set(0, 0.01, 3.2);
scene.add(aisle);
let lastYear = 0;
for (const g of GPUS) {
  const y = Math.floor(g.t);
  if (y === lastYear) continue;
  lastYear = y;
  const d = document.createElement("div");
  d.className = "yrl";
  d.textContent = y;
  const o = new CSS2DObject(d);
  o.position.set(xOf(g.i) - SLOT * 0.35, 0, 4.2);
  scene.add(o);
  const tick = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 1.0), new THREE.MeshBasicMaterial({ color: "#3b5a2c" }));
  tick.rotation.x = -Math.PI / 2;
  tick.position.set(xOf(g.i) - SLOT / 2, 0.012, 3.2);
  scene.add(tick);
}

// Backdrop: a large, faded silicon wafer behind the hall: a grid of dies with faint circuit
// blocks and a green rim.
// A small hash stands in for randomness, so the wafer looks the same on every load.
const hash = (i, j) => { const x = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return x - Math.floor(x); };
const waferCanvas = (() => {
  const S2 = 2048, c = document.createElement("canvas"); c.width = c.height = S2;
  const x = c.getContext("2d"), cx = S2 / 2, R2 = S2 / 2 - 24, flat = R2 * 0.96; // flat edge (the wafer's "notch") at the bottom
  const inside = (px, py) => (px - cx) ** 2 + (py - cx) ** 2 <= R2 * R2 && py - cx <= flat;
  x.save();
  x.beginPath(); x.arc(cx, cx, R2, 0, Math.PI * 2); x.clip();
  x.beginPath(); x.rect(0, 0, S2, cx + flat); x.clip();
  const bg = x.createRadialGradient(cx, cx * 0.9, 0, cx, cx, R2);
  bg.addColorStop(0, "#2a3d24"); bg.addColorStop(0.7, "#17241a"); bg.addColorStop(1, "#0c140d");
  x.fillStyle = bg; x.fillRect(0, 0, S2, S2);
  const dw = 92, dh = 116, gap = 8; // die size and street width, px
  for (let j = 0; j * (dh + gap) < S2; j++) for (let i = 0; i * (dw + gap) < S2; i++) {
    const l = i * (dw + gap) + 14, t = j * (dh + gap) + 10, r = hash(i, j);
    const whole = inside(l, t) && inside(l + dw, t) && inside(l, t + dh) && inside(l + dw, t + dh);
    x.fillStyle = `rgba(118,185,0,${whole ? 0.05 + 0.07 * r + (r > 0.94 ? 0.22 : 0) : 0.025})`;
    x.fillRect(l, t, dw, dh);
    if (!whole) continue;
    x.strokeStyle = "rgba(150,220,80,0.22)"; x.lineWidth = 1.5; x.strokeRect(l + 0.5, t + 0.5, dw - 1, dh - 1);
    // a few functional blocks and traces inside each die
    x.strokeStyle = "rgba(150,220,80,0.13)"; x.lineWidth = 1;
    x.strokeRect(l + 10, t + 10, dw * 0.45, dh * 0.38);
    x.strokeRect(l + dw * 0.6, t + 10, dw * 0.3, dh * 0.6);
    x.strokeRect(l + 10, t + dh * 0.58, dw * 0.45, dh * 0.3);
    x.beginPath();
    for (let k = 0; k < 4; k++) { const yy = t + dh * (0.2 + 0.18 * k + 0.05 * hash(k, i + j)); x.moveTo(l + 6, yy); x.lineTo(l + dw - 6, yy); }
    x.stroke();
  }
  // iridescence: real wafers throw a rainbow sheen, which also gives the backdrop some colour
  x.globalCompositeOperation = "screen";
  const sheen = x.createConicGradient(-0.6, cx, cx);
  ["#ff4f9a", "#ffb347", "#f6ff6b", "#5dff9c", "#3fd3ff", "#7a6bff", "#ff4fd8", "#ff4f9a"].forEach((c, k, a) => sheen.addColorStop(k / (a.length - 1), c));
  x.globalAlpha = 0.26; x.fillStyle = sheen; x.fillRect(0, 0, S2, S2);
  x.globalCompositeOperation = "screen"; x.globalAlpha = 1;
  const spec = x.createLinearGradient(0, 0, S2, S2); // a soft diagonal highlight
  spec.addColorStop(0.25, "rgba(255,255,255,0)"); spec.addColorStop(0.42, "rgba(255,255,255,0.16)"); spec.addColorStop(0.6, "rgba(255,255,255,0)");
  x.fillStyle = spec; x.fillRect(0, 0, S2, S2);
  x.globalCompositeOperation = "source-over";
  x.restore();
  // the rim, with a soft glow
  x.save(); x.shadowColor = "rgba(118,185,0,0.9)"; x.shadowBlur = 40; x.strokeStyle = "rgba(118,185,0,0.55)"; x.lineWidth = 6;
  const a0 = Math.acos(flat / R2);
  x.beginPath(); x.arc(cx, cx, R2, Math.PI / 2 + a0, Math.PI / 2 - a0 + Math.PI * 2); x.closePath(); x.stroke(); x.restore();
  return c;
})();
// It is drawn behind the (transparent) WebGL canvas rather than in the scene, so the whole disc
// stays in view at any camera angle and stage size; index.html sizes, fades and turns it.
waferCanvas.id = "wafer";
stage.prepend(waferCanvas);

// textures: floor heat halo and the rack face (blade slots)
const haloTex = (() => {
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const x = c.getContext("2d"), gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, "rgba(255,140,40,1)"); gr.addColorStop(0.4, "rgba(255,80,20,.45)"); gr.addColorStop(1, "rgba(255,40,0,0)");
  x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
})();
const slotTex = (() => {
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const x = c.getContext("2d");
  x.fillStyle = "#fff"; x.fillRect(0, 0, 64, 64);
  x.fillStyle = "#000"; x.fillRect(0, 56, 64, 8); x.fillRect(0, 0, 4, 64); x.fillRect(60, 0, 4, 64);
  x.fillStyle = "#666"; x.fillRect(48, 28, 6, 4);
  const tx = new THREE.CanvasTexture(c); tx.wrapS = tx.wrapT = THREE.RepeatWrapping;
  return tx;
})();

// how solid a rack looks is how well its row was checked
const LOOK = { verified: { fill: 0.95, edge: 0.35 }, corrected: { fill: 0.95, edge: 0.35 }, partial: { fill: 0.42, edge: 0.6 }, unverified: { fill: 0.07, edge: 1 } };
const box = new THREE.BoxGeometry(1, 1, 1);
box.translate(0, 0.5, 0);
const edgesG = new THREE.EdgesGeometry(box);
const WHITE = new THREE.Color("#ffffff");
const GREY = new THREE.Color("#4a524a"); // no figure for the chosen measure

let msCount = 0;
const racks = GPUS.map((g) => {
  const col = ramp(0.5); // recoloured by applyMeasure
  const look = LOOK[g.status] ?? LOOK.unverified;
  const grp = new THREE.Group();
  grp.position.x = xOf(g.i);
  scene.add(grp);
  const face = slotTex.clone(); face.needsUpdate = true;
  const mat = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveMap: face, map: face, roughness: 0.55, metalness: 0.25,
    transparent: look.fill < 0.9, opacity: look.fill, depthWrite: look.fill > 0.9 });
  const mesh = new THREE.Mesh(box, mat); mesh.userData.i = g.i; grp.add(mesh);
  const edge = new THREE.LineSegments(edgesG, new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: look.edge }));
  grp.add(edge);
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: haloTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.rotation.x = -Math.PI / 2; halo.position.y = 0.02;
  const hs = g.watts == null ? 0 : 1.6 + 4.5 * heatOf(g);
  halo.scale.set(hs, hs, 1); grp.add(halo);
  const el = document.createElement("div");
  el.className = "lbl" + (g.milestone ? " ms" : "");
  const lbl = new CSS2DObject(el); grp.add(lbl);
  return { g, grp, mesh, edge, halo, mat, face, lbl, el, h: 0, target: 1, grow: 0, col, look, depth: depthOf(g), missing: false,
    msIdx: g.milestone ? msCount++ : -1 };
});

// ---------------------------------------------------------------- state
const S = { measure: "transistors", scale: "linear", year: END, pos: N, playing: false, speed: 1, hover: null, focus: null, follow: true, narrow: false };

function applyMeasure() {
  for (const r of racks) {
    const h = heightOf(r.g, S.measure);
    r.missing = h == null; r.target = h ?? 0.35;
    if (!r.missing) ramp(logN(S.measure, r.g[S.measure]), r.col);
    const c = r.missing ? GREY : r.col;
    r.mat.color.copy(c); r.mat.emissive.copy(c);
  }
  $("hudm").textContent = T.s.hud(T.s.measures[S.measure], T.s.scaleWords[S.scale]);
  document.querySelectorAll("[data-scale]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.scale === S.scale)));
  if (S.focus != null) updateCard();
  if (S.focus != null) frameFocus(false);
}

// ---------------------------------------------------------------- camera rig
// Glides target and camera together, so an orbit angle the viewer chose is kept while it follows.
const DIR_HOME = new THREE.Vector3(-0.22, 0.34, 0.95).normalize();
const DIR_FOCUS = new THREE.Vector3(-0.34, 0.3, 0.9).normalize();
const rig = { target: new THREE.Vector3(), dist: 40, dir: null, until: 0, track: false };
const view = { ox: 0, oy: 0 }; // camera view offset in px, so the card never sits over the focused rack
const cardFit = { s: 1 }; // scale applied to the card so it always fits without scrolling
const halfTan = () => Math.tan(THREE.MathUtils.degToRad(FOV / 2));
const aspect = () => stage.clientWidth / Math.max(1, stage.clientHeight);
const isNarrow = () => stage.clientWidth < 760 || aspect() < 0.9;

function applyView() {
  const w = stage.clientWidth, h = stage.clientHeight;
  if (Math.abs(view.ox) < 0.5 && Math.abs(view.oy) < 0.5) camera.clearViewOffset();
  else camera.setViewOffset(w, h, view.ox, view.oy, w, h);
  camera.updateProjectionMatrix();
}
/** The part of the stage used for framing, and the view offset that centres the scene in it. */
function freeArea() {
  // The card is centred over the scene and see-through, so the whole stage stays the framing area.
  return { w: stage.clientWidth, h: stage.clientHeight, ox: 0, oy: 0 };
}
/** Distance that shows `halfW` world units either side of the target and `halfH` up and down, inside the free area. */
function fitDist(halfW, halfH) {
  const a = freeArea(), H = stage.clientHeight;
  return Math.max(halfW / ((halfTan() * a.w) / H), halfH / ((halfTan() * a.h) / H));
}
function glide(target, dist, dir, ms = 1400) {
  rig.target.copy(target); rig.dist = dist; rig.dir = dir; rig.until = performance.now() + ms; rig.track = true;
}
/** Wide: the whole hall. Narrow: the newest racks with their neighbours. */
function homeView() {
  if (S.narrow) glide(new THREE.Vector3(xOf(N - 1) - SLOT * 1.6, 6.8, 0), fitDist(SLOT * 5.4, 11.5), DIR_FOCUS.clone());
  else glide(new THREE.Vector3(-0.5, 4.5, 0), Math.min(150, fitDist((N * SLOT) / 2 + 3, 9) * 0.97), DIR_HOME.clone());
}
function overview() {
  glide(new THREE.Vector3(0, 4.5, 0), Math.min(190, fitDist((N * SLOT) / 2 + 3, 9) * (S.narrow ? 1 : 0.88)), DIR_HOME.clone());
}
/** About 3 racks either side of the focus on a phone, 4 on a wide screen, fitted to the tallest of them. */
function frameFocus(resetDir) {
  const span = S.narrow ? 3 : 4, halfW = SLOT * (span + 0.6);
  let maxH = 1;
  for (const r of racks) if (Math.abs(r.g.i - S.focus) <= span && r.g.t <= S.year) maxH = Math.max(maxH, r.target);
  glide(new THREE.Vector3(xOf(S.focus), THREE.MathUtils.clamp(maxH * 0.55, 2.5, 7.5), 0),
    THREE.MathUtils.clamp(fitDist(halfW, maxH * 0.7 + 3), 16, 110), resetDir ? DIR_FOCUS.clone() : null);
}
function setFocus(i, { resetDir = false } = {}) {
  S.focus = i;
  updateCard();
  if (i == null) { homeView(); return; }
  if (S.follow) frameFocus(resetDir);
}
let userOrbit = false;
controls.addEventListener("start", () => {
  userOrbit = true; rig.dir = null; rig.until = 0;
  if (!S.playing || !S.follow) rig.track = false;
});
const _d = new THREE.Vector3(), _o = new THREE.Vector3();
function stepRig(dt) {
  if (!rig.track) return;
  const k = reduced ? 1 : 1 - Math.exp(-4 * dt);
  _d.subVectors(rig.target, controls.target).multiplyScalar(k);
  controls.target.add(_d); camera.position.add(_d);
  if (performance.now() < rig.until || reduced) { // ease the distance (and the angle, if asked) only just after a change
    _o.subVectors(camera.position, controls.target);
    const len = THREE.MathUtils.lerp(_o.length(), rig.dist, k);
    if (rig.dir) _o.normalize().lerp(rig.dir, k).normalize(); else _o.normalize();
    camera.position.copy(controls.target).addScaledVector(_o, len);
  } else if (!S.playing && controls.target.distanceTo(rig.target) < 0.02) rig.track = false;
}

function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h); labelR.setSize(w, h); camera.aspect = w / h; applyView();
  if (S.focus != null) requestAnimationFrame(fitCard);
  const n = isNarrow();
  if (n !== S.narrow) { S.narrow = n; if (S.focus != null) frameFocus(false); else if (!userOrbit) homeView(); }
}

// ---------------------------------------------------------------- detail card
const STATUS_COLOR = { verified: "#9be03a", corrected: "#4fc3f7", partial: "#ffd54f", unverified: "#ff8a65" };
const na = () => `<span class='na'>${T.s.na}</span>`;
const ratio = (a, b) => {
  if (a == null || b == null) return "<span class='na'>–</span>";
  const r = a / b, txt = r >= 10 ? Math.round(r) : r.toFixed(r >= 1.995 ? 1 : 2);
  return `<span class="${r >= 1 ? "up" : "dn"}">×${txt}</span>`;
};
let lastCardFocus = null;

/** Never scroll: scale the card down if the stage is too short for it. */
function fitCard() {
  const c = $("card"), H = stage.clientHeight;
  cardFit.s = Math.min(1, (H - 24) / Math.max(1, c.offsetHeight));
  c.style.transformOrigin = "50% 50%";
}

// The zoom: the card grows out of the rack's top, which is re-projected every frame, so it still
// starts from the rack while the camera glides. A glowing frame runs just ahead of it.
const zoom = { t0: -1, dur: 800 };
const easeOut = (p) => 1 - Math.pow(1 - p, 3);
const easeBack = (p) => { const c1 = 1.4, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); };
function startZoom() {
  zoom.t0 = performance.now();
  zoom.dur = reduced ? 0 : THREE.MathUtils.clamp(800 / Math.max(1, S.playing ? S.speed : 1), 320, 800);
}
const _p = new THREE.Vector3();
function rackTop(i) {
  _p.set(xOf(i), Math.max(racks[i].h, 0.3), 0).project(camera);
  return { x: ((_p.x + 1) / 2) * stage.clientWidth, y: ((1 - _p.y) / 2) * stage.clientHeight };
}
function drawCard() {
  const c = $("card"), ghost = $("ghost"), L = $("leadl"), C = $("leadc");
  if (S.focus == null) { ghost.style.display = "none"; L.style.display = C.style.display = "none"; return; }
  const col = "#" + racks[S.focus].col.getHexString(), top = rackTop(S.focus), s = cardFit.s;
  // where the card rests: its layout box (centred on the stage), scaled about its centre
  const W = c.offsetWidth, H = c.offsetHeight;
  const ox = c.offsetLeft + W / 2, oy = c.offsetTop + H / 2;
  const rest = { l: ox - (W / 2) * s, t: oy - (H / 2) * s, w: W * s, h: H * s };
  const p = zoom.dur <= 0 ? 1 : Math.min(1, (performance.now() - zoom.t0) / zoom.dur);
  const e = easeBack(p), move = 1 - Math.min(1, e);
  c.style.transform = `translate(${(top.x - ox) * move}px, ${(top.y - oy) * move}px) scale(${s * (0.03 + 0.97 * e)})`;
  c.style.opacity = Math.min(1, p * 2.5);
  if (p < 1 && !reduced) {
    const q = easeOut(Math.min(1, p * 1.25));
    ghost.style.display = "block"; ghost.style.borderColor = col;
    ghost.style.width = Math.max(4, rest.w * q) + "px"; ghost.style.height = Math.max(4, rest.h * q) + "px";
    ghost.style.transform = `translate(${top.x + (rest.l - top.x) * q}px, ${top.y + (rest.t - top.y) * q}px)`;
    ghost.style.opacity = 1 - p * p;
  } else ghost.style.display = "none";
  // leader line from the rack's top to the nearest point of the card
  const nx = THREE.MathUtils.clamp(top.x, rest.l, rest.l + rest.w), ny = THREE.MathUtils.clamp(top.y, rest.t, rest.t + rest.h);
  L.style.display = C.style.display = "block";
  L.setAttribute("x1", top.x); L.setAttribute("y1", top.y); L.setAttribute("x2", nx); L.setAttribute("y2", ny);
  L.setAttribute("stroke", col); L.style.opacity = Math.min(1, p * 1.5) * 0.8;
  C.setAttribute("cx", top.x); C.setAttribute("cy", top.y); C.setAttribute("fill", col); C.style.opacity = Math.min(1, p * 1.5);
}

const visibleIdx = () => GPUS.filter((g) => g.t <= S.year).map((g) => g.i);
function updateCard() {
  const card = $("card");
  document.body.classList.toggle("card-on", S.focus != null);
  if (S.focus == null) { card.classList.remove("on"); lastCardFocus = null; tip.style.display = "none"; return; }
  const s = T.s, g = GPUS[S.focus], col = "#" + racks[S.focus].col.getHexString(), prev = GPUS[S.focus - 1], first = GPUS[0];
  card.style.borderTopColor = col;
  const vis = visibleIdx();
  $("cpos").textContent = `${vis.indexOf(S.focus) + 1} / ${vis.length}`;
  $("cn").textContent = g.name;
  $("cs").textContent = `${g.arch} · ${g.chip} · ${s.announced(T.date(g.date))}`;
  const sc = STATUS_COLOR[g.status];
  $("cbadges").innerHTML = `<span class="badge" style="color:${sc};border-color:${sc}">${s.status[g.status] ?? g.status}</span>` +
    (g.memType ? `<span class="badge" style="color:var(--dim);border-color:var(--line)">${g.memType}</span>` : "");
  const ms = T.milestone(g);
  $("cms").style.display = ms ? "block" : "none";
  $("cms").textContent = ms ? "★ " + ms : "";
  const f = s.fields;
  $("cg").innerHTML = [
    [f.process, g.nm ? `${g.nm} nm` : null],
    [f.transistors, T.transistors(g.transistors)],
    [f.die, g.die ? `${T.number(g.die)} mm²` : null],
    [f.cores, g.cores != null ? T.number(g.cores) : null],
    [f.memory, g.memory != null ? `${g.memory} GB` : null],
    [f.watts, g.watts != null ? `${T.number(g.watts)} W` : null],
    [f.price, T.price(g.price)],
    [f.perWatt, g.transistors && g.watts ? T.transistors(g.transistors / g.watts) : null],
  ].map(([k, v]) => `<span>${k}</span><span>${v ?? na()}</span>`).join("");
  const row = (label, o) => `<b>${label}</b>${ratio(g.transistors, o.transistors)}${ratio(g.memory, o.memory)}${ratio(g.watts, o.watts)}`;
  $("cvs").innerHTML = `<b></b>${s.cols.map((c) => `<b>${c}</b>`).join("")}` +
    (prev ? row(s.vs(shortName(prev)), prev) : `<b style="grid-column:1/-1">${s.first}</b>`) +
    (S.focus > 1 ? row(s.vsFirst(shortName(first)), first) : "");
  $("cnote").textContent = T.note(g);
  $("cchk").textContent = s.statusNote[g.status] ?? "";
  card.classList.add("on");
  fitCard();
  if (lastCardFocus !== S.focus) { lastCardFocus = S.focus; card.style.opacity = 0; startZoom(); }
}

// ---------------------------------------------------------------- panel and language
const speedEl = $("speed"), yearEl = $("year"), playEl = $("play"), followEl = $("follow");
const setPlayLabel = () => { playEl.textContent = S.playing ? T.s.pause : T.s.play; };

function setScale(sc) { S.scale = sc; applyMeasure(); }
document.querySelectorAll("[data-scale]").forEach((b) => (b.onclick = () => setScale(b.dataset.scale)));
function applyLang() {
  const s = T.s;
  document.documentElement.lang = s.htmlLang;
  document.title = s.docTitle;
  document.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = s[el.dataset.i18n]; });
  document.querySelectorAll("[data-i18n-html]").forEach((el) => { el.innerHTML = s[el.dataset.i18nHtml]; });
  document.querySelectorAll("[data-i18n-title]").forEach((el) => { el.title = s[el.dataset.i18nTitle]; });
  document.querySelectorAll("[data-m]").forEach((el) => { el.textContent = s.measures[el.dataset.m]; });
  document.querySelectorAll("[data-scale]").forEach((el) => { el.textContent = s.scaleNames[el.dataset.scale]; });
  document.querySelectorAll("[data-lang]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lang === T.lang)));
  for (const r of racks) { // rack labels: milestones carry a one-line subtitle
    const ms = T.milestone(r.g), sub = ms.split("–")[1]?.trim();
    r.el.innerHTML = sub ? `${shortName(r.g)}<i>${sub}</i>` : shortName(r.g);
  }
  setPlayLabel();
  $("hudm").textContent = s.hud(s.measures[S.measure], s.scaleWords[S.scale]);
  document.querySelectorAll("[data-scale]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.scale === S.scale)));
  if (S.focus != null) { updateCard(); requestAnimationFrame(fitCard); }
}
function setLang(lang) {
  T = makeText(lang);
  localStorage.setItem(LANG_KEY, T.lang);
  const u = new URL(location.href); u.searchParams.set("lang", T.lang); history.replaceState(null, "", u);
  applyLang();
}
document.querySelectorAll("[data-lang]").forEach((b) => (b.onclick = () => setLang(b.dataset.lang)));

document.querySelectorAll("input[name=m]").forEach((el) => (el.onchange = () => { S.measure = el.value; applyMeasure(); }));
const ALPHA_KEY = "ai-factory-card-opacity", alphaEl = $("alpha");
function setAlpha(v) {
  v = THREE.MathUtils.clamp(Math.round(+v || 80), 40, 100);
  alphaEl.value = v; $("alphav").textContent = v + "%";
  $("card").style.setProperty("--card-a", v / 100);
  localStorage.setItem(ALPHA_KEY, v);
}
alphaEl.oninput = () => setAlpha(alphaEl.value);
setAlpha(localStorage.getItem(ALPHA_KEY) ?? 80);
speedEl.oninput = () => { S.speed = +speedEl.value; $("speedv").textContent = S.speed + "×"; };
const latestAt = (y) => { let k = null; for (const g of GPUS) if (g.t <= y) k = g.i; return k; };
const stopPlay = () => { S.playing = false; setPlayLabel(); };
yearEl.oninput = () => {
  S.year = +yearEl.value; stopPlay();
  if (S.follow) { const k = latestAt(S.year); if (k != null && k !== S.focus) setFocus(k); }
};
/** Playback position (in GPUs, 0..N) for a year, so playing resumes from wherever the slider is. */
function posFromYear(y) {
  const k = latestAt(y);
  if (k == null) return 0;
  if (k >= N - 1) return N - 1 + Math.min(1, (y - GPUS[N - 1].t) / (END - GPUS[N - 1].t));
  return k + THREE.MathUtils.clamp((y - GPUS[k].t) / (GPUS[k + 1].t - GPUS[k].t), 0, 0.999);
}
/** The year shown at a playback position: release dates, eased linearly within each slot. */
function yearFromPos(p) {
  const k = Math.min(N - 1, Math.floor(p)), f = p - k;
  const next = k < N - 1 ? GPUS[k + 1].t : END;
  return GPUS[k].t + (next - GPUS[k].t) * f;
}
function togglePlay() {
  if (!S.playing) {
    S.pos = S.year >= END - 0.01 ? 0 : posFromYear(S.year);
    if (S.pos === 0) { S.focus = null; updateCard(); }
  }
  S.playing = !S.playing;
  if (S.playing) userOrbit = false;
  setPlayLabel();
}
playEl.onclick = togglePlay;
$("all").onclick = () => { S.year = END; yearEl.value = S.year; stopPlay(); S.focus = null; updateCard(); overview(); };
$("reset").onclick = () => { userOrbit = false; stopPlay(); S.focus = null; updateCard(); homeView(); };
followEl.onchange = () => { S.follow = followEl.checked; if (S.follow && S.focus != null) frameFocus(false); };
$("labels").onchange = (e) => document.body.classList.toggle("no-labels", !e.target.checked);
const setSide = (hide) => document.body.classList.toggle("hide-side", hide);
$("close").onclick = () => setSide(true);
$("open").onclick = () => setSide(false);
function step(dir) {
  const v = visibleIdx();
  if (!v.length) return;
  stopPlay();
  const cur = S.focus == null ? (dir > 0 ? -1 : v.length) : v.indexOf(S.focus);
  setFocus(v[THREE.MathUtils.clamp(cur + dir, 0, v.length - 1)]);
}
$("prev").onclick = () => step(-1);
$("next").onclick = () => step(1);
$("unfocus").onclick = () => setFocus(null);
addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT" && e.target.type === "range") return;
  const k = e.key.toLowerCase();
  if (e.code === "Space") { e.preventDefault(); togglePlay(); }
  else if (k === "h") setSide(!document.body.classList.contains("hide-side"));
  else if (k === "r") $("reset").click();
  else if (k === "l") setScale(S.scale === "log" ? "linear" : "log");
  else if (k === "f") { followEl.checked = !followEl.checked; followEl.onchange(); }
  else if (e.key === "ArrowRight") { e.preventDefault(); step(1); }
  else if (e.key === "ArrowLeft") { e.preventDefault(); step(-1); }
  else if (e.key === "Escape") setFocus(null);
  else if (e.key === "+" || e.key === "=") { speedEl.value = Math.min(3, S.speed + 0.25); speedEl.oninput(); }
  else if (e.key === "-") { speedEl.value = Math.max(0.25, S.speed - 0.25); speedEl.oninput(); }
});

// ---------------------------------------------------------------- picking: hover tooltip (mouse), tap or click to focus
const ray = new THREE.Raycaster(), mouse = new THREE.Vector2(), tip = $("tip");
function pick(e) {
  const b = renderer.domElement.getBoundingClientRect();
  mouse.set(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1);
  ray.setFromCamera(mouse, camera);
  const hit = ray.intersectObjects(racks.filter((r) => r.grp.visible).map((r) => r.mesh))[0];
  return hit ? hit.object.userData.i : null;
}
renderer.domElement.addEventListener("pointermove", (e) => {
  if (e.pointerType !== "mouse") return;
  const i = pick(e);
  S.hover = i;
  if (i == null || i === S.focus) { tip.style.display = "none"; return; }
  const s = T.s, f = s.fields, g = GPUS[i], b = renderer.domElement.getBoundingClientRect();
  const v = (x) => x ?? s.na;
  tip.innerHTML = `<b>${g.name}</b> <span style="color:var(--dim)">${T.date(g.date)}</span><br>
    ${g.arch} · ${g.chip} · ${g.nm} nm
    <table style="margin-top:4px">
      <tr><td>${f.transistors}</td><td>${v(T.transistors(g.transistors))}</td></tr>
      <tr><td>${f.memory}</td><td>${g.memory} GB ${g.memType ?? ""}</td></tr>
      <tr><td>${f.watts}</td><td>${g.watts != null ? T.number(g.watts) + " W" : s.na}</td></tr>
      <tr><td>${f.cores}</td><td>${g.cores != null ? T.number(g.cores) : s.na}</td></tr>
    </table><div style="color:var(--accent);margin-top:4px">${s.tipHint}</div>`;
  tip.style.display = "block";
  tip.style.left = Math.max(4, Math.min(e.clientX - b.left + 14, b.width - tip.offsetWidth - 8)) + "px";
  tip.style.top = Math.max(4, Math.min(e.clientY - b.top + 14, b.height - tip.offsetHeight - 8)) + "px";
});
renderer.domElement.addEventListener("pointerleave", () => { S.hover = null; tip.style.display = "none"; });
let down = null;
renderer.domElement.addEventListener("pointerdown", (e) => { down = { x: e.clientX, y: e.clientY }; });
renderer.domElement.addEventListener("pointerup", (e) => {
  const click = down && Math.hypot(e.clientX - down.x, e.clientY - down.y) <= 6;
  down = null;
  if (!click) return;
  const i = pick(e);
  tip.style.display = "none";
  if (i != null) { stopPlay(); setFocus(i, { resetDir: !userOrbit }); }
  else if (S.focus != null) setFocus(null);
});

// ---------------------------------------------------------------- boot and frame loop
applyLang();
applyMeasure();
camera.position.copy(DIR_HOME).multiplyScalar(80);
new ResizeObserver(resize).observe(stage);
S.narrow = !isNarrow();
resize();
homeView(); // the first frame jumps straight to home rather than gliding in from nowhere
controls.target.copy(rig.target);
camera.position.copy(rig.target).addScaledVector(rig.dir, rig.dist);
controls.update();

const timer = new THREE.Timer(), yrEl = $("yr");
timer.connect(document); // pauses cleanly while the tab is hidden
renderer.setAnimationLoop(() => {
  timer.update();
  const dt = Math.min(timer.getDelta(), 0.05), now = timer.getElapsed();
  if (S.playing) {
    S.pos += (dt * S.speed) / SLOT_SEC;
    if (S.pos >= N) { S.pos = N; S.year = END; stopPlay(); } else S.year = yearFromPos(S.pos);
    yearEl.value = S.year;
    if (S.follow) { const k = latestAt(S.year); if (k != null && k !== S.focus) setFocus(k); }
  }
  yrEl.textContent = Math.floor(S.year);

  for (const r of racks) {
    const i = r.g.i, on = r.g.t <= S.year;
    r.grp.visible = on || r.h > 0.02;
    const want = on ? r.target : 0;
    r.h = reduced ? want : r.h + (want - r.h) * (1 - Math.exp(-6 * dt));
    if (!on) r.grow = 0; else if (r.grow < 1) r.grow = reduced ? 1 : Math.min(1, r.grow + dt * 1.5);
    const h = Math.max(r.h, 0.001);
    r.mesh.scale.set(WIDTH, h, r.depth); r.edge.scale.copy(r.mesh.scale);
    r.face.repeat.set(1, Math.max(1, Math.round(h / 0.55)));
    const foc = S.focus === i, hov = S.hover === i;
    r.lbl.position.set(0, h + (foc ? 0.9 : r.g.milestone ? (r.msIdx % 2 ? 2.6 : 0.9) : 0.5), 0);
    // On a narrow stage only the focused rack's neighbours (or milestones, with nothing focused) are named.
    const near = S.focus == null ? !S.narrow || !!r.g.milestone : Math.abs(i - S.focus) <= (S.narrow ? 3 : 6) || (!S.narrow && !!r.g.milestone);
    r.el.style.opacity = near ? 1 : 0;
    r.el.classList.toggle("focus", foc);
    const pulse = r.missing || reduced ? 0 : 0.12 * Math.sin(now * 2 + i) * heatOf(r.g);
    r.mat.emissiveIntensity = (r.missing ? 0.05 : 0.08 + 0.45 * heatOf(r.g) + pulse) + (hov ? 0.4 : 0) + (foc ? 0.45 : 0) + (reduced ? 0 : (1 - r.grow) * 1.5);
    r.edge.material.color.copy(foc ? WHITE : r.missing ? GREY : r.col);
    r.edge.material.opacity = foc ? 1 : r.look.edge;
    r.halo.material.opacity = r.g.watts == null ? 0 : (0.25 + 0.75 * heatOf(r.g)) * Math.min(1, r.h / r.target) * (1 + pulse);
  }

  // ease the view offset as the card opens and closes
  const a = freeArea(), k = reduced ? 1 : 1 - Math.exp(-6 * dt);
  if (Math.abs(a.ox - view.ox) > 0.3 || Math.abs(a.oy - view.oy) > 0.3) { view.ox += (a.ox - view.ox) * k; view.oy += (a.oy - view.oy) * k; applyView(); }
  else if (view.ox !== a.ox || view.oy !== a.oy) { view.ox = a.ox; view.oy = a.oy; applyView(); }

  stepRig(dt);
  controls.update();
  renderer.render(scene, camera);
  labelR.render(scene, camera);
  drawCard();
});
