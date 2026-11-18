/**
 * Twin Racks: the GB300 NVL72 and the Vera Rubin NVL72 side by side, at true physical size.
 *
 * Both racks are the same Oberon-class NVL72 rack (about 0.60 × 1.07 × 2.24 m), so nothing about
 * their geometry encodes data. The specs are compared on a card under the title instead, one
 * metric at a time, with bars whose height is proportional to the value; the part of the rack a
 * metric describes (GPUs, CPUs, NVLink switch trays, NICs or power shelves) lights up, and the
 * camera glides to it. NVLink traffic runs as particles whose speed is the per-GPU link bandwidth.
 *
 * Everything is in this one module: scene, racks, dimension lines, camera framing, spec card,
 * panel, input and the frame loop. Strings and formats come from i18n.js, the data from data.js.
 */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { SPECS, RACK, NVLINK } from "./data.js";
import { LANGS, makeText } from "./i18n.js";

const $ = (id) => document.getElementById(id);
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const params = new URLSearchParams(location.search);
const STILL = params.has("still"); // screenshots: no glides or count-ups
const COLOR = { b300: 0x3987e5, rubin: 0xd95926 };
const KEYS = ["b300", "rubin"];
const { w: RW, d: RD, h: RH, u: U } = RACK;
const GAP = 16; // the same gap in px: title → card, card → racks, racks → bottom of the stage

// localStorage can throw in sandboxed previews; the page must still run
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
};
const LANG_KEY = "twin-racks-lang", OPACITY_KEY = "twin-racks-card-opacity", TITLE_OPACITY_KEY = "twin-racks-title-opacity";
function initialLang() {
  const q = params.get("lang");
  if (LANGS.includes(q)) return q;
  const saved = store.get(LANG_KEY);
  if (LANGS.includes(saved)) return saved;
  return navigator.language?.toLowerCase().startsWith("zh") ? "zh" : "en";
}
let T = makeText(initialLang());

// ---------------------------------------------------------------- renderer and scene
const stage = $("stage"), wrap = $("wrap"), card = $("cardrow"), mainEl = $("main");
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
{ // a soft slate gradient instead of black
  const c = document.createElement("canvas"); c.width = 4; c.height = 256;
  const x = c.getContext("2d"), g = x.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, "#4a505b"); g.addColorStop(0.55, "#353941"); g.addColorStop(1, "#2a2d33");
  x.fillStyle = g; x.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; scene.background = t;
}
scene.fog = new THREE.Fog(0x30343a, 12, 30);
const cam = new THREE.PerspectiveCamera(40, 1, 0.01, 100);
cam.position.set(2.9, 1.9, 4.2);
const ctl = new OrbitControls(cam, renderer.domElement);
ctl.target.set(0, 1.1, 0);
ctl.enableDamping = !reduced;
ctl.minDistance = 0.8;
ctl.maxDistance = 12;
scene.add(new THREE.HemisphereLight(0xe8eef8, 0x3a3a3a, 1.35));
const key = new THREE.DirectionalLight(0xffffff, 1.4);
key.position.set(3, 6, 5);
scene.add(key);
const floor = new THREE.Mesh(new THREE.CircleGeometry(14, 64), new THREE.MeshStandardMaterial({ color: 0x3a3e46, roughness: 0.95 }));
floor.rotation.x = -Math.PI / 2; floor.position.y = -0.002;
scene.add(floor);
scene.add(new THREE.GridHelper(12, 24, 0x5a606b, 0x474c55)); // 0.5 m grid

// ---------------------------------------------------------------- racks
// Bottom to top, roughly the NVL72 layout: 3 power shelves, 8 compute trays, 9 NVLink switch trays,
// 10 compute trays, 3 power shelves. Each compute tray: 4 GPUs and 2 CPUs at the front, 4 NICs at the back.
const LAYOUT = [...Array(3).fill("pwr"), ...Array(8).fill("cmp"), ...Array(9).fill("sw"), ...Array(10).fill("cmp"), ...Array(3).fill("pwr")];
const parts = { b300: {}, rubin: {} };
const pickables = [];
const std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, metalness: 0.45, roughness: 0.6, ...o });

