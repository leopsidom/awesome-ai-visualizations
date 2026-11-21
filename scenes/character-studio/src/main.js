import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import {
  createCharacter,
  CHARACTER_PRESETS,
  OPTIONS,
  PALETTES,
} from "../../../components/characters/index.js";

const params = new URLSearchParams(window.location.search);
if (params.get("panel") === "closed") {
  document.body.classList.add("panel-closed");
}
if (params.get("clean") === "1") {
  document.body.classList.add("panel-closed", "clean-capture");
}

const stageWrap = document.getElementById("stage-wrap");
const canvasHost = document.getElementById("canvas-host");

// ---- Renderer ----
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.06;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
canvasHost.appendChild(renderer.domElement);

// ---- Scene & Studio IBL ----
const scene = new THREE.Scene();
scene.background = new THREE.Color("#161d2d");
scene.fog = new THREE.Fog("#161d2d", 11, 28);

const pmrem = new THREE.PMREMGenerator(renderer);
const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environment = envTex;
scene.environmentIntensity = 0.72;
pmrem.dispose();

// ---- Camera & OrbitControls ----
const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 60);
camera.position.set(0.0, 1.55, 5.15);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 1.4;
controls.maxDistance = 10.0;
controls.maxPolarAngle = Math.PI * 0.495;
controls.target.set(0, 0.85, 0);
controls.update();

// Smooth camera framing targets
const camGoalPos = camera.position.clone();
const camGoalTarget = controls.target.clone();
let camLerping = false;

controls.addEventListener("start", () => {
  camLerping = false;
});

function frameCamera(pos, target, instant = false) {
  camGoalPos.set(...pos);
  camGoalTarget.set(...target);
  if (instant) {
    camera.position.copy(camGoalPos);
    controls.target.copy(camGoalTarget);
    controls.update();
    camLerping = false;
  } else {
    camLerping = true;
  }
}

// ---- 3-Point Studio Lighting ----
const hemiLight = new THREE.HemisphereLight(0xdce8ff, 0x262c3d, 0.55);
scene.add(hemiLight);

const keyLight = new THREE.DirectionalLight(0xfff6ea, 1.65);
keyLight.position.set(3.8, 6.2, 4.4);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.near = 0.5;
keyLight.shadow.camera.far = 18;
keyLight.shadow.camera.left = -3.8;
keyLight.shadow.camera.right = 3.8;
keyLight.shadow.camera.top = 3.5;
keyLight.shadow.camera.bottom = -3.5;
keyLight.shadow.bias = -0.0002;
keyLight.shadow.normalBias = 0.025;
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0xaad2ff, 0.55);
fillLight.position.set(-4.2, 2.8, 2.5);
scene.add(fillLight);

const rimLight = new THREE.DirectionalLight(0x63f0e0, 0.78);
rimLight.position.set(-1.5, 3.6, -4.4);
scene.add(rimLight);

// ---- Studio Floor & Wide Turntable Plinth ----
const floorMat = new THREE.MeshStandardMaterial({
  color: "#151b29",
  roughness: 0.86,
  metalness: 0.05,
});
const floor = new THREE.Mesh(new THREE.CircleGeometry(16, 64), floorMat);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.04;
floor.receiveShadow = true;
scene.add(floor);

const plinthMat = new THREE.MeshStandardMaterial({
  color: "#1f273a",
  roughness: 0.72,
  metalness: 0.08,
});
const plinthTop = new THREE.Mesh(new THREE.CylinderGeometry(2.35, 2.46, 0.04, 72), plinthMat);
plinthTop.position.y = -0.02;
plinthTop.receiveShadow = true;
scene.add(plinthTop);

const plinthRingMat = new THREE.MeshStandardMaterial({
  color: "#38e8d4",
  emissive: "#38e8d4",
  emissiveIntensity: 0.55,
  roughness: 0.35,
});
const plinthRing = new THREE.Mesh(new THREE.TorusGeometry(2.355, 0.009, 10, 84), plinthRingMat);
plinthRing.rotation.x = Math.PI / 2;
plinthRing.position.y = -0.002;
scene.add(plinthRing);