function makeRack(k, x) {
  const g = new THREE.Group(); g.position.x = x; scene.add(g);
  const P = Object.assign(parts[k], { group: g, gpu: [], cpu: [], sw: [], nic: [], pwr: [], body: [], tray: [], switchY: [], gpuPos: [] });
  const shell = new THREE.Mesh(new THREE.BoxGeometry(RW, RH, RD), std(0x262625, { transparent: true, opacity: 0.22, depthWrite: false }));
  shell.position.y = RH / 2; g.add(shell);
  P.edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(RW, RH, RD)), new THREE.LineBasicMaterial({ color: COLOR[k], transparent: true, opacity: 0.5 }));
  P.edges.position.y = RH / 2; g.add(P.edges);
  let y = 0.22, tray = 0;
  for (const kind of LAYOUT) {
    const cy = y + U / 2;
    const body = new THREE.Mesh(new THREE.BoxGeometry(RW - 0.04, U * 0.86, RD - 0.06), std(kind === "sw" ? 0x343432 : kind === "pwr" ? 0x2e2e2c : 0x232322, { transparent: true }));
    body.position.set(0, cy, 0); g.add(body); P.body.push(body);
    if (kind === "cmp") { // compute-tray bodies can glow (dimmed rack colour) for the overview's tray step
      body.material.emissive = new THREE.Color(COLOR[k]).multiplyScalar(0.45); body.material.emissiveIntensity = 0; P.tray.push(body);
    }
    const face = (arr, kindKey, col) => {
      const f = new THREE.Mesh(new THREE.BoxGeometry(RW - 0.06, U * 0.6, 0.01), std(col, { emissive: kindKey === "SW" ? COLOR[k] : 0xffffff, emissiveIntensity: 0 }));
      f.position.set(0, cy, RD / 2 - 0.025); f.userData = { key: k, kind: kindKey };
      g.add(f); arr.push(f); pickables.push(f);
    };
    if (kind === "pwr") face(P.pwr, "PWR", 0x555550);
    if (kind === "sw") { face(P.sw, "SW", 0x666660); P.switchY.push(cy); }
    if (kind === "cmp") {
      tray++;
      const add = (arr, kindKey, geo, mat, pos) => { const m = new THREE.Mesh(geo, mat); m.position.set(...pos); m.userData = { key: k, kind: kindKey, tray }; g.add(m); arr.push(m); pickables.push(m); return m; };
      for (let j = 0; j < 4; j++) P.gpuPos.push(add(P.gpu, "GPU", new THREE.BoxGeometry(0.09, U * 0.55, 0.1), std(COLOR[k], { emissive: COLOR[k], emissiveIntensity: 0.15 }), [-0.2 + j * 0.133, cy, RD / 2 - 0.06]).position);
      for (let j = 0; j < 2; j++) add(P.cpu, "CPU", new THREE.BoxGeometry(0.11, U * 0.5, 0.08), std(0x9a9a92, { emissive: 0xffffff, emissiveIntensity: 0 }), [-0.12 + j * 0.24, cy, 0.05]);
      for (let j = 0; j < 4; j++) add(P.nic, "NIC", new THREE.BoxGeometry(0.07, U * 0.5, 0.04), std(0x777770, { emissive: 0xffffff, emissiveIntensity: 0 }), [-0.2 + j * 0.133, cy, -RD / 2 + 0.04]);
    }
    y += U;
  }
}
const RACK_X = 0.55;
makeRack("b300", -RACK_X);
makeRack("rubin", RACK_X);

// ---------------------------------------------------------------- dimension lines on the racks
// Drawn like a technical drawing, once (both racks are the same size): height beside the left rack's
// front-left edge, width along its front base, depth along the right rack's side base.
const dims = new THREE.Group(); scene.add(dims);
const DIMC = 0xffd27a, LX = -RACK_X - RW / 2, RX = RACK_X + RW / 2, OFF = 0.09;
function dimLine(a, b, tickDir) {
  const mat = new THREE.LineBasicMaterial({ color: DIMC, depthTest: false, transparent: true });
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), t = new THREE.Vector3(...tickDir).multiplyScalar(0.035);
  for (const [p, q] of [[A, B], [A.clone().sub(t), A.clone().add(t)], [B.clone().sub(t), B.clone().add(t)]]) {
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([p, q]), mat); l.renderOrder = 10; dims.add(l);
  }
  return A.clone().add(B).multiplyScalar(0.5);
}
const DIM = {
  h: dimLine([LX - OFF, 0, RD / 2], [LX - OFF, RH, RD / 2], [1, 0, 0]),
  w: dimLine([LX, 0.01, RD / 2 + OFF], [LX + RW, 0.01, RD / 2 + OFF], [0, 0, 1]),
  d: dimLine([RX + OFF, 0.01, RD / 2], [RX + OFF, 0.01, -RD / 2], [1, 0, 0]),
};
{ // faint extension lines from the rack corners to the dimension lines
  const mat = new THREE.LineBasicMaterial({ color: DIMC, transparent: true, opacity: 0.45, depthTest: false });
  const ext = [
    [[LX, 0, RD / 2], [LX - OFF - 0.03, 0, RD / 2]], [[LX, RH, RD / 2], [LX - OFF - 0.03, RH, RD / 2]],
    [[LX, 0.01, RD / 2], [LX, 0.01, RD / 2 + OFF + 0.03]], [[LX + RW, 0.01, RD / 2], [LX + RW, 0.01, RD / 2 + OFF + 0.03]],
    [[RX, 0.01, RD / 2], [RX + OFF + 0.03, 0.01, RD / 2]], [[RX, 0.01, -RD / 2], [RX + OFF + 0.03, 0.01, -RD / 2]],
  ];
  for (const [p, q] of ext) { const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...p), new THREE.Vector3(...q)]), mat); l.renderOrder = 10; dims.add(l); }
}
/** A label sized to its own text; h is the text height in metres, so it scales with the racks. */
function textLabel(text, { h = 0.085, color = "#ffd27a", weight = 650 } = {}) {
  const px = 96, font = `${weight} ${px}px -apple-system, "PingFang SC", "Microsoft YaHei", Helvetica, sans-serif`;
  const c = document.createElement("canvas"), x = c.getContext("2d");
  x.font = font;
  const tw = Math.ceil(x.measureText(text).width) + 24;
  c.width = tw; c.height = px + 28;
  x.font = font; x.textBaseline = "middle";
  x.fillStyle = "rgba(20,22,26,.55)"; x.beginPath(); x.roundRect(0, 0, tw, c.height, 18); x.fill();
  x.fillStyle = color; x.fillText(text, 12, c.height / 2 + 2);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false }));
  const H = (h * c.height) / px;
  sp.scale.set((H * c.width) / c.height, H, 1);
  sp.renderOrder = 11;
  sp.userData = { w: (H * c.width) / c.height, h: H };
  return sp;
}
let dimSprites = [];
function dimLabels() {
  for (const s of dimSprites) { dims.remove(s); s.material.map.dispose(); s.material.dispose(); }
  dimSprites = [];
  const add = (text, pos, center, o) => { const s = textLabel(text, o); s.center.set(...center); s.position.copy(pos); dims.add(s); dimSprites.push(s); };
  add(T.s.dimH, DIM.h.clone().add(new THREE.Vector3(-0.03, 0, 0)), [1, 0.5]);
  add(T.s.dimW, DIM.w.clone().add(new THREE.Vector3(0, 0, 0.06)), [0.5, 1]);
  add(T.s.dimD, DIM.d.clone().add(new THREE.Vector3(0.06, 0, 0)), [0, 1]);
}

// ---------------------------------------------------------------- NVLink particles and power columns
const particles = {};
for (const k of KEYS) {
  const n = 260, pos = new Float32Array(n * 3), geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: COLOR[k], size: 0.018, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
  pts.frustumCulled = false;
  parts[k].group.add(pts);
  particles[k] = { pts, pos, n, st: Array.from({ length: n }, () => ({ g: (Math.random() * 72) | 0, t: Math.random() })) };
}
const RACK_KW = SPECS.find((r) => r.id === "Rack power (max)");
const colH = (kW) => (kW / 250) * 1.1; // 250 kW ≙ 1.1 m column
const pcol = {};
for (const k of KEYS) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1, 40), std(COLOR[k], { transparent: true, opacity: 0.3, emissive: COLOR[k], emissiveIntensity: 0.4, depthWrite: false }));
  m.visible = false; parts[k].group.add(m); pcol[k] = m;
}

// ---------------------------------------------------------------- camera: fitted framing
// Each view is a direction only. The distance and target are solved so the racks (and their
// dimension labels, and the power columns when shown) fill the part of the stage below the card.
const VIEWS = {
  gpu: [2.3, 1.6, 4.1], cpu: [2.2, 3.6, 3.2], switch: [2.4, 1.2, 3.9], nic: [-2.5, 1.6, -3.7], rack: [2.9, 1.9, 4.2], power: [3.4, 2.4, 5.0],
};
VIEWS.none = VIEWS.rack;
const VIEW_TARGET = { gpu: [0, 1.15, 0.2], cpu: [0, 1.0, 0], switch: [0, 1.0, 0.2], nic: [0, 1.1, -0.3], rack: [0, 1.1, 0], power: [0, 1.75, 0], none: [0, 1.1, 0] };
let CLOCK = performance.now();
const clock = () => CLOCK;
let camAnim = null, curView = "gpu", curPart = "gpu";
const fitCam = new THREE.PerspectiveCamera(40, 1, 0.01, 100);