// ---- Optional 2.1m 48U Server Rack Scale Guide ----
const scaleGuide = new THREE.Group();
scaleGuide.visible = false;
const rackW = 0.6;
const rackH = 2.1;
const rackD = 1.05;
const rackWire = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(rackW, rackH, rackD)),
  new THREE.LineBasicMaterial({ color: 0x76b900, transparent: true, opacity: 0.68 }),
);
rackWire.position.set(1.68, rackH / 2, -0.45);
scaleGuide.add(rackWire);

const rackGhost = new THREE.Mesh(
  new THREE.BoxGeometry(rackW, rackH, rackD),
  new THREE.MeshBasicMaterial({
    color: 0x76b900,
    transparent: true,
    opacity: 0.07,
    depthWrite: false,
  }),
);
rackGhost.position.copy(rackWire.position);
scaleGuide.add(rackGhost);

const labelCanvas = document.createElement("canvas");
labelCanvas.width = 256;
labelCanvas.height = 64;
const lctx = labelCanvas.getContext("2d");
lctx.fillStyle = "rgba(10, 18, 12, 0.88)";
lctx.fillRect(0, 0, 256, 64);
lctx.strokeStyle = "#76b900";
lctx.lineWidth = 3;
lctx.strokeRect(2, 2, 252, 60);
lctx.fillStyle = "#a8e03a";
lctx.font = "bold 24px ui-monospace, Menlo, monospace";
lctx.textAlign = "center";
lctx.textBaseline = "middle";
lctx.fillText("48U RACK · 2.10m", 128, 33);
const labelTex = new THREE.CanvasTexture(labelCanvas);
labelTex.colorSpace = THREE.SRGBColorSpace;
const labelSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex, transparent: true }));
labelSprite.scale.set(0.75, 0.19, 1);
labelSprite.position.set(1.68, rackH + 0.16, -0.45);
scaleGuide.add(labelSprite);
scene.add(scaleGuide);

// ---- Spawn Full 5-Character Cast ----
const turntable = new THREE.Group();
scene.add(turntable);

const CAST_ORDER = ["ada", "kai", "maya", "leo", "pip"];
const LINEUP_SLOTS = {
  ada: { pos: [-1.42, 0, -0.18], rotY: 0.24 },
  kai: { pos: [-0.72, 0, 0.08], rotY: 0.12 },
  maya: { pos: [0.0, 0, 0.2], rotY: 0.0 },
  leo: { pos: [0.74, 0, 0.06], rotY: -0.14 },
  pip: { pos: [1.4, 0, -0.05], rotY: -0.26 },
};

const configs = {};
const cast = {};

function tagCharacterId(root, id) {
  root.traverse((obj) => {
    obj.userData.characterId = id;
  });
}

function buildCastMember(id) {
  if (cast[id]) {
    cast[id].dispose();
  }
  const instance = createCharacter(configs[id]);
  instance.setState(state.loop);
  if (state.expression !== "loading" || id === "pip") {
    instance.setExpression(state.expression);
  }
  tagCharacterId(instance.root, id);
  turntable.add(instance.root);
  cast[id] = instance;
  return instance;
}

const state = {
  view: params.get("view") || "lineup",
  activeId: "ada", // character targeted by Customize tab
  loop: params.get("state") || "idle",
  expression: "neutral",
  lighting: "studio",
  lookAtCamera: true,
  autoTurn: false,
  scaleGuide: false,
};

for (const id of CAST_ORDER) {
  configs[id] = { ...CHARACTER_PRESETS[id] };
  buildCastMember(id);
}

// Give Ada a tablet and Leo a pointer in the default Lineup so props shine on first load!
if (params.get("showcaseProps") !== "0") {
  configs.ada.prop = "tablet";
  cast.ada.setProp("tablet");
  configs.leo.prop = "pointer";
  cast.leo.setProp("pointer");
}