function framePoints() {
  const pts = [], ys = [0, RH];
  if (curPart === "power") ys.push(RH + 0.45 + colH(RACK_KW.rubin));
  for (const x of [-RACK_X - RW / 2, RACK_X + RW / 2]) for (const y of ys) for (const z of [-RD / 2, RD / 2]) pts.push(new THREE.Vector3(x, y, z));
  if (dims.visible && dimSprites.length) {
    const [h, w, d] = dimSprites.map((s) => s.userData);
    pts.push(new THREE.Vector3(LX - OFF - 0.03 - h.w, RH * 0.5, RD / 2), new THREE.Vector3(LX + RW / 2, -w.h, RD / 2 + OFF + 0.06),
      new THREE.Vector3(RX + OFF + 0.06 + d.w, -d.h, 0));
  }
  return pts;
}
/** The free part of the stage in NDC: below the card (or the title), above the hint, with GAP margins. */
function freeRegion() {
  const w = stage.clientWidth || 1, h = stage.clientHeight || 1;
  let top = $("title").offsetTop + $("title").offsetHeight + GAP;
  // the title slide covers the scene on purpose, so the racks stay framed behind it as if it weren't there
  if (card.classList.contains("floating") && !card.classList.contains("titleslide") && card.offsetHeight > 0) top = card.offsetTop + card.offsetHeight + GAP;
  const hint = $("hint"), bottom = GAP + (hint.offsetParent ? hint.offsetHeight + 6 : 0);
  return { l: -1 + (2 * GAP) / w, r: 1 - (2 * GAP) / w, t: 1 - (2 * top) / h, b: -1 + (2 * bottom) / h };
}
function fitView(name) {
  const R = freeRegion(), pts = framePoints();
  const dir = new THREE.Vector3(...VIEWS[name]).sub(new THREE.Vector3(...VIEW_TARGET[name])).normalize();
  fitCam.aspect = cam.aspect || 1; fitCam.updateProjectionMatrix();
  const tanV = Math.tan(THREE.MathUtils.degToRad(fitCam.fov / 2));
  const t = new THREE.Vector3(0, RH * 0.45, 0);
  let d = 5;
  for (let it = 0; it < 14; it++) {
    fitCam.position.copy(t).addScaledVector(dir, d); fitCam.lookAt(t); fitCam.updateMatrixWorld();
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const p of pts) { const q = p.clone().project(fitCam); x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); }
    const scale = Math.max((x1 - x0) / (R.r - R.l), (y1 - y0) / (R.t - R.b));
    const right = new THREE.Vector3().setFromMatrixColumn(fitCam.matrixWorld, 0), up = new THREE.Vector3().setFromMatrixColumn(fitCam.matrixWorld, 1);
    t.addScaledVector(right, ((x0 + x1) / 2 - (R.l + R.r) / 2) * d * tanV * fitCam.aspect).addScaledVector(up, ((y0 + y1) / 2 - (R.t + R.b) / 2) * d * tanV);
    d *= Math.max(0.5, Math.min(2, scale));
  }
  return { p: t.clone().addScaledVector(dir, d), t };
}
function flyTo(name, instant = false) {
  curView = name;
  const f = fitView(name);
  if (STILL || reduced || instant) { camAnim = null; cam.position.copy(f.p); ctl.target.copy(f.t); return; }
  camAnim = { t0: clock(), dur: 1400, p0: cam.position.clone(), q0: ctl.target.clone(), p1: f.p, q1: f.t };
}

// ---------------------------------------------------------------- highlight
function highlight(part) {
  curPart = part;
  for (const k of KEYS) {
    const P = parts[k];
    const set = (arr, on, base = 0) => arr.forEach((m) => { m.userData.hl = on; m.material.emissiveIntensity = on ? 1 : base; });
    // "ov-*" are the overview frame's steps: GPUs, CPUs, compute trays, NVLink switch trays
    set(P.gpu, part === "gpu" || part === "rack" || part === "ov-gpu" || part === "ov-hbm", 0.15); // the HBM sits on the GPU package
    set(P.cpu, part === "cpu" || part === "ov-cpu");
    set(P.sw, part === "switch" || part === "rack" || part === "ov-switch");
    set(P.nic, part === "nic");
    set(P.pwr, part === "power");
    set(P.tray, part === "ov-tray");
    for (const b of P.body) { const see = part === "cpu" || part === "ov-cpu"; b.material.opacity = see ? 0.12 : 1; b.material.depthWrite = !see; } // CPUs sit inside the trays
    P.edges.material.opacity = part === "rack" || part === "power" ? 1 : 0.5;
    const h = colH(RACK_KW[k]);
    pcol[k].visible = part === "power"; pcol[k].scale.y = h; pcol[k].position.set(0, RH + 0.45 + h / 2, 0);
  }
}

// ---------------------------------------------------------------- spec card
const isNum = (v) => typeof v === "number";
// The tour: two text frames (a title, then the rack summary) before the spec cards. `idx` counts all of them.
const FRAMES = [{ id: "intro", part: "none" }, { id: "summary", part: "rack" }];
const NF = FRAMES.length, NS = NF + SPECS.length;
const partOf = (i) => (i < NF ? FRAMES[i].part : SPECS[i - NF].part);
// The overview walks through its four lines, one part at a time, in step with the racks; one full walk per tour dwell.
const OV_STEPS = ["gpu", "hbm", "cpu", "tray", "switch"];
let ovT0 = 0, ovStep = -1;
function overviewTick(now) {
  if (FRAMES[idx]?.id !== "summary") return;
  const stepMs = Math.max(900, dwell / OV_STEPS.length);
  const step = Math.floor(Math.max(0, now - ovT0) / stepMs) % OV_STEPS.length;
  if (step === ovStep) return;
  ovStep = step;
  const key = OV_STEPS[step];
  document.querySelectorAll("#cFrame [data-ov]").forEach((el) => el.classList.toggle("on", el.dataset.ov === key));
  highlight(`ov-${key}`);
}
let idx = 0, shown = { b: 0, r: 0 }, numAnim = null, playing = false, tourT0 = clock(), dwell = 5000;