function applyCastLayout(instantCamera = false) {
  const isLineup = state.view === "lineup";
  for (const id of CAST_ORDER) {
    const c = cast[id];
    if (isLineup) {
      const slot = LINEUP_SLOTS[id];
      c.root.visible = true;
      c.root.position.set(...slot.pos);
      c.root.rotation.y = slot.rotY;
    } else {
      c.root.visible = id === state.view;
      c.root.position.set(0, 0, 0);
      c.root.rotation.y = 0;
    }
  }

  if (isLineup) {
    const portrait = stageWrap.clientWidth < stageWrap.clientHeight;
    frameCamera(portrait ? [0, 1.55, 7.4] : [0, 1.48, 4.95], [0, 0.82, 0], instantCamera);
  } else {
    state.activeId = state.view;
    const isBot = state.view === "pip";
    frameCamera(
      isBot ? [0.15, 0.85, 2.45] : [0.22, 1.25, 3.15],
      isBot ? [0, 0.56, 0] : [0, 0.88, 0],
      instantCamera,
    );
  }

  syncCastButtons();
  syncCustomizerUI();
  updateReadout();
}

const LIGHTING_PRESETS = {
  studio: {
    bg: "#161d2d",
    floor: "#151b29",
    plinth: "#1f273a",
    keyColor: 0xfff6ea,
    keyInt: 1.65,
    fillColor: 0xaad2ff,
    fillInt: 0.55,
    rimColor: 0x63f0e0,
    rimInt: 0.78,
    envInt: 0.72,
  },
  warm: {
    bg: "#1e171b",
    floor: "#1a1417",
    plinth: "#2a2024",
    keyColor: 0xffd7a8,
    keyInt: 1.85,
    fillColor: 0xffb396,
    fillInt: 0.45,
    rimColor: 0xffcb6b,
    rimInt: 0.85,
    envInt: 0.65,
  },
  dark: {
    bg: "#060912",
    floor: "#080c16",
    plinth: "#101726",
    keyColor: 0xdbeafe,
    keyInt: 1.15,
    fillColor: 0x38bdf8,
    fillInt: 0.48,
    rimColor: 0x38e8d4,
    rimInt: 1.45,
    envInt: 0.35,
  },
};

function applyLighting(presetName) {
  const p = LIGHTING_PRESETS[presetName] || LIGHTING_PRESETS.studio;
  state.lighting = presetName;
  scene.background.set(p.bg);
  scene.fog.color.set(p.bg);
  floorMat.color.set(p.floor);
  plinthMat.color.set(p.plinth);
  keyLight.color.setHex(p.keyColor);
  keyLight.intensity = p.keyInt;
  fillLight.color.setHex(p.fillColor);
  fillLight.intensity = p.fillInt;
  rimLight.color.setHex(p.rimColor);
  rimLight.intensity = p.rimInt;
  scene.environmentIntensity = p.envInt;
}

const readoutEl = document.getElementById("state-readout");
function updateReadout() {
  if (state.view === "lineup") {
    readoutEl.innerHTML =
      `<div><strong>View:</strong> Full Lineup (5 characters)</div>` +
      `<div><strong>State:</strong> ${state.loop} &middot; <strong>Expr:</strong> ${state.expression}</div>`;
  } else {
    const cfg = configs[state.view];
    readoutEl.innerHTML =
      `<div><strong>${cfg.name}</strong> &middot; ${cfg.role} (${cfg.height.toFixed(2)}m)</div>` +
      `<div><strong>State:</strong> ${state.loop} &middot; <strong>Expr:</strong> ${state.expression}</div>`;
  }
}

// ---- Tabs ----
const tabBtns = document.querySelectorAll(".tab-btn");
const tabPanes = document.querySelectorAll(".tab-pane");
tabBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.tab;
    tabBtns.forEach((b) => b.classList.toggle("active", b === btn));
    tabPanes.forEach((p) => p.classList.toggle("active", p.dataset.pane === target));
    // When opening Customize from Lineup, focus the active solo character so edits are crystal clear
    if (target === "customize" && state.view === "lineup") {
      state.view = state.activeId;
      applyCastLayout(false);
    }
  });
});