function renderFrame(id) {
  const s = T.s;
  if (id === "intro") {
    return `<div class="lab">${s.introKicker}</div><div class="ft">${s.introTitle}</div><div class="rule"></div><div class="fs" style="margin-top:16px">${s.introSub}</div><div class="fh">${s.introHint(SPECS.length)}</div>`;
  }
  // each line names a part; the overview steps through them and lights the same part on the racks
  // 2 columns × 2 rows, like the spec cards: the system names as a header row, then each system's parts
  const col = (k, gpu, hbm, cpu, nvl) => `<div class="fc ${k}"><span data-ov="gpu">${s.gpus(gpu)}</span><span data-ov="hbm">${s.perGpu(hbm)}</span>` +
    `<span data-ov="cpu">${s.cpus(cpu)}</span><span data-ov="tray">${s.computeTrays}</span><span data-ov="switch">${s.switchTrays(nvl)}</span></div>`;
  return `<div class="lab">${s.sumKicker}</div><div class="ft">${s.sumTitle}</div><div class="fs">${s.sumSize}</div>` +
    `<div class="fcols"><div class="ch b">GB300 NVL72</div><div class="ch r">Vera Rubin NVL72</div>${col("b", "B300", s.hbmB, "Grace", 5)}${col("r", "Rubin", s.hbmR, "Vera", 6)}</div>`;
}
function renderCard(animate) {
  const s = T.s;
  if (idx < NF) { // a text frame
    numAnim = null;
    card.classList.add("framemode");
    card.classList.toggle("titleslide", idx === 0); // the first frame is a full title slide over the scene
    stage.classList.toggle("titlemode", idx === 0 && card.classList.contains("floating"));
    dims.visible = $("dims").checked && !stage.classList.contains("titlemode"); // no labels peeking out beside the slide
    $("cFrame").innerHTML = renderFrame(FRAMES[idx].id);
    ovT0 = clock(); ovStep = -1; // the overview's part-by-part walk starts over
    return;
  }
  card.classList.remove("framemode", "titleslide");
  stage.classList.remove("titlemode");
  dims.visible = $("dims").checked;
  const d = SPECS[idx - NF];
  $("cStep").textContent = s.step(T.group(d.group), idx - NF + 1, SPECS.length);
  $("cMetric").textContent = T.metric(d);
  $("cChips").innerHTML = `<span class="chip ${d.confidence}">${s.conf(d.confidence)}</span>${d.cost ? `<span class="chip">${s.costChip}</span>` : ""}`;
  $("cAbout").textContent = T.about(d); // what the metric is and why it matters
  $("uB").textContent = $("uR").textContent = T.unit(d.unit);
  $("cNote").textContent = T.note(d);
  $("cSrc").textContent = s.source + d.source;
  const rackLine = (v) => { if (!d.rack) return ""; const t = `${T.value(v, d.rack.unit)}\u00a0${T.unit(d.rack.unit)}`; return d.rack.label === "fast" ? s.rackFast(t) : s.perRack(t); };
  $("rB").textContent = d.rack ? rackLine(d.rack.b300) : ""; $("rR").textContent = d.rack ? rackLine(d.rack.rubin) : "";
  if (isNum(d.b300) && isNum(d.rubin)) {
    const b = d.b300, r = d.rubin, ratio = r / b, mx = Math.max(b, r);
    card.classList.remove("text");
    if (animate && !STILL && !reduced) numAnim = { t0: clock(), from: { ...shown }, to: { b, r }, unit: d.unit };
    else { numAnim = null; shown = { b, r }; $("vB").textContent = T.value(b, d.unit); $("vR").textContent = T.value(r, d.unit); }
    $("barB").style.height = `${(b / mx) * 100}%`; // strictly proportional, shared zero baseline
    $("barR").style.height = `${(r / mx) * 100}%`;
    $("cDelta").textContent = `${ratio.toFixed(2)}×`;
    const p = Math.round((ratio - 1) * 100);
    $("cDeltaTxt").textContent = p === 0 ? "" : d.cost ? (p > 0 ? s.costUp(p) : s.costDown(p)) : p > 0 ? s.more(p) : s.less(p);
  } else {
    numAnim = null;
    card.classList.add("text");
    $("vB").textContent = T.text(d, 0); $("vR").textContent = T.text(d, 1);
    $("uB").textContent = T.sub(d, 0); $("uR").textContent = T.sub(d, 1); // e.g. "4 nm class" after "TSMC 4NP"
    $("barB").style.height = $("barR").style.height = "0%";
    $("cDelta").textContent = ""; $("cDeltaTxt").textContent = ""; // text rows: no ratio, only the note and source
  }
}
// Slide between cards: the card's frame stays put while its contents slide out one way and the next
// metric's slide in from the other (dir +1 = forward: out to the left, in from the right). A newer
// change cancels an older slide part-way, so rapid presses never queue up.
let slideToken = 0;
function slideCard(dir, update) {
  const els = [...card.children].filter((e) => e.matches(".head, .about, .cmp, .notes, .frame"));
  els.forEach((e) => e.getAnimations().forEach((a) => a.cancel()));
  if (!dir || reduced || STILL) { update(); return; }
  const token = ++slideToken, dx = 28 * dir;
  const outs = els.map((e) => e.animate([{ transform: "translateX(0)", opacity: 1 }, { transform: `translateX(${-dx}px)`, opacity: 0 }], { duration: 170, easing: "cubic-bezier(.4,0,1,1)", fill: "forwards" }));
  Promise.all(outs.map((a) => a.finished.catch(() => {}))).then(() => {
    if (token !== slideToken) return; // a newer change took over
    update();
    els.forEach((e, k) => {
      e.getAnimations().forEach((a) => a.cancel());
      e.animate([{ transform: `translateX(${dx}px)`, opacity: 0 }, { transform: "translateX(0)", opacity: 1 }], { duration: 300, delay: k * 35, easing: "cubic-bezier(.2,.8,.2,1)", fill: "backwards" });
    });
  });
}
function show(i, dir = Math.sign(i - idx)) {
  idx = (i + NS) % NS;
  const part = partOf(idx);
  // the camera is fitted after the new content is in, since frames and spec cards differ in height
  slideCard(dir, () => {
    const wasTitle = card.classList.contains("titleslide");
    renderCard(true);
    // the card grows into the title slide or shrinks back to a spec card: settle it with a short fade
    if (wasTitle !== card.classList.contains("titleslide") && card.classList.contains("floating") && !reduced && !STILL)
      card.animate([{ opacity: 0.4, transform: "translateX(-50%) scale(0.985)" }, { opacity: 1, transform: "translateX(-50%) scale(1)" }], { duration: 380, easing: "cubic-bezier(.2,.8,.2,1)" });
    if ($("camFollow").checked) flyTo(part);
  });
  document.querySelectorAll("#mlist button").forEach((b, j) => b.classList.toggle("cur", j === idx));
  document.querySelector("#mlist button.cur")?.scrollIntoView({ block: "nearest" });
  highlight(part);
  tourT0 = clock();
}
function buildList() {
  const ml = $("mlist");
  ml.innerHTML = "";
  const add = (i, label, ratio) => {
    const b = document.createElement("button");
    b.innerHTML = `<span>${label}</span><span>${ratio}</span>`;
    b.classList.toggle("cur", i === idx);
    b.onclick = () => show(i, Math.sign(i - idx));
    ml.appendChild(b);
  };
  ml.insertAdjacentHTML("beforeend", `<div class="grp">${T.s.introGroup}</div>`);
  FRAMES.forEach((f, i) => add(i, T.s.frameNames[f.id], ""));
  let g = "";
  SPECS.forEach((d, k) => {
    if (d.group !== g) { g = d.group; ml.insertAdjacentHTML("beforeend", `<div class="grp">${T.group(g)}</div>`); }
    add(NF + k, T.metric(d), isNum(d.b300) ? `${(d.rubin / d.b300).toFixed(2)}×` : "");
  });
}