// ---- Cast / Motion / Lighting Bindings ----
function syncCastButtons() {
  document.querySelectorAll("#cast-btns .chip").forEach((b) => {
    b.classList.toggle("active", b.dataset.cast === state.view);
  });
}

function bindButtonGroup(containerId, attr, onSelect) {
  const wrap = document.getElementById(containerId);
  wrap.addEventListener("click", (e) => {
    const btn = e.target.closest(`button[data-${attr}]`);
    if (!btn) return;
    wrap.querySelectorAll(".chip").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    onSelect(btn.dataset[attr]);
  });
}

bindButtonGroup("cast-btns", "cast", (val) => {
  state.view = val;
  applyCastLayout(false);
});

bindButtonGroup("state-btns", "state", (val) => {
  state.loop = val;
  for (const id of CAST_ORDER) cast[id].setState(val);
  updateReadout();
});

document.getElementById("gesture-btns").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-gesture]");
  if (!btn) return;
  const g = btn.dataset.gesture;
  const opts =
    g === "point" && state.scaleGuide
      ? { target: rackWire.position.clone() }
      : null;
  for (const id of CAST_ORDER) {
    if (state.view === "lineup" || id === state.view) {
      cast[id].play(g, opts);
    }
  }
});

bindButtonGroup("expr-btns", "expr", (val) => {
  state.expression = val;
  for (const id of CAST_ORDER) {
    if (id === "pip") {
      cast[id].setExpression(val);
    } else if (val !== "loading" && val !== "heart") {
      cast[id].setExpression(val);
    }
  }
  updateReadout();
});

bindButtonGroup("light-btns", "light", (val) => applyLighting(val));

document.getElementById("toggle-look").addEventListener("change", (e) => {
  state.lookAtCamera = e.target.checked;
  if (!state.lookAtCamera) {
    for (const id of CAST_ORDER) cast[id].lookAt(null);
  }
});

document.getElementById("toggle-turn").addEventListener("change", (e) => {
  state.autoTurn = e.target.checked;
});

document.getElementById("toggle-scale").addEventListener("change", (e) => {
  state.scaleGuide = e.target.checked;
  scaleGuide.visible = state.scaleGuide;
});

document.getElementById("toggle-mobile-safe").addEventListener("change", (e) => {
  document.body.classList.toggle("mobile-capture", e.target.checked);
});

document.getElementById("close-panel-btn").addEventListener("click", () => {
  document.body.classList.add("panel-closed");
});
document.getElementById("open-panel-btn").addEventListener("click", () => {
  document.body.classList.remove("panel-closed");
});

// ---- Modular Customizer UI ----
const LABEL_MAP = {
  bob: "Bob",
  spiky: "Spiky",
  puffs: "Puffs",
  sidepart: "Side-Part",
  beanie: "Beanie",
  sweater: "Sweater",
  hoodie: "Hoodie",
  jacket: "Jacket",
  blazer: "Blazer",
  none: "None",
  round: "Round",
  square: "Square",
  lanyard: "Lanyard",
  headphones: "Headphones",
  backpack: "Backpack",
  tablet: "Tablet",
  pointer: "Pointer",
  coffee: "Coffee",
  laptop: "Laptop",
};

function rebuildActiveCharacter() {
  const id = state.activeId;
  const prevPos = cast[id].root.position.clone();
  const prevRot = cast[id].root.rotation.y;
  const prevVis = cast[id].root.visible;
  buildCastMember(id);
  cast[id].root.position.copy(prevPos);
  cast[id].root.rotation.y = prevRot;
  cast[id].root.visible = prevVis;
  updateReadout();
}

function populateOptionChips(containerId, key, values) {
  const el = document.getElementById(containerId);
  el.innerHTML = "";
  for (const val of values) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip";
    btn.dataset.val = val;
    btn.textContent = LABEL_MAP[val] || val;
    btn.addEventListener("click", () => {
      const cfg = configs[state.activeId];
      if (!cfg || cfg.type !== "human") return;
      cfg[key] = val;
      if (key === "outfit") {
        // Clear custom sleeveColor override so jacket gets cream sleeves & others match primary
        delete cfg.sleeveColor;
      }
      if (key === "prop") {
        cast[state.activeId].setProp(val);
      } else {
        rebuildActiveCharacter();
      }
      syncCustomizerUI();
    });
    el.appendChild(btn);
  }
}

function populateSwatches(containerId, key, colors) {
  const el = document.getElementById(containerId);
  el.innerHTML = "";
  for (const hex of colors) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "swatch";
    btn.dataset.val = hex;
    btn.style.background = hex;
    btn.title = hex;
    btn.addEventListener("click", () => {
      const cfg = configs[state.activeId];
      if (!cfg) return;
      cfg[key] = hex;
      rebuildActiveCharacter();
      syncCustomizerUI();
    });
    el.appendChild(btn);
  }
}

populateOptionChips("opt-hairStyle", "hairStyle", OPTIONS.hairStyle);
populateOptionChips("opt-outfit", "outfit", OPTIONS.outfit);
populateOptionChips("opt-glasses", "glasses", OPTIONS.glasses);
populateOptionChips("opt-accessory", "accessory", OPTIONS.accessory);
populateOptionChips("opt-prop", "prop", OPTIONS.prop);

populateSwatches("swatch-skinTone", "skinTone", PALETTES.skinTone);
populateSwatches("swatch-hairColor", "hairColor", PALETTES.hairColor);
populateSwatches("swatch-primaryColor", "primaryColor", PALETTES.primaryColor);
populateSwatches("swatch-accentColor", "accentColor", PALETTES.accentColor);

populateSwatches("swatch-bodyColor", "bodyColor", ["#eef2f8", "#1e2533", "#f6e7d2", "#d8f3ec", "#fce1e4"]);
populateSwatches("swatch-botAccent", "accentColor", ["#38e8d4", "#76b900", "#38bdf8", "#f2c15a", "#ff6b8b", "#a855f7"]);

const heightSlider = document.getElementById("height-slider");
const heightVal = document.getElementById("height-val");
heightSlider.addEventListener("input", () => {
  const cfg = configs[state.activeId];
  if (!cfg) return;
  cfg.height = parseFloat(heightSlider.value);
  heightVal.textContent = `${cfg.height.toFixed(2)}m`;
  rebuildActiveCharacter();
});

const humanCustEl = document.getElementById("human-customizer");
const botCustEl = document.getElementById("bot-customizer");
const custNoteEl = document.getElementById("customize-target-note");

function syncCustomizerUI() {
  const cfg = configs[state.activeId];
  if (!cfg) return;
  const isBot = cfg.type === "bot";
  humanCustEl.style.display = isBot ? "none" : "flex";
  botCustEl.style.display = isBot ? "flex" : "none";
  custNoteEl.innerHTML = `Editing <strong>${cfg.name}</strong> &mdash; tweak parts &amp; copy a ready-to-paste JS snippet.`;

  heightSlider.min = isBot ? "0.65" : "1.20";
  heightSlider.max = isBot ? "1.30" : "1.95";
  heightSlider.value = String(cfg.height);
  heightVal.textContent = `${cfg.height.toFixed(2)}m`;

  const syncGroup = (id, key) => {
    document.querySelectorAll(`#${id} [data-val]`).forEach((el) => {
      el.classList.toggle("active", el.dataset.val === cfg[key]);
    });
  };

  if (!isBot) {
    syncGroup("opt-hairStyle", "hairStyle");
    syncGroup("opt-outfit", "outfit");
    syncGroup("opt-glasses", "glasses");
    syncGroup("opt-accessory", "accessory");
    syncGroup("opt-prop", "prop");
    syncGroup("swatch-skinTone", "skinTone");
    syncGroup("swatch-hairColor", "hairColor");
    syncGroup("swatch-primaryColor", "primaryColor");
    syncGroup("swatch-accentColor", "accentColor");
  } else {
    syncGroup("swatch-bodyColor", "bodyColor");
    syncGroup("swatch-botAccent", "accentColor");
  }
}