// ---------------------------------------------------------------- language
const mqPhone = matchMedia("(max-width: 760px)");
function toggleLabel() {
  const c = wrap.classList.contains("closed");
  $("toggle").textContent = mqPhone.matches ? (c ? T.s.open : T.s.close) : c ? T.s.show : T.s.hide;
}
function setLang(lang) {
  T = makeText(LANGS.includes(lang) ? lang : "en");
  store.set(LANG_KEY, T.lang);
  const u = new URL(location.href); u.searchParams.set("lang", T.lang); history.replaceState(null, "", u);
  document.documentElement.lang = T.s.htmlLang;
  document.title = T.s.docTitle;
  document.querySelectorAll("[data-i18n]").forEach((el) => (el.textContent = T.s[el.dataset.i18n]));
  document.querySelectorAll("[data-i18n-title]").forEach((el) => (el.title = T.s[el.dataset.i18nTitle]));
  document.querySelectorAll(".seg button").forEach((b) => b.classList.toggle("on", b.dataset.lang === T.lang));
  $("prev").textContent = T.s.prev; $("next").textContent = T.s.next; $("play").textContent = playing ? T.s.pause : T.s.play;
  document.querySelector("#panel .seg").setAttribute("aria-label", T.s.ariaLanguage);
  $("dwell").setAttribute("aria-label", T.s.ariaDwell);
  $("op").setAttribute("aria-label", T.s.ariaOpacity);
  toggleLabel(); buildList(); dimLabels(); renderCard(false); resize();
}
document.querySelectorAll(".seg button").forEach((b) => (b.onclick = () => setLang(b.dataset.lang)));

// ---------------------------------------------------------------- panel controls (none on the card)
function setPlay(p) { playing = p; $("play").textContent = p ? T.s.pause : T.s.play; $("play").classList.toggle("on", p); tourT0 = clock(); }
$("play").onclick = () => setPlay(!playing);
$("next").onclick = () => show(idx + 1, 1);
$("prev").onclick = () => show(idx - 1, -1);
$("dwell").oninput = (e) => { dwell = e.target.value * 1000; $("dwellV").textContent = e.target.value; };
$("nvlink").onchange = (e) => { for (const k of KEYS) particles[k].pts.visible = e.target.checked; };
$("dims").onchange = (e) => { dims.visible = e.target.checked && !stage.classList.contains("titlemode"); resize(); };
function setOpacity(v) { document.documentElement.style.setProperty("--card-alpha", (v / 100).toFixed(2)); $("op").value = v; $("opV").textContent = `${v}%`; }
$("op").oninput = (e) => { setOpacity(+e.target.value); store.set(OPACITY_KEY, e.target.value); };
// the title slide has its own opacity, separate from the spec cards'
function setTitleOpacity(v) { document.documentElement.style.setProperty("--title-alpha", (v / 100).toFixed(2)); $("top").value = v; $("topV").textContent = `${v}%`; }
$("top").oninput = (e) => { setTitleOpacity(+e.target.value); store.set(TITLE_OPACITY_KEY, e.target.value); };
let autoClosed = false, notesTouched = false;
$("notes").checked = !mqPhone.matches;
card.classList.toggle("nonotes", mqPhone.matches);
$("notes").onchange = (e) => { notesTouched = true; card.classList.toggle("nonotes", !e.target.checked); resize(); };
function applyCardMode() {
  const fl = $("floatCard").checked;
  card.classList.toggle("floating", fl);
  if (fl && card.parentElement !== stage) stage.appendChild(card);
  if (!fl && card.parentElement !== mainEl) mainEl.appendChild(card);
  if (idx < NF && typeof FRAMES !== "undefined") renderCard(false); // the title slide only exists while floating
  resize();
}
$("floatCard").onchange = applyCardMode;
function togglePanel() { autoClosed = false; wrap.classList.toggle("closed"); toggleLabel(); setTimeout(resize, 270); }
$("toggle").onclick = togglePanel;
// Phones start with the panel closed. A preview frame can report a phone width while it loads,
// so a panel closed that way reopens once the stage is wide again.
mqPhone.addEventListener("change", () => {
  if (mqPhone.matches) { if (!wrap.classList.contains("closed")) { wrap.classList.add("closed"); autoClosed = true; } }
  else if (autoClosed) { wrap.classList.remove("closed"); autoClosed = false; }
  if (!notesTouched) { $("notes").checked = !mqPhone.matches; card.classList.toggle("nonotes", mqPhone.matches); }
  toggleLabel(); resize();
});
addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT" || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.code === "Space") { e.preventDefault(); setPlay(!playing); }
  else if (e.code === "ArrowRight") show(idx + 1, 1);
  else if (e.code === "ArrowLeft") show(idx - 1, -1);
  else if (e.code === "KeyF") { $("camFollow").checked = !$("camFollow").checked; if ($("camFollow").checked) flyTo(partOf(idx)); }
  else if (e.code === "KeyH") togglePanel();
});
{ // swipe the card left / right: the same as ← / →
  let x0 = null;
  card.addEventListener("pointerdown", (e) => (x0 = e.clientX));
  card.addEventListener("pointerup", (e) => { if (x0 === null) return; const dx = e.clientX - x0; x0 = null; if (Math.abs(dx) > 40) show(idx + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1); });
}

// ---------------------------------------------------------------- hover (mouse) and tap (touch)
const ray = new THREE.Raycaster(), mouse = new THREE.Vector2(), tip = $("tip");
let hov = null;
function pick(e) {
  const r = renderer.domElement.getBoundingClientRect();
  mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(mouse, cam);
  const h = ray.intersectObjects(pickables)[0];
  if (hov && hov !== h?.object) { hov.scale.set(1, 1, 1); hov = null; }
  if (!h) { tip.style.display = "none"; return; }
  hov = h.object; hov.scale.set(1.15, 1.3, 1.15);
  const u = hov.userData;
  tip.style.display = "block";
  tip.style.left = `${Math.max(6, Math.min(e.clientX - r.left + 14, r.width - Math.min(280, r.width - 12)))}px`;
  tip.style.top = `${e.clientY - r.top + 14}px`;
  tip.innerHTML = `<b style="color:${u.key === "b300" ? "#6aa6ee" : "#ee8556"}">${u.key === "b300" ? "GB300 NVL72" : "Vera Rubin NVL72"}</b> · ${T.s.kinds[u.kind]}${u.tray ? ` · ${T.s.tray(u.tray)}` : ""}<br>${T.s.parts[u.kind][u.key]}`;
}
renderer.domElement.addEventListener("pointermove", (e) => { if (e.pointerType === "mouse") pick(e); });
let tapTimer = null, down = null;
renderer.domElement.addEventListener("pointerdown", (e) => (down = { x: e.clientX, y: e.clientY }));
renderer.domElement.addEventListener("pointerup", (e) => {
  if (e.pointerType === "mouse" || !down || Math.hypot(e.clientX - down.x, e.clientY - down.y) >= 8) return;
  pick(e);
  clearTimeout(tapTimer);
  tapTimer = setTimeout(() => { tip.style.display = "none"; if (hov) { hov.scale.set(1, 1, 1); hov = null; } }, 2800);
});
renderer.domElement.addEventListener("pointerleave", () => (tip.style.display = "none"));