const copyBtn = document.getElementById("copy-config-btn");
copyBtn.addEventListener("click", async () => {
  const cfg = configs[state.activeId];
  const base = CHARACTER_PRESETS[state.activeId];
  const diff = {};
  for (const [k, v] of Object.entries(cfg)) {
    if (base[k] !== v) diff[k] = v;
  }
  const snippet =
    Object.keys(diff).length === 0
      ? `const ${state.activeId} = createCharacter("${state.activeId}");`
      : `const ${state.activeId} = createCharacter("${state.activeId}", ${JSON.stringify(diff, null, 2)});`;
  try {
    await navigator.clipboard.writeText(snippet);
    copyBtn.textContent = "Copied!";
    setTimeout(() => {
      copyBtn.textContent = "Copy JS Config";
    }, 1500);
  } catch {
    copyBtn.textContent = "Logged to Console";
    console.log(snippet);
    setTimeout(() => {
      copyBtn.textContent = "Copy JS Config";
    }, 1500);
  }
});

document.getElementById("reset-preset-btn").addEventListener("click", () => {
  configs[state.activeId] = { ...CHARACTER_PRESETS[state.activeId] };
  rebuildActiveCharacter();
  syncCustomizerUI();
});

// ---- Click-to-Focus / Click-to-Wave Raycasting ----
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let pointerDownXY = null;

renderer.domElement.addEventListener("pointerdown", (e) => {
  pointerDownXY = [e.clientX, e.clientY];
});

renderer.domElement.addEventListener("pointermove", (e) => {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const roots = CAST_ORDER.filter((id) => cast[id].root.visible).map((id) => cast[id].root);
  const hits = raycaster.intersectObjects(roots, true);
  canvasHost.classList.toggle("hover-char", hits.length > 0);
});

renderer.domElement.addEventListener("pointerup", (e) => {
  if (!pointerDownXY) return;
  const dist = Math.hypot(e.clientX - pointerDownXY[0], e.clientY - pointerDownXY[1]);
  pointerDownXY = null;
  if (dist > 6) return; // drag orbit, not click

  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);

  const roots = CAST_ORDER.filter((id) => cast[id].root.visible).map((id) => cast[id].root);
  const hits = raycaster.intersectObjects(roots, true);
  if (hits.length > 0) {
    const id = hits[0].object.userData.characterId;
    if (id) {
      if (state.view === "lineup") {
        state.view = id;
        applyCastLayout(false);
        cast[id].play("wave");
      } else {
        cast[id].play("wave");
      }
    }
  }
});

// ---- Responsive ResizeObserver ----
function resize() {
  const w = Math.max(1, stageWrap.clientWidth);
  const h = Math.max(1, stageWrap.clientHeight);
  camera.aspect = w / h;
  camera.fov = w < h ? 46 : 36;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}

const ro = new ResizeObserver(resize);
ro.observe(stageWrap);
resize();

applyLighting("studio");
applyCastLayout(true);

// ---- Render Loop ----
let lastTime = null;
function animate(now) {
  requestAnimationFrame(animate);
  const dt = lastTime === null ? 1 / 60 : THREE.MathUtils.clamp((now - lastTime) / 1000, 0, 0.05);
  lastTime = now;

  if (camLerping) {
    const alpha = 1 - Math.exp(-7 * dt);
    camera.position.lerp(camGoalPos, alpha);
    controls.target.lerp(camGoalTarget, alpha);
    if (camera.position.distanceTo(camGoalPos) < 0.015) {
      camLerping = false;
    }
  }

  if (state.autoTurn) {
    turntable.rotation.y += dt * 0.42;
  }

  for (const id of CAST_ORDER) {
    if (!cast[id].root.visible) continue;
    if (state.lookAtCamera) {
      cast[id].lookAt(camera.position);
    }
    cast[id].update(dt);
  }

  controls.update();
  renderer.render(scene, camera);
}
requestAnimationFrame(animate);