// ---------------------------------------------------------------- layout
function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h);
  cam.aspect = w / h; cam.updateProjectionMatrix();
  const tt = $("title");
  stage.style.setProperty("--card-top", `${tt.offsetTop + tt.offsetHeight + GAP}px`);
  if (!camAnim) flyTo(curView, true);
}
addEventListener("resize", resize);
if (mqPhone.matches) { wrap.classList.add("closed"); autoClosed = true; }
setOpacity(Math.max(0, Math.min(100, +(params.get("op") ?? store.get(OPACITY_KEY) ?? 55))));
setTitleOpacity(Math.max(0, Math.min(100, +(params.get("top") ?? store.get(TITLE_OPACITY_KEY) ?? 90))));
applyCardMode();
setLang(T.lang);
show(params.has("m") ? NF + (Math.max(0, +params.get("m")) % SPECS.length) : 0, 0); // starts on the title frame; ?m=N opens spec N

// ---------------------------------------------------------------- frame loop
const ease = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
let last = performance.now();
function tick(now) {
  CLOCK = now;
  const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); // rAF time can start behind performance.now()
  last = now;
  if (camAnim) {
    const p = Math.min(1, (now - camAnim.t0) / camAnim.dur), e = ease(p);
    cam.position.lerpVectors(camAnim.p0, camAnim.p1, e); ctl.target.lerpVectors(camAnim.q0, camAnim.q1, e);
    if (p >= 1) camAnim = null;
  }
  if (numAnim) { // count the card's numbers up from the previous metric's
    const p = Math.min(1, (now - numAnim.t0) / 800), e = ease(p);
    shown = p >= 1 ? { ...numAnim.to } : { b: numAnim.from.b + (numAnim.to.b - numAnim.from.b) * e, r: numAnim.from.r + (numAnim.to.r - numAnim.from.r) * e };
    $("vB").textContent = T.value(shown.b, numAnim.unit); $("vR").textContent = T.value(shown.r, numAnim.unit);
    if (p >= 1) numAnim = null;
  }
  overviewTick(now);
  if (!reduced) { // pulse the highlighted parts
    const pulse = 0.75 + 0.25 * Math.sin(now / 260);
    for (const k of KEYS) for (const arr of [parts[k].gpu, parts[k].cpu, parts[k].sw, parts[k].nic, parts[k].pwr, parts[k].tray]) for (const m of arr) if (m.userData.hl) m.material.emissiveIntensity = pulse;
  }
  const bar = $("progress").firstElementChild;
  if (playing) {
    const p = (now - tourT0) / dwell;
    bar.style.width = `${Math.min(100, p * 100)}%`;
    if (p >= 1) { if (idx === NS - 1 && !$("loop").checked) setPlay(false); else show(idx + 1, 1); }
  } else bar.style.width = "0%";
  for (const k of KEYS) { // NVLink traffic: GPU → switch trays → GPU
    const P = particles[k], gp = parts[k].gpuPos, sy = parts[k].switchY;
    for (let i = 0; i < P.n; i++) {
      const s = P.st[i];
      s.t += dt * NVLINK[k] * 0.25;
      if (s.t > 1) { s.t = 0; s.g = (Math.random() * 72) | 0; }
      const a = gp[s.g], tt = Math.min(1, Math.max(0, s.t < 0.5 ? s.t * 2 : 2 - s.t * 2));
      P.pos[i * 3] = a.x * (1 - tt * 0.7); P.pos[i * 3 + 1] = a.y + (sy[s.g % 9] - a.y) * tt; P.pos[i * 3 + 2] = RD / 2 + 0.02;
    }
    P.pts.geometry.attributes.position.needsUpdate = true;
  }
  ctl.update();
  renderer.render(scene, cam);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

// for automated checks
window.__twinRacks = {
  show, setPlay, setLang, tick, get idx() { return idx; },
  overviewStep(i) { ovT0 = clock() - i * Math.max(900, dwell / OV_STEPS.length) - 1; ovStep = -1; overviewTick(clock()); },
  get lit() { const n = (a) => a.filter((m) => m.userData.hl).length; return Object.fromEntries(["gpu", "cpu", "tray", "sw"].map((k) => [k, n(parts.b300[k]) + n(parts.rubin[k])])); },
};
