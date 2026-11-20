import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GENERATIONS, STORY_CHAPTERS } from './data.js';
import { I18N, detectInitialLang, persistLang } from './i18n.js';

// =============================================================================
// 1. APPLICATION STATE
// =============================================================================
const state = {
  locale: detectInitialLang(),
  mode: 'lineup',        // 'lineup' | 'focus' | 'compare'
  selectedGen: 4,        // 0..4
  compareLeft: 0,
  compareRight: 4,
  drill: 'rack',         // 'rack' | 'tray' | 'package'
  rackFlipped: false,    // false = Front (0 deg), true = Rear (180 deg)
  chart: 'none',         // 'compute' | 'hbm' | 'nvlink' | 'power' | 'memory_pool' | 'none'
  precision: 'dense',    // 'dense' | 'peak'
  explode: 0,            // 0..1
  xray: false,
  showPins: true,
  bloom: true,
  showCaption: true,
  autoOrbit: false,
  mobileSafe: window.innerWidth <= 860,
  // Guided Play Script state
  playing: false,
  chapterIdx: 0,
  chapterElapsed: 0,
  speed: 1.0,
  autoHideOnPlay: true,
};

const tr = (k) => (I18N[state.locale] && I18N[state.locale][k]) || I18N.en[k] || k;

// =============================================================================
// 2. PROCEDURAL TEXTURES (Zero external image dependencies)
// =============================================================================
function makeStudioBackdropTexture() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 1024;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#050907';
  ctx.fillRect(0, 0, 1024, 1024);

  const g1 = ctx.createRadialGradient(512, 640, 40, 512, 640, 520);
  g1.addColorStop(0.0, 'rgba(118, 185, 0, 0.24)');
  g1.addColorStop(0.45, 'rgba(65, 110, 12, 0.10)');
  g1.addColorStop(1.0, 'rgba(5, 9, 7, 0.0)');
  ctx.fillStyle = g1;
  ctx.fillRect(0, 0, 1024, 1024);

  const g2 = ctx.createRadialGradient(512, 180, 20, 512, 180, 420);
  g2.addColorStop(0.0, 'rgba(34, 211, 238, 0.07)');
  g2.addColorStop(1.0, 'rgba(5, 9, 7, 0.0)');
  ctx.fillStyle = g2;
  ctx.fillRect(0, 0, 1024, 1024);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makePCBTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#082414';
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = 'rgba(118, 185, 0, 0.24)';
  ctx.lineWidth = 1.5;
  for (let i = 8; i < 256; i += 14) {
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(256, i); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 256); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(212, 175, 55, 0.45)';
  for (let y = 16; y < 250; y += 28) {
    for (let x = 16; x < 250; x += 28) {
      ctx.beginPath(); ctx.arc(x, y, 2.2, 0, Math.PI * 2); ctx.fill();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const pcbTex = makePCBTexture();

// =============================================================================
// 3. THREE.JS SCENE, RENDERER, COMPOSER (BLOOM), LIGHTING
// =============================================================================
const container = document.getElementById('canvas-container');
const overlayLayer = document.getElementById('overlay-layer');

const scene = new THREE.Scene();
scene.background = makeStudioBackdropTexture();
scene.fog = new THREE.FogExp2(0x050a07, 0.015);

const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
camera.position.set(0, 4.8, 14.6);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(new THREE.Vector2(1024, 768), 0.34, 0.45, 0.72);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.065;
controls.maxPolarAngle = Math.PI * 0.495;
controls.minDistance = 2.0;
controls.maxDistance = 42;
controls.target.set(0, 2.25, 0);

const camGoal = {
  pos: new THREE.Vector3(0, 4.5, 14.6),
  target: new THREE.Vector3(0, 2.55, 0),
  basePos: new THREE.Vector3(0, 4.5, 14.6),
  baseTarget: new THREE.Vector3(0, 2.55, 0),
  holisticPos: null,
  holisticTarget: null,
  panRange: null, // [xStart, xEnd] for Phase A left->right pass
  panEnd: 0.64,   // fraction of chapter where Phase B holistic zoom-out begins
  active: false,
  sweep: 0,
};

controls.addEventListener('start', () => {
  camGoal.active = false;
  if (gpuZoom.active) {
    const srcR = rackEntries[gpuZoom.sourceRackIdx];
    if (srcR) srcR.root.visible = false;
    pkgStage.visible = (state.drill === 'package');
    cancelGpuZoom();
  }
  if (state.playing) pauseTour();
});

// Studio Lighting (Obsidian + NVIDIA-Green Rim + Rear Fill)
scene.add(new THREE.HemisphereLight(0xd2f0dc, 0x09150b, 0.72));

const keyLight = new THREE.DirectionalLight(0xf6fff8, 1.82);
keyLight.position.set(9, 15, 12);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.near = 2;
keyLight.shadow.camera.far = 46;
keyLight.shadow.camera.left = -15;
keyLight.shadow.camera.right = 15;
keyLight.shadow.camera.top = 12;
keyLight.shadow.camera.bottom = -5;
keyLight.shadow.bias = -0.0004;
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0x38bdf8, 0.58);
fillLight.position.set(-11, 7, 8);
scene.add(fillLight);

const backFill = new THREE.DirectionalLight(0xe4f7eb, 0.85);
backFill.position.set(-6, 7, -12);
scene.add(backFill);

const nvRim = new THREE.SpotLight(0x76b900, 18, 42, Math.PI / 2.4, 0.78, 1.35);
nvRim.position.set(0, 9.5, -10);
nvRim.target.position.set(0, 2.4, 0);
scene.add(nvRim, nvRim.target);

// Reflective studio floor + subtle NVIDIA-green radial halo + architectural grid
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(80, 52),
  new THREE.MeshStandardMaterial({ color: 0x070d09, roughness: 0.40, metalness: 0.48 })
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const grid = new THREE.GridHelper(38, 38, 0x2f5015, 0x111f15);
grid.position.y = 0.006;
grid.material.opacity = 0.52;
grid.material.transparent = true;
scene.add(grid);

const glowC = document.createElement('canvas');
glowC.width = 512; glowC.height = 512;
const gctx = glowC.getContext('2d');
const grad = gctx.createRadialGradient(256, 256, 10, 256, 256, 256);
grad.addColorStop(0, 'rgba(118,185,0,0.30)');
grad.addColorStop(0.5, 'rgba(118,185,0,0.09)');
grad.addColorStop(1, 'rgba(118,185,0,0)');
gctx.fillStyle = grad; gctx.fillRect(0, 0, 512, 512);
const floorGlow = new THREE.Mesh(
  new THREE.PlaneGeometry(28, 15),
  new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(glowC), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
);
floorGlow.rotation.x = -Math.PI / 2;
floorGlow.position.set(0, 0.012, -0.5);
scene.add(floorGlow);

// =============================================================================
// 4. RESPONSIVE HELPERS (Exact Horizontal FOV Fitting + Narrow Screen Detection)
// =============================================================================
function isNarrowViewport() {
  const w = container.clientWidth || window.innerWidth;
  const h = container.clientHeight || window.innerHeight;
  return (w / h) < 0.88 || w < 680;
}

function getRackSpacing() {
  return isNarrowViewport() ? 2.15 : 2.68;
}

function fitZForHalfWidth(halfWidth, minZ) {
  const aspect = Math.max(0.35, (container.clientWidth || 1) / (container.clientHeight || 1));
  const vfov = THREE.MathUtils.degToRad(camera.fov);
  const hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect);
  const needed = (halfWidth / Math.tan(hfov / 2)) * 1.14;
  return Math.max(minZ, Math.min(34, needed));
}

// =============================================================================
// 5. SHARED MATERIAL FACTORY
// =============================================================================
const MATS = {
  frameDark: () => new THREE.MeshStandardMaterial({ color: 0x16201c, roughness: 0.42, metalness: 0.78 }),
  chassisHopper: () => new THREE.MeshStandardMaterial({ color: 0x243038, roughness: 0.36, metalness: 0.74, transparent: true }),
  chassisTray: (hex) => new THREE.MeshStandardMaterial({ color: hex, roughness: 0.34, metalness: 0.74, transparent: true }),
  switchAmber: () => new THREE.MeshStandardMaterial({ color: 0xd97706, emissive: 0x78350f, emissiveIntensity: 0.55, roughness: 0.28, metalness: 0.68 }),
  powerShelf: () => new THREE.MeshStandardMaterial({ color: 0x1c2733, roughness: 0.5, metalness: 0.62 }),
  copper: () => new THREE.MeshStandardMaterial({ color: 0xe68b45, emissive: 0x6e2d08, emissiveIntensity: 0.65, roughness: 0.30, metalness: 0.70 }),
  manifoldCool: () => new THREE.MeshStandardMaterial({ color: 0x06b6d4, emissive: 0x0e7490, emissiveIntensity: 0.55, roughness: 0.22, metalness: 0.8 }),
  pcb: () => new THREE.MeshStandardMaterial({ map: pcbTex, roughness: 0.5, metalness: 0.28 }),
  siliconDie: (emHex) => new THREE.MeshStandardMaterial({ color: 0x18212b, emissive: emHex, emissiveIntensity: 0.48, roughness: 0.14, metalness: 0.92 }),
  hbmActive: (hex) => new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: 0.45, roughness: 0.2, metalness: 0.74 }),
  hbmDisabled: () => new THREE.MeshStandardMaterial({ color: 0x1e2529, roughness: 0.72, metalness: 0.3 }),
  cpuMetal: () => new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.26, metalness: 0.86 }),
};

// =============================================================================
// 6. BUILD 5 HARDWARE RACK TWINS + ANIMATED NVLINK ARCS
// =============================================================================
const RACK_W = 1.18;
const RACK_H = 4.20;
const RACK_D = 1.48;
const U_H = RACK_H / 48;

const rackEntries = [];
const clickableMeshes = [];

function buildRack(gen, idx) {
  const root = new THREE.Group();
  root.userData = { genIndex: idx };

  const plinth = new THREE.Mesh(
    new THREE.BoxGeometry(RACK_W + 0.18, 0.08, RACK_D + 0.18),
    new THREE.MeshStandardMaterial({ color: 0x0d1511, roughness: 0.45, metalness: 0.72 })
  );
  plinth.position.y = 0.04;
  plinth.receiveShadow = true;
  root.add(plinth);

  const trimGeo = new THREE.BoxGeometry(RACK_W + 0.22, 0.022, RACK_D + 0.22);
  const trim = new THREE.LineSegments(
    new THREE.EdgesGeometry(trimGeo),
    new THREE.LineBasicMaterial({ color: gen.accent, transparent: true, opacity: 0.85 })
  );
  trim.position.y = 0.082;
  root.add(trim);

  const postMat = MATS.frameDark();
  const postGeo = new THREE.BoxGeometry(0.055, RACK_H, 0.055);
  [
    [-RACK_W / 2 + 0.03, -RACK_D / 2 + 0.03],
    [ RACK_W / 2 - 0.03, -RACK_D / 2 + 0.03],
    [-RACK_W / 2 + 0.03,  RACK_D / 2 - 0.03],
    [ RACK_W / 2 - 0.03,  RACK_D / 2 - 0.03],
  ].forEach(([cx, cz]) => {
    const p = new THREE.Mesh(postGeo, postMat);
    p.position.set(cx, 0.08 + RACK_H / 2, cz);
    p.castShadow = true;
    root.add(p);
  });

  const topCap = new THREE.Mesh(new THREE.BoxGeometry(RACK_W, 0.05, RACK_D), postMat);
  topCap.position.y = 0.08 + RACK_H + 0.025;
  topCap.castShadow = true;
  root.add(topCap);

  const sideSkinMat = new THREE.MeshStandardMaterial({
    color: 0x0f1814, roughness: 0.5, metalness: 0.68, transparent: true, opacity: 0.86,
  });
  const leftSkin = new THREE.Mesh(new THREE.BoxGeometry(0.02, RACK_H - 0.06, RACK_D - 0.08), sideSkinMat);
  leftSkin.position.set(-RACK_W / 2 + 0.01, 0.08 + RACK_H / 2, 0);
  const rightSkin = leftSkin.clone();
  rightSkin.position.x = RACK_W / 2 - 0.01;
  root.add(leftSkin, rightSkin);

  const wireBox = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(RACK_W + 0.012, RACK_H + 0.012, RACK_D + 0.012)),
    new THREE.LineBasicMaterial({ color: gen.accent, transparent: true, opacity: 0.25 })
  );
  wireBox.position.y = 0.08 + RACK_H / 2;
  root.add(wireBox);

  const modules = [];
  const nvlinkPulses = [];
  const innerW = RACK_W - 0.14;
  const innerD = RACK_D - 0.14;
  let heroTrayRef = null;
  let heroGpuRef = null;

  if (!gen.isNVL72) {
    // Hopper 48U SuperPOD: 4x 8U Air-Cooled Servers stacked tightly (U4-U36),
    // airflow blanking panels (U37-U41, rack is ~45 kW power-limited!), and ToR IB Switches (U42-U47)
    for (let s = 0; s < 3; s++) {
      const swGroup = new THREE.Group();
      const swH = U_H * 1.35;
      const swBody = new THREE.Mesh(
        new THREE.BoxGeometry(innerW, swH, innerD * 0.78),
        new THREE.MeshStandardMaterial({ color: 0x1e2c38, roughness: 0.42, metalness: 0.68 })
      );
      swBody.castShadow = true;
      swGroup.add(swBody);
      // Glowing InfiniBand / Mgmt front port bar
      const portBar = new THREE.Mesh(
        new THREE.BoxGeometry(innerW * 0.86, 0.022, 0.02),
        new THREE.MeshBasicMaterial({ color: s === 0 ? 0x38bdf8 : 0x22d3ee })
      );
      portBar.position.set(0, 0, innerD * 0.39 + 0.01);
      swGroup.add(portBar);
      swGroup.position.set(0, 0.08 + (42.8 + s * 1.65) * U_H, 0.06);
      root.add(swGroup);
      modules.push({ mesh: swGroup, basePos: swGroup.position.clone(), explodeOffset: new THREE.Vector3(0, 0.26, 0), kind: 'infra' });
    }

    // Air-cooling blanking panels (U37-U41): prevent hot-aisle recirculation in ~45 kW power-capped racks
    const blankingMat = new THREE.MeshStandardMaterial({ color: 0x1e2a33, roughness: 0.55, metalness: 0.62, transparent: true, opacity: 0.88 });
    const bpGeo = new THREE.BoxGeometry(innerW, U_H * 0.84, 0.04);
    const bpEdgeGeo = new THREE.EdgesGeometry(bpGeo);
    const bpEdgeMat = new THREE.LineBasicMaterial({ color: 0x64748b, transparent: true, opacity: 0.65 });
    for (let b = 0; b < 5; b++) {
      const bpGroup = new THREE.Group();
      const bp = new THREE.Mesh(bpGeo, blankingMat);
      const bpEdge = new THREE.LineSegments(bpEdgeGeo, bpEdgeMat);
      bpGroup.add(bp, bpEdge);
      bpGroup.position.set(0, 0.08 + (36.8 + b * 1.0) * U_H, innerD / 2 - 0.02);
      root.add(bpGroup);
      modules.push({ mesh: bpGroup, basePos: bpGroup.position.clone(), explodeOffset: new THREE.Vector3(0, 0.16, 0), kind: 'blanking', bodyMat: blankingMat });
    }

    const nodeStartU = [3.5, 11.75, 20.0, 28.25];
    const bezelHex = gen.id === 'H100' ? 0xd4af37 : 0x38bdf8;
    const heatsinkMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8, roughness: 0.35, metalness: 0.80, transparent: true, opacity: 0.28, depthWrite: false,
    });
    const heatsinkEdgeMat = new THREE.LineBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.45 });
    const gpuDieMat = new THREE.MeshStandardMaterial({
      color: 0x76b900, emissive: 0x76b900, emissiveIntensity: 0.85, roughness: 0.22, metalness: 0.55,
    });
    const fanRimMat = new THREE.MeshStandardMaterial({ color: 0x364754, roughness: 0.40, metalness: 0.72 });
    const fanHubMat = new THREE.MeshStandardMaterial({ color: 0x162028, roughness: 0.52, metalness: 0.55 });
    const midDeckMat = new THREE.MeshStandardMaterial({
      color: 0x1d2932, roughness: 0.45, metalness: 0.68, transparent: true, opacity: 0.72,
    });
    const psuBayMat = new THREE.MeshStandardMaterial({ color: 0x2a3946, roughness: 0.38, metalness: 0.75 });
    const h8U = U_H * 7.85;
    const hsGeo = new THREE.BoxGeometry(0.15, h8U * 0.26, 0.165);
    const hsEdgesGeo = new THREE.EdgesGeometry(hsGeo);

    nodeStartU.forEach((uStart, nIdx) => {
      const nodeGroup = new THREE.Group();
      const h = h8U;
      const y = 0.08 + (uStart + 3.95) * U_H;

      const bodyGeo = new THREE.BoxGeometry(innerW, h, innerD);
      const bodyMat = MATS.chassisHopper();
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.castShadow = true; body.receiveShadow = true;
      nodeGroup.add(body);

      // Crisp metallic wireframe edge outline so ALL 4x 8U servers stay clearly visible in X-Ray mode
      const nodeWire = new THREE.LineSegments(
        new THREE.EdgesGeometry(bodyGeo),
        new THREE.LineBasicMaterial({ color: gen.accent, transparent: true, opacity: 0.45 })
      );
      nodeGroup.add(nodeWire);

      // Signature DGX gold (H100) / sky-blue (H200) front bezel trim
      const bezel = new THREE.Mesh(
        new THREE.BoxGeometry(innerW * 0.94, 0.036, 0.03),
        new THREE.MeshStandardMaterial({ color: bezelHex, emissive: bezelHex, emissiveIntensity: 0.28, metalness: 0.85, roughness: 0.25 })
      );
      bezel.position.set(0, h * 0.40, innerD / 2 + 0.012);
      nodeGroup.add(bezel);

      // Upper 3U front hot-swap NVMe / PSU bay array
      for (let p = 0; p < 6; p++) {
        const bay = new THREE.Mesh(new THREE.BoxGeometry(innerW * 0.135, h * 0.20, 0.04), psuBayMat);
        bay.position.set(-innerW * 0.385 + p * (innerW * 0.154), h * 0.23, innerD / 2 + 0.008);
        nodeGroup.add(bay);
      }

      // Lower 4U dual-rotor intake fan wall with visible brushed gunmetal rings
      for (let v = 0; v < 4; v++) {
        const fx = -innerW * 0.34 + v * (innerW * 0.226);
        const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.105, 0.024, 18), fanRimMat);
        rim.rotation.x = Math.PI / 2;
        rim.position.set(fx, -h * 0.15, innerD / 2 + 0.009);
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.072, 0.028, 16), fanHubMat);
        hub.rotation.x = Math.PI / 2;
        hub.position.set(fx, -h * 0.15, innerD / 2 + 0.011);
        nodeGroup.add(rim, hub);
      }

      // Rear-upper CPU/memory deck (leaves front/mid GPU bay open upward so all 8 GPUs are clearly visible!)
      const midDeck = new THREE.Mesh(new THREE.BoxGeometry(innerW * 0.90, 0.022, innerD * 0.42), midDeckMat);
      midDeck.position.set(0, h * 0.12, -innerD * 0.24);
      nodeGroup.add(midDeck);

      // Lower 4U HGX GPU baseboard + 8x unmistakable glowing NVIDIA-green SXM5 GPUs + ghosted air heatsink cages
      const board = new THREE.Mesh(new THREE.BoxGeometry(innerW * 0.88, 0.026, innerD * 0.82), MATS.pcb());
      board.position.set(0, -h * 0.38, -0.02);
      nodeGroup.add(board);

      for (let g = 0; g < 8; g++) {
        const row = Math.floor(g / 4);
        const col = g % 4;
        const gx = -0.31 + col * 0.205;
        const gz = -0.14 + row * 0.32;
        const gpuM = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.075, 0.175), gpuDieMat);
        gpuM.position.set(gx, -h * 0.31, gz);
        nodeGroup.add(gpuM);
        // Pick front-center glowing green GPU in the top 8U server (unobstructed from elevated 3/4 view!)
        if (nIdx === 3 && g === 5) heroGpuRef = gpuM;

        // Translucent wireframe air-cooling heatsink tower above each GPU (shows 8U air bulk without hiding GPUs!)
        const hs = new THREE.Mesh(hsGeo, heatsinkMat);
        hs.position.set(gx, -h * 0.12, gz);
        const hsEdge = new THREE.LineSegments(hsEdgesGeo, heatsinkEdgeMat);
        hsEdge.position.copy(hs.position);
        nodeGroup.add(hs, hsEdge);
      }

      // Upper-rear Dual Xeon CPUs (metallic silver, clearly distinct from glowing NVIDIA-green GPUs)
      for (let c = 0; c < 2; c++) {
        const cx = -0.20 + c * 0.40;
        const cpu = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.055, 0.22), MATS.cpuMetal());
        cpu.position.set(cx, h * 0.17, -innerD * 0.24);
        nodeGroup.add(cpu);
      }

      // Local 8-GPU NVLink 4 island pulse loop (moves with the server when exploded!)
      const ringCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.33, -h * 0.26, -0.16),
        new THREE.Vector3( 0.33, -h * 0.26, -0.16),
        new THREE.Vector3( 0.33, -h * 0.26,  0.20),
        new THREE.Vector3(-0.33, -h * 0.26,  0.20),
      ], true);
      const pulse = new THREE.Mesh(new THREE.SphereGeometry(0.034, 8, 8), new THREE.MeshBasicMaterial({ color: 0xf59e0b }));
      nodeGroup.add(pulse);
      nvlinkPulses.push({ curve: ringCurve, mesh: pulse, phase: nIdx * 0.25, speed: 0.55 });

      nodeGroup.position.set(0, y, 0);
      root.add(nodeGroup);
      // Uniform explode across all 4 identical 8U servers (hero tray only slides forward in Tray Drill-Down!)
      const explodeOff = new THREE.Vector3(0, (nIdx - 1.5) * 0.14, 0);
      modules.push({ mesh: nodeGroup, basePos: nodeGroup.position.clone(), explodeOffset: explodeOff, kind: 'compute', bodyMat });
      if (nIdx === 2) heroTrayRef = nodeGroup;
    });

    const pdu = new THREE.Mesh(new THREE.BoxGeometry(innerW, U_H * 2.8, innerD * 0.88), MATS.powerShelf());
    pdu.position.set(0, 0.08 + 1.65 * U_H, 0);
    root.add(pdu);
    modules.push({ mesh: pdu, basePos: pdu.position.clone(), explodeOffset: new THREE.Vector3(0, -0.12, 0), kind: 'infra' });
  } else {
    // NVL72 Liquid-Cooled Rack: 10 Upper + 9 Central NVLink Switches + 8 Lower 1U Trays
    const trayColor = gen.cableFree ? 0x18341d : (gen.id === 'B300' ? 0x132e3b : 0x182b37);
    const ledColor = gen.cableFree ? 0x76b900 : (gen.id === 'B300' ? 0x22d3ee : 0x38bdf8);

    const topPwr = new THREE.Mesh(new THREE.BoxGeometry(innerW, U_H * (gen.cableFree ? 5.4 : 4.2), innerD * 0.92), MATS.powerShelf());
    topPwr.position.set(0, 0.08 + 44.5 * U_H, 0);
    topPwr.castShadow = true;
    root.add(topPwr);
    modules.push({ mesh: topPwr, basePos: topPwr.position.clone(), explodeOffset: new THREE.Vector3(0, 0.48, 0), kind: 'infra' });

    const build1UComputeTray = (uIdx, bankSign, isHero) => {
      const g = new THREE.Group();
      const h = U_H * 0.84;
      const y = 0.08 + (uIdx + 0.5) * U_H;

      const bodyMat = MATS.chassisTray(trayColor);
      const chassis = new THREE.Mesh(new THREE.BoxGeometry(innerW, h, innerD * 0.92), bodyMat);
      chassis.castShadow = true;
      g.add(chassis);

      const led = new THREE.Mesh(new THREE.BoxGeometry(innerW * 0.88, 0.015, 0.018), new THREE.MeshBasicMaterial({ color: ledColor }));
      led.position.set(0, 0, innerD * 0.46 + 0.008);
      g.add(led);

      if (isHero) {
        const pcb = new THREE.Mesh(new THREE.BoxGeometry(innerW * 0.92, 0.014, innerD * 0.86), MATS.pcb());
        pcb.position.y = 0.018;
        g.add(pcb);

        for (let s = 0; s < 2; s++) {
          const sx = s === 0 ? -0.24 : 0.24;
          const cpu = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.036, 0.22), MATS.cpuMetal());
          cpu.position.set(sx, 0.042, -0.34);
          g.add(cpu);

          for (let k = 0; k < 2; k++) {
            const gpu = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, 0.22), MATS.siliconDie(gen.accent));
            gpu.position.set(sx + (k === 0 ? -0.105 : 0.105), 0.044, 0.08);
            g.add(gpu);
            if (isHero && s === 0 && k === 1) heroGpuRef = gpu;
          }
          const loop = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.014, 0.035), MATS.manifoldCool());
          loop.position.set(sx, 0.068, 0.08);
          g.add(loop);

          const nic = new THREE.Mesh(
            new THREE.BoxGeometry(0.14, 0.025, 0.16),
            new THREE.MeshStandardMaterial({ color: 0xa855f7, emissive: 0x581c87, emissiveIntensity: 0.45, metalness: 0.7, roughness: 0.3 })
          );
          nic.position.set(sx, 0.036, 0.44);
          g.add(nic);
        }
      }

      g.position.set(0, y, 0.03);
      root.add(g);
      const explodeOff = new THREE.Vector3(0, bankSign * 0.38, isHero ? 1.05 : 0.18);
      modules.push({ mesh: g, basePos: g.position.clone(), explodeOffset: explodeOff, kind: 'compute', bodyMat });
      if (isHero) heroTrayRef = g;
    };

    for (let i = 0; i < 10; i++) build1UComputeTray(31 + i, +1, i === 3);

    const swMat = MATS.switchAmber();
    for (let i = 0; i < 9; i++) {
      const sw = new THREE.Mesh(new THREE.BoxGeometry(innerW * 0.98, U_H * 0.84, innerD * 0.88), swMat);
      sw.position.set(0, 0.08 + (21 + i + 0.5) * U_H, 0.02);
      sw.castShadow = true;
      root.add(sw);
      modules.push({ mesh: sw, basePos: sw.position.clone(), explodeOffset: new THREE.Vector3(0, 0, -0.42), kind: 'nvlink' });
    }

    for (let i = 0; i < 8; i++) build1UComputeTray(12 + i, -1, false);

    const botPwr = new THREE.Mesh(new THREE.BoxGeometry(innerW, U_H * 6.5, innerD * 0.92), MATS.powerShelf());
    botPwr.position.set(0, 0.08 + 6.5 * U_H, 0);
    botPwr.castShadow = true;
    root.add(botPwr);
    modules.push({ mesh: botPwr, basePos: botPwr.position.clone(), explodeOffset: new THREE.Vector3(0, -0.46, 0), kind: 'infra' });

    const maniMat = MATS.manifoldCool();
    [-1, 1].forEach((side) => {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, RACK_H * 0.86, 12), maniMat);
      pipe.position.set(side * (RACK_W / 2 - 0.07), 0.08 + RACK_H * 0.5, -RACK_D / 2 + 0.14);
      root.add(pipe);
      modules.push({ mesh: pipe, basePos: pipe.position.clone(), explodeOffset: new THREE.Vector3(side * 0.34, 0, 0), kind: 'cooling' });
    });

    // Rear NVLink Spine: 4 sculpted illuminated vertical cartridge bus bars
    const spineMat = gen.cableFree
      ? new THREE.MeshStandardMaterial({ color: 0x76b900, emissive: 0x3b6000, emissiveIntensity: 0.80, roughness: 0.24, metalness: 0.72 })
      : MATS.copper();
    const spineGroup = new THREE.Group();
    for (let b = 0; b < 4; b++) {
      const bx = -0.27 + b * 0.18;
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.11, U_H * 29.5, 0.08), spineMat);
      bar.position.set(bx, 0, 0);
      spineGroup.add(bar);
    }
    spineGroup.position.set(0, 0.08 + 26 * U_H, -RACK_D / 2 - 0.03);
    root.add(spineGroup);
    modules.push({ mesh: spineGroup, basePos: spineGroup.position.clone(), explodeOffset: new THREE.Vector3(0, 0, -0.58), kind: 'nvlink' });

    // Animated 3D NVLink Signal Arcs connecting upper/lower compute trays into central 9 switch trays
    const arcColor = gen.cableFree ? 0xa8e03a : 0xf59e0b;
    const arcLineMat = new THREE.LineBasicMaterial({ color: arcColor, transparent: true, opacity: 0.68 });
    const arcTrays = [13, 16, 19, 32, 35, 39];
    arcTrays.forEach((uTray, aIdx) => {
      const yStart = 0.08 + (uTray + 0.5) * U_H;
      const yEnd = 0.08 + (22 + (aIdx % 6) * 1.3) * U_H;
      const sideSign = aIdx % 2 === 0 ? -1 : 1;
      const xEdge = sideSign * (RACK_W / 2 + 0.02);
      const xBulge = sideSign * (RACK_W / 2 + 0.20 + Math.abs(yStart - yEnd) * 0.10);
      const zRear = -RACK_D / 2 + 0.06;
      const curve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(xEdge, yStart, zRear),
        new THREE.Vector3(xBulge, (yStart + yEnd) / 2, zRear - 0.18),
        new THREE.Vector3(xEdge, yEnd, zRear)
      );
      root.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(20)), arcLineMat));
      const pulse = new THREE.Mesh(new THREE.SphereGeometry(0.044, 10, 10), new THREE.MeshBasicMaterial({ color: arcColor }));
      root.add(pulse);
      nvlinkPulses.push({ curve, mesh: pulse, phase: aIdx * 0.18, speed: gen.cableFree ? 1.25 : 0.85 });
    });
  }

  const hitbox = new THREE.Mesh(
    new THREE.BoxGeometry(RACK_W + 0.16, RACK_H + 0.2, RACK_D + 0.16),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hitbox.position.y = 0.08 + RACK_H / 2;
  hitbox.userData = { genIndex: idx };
  root.add(hitbox);
  clickableMeshes.push(hitbox);

  const tagEl = document.createElement('div');
  tagEl.className = 'rack-tag';
  const shortName = gen.id === 'Vera Rubin' ? 'Rubin' : gen.id;
  tagEl.innerHTML = `<div class="t-name"><span class="t-full">${gen.id}</span><span class="t-short">${shortName}</span></div><div class="t-sub">${gen.gpusPerRack} GPUs · ${gen.node}</div>`;
  tagEl.addEventListener('click', () => {
    if (state.playing) pauseTour();
    state.selectedGen = idx;
    if (state.mode === 'lineup') state.mode = 'focus';
    syncUIAndScene(true);
  });
  overlayLayer.appendChild(tagEl);

  scene.add(root);
  rackEntries.push({
    gen, idx, root, sideSkinMat, wireBox, modules, heroTrayRef, heroGpuRef, nvlinkPulses, tagEl,
    targetX: (idx - 2) * getRackSpacing(),
    targetZ: 0,
    targetScale: 1.0,
    targetRotY: 0,
  });
}

GENERATIONS.forEach((g, i) => buildRack(g, i));

// =============================================================================
// 7. EMBEDDED 3D COMPARATIVE BAR GRAPH WALL
// =============================================================================
const barWallGroup = new THREE.Group();
scene.add(barWallGroup);

const BAR_MAX_H = 5.4;
const BAR_Z_LINEUP = -0.35;
const BAR_PAIR_OFFSET = 0.40;

const wallGridGroup = new THREE.Group();
const gridLineMat = new THREE.LineBasicMaterial({ color: 0x2a4836, transparent: true, opacity: 0.55 });
for (let k = 1; k <= 4; k++) {
  const y = (k / 4) * BAR_MAX_H;
  const pts = [new THREE.Vector3(-7.0, y, BAR_Z_LINEUP - 0.65), new THREE.Vector3(7.0, y, BAR_Z_LINEUP - 0.65)];
  wallGridGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), gridLineMat));
}
barWallGroup.add(wallGridGroup);

const refPlaneMat = new THREE.MeshBasicMaterial({
  color: 0xfb7185, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false,
});
const refPlane = new THREE.Mesh(new THREE.PlaneGeometry(13.8, 1.45), refPlaneMat);
refPlane.rotation.x = -Math.PI / 2;
refPlane.position.set(0, 1.5, BAR_Z_LINEUP);
refPlane.visible = false;
barWallGroup.add(refPlane);

const refPlaneEdge = new THREE.Line(
  new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-6.9, 0, 0.725), new THREE.Vector3(6.9, 0, 0.725),
  ]),
  new THREE.LineBasicMaterial({ color: 0xfb7185, transparent: true, opacity: 0.88 })
);
refPlane.add(refPlaneEdge);

const refPlaneTag = document.createElement('div');
refPlaneTag.className = 'bar-val-tag center ref-plane-tag';
refPlaneTag.style.display = 'none';
overlayLayer.appendChild(refPlaneTag);
let activeRefLabelX = -4.2;

const barColumns = GENERATIONS.map((gen, idx) => {
  const g = new THREE.Group();
  const matA = new THREE.MeshStandardMaterial({ color: 0x76b900, emissive: 0x3b5c00, emissiveIntensity: 0.42, roughness: 0.24, metalness: 0.55, transparent: true, opacity: 0.95 });
  const matB = new THREE.MeshStandardMaterial({ color: 0xa8e03a, emissive: 0x557700, emissiveIntensity: 0.45, roughness: 0.24, metalness: 0.55, transparent: true, opacity: 0.95 });
  const matCap = new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xd97706, emissiveIntensity: 0.45, roughness: 0.22, metalness: 0.42, transparent: true, opacity: 0.44 });

  const geoUnit = new THREE.BoxGeometry(0.50, 1.0, 0.50);
  const barA = new THREE.Mesh(geoUnit, matA);
  const barB = new THREE.Mesh(geoUnit, matB);
  const barCap = new THREE.Mesh(new THREE.BoxGeometry(0.52, 1.0, 0.52), matCap);
  barA.castShadow = true; barB.castShadow = true;

  const topA = new THREE.Mesh(new THREE.BoxGeometry(0.51, 0.032, 0.51), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  const topB = new THREE.Mesh(new THREE.BoxGeometry(0.51, 0.032, 0.51), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  g.add(barA, barB, barCap, topA, topB);

  const lblA = document.createElement('div');
  lblA.className = 'bar-val-tag left';
  const lblB = document.createElement('div');
  lblB.className = 'bar-val-tag right';
  overlayLayer.appendChild(lblA);
  overlayLayer.appendChild(lblB);

  barWallGroup.add(g);
  return {
    idx, gen, g, barA, barB, barCap, matA, matB, matCap, topA, topB, lblA, lblB,
    targetX: (idx - 2) * getRackSpacing(),
    targetZ: BAR_Z_LINEUP,
    curHA: 0.01, tgtHA: 0.01,
    curHB: 0.01, tgtHB: 0.01,
    curHCap: 0.0, tgtHCap: 0.0,
    stacked: false,
  };
});

function getChartSpec() {
  const scopeLabel = tr('scopeRack');
  const c = state.chart;
  if (c === 'none') return { visible: false, scopeLabel, legend: [], ref: null, rows: [] };

  if (c === 'compute') {
    const maxV = state.precision === 'peak' ? 3600 : 2600;
    return {
      visible: true, scopeLabel, stacked: false,
      legend: [
        { color: '#38bdf8', text: tr('legRackFp8') },
        { color: '#76b900', text: tr('legRackFp4') },
        { color: '#f59e0b', text: tr('legFp4Cap') },
      ],
      ref: { norm: 1000 / maxV, color: 0xfacc15, text: tr('refEf'), labelX: -3.6 },
      rows: GENERATIONS.map(g => ({
        hA: g.rackFp8DensePF / maxV,
        lblA: `${g.rackFp8DensePF.toFixed(0)} PF`,
        colA: 0x38bdf8,
        hB: g.rackFp4DensePF ? g.rackFp4DensePF / maxV : 0,
        hCap: (g.rackFp4PeakPF && state.precision === 'peak') ? (g.rackFp4PeakPF - g.rackFp4DensePF) / maxV : 0,
        lblB: g.rackFp4DensePF
          ? `${((state.precision === 'peak' ? g.rackFp4PeakPF : g.rackFp4DensePF) >= 1000
              ? ((state.precision === 'peak' ? g.rackFp4PeakPF : g.rackFp4DensePF) / 1000).toFixed(2) + ' EF'
              : (state.precision === 'peak' ? g.rackFp4PeakPF : g.rackFp4DensePF) + ' PF')}`
          : '',
        colB: 0x76b900,
        primary: g.rackFp4DensePF ? 'B' : 'A',
      })),
    };
  }

  if (c === 'hbm') {
    return {
      visible: true, scopeLabel, stacked: false,
      legend: [
        { color: '#22d3ee', text: tr('legHbmCap') },
        { color: '#a8e03a', text: tr('legHbmBw') },
      ],
      ref: null,
      rows: GENERATIONS.map(g => ({
        hA: g.rackHbmTB / 22.0, lblA: `${g.rackHbmTB.toFixed(1)} TB`, colA: 0x22d3ee,
        hB: g.rackHbmBW / 1600, hCap: 0, lblB: `${g.rackHbmBW.toFixed(0)} TB/s`, colB: 0xa8e03a,
        primary: 'B',
      })),
    };
  }

  if (c === 'nvlink') {
    return {
      visible: true, scopeLabel, stacked: false,
      legend: [
        { color: '#f59e0b', text: tr('legNvlDom') },
        { color: '#a855f7', text: tr('legNic') },
      ],
      ref: null,
      rows: GENERATIONS.map(g => ({
        hA: g.nvlinkDomainBW / 265, lblA: `${g.nvlinkDomainBW} TB/s`, colA: 0xf59e0b,
        hB: g.nicGbps / 1650, hCap: 0, lblB: `${g.nicGbps}G`, colB: 0xa855f7,
        primary: 'A',
      })),
    };
  }

  if (c === 'power') {
    return {
      visible: true, scopeLabel, stacked: false,
      legend: [
        { color: '#fb7185', text: tr('legPwr') },
        { color: '#76b900', text: tr('legEff') },
      ],
      ref: { norm: 50 / 240, color: 0xfb7185, text: tr('refAir'), labelX: -1.15 },
      rows: GENERATIONS.map(g => ({
        hA: g.rackPowerKW / 240,
        lblA: `${g.rackPowerKW} kW${g.powerEst ? '*' : ''}`,
        colA: g.isNVL72 ? (g.cableFree ? 0x38bdf8 : 0x22d3ee) : 0xfb7185,
        hB: g.rackFp8PerKw / 5.7, hCap: 0,
        lblB: `${g.rackFp8PerKw} PF/kW`,
        colB: 0x76b900,
        primary: 'A',
      })),
    };
  }

  return {
    visible: true, scopeLabel: tr('scopePool'), stacked: true,
    legend: [
      { color: '#22d3ee', text: tr('legMemHbm') },
      { color: '#3b82f6', text: tr('legMemCpu') },
    ],
    ref: null,
    rows: GENERATIONS.map(g => ({
      hA: g.rackHbmTB / 76, lblA: '', colA: 0x22d3ee,
      hB: g.rackHostRamTB / 76, hCap: 0, lblB: `${g.totalFastMemTB.toFixed(1)} TB`, colB: 0x3b82f6,
    })),
  };
}

// =============================================================================
// 8. LEVEL-3 GPU SILICON PACKAGE STAGE + SEAMLESS RACK-GPU DIVE-ZOOM ENGINE
// =============================================================================
const PKG_HERO_POS = new THREE.Vector3(-0.75, 1.32, 0.55);
const pkgStage = new THREE.Group();
pkgStage.visible = false;
pkgStage.position.copy(PKG_HERO_POS);
scene.add(pkgStage);

// Neon-lime selection reticle highlighting the exact GPU square we zoom into on the rack/tray
const gpuFocusFrameMat = new THREE.LineBasicMaterial({ color: 0xd4ff66, transparent: true, opacity: 0.0 });
const gpuFocusFrame = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(0.22, 0.06, 0.26)),
  gpuFocusFrameMat
);
gpuFocusFrame.visible = false;
scene.add(gpuFocusFrame);

const gpuZoom = {
  active: false,
  t: 1,
  duration: 2.0,
  fromTour: false,
  sourceRackIdx: 0,
  fromTray: false,
  gpuWorld: new THREE.Vector3(0, 2.02, 0.15),
  camStartPos: new THREE.Vector3(),
  camStartTgt: new THREE.Vector3(),
  camDivePos: new THREE.Vector3(),
  camEndPos: new THREE.Vector3(),
  camEndTgt: new THREE.Vector3(),
};

let pkgFadeMats = [];
function setMatOpacityState(mat, opacity, transparent, depthWrite) {
  if (mat.transparent !== transparent) {
    mat.transparent = transparent;
    mat.needsUpdate = true;
  }
  mat.opacity = opacity;
  mat.depthWrite = depthWrite;
}

function setPkgFade(alpha) {
  const a = THREE.MathUtils.clamp(alpha, 0, 1);
  pkgFadeMats.forEach((mat) => {
    if (a >= 0.995) {
      setMatOpacityState(mat, mat.userData.baseOpacity, mat.userData.baseTransparent, mat.userData.baseDepthWrite);
    } else {
      setMatOpacityState(mat, mat.userData.baseOpacity * a, true, a > 0.78 ? mat.userData.baseDepthWrite : false);
    }
  });
}

let rackFadeSaved = [];
let rackFadeEntry = null;
function captureRackFadeMats(entry) {
  restoreRackFade();
  const seen = new Set();
  rackFadeEntry = entry;
  entry.root.traverse((obj) => {
    if (obj.material) {
      const list = Array.isArray(obj.material) ? obj.material : [obj.material];
      list.forEach((m) => {
        if (!seen.has(m)) {
          seen.add(m);
          rackFadeSaved.push({ mat: m, op: m.opacity, tr: m.transparent, dw: m.depthWrite });
        }
      });
    }
  });
}

function setRackFade(alpha) {
  const a = THREE.MathUtils.clamp(alpha, 0, 1);
  rackFadeSaved.forEach((s) => {
    if (a >= 0.995) {
      setMatOpacityState(s.mat, s.op, s.tr, s.dw);
    } else {
      setMatOpacityState(s.mat, s.op * a, true, a > 0.82 ? s.dw : false);
    }
  });
}

function restoreRackFade() {
  rackFadeSaved.forEach((s) => {
    setMatOpacityState(s.mat, s.op, s.tr, s.dw);
  });
  rackFadeSaved = [];
  if (rackFadeEntry) {
    rackFadeEntry.root.position.set(rackFadeEntry.targetX, 0, rackFadeEntry.targetZ);
    rackFadeEntry.root.scale.setScalar(rackFadeEntry.targetScale);
    rackFadeEntry = null;
  }
}

function cancelGpuZoom() {
  restoreRackFade();
  gpuZoom.active = false;
  gpuZoom.t = 1;
  gpuFocusFrame.visible = false;
  pkgStage.position.copy(PKG_HERO_POS);
  pkgStage.scale.setScalar(1.0);
  setPkgFade(1.0);
}

function triggerGpuZoomIn(sourceGenIdx, fromTray, fromTour, wasAlreadyOnSource = true) {
  const entry = rackEntries[sourceGenIdx];
  if (!entry) return;

  // Place source rack cleanly at center front so the dive targets its exact glowing GPU square
  rackEntries.forEach((r) => {
    const isSrc = r.idx === sourceGenIdx;
    r.root.visible = isSrc;
    r.tagEl.style.display = 'none';
    if (isSrc) {
      r.targetX = 0; r.targetZ = 0; r.targetScale = 1.0; r.targetRotY = 0;
      r.root.position.set(0, 0, 0);
      r.root.scale.setScalar(1.0);
      r.root.rotation.y = 0;
      const showXray = !r.gen.isNVL72 || fromTray;
      r.sideSkinMat.opacity = showXray ? 0.12 : 0.86;
      r.sideSkinMat.depthWrite = !showXray;
      r.modules.forEach((m) => {
        if (m.bodyMat) {
          const isHeroTrayBlade = fromTray && r.gen.isNVL72 && m.mesh === r.heroTrayRef;
          const op = isHeroTrayBlade ? 0.96 : (showXray ? (m.kind === 'blanking' ? 0.45 : 0.18) : 1.0);
          m.bodyMat.opacity = op;
          m.bodyMat.depthWrite = op >= 0.9;
        }
        if (fromTray && !wasAlreadyOnSource && m.mesh === r.heroTrayRef) {
          m.mesh.position.z = m.basePos.z + 1.62 + m.explodeOffset.z * 0.15;
        }
      });
    }
  });

  // Snapshot source rack/tray materials so we can dissolve its transparency smoothly while zooming inward!
  captureRackFadeMats(entry);

  // Read exact 3D world position of the target GPU square on the tray/rack!
  entry.root.updateMatrixWorld(true);
  if (entry.heroGpuRef) {
    entry.heroGpuRef.getWorldPosition(gpuZoom.gpuWorld);
  } else {
    const heroY = entry.heroTrayRef ? entry.heroTrayRef.position.y : (entry.gen.isNVL72 ? 3.00 : 2.23);
    gpuZoom.gpuWorld.set(-0.14, heroY + 0.04, fromTray ? 1.88 : 0.16);
  }

  if (wasAlreadyOnSource) {
    gpuZoom.camStartPos.copy(camera.position);
    gpuZoom.camStartTgt.copy(controls.target);
  } else {
    const narrow = isNarrowViewport();
    gpuZoom.camStartPos.set(narrow ? 3.0 : 3.5, 4.1, narrow ? 7.8 : 6.0);
    gpuZoom.camStartTgt.copy(gpuZoom.gpuWorld);
    camera.position.copy(gpuZoom.camStartPos);
    controls.target.copy(gpuZoom.camStartTgt);
  }

  // Clean hero close-up of the GPU card/tray (never clips into the PCB!)
  const diveDist = fromTray ? 1.55 : 1.75;
  const diveLift = fromTray ? 0.88 : 0.85;
  gpuZoom.camDivePos.set(
    gpuZoom.gpuWorld.x + (fromTray ? 0.32 : 0.45),
    gpuZoom.gpuWorld.y + diveLift,
    gpuZoom.gpuWorld.z + diveDist
  );
  gpuZoom.camEndPos.copy(camGoal.pos);
  gpuZoom.camEndTgt.copy(camGoal.target);

  gpuZoom.active = true;
  gpuZoom.t = 0;
  gpuZoom.fromTour = fromTour;
  gpuZoom.sourceRackIdx = sourceGenIdx;
  gpuZoom.fromTray = fromTray;

  // Highlight reticle snaps onto the GPU square
  gpuFocusFrame.position.copy(gpuZoom.gpuWorld);
  gpuFocusFrame.scale.setScalar(1.0);
  gpuFocusFrameMat.opacity = 0.95;
  gpuFocusFrame.visible = true;

  // Silicon package starts at hero stage with 0% opacity (100% transparent), ready to cross-dissolve smoothly!
  pkgStage.visible = false;
  pkgStage.position.copy(PKG_HERO_POS);
  pkgStage.scale.setScalar(0.92);
  setPkgFade(0.0);
  pkgParts.forEach((p) => { p.mesh.position.y = p.baseY; });
}

const pkgKeyLight = new THREE.PointLight(0xeafff2, 10, 14, 1.5);
pkgKeyLight.position.set(0.8, 3.2, 1.8);
pkgStage.add(pkgKeyLight);

const pkgPartsGroup = new THREE.Group();
pkgStage.add(pkgPartsGroup);

let pkgParts = [];

function rebuildPackageStage(gen) {
  while (pkgPartsGroup.children.length) pkgPartsGroup.remove(pkgPartsGroup.children[0]);
  pkgParts = [];

  const subW = gen.dies === 2 ? 3.2 : 2.3;
  const subD = 2.4;

  const substrate = new THREE.Mesh(new THREE.BoxGeometry(subW, 0.14, subD), MATS.pcb());
  substrate.castShadow = true; substrate.receiveShadow = true;
  pkgPartsGroup.add(substrate);

  const interposer = new THREE.Mesh(
    new THREE.BoxGeometry(subW * 0.88, 0.05, subD * 0.86),
    new THREE.MeshStandardMaterial({ color: 0x22303c, roughness: 0.44, metalness: 0.72 })
  );
  interposer.position.y = 0.095;
  pkgPartsGroup.add(interposer);
  pkgParts.push({ mesh: interposer, baseY: 0.095, explodeY: 0.36 });

  if (gen.dies === 1) {
    const die = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.11, 1.36), MATS.siliconDie(gen.accent));
    die.position.set(0, 0.175, 0);
    die.castShadow = true;
    pkgPartsGroup.add(die);
    pkgParts.push({ mesh: die, baseY: 0.175, explodeY: 0.90 });
  } else {
    [-0.56, 0.56].forEach((dx) => {
      const die = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.11, 1.36), MATS.siliconDie(gen.accent));
      die.position.set(dx, 0.175, 0);
      die.castShadow = true;
      pkgPartsGroup.add(die);
      pkgParts.push({ mesh: die, baseY: 0.175, explodeY: 0.90 });
    });
    const bridge = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.06, 1.18),
      new THREE.MeshStandardMaterial({ color: 0x76b900, emissive: 0x76b900, emissiveIntensity: 1.1, roughness: 0.2 })
    );
    bridge.position.set(0, 0.16, 0);
    pkgPartsGroup.add(bridge);
    pkgParts.push({ mesh: bridge, baseY: 0.16, explodeY: 0.68 });

    if (gen.id === 'Vera Rubin') {
      [-0.56, 0.56].forEach((dx) => {
        const io = new THREE.Mesh(
          new THREE.BoxGeometry(0.76, 0.075, 0.22),
          new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xd97706, emissiveIntensity: 0.7, metalness: 0.82, roughness: 0.22 })
        );
        io.position.set(dx, 0.16, 0.85);
        pkgPartsGroup.add(io);
        pkgParts.push({ mesh: io, baseY: 0.16, explodeY: 0.76 });
      });
    }
  }

  const perSide = gen.hbmSites / 2;
  const is12Hi = gen.hbmGen.includes('12-Hi');
  const isHBM4 = gen.hbmGen.includes('HBM4');
  const stackH = is12Hi ? 0.27 : 0.17;
  const stackColor = isHBM4 ? 0x22d3ee : (gen.hbmGen.includes('HBM3e') ? 0x38bdf8 : 0x0284c7);

  let placed = 0;
  for (const side of [-1, 1]) {
    for (let r = 0; r < perSide; r++) {
      const active = placed < gen.hbmStacks;
      placed++;
      const zSpan = 1.38;
      const zPos = -zSpan / 2 + (r + 0.5) * (zSpan / perSide);
      const xPos = side * (gen.dies === 2 ? 1.28 : 0.80);
      const hbm = new THREE.Mesh(
        new THREE.BoxGeometry(isHBM4 ? 0.36 : 0.31, stackH, (zSpan / perSide) * 0.76),
        active ? MATS.hbmActive(stackColor) : MATS.hbmDisabled()
      );
      hbm.position.set(xPos, 0.12 + stackH / 2, zPos);
      hbm.castShadow = true;
      pkgPartsGroup.add(hbm);
      pkgParts.push({ mesh: hbm, baseY: hbm.position.y, explodeY: 1.12 + (r % 2) * 0.12 });
    }
  }

  const lidGeo = new THREE.BoxGeometry(subW * 0.94, 0.08, subD * 0.9);
  const lid = new THREE.Mesh(
    lidGeo,
    new THREE.MeshStandardMaterial({
      color: gen.isNVL72 ? 0x0e7490 : 0x475569, roughness: 0.35, metalness: 0.78, transparent: true, opacity: 0.24,
    })
  );
  lid.add(new THREE.LineSegments(
    new THREE.EdgesGeometry(lidGeo),
    new THREE.LineBasicMaterial({ color: gen.isNVL72 ? 0x22d3ee : 0x94a3b8, transparent: true, opacity: 0.5 })
  ));
  lid.position.y = 0.52;
  pkgPartsGroup.add(lid);
  pkgParts.push({ mesh: lid, baseY: 0.52, explodeY: 1.85 });

  const cpuGroup = new THREE.Group();
  const cpuBoard = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.12, 1.85), MATS.pcb());
  const cpuLid = new THREE.Mesh(
    new THREE.BoxGeometry(1.05, 0.10, 1.30),
    new THREE.MeshStandardMaterial({
      color: gen.id === 'Vera Rubin' ? 0x4d7c0f : (gen.isNVL72 ? 0x3b4d61 : 0x526478),
      roughness: 0.25, metalness: 0.86,
    })
  );
  cpuLid.position.y = 0.11;
  cpuGroup.add(cpuBoard, cpuLid);
  cpuGroup.position.set(subW / 2 + 1.25, 0, 0);
  pkgPartsGroup.add(cpuGroup);

  const c2c = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.045, 0.65),
    new THREE.MeshBasicMaterial({ color: gen.isNVL72 ? 0xf59e0b : 0x64748b, transparent: true, opacity: 0.9 })
  );
  c2c.position.set(subW / 2 + 0.27, 0.06, 0);
  pkgPartsGroup.add(c2c);

  // Cache unique materials for smooth opacity ease-in during Rack/Tray GPU -> Silicon Die zoom
  const seen = new Set();
  pkgFadeMats = [];
  pkgPartsGroup.traverse((obj) => {
    if (obj.material) {
      const list = Array.isArray(obj.material) ? obj.material : [obj.material];
      list.forEach((m) => {
        if (!seen.has(m)) {
          seen.add(m);
          m.userData.baseOpacity = m.opacity;
          m.userData.baseTransparent = m.transparent;
          m.userData.baseDepthWrite = m.depthWrite;
          pkgFadeMats.push(m);
        }
      });
    }
  });
}

// =============================================================================
// 9. VIEW-AWARE 3D HARDWARE ANATOMY CALLOUT PINS
// =============================================================================
let activePins = [];

function rebuildAnatomyPins() {
  activePins.forEach(p => p.el.remove());
  activePins = [];

  if (!state.showPins || state.mode === 'lineup' || state.mode === 'compare') return;
  const gen = GENERATIONS[state.selectedGen];
  const zh = state.locale === 'zh';
  let defs = [];

  if (state.drill === 'rack') {
    if (!gen.isNVL72) {
      const serverDot = gen.id === 'H100' ? '#d4af37' : '#38bdf8';
      defs = [
        { pos: [0.0, 4.10, 0.55], color: '#38bdf8', side: 'front', attachToRack: true,
          text: zh ? '柜顶 InfiniBand 交换机（400G）' : 'ToR InfiniBand Leaf Switches (400G)' },
        { pos: [0.58, 3.55, 0.58], color: '#94a3b8', side: 'front', attachToRack: true,
          text: zh ? '风冷盲板区（受限于 ~45 kW 整柜风冷功耗）' : 'Airflow Blanking Panels (~45 kW Air Cap)' },
        { pos: [0.64, 2.68, 0.60], color: serverDot, side: 'front', attachToRack: true,
          text: zh ? '4× 8U 相同风冷服务器（共 32 颗 GPU）' : '4× Identical 8U Air-Cooled Servers (32 GPUs)' },
        { pos: [-0.62, 1.48, 0.52], color: '#76b900', side: 'front', attachToRack: true,
          text: zh ? '绿色芯片：每台 8× SXM5 GPU（NVLink 4）' : 'Green Dies: 8× SXM5 GPUs / Server (NVLink 4)' },
        { pos: [0.0, 2.35, -0.78], color: '#94a3b8', side: 'rear', attachToRack: true,
          text: zh ? '后部热通道排风与 ConnectX-7 上联（400G）' : 'Rear Hot-Aisle Exhaust & ConnectX-7 Uplinks (400G)' },
      ];
    } else {
      defs = [
        { pos: [0.64, 3.28, 0.62], color: gen.cableFree ? '#76b900' : '#38bdf8', side: 'front', attachToRack: true,
          text: zh ? '上层 10× 1U 液冷计算托盘（40 颗 GPU）' : '10× 1U Upper Compute Trays (40 GPUs)' },
        { pos: [-0.64, 2.30, 0.55], color: '#f59e0b', side: 'front', attachToRack: true,
          text: zh ? `中部 9× ${gen.nvlinkGen} 交换托盘` : `9× Central ${gen.nvlinkGen} Switch Trays` },
        { pos: [0.64, 1.42, 0.62], color: gen.cableFree ? '#76b900' : '#38bdf8', side: 'front', attachToRack: true,
          text: zh ? '下层 8× 1U 液冷计算托盘（32 颗 = 总计 72 颗）' : '8× 1U Lower Trays (32 GPUs = 72 Total)' },
        { pos: [0.0, 2.40, -1.05], color: gen.cableFree ? '#a8e03a' : '#f59e0b', side: 'rear', attachToRack: true,
          text: gen.cableFree
            ? (zh ? '无线缆盲插背板（260 TB/s NVLink 6）' : 'Cable-Free Cartridge Spine (260 TB/s NVLink 6)')
            : (zh ? '无源铜缆 NVLink 背板（130 TB/s NVLink 5）' : 'Passive Copper Backplane (130 TB/s NVLink 5)') },
        { pos: [0.70, 3.55, -0.78], color: '#22d3ee', side: 'rear', attachToRack: true,
          text: zh ? '垂直直接液冷（DLC）分液歧管' : 'Vertical Direct Liquid-Cooling Manifolds' },
        { pos: [-0.70, 1.45, -0.82], color: gen.cableFree ? '#a8e03a' : '#f59e0b', side: 'rear', attachToRack: true,
          text: gen.cableFree
            ? (zh ? '18 托盘无线缆直连中部 9 交换机' : 'Cable-Free Midplane: 18 Trays ↔ 9 Switches')
            : (zh ? '18 托盘直连中部 9 交换机高速铜互连' : 'Short-Reach Copper Fabric: 18 Trays ↔ 9 Switches') },
      ];
    }
  } else if (state.drill === 'tray') {
    const cpuLbl = zh ? gen.cpuName_zh : gen.cpuName;
    if (!gen.isNVL72) {
      defs = [
        { pos: [0.0, 2.12, 1.65], color: '#76b900', side: 'any', attachToRack: false,
          text: zh ? `下层 4U HGX 基板：8× ${gen.id} GPU + 巨型风冷散热塔` : `Lower 4U HGX: 8× ${gen.id} GPUs + Tall Air Heatsinks` },
        { pos: [0.0, 2.48, 1.30], color: '#94a3b8', side: 'any', attachToRack: false,
          text: zh ? `上层 3U：2× ${cpuLbl} 与热插拔电源/NVMe` : `Upper 3U: 2× ${cpuLbl} + Hot-Swap PSUs` },
        { pos: [0.55, 1.88, 2.08], color: '#fb7185', side: 'any', attachToRack: false,
          text: zh ? '8U 风冷机箱（单节点 ~10.2 kW）' : 'Air-Cooled 8U Chassis (~10.2 kW/Node)' },
      ];
    } else {
      defs = [
        { pos: [0.04, 3.32, 1.18], color: '#94a3b8', side: 'any', attachToRack: false,
          text: `2× ${cpuLbl}` },
        { pos: [0.08, 3.36, 1.66], color: '#22d3ee', side: 'any', attachToRack: false,
          text: zh ? '直接液冷冷板散热回路' : 'Direct-to-Chip Liquid Cold Plates' },
        { pos: [-0.06, 3.28, 2.02], color: '#76b900', side: 'any', attachToRack: false,
          text: zh ? `4× ${gen.gpuName} GPU（每 1U 含 2 组超级芯片）` : `4× ${gen.gpuName} GPUs (2 Superchips / 1U)` },
        { pos: [0.04, 3.22, 2.48], color: '#a855f7', side: 'any', attachToRack: false,
          text: zh ? `${gen.nic}（${gen.nicGbps}G / 卡）` : `${gen.nic} (${gen.nicGbps}G / GPU)` },
      ];
    }
  } else if (state.drill === 'package') {
    const subW = gen.dies === 2 ? 3.2 : 2.3;
    const px = -0.75;
    const cpuLbl = zh ? gen.cpuName_zh : gen.cpuName;
    const cpuShort = gen.id === 'Vera Rubin'
      ? (zh ? 'Vera 88核' : 'Vera 88C')
      : (gen.isNVL72 ? (zh ? 'Grace 72核' : 'Grace 72C') : (zh ? 'Xeon 56核' : 'Xeon 56C'));
    defs = [
      { pos: [px, 2.28 + state.explode * 0.5, 0.55], color: '#76b900', side: 'any', attachToRack: false,
        text: zh
          ? `${gen.dieLayout_zh} · ${gen.node}（${gen.transistorsB * 10} 亿晶体管）`
          : `${gen.dieLayout} · ${gen.node} (${gen.transistorsB}B)`,
        short: zh ? `${gen.node} · ${gen.transistorsB * 10}亿` : `${gen.node} · ${gen.transistorsB}B` },
      { pos: [px - (gen.dies === 2 ? 1.15 : 0.78), 1.98 + state.explode * 0.65, 0.55], color: '#22d3ee', side: 'any', attachToRack: false,
        text: `${gen.hbmStacks}/${gen.hbmSites} ${gen.hbmGen} (${gen.gpuHbmGB} GB · ${gen.gpuHbmBW} TB/s)`,
        short: `${gen.hbmStacks}× ${gen.hbmGen.split(' ')[0]} · ${gen.gpuHbmBW} TB/s` },
      { pos: [px + subW / 2 + 1.25, 1.75, 0.55], color: '#94a3b8', side: 'any', attachToRack: false,
        text: zh ? `直连主机 CPU：${cpuLbl}` : `Paired ${cpuLbl}`,
        short: cpuShort },
    ];
    if (gen.dies === 2) {
      defs.push({ pos: [px, 1.78 + state.explode * 0.4, 1.00], color: '#a8e03a', side: 'any', attachToRack: false,
        text: zh ? '10 TB/s NV-HBI 双芯高速互联桥' : '10 TB/s NV-HBI Dual-Die Bridge',
        short: 'NV-HBI 10 TB/s' });
    }
    if (gen.id === 'Vera Rubin') {
      defs.push({ pos: [px, 1.80 + state.explode * 0.45, 1.48], color: '#f59e0b', side: 'any', attachToRack: false,
        text: zh ? '独立 I/O 芯粒（NVLink 6）' : 'Dedicated I/O Chiplets (NVLink 6)',
        short: zh ? 'I/O 芯粒' : 'I/O Chiplets' });
    }
  }

  defs.forEach(d => {
    const el = document.createElement('div');
    el.className = 'callout-pin';
    const shortTxt = d.short || d.text;
    el.innerHTML = `<span class="callout-dot" style="background:${d.color};color:${d.color}"></span><span class="pin-full">${d.text}</span><span class="pin-short">${shortTxt}</span>`;
    overlayLayer.appendChild(el);
    activePins.push({
      el,
      anchor: new THREE.Vector3(...d.pos),
      side: d.side || 'any',
      attachToRack: !!d.attachToRack,
    });
  });
}

// =============================================================================
// 10. CAMERA PRESETS & SYNC UI / SCENE (Lifted Framing + Pan->Holistic Choreography)
// =============================================================================
function setCameraPreset(chapter = null) {
  const narrow = isNarrowViewport();
  if (chapter) {
    const c = chapter.cam(narrow);
    camGoal.basePos.set(...c.pos);
    camGoal.baseTarget.set(...c.target);

    if (chapter.panRange && chapter.holistic) {
      camGoal.panRange = chapter.panRange(narrow);
      camGoal.panEnd = chapter.panEnd || 0.64;
      const hol = chapter.holistic(narrow);
      const holZ = fitZForHalfWidth(hol.halfW, hol.minZ);
      camGoal.holisticPos = new THREE.Vector3(0, hol.posY, holZ);
      camGoal.holisticTarget = new THREE.Vector3(0, hol.targetY, camGoal.baseTarget.z);

      if (state.playing) {
        // Start Phase A on the left edge (H100 / HBM side) so we pan smoothly Left -> Right
        const x0 = camGoal.panRange[0];
        camGoal.pos.set(camGoal.basePos.x + x0, camGoal.basePos.y, camGoal.basePos.z);
        camGoal.target.set(camGoal.baseTarget.x + x0, camGoal.baseTarget.y, camGoal.baseTarget.z);
        document.body.classList.remove('holistic-compact');
      } else {
        // Paused/jumped directly to chapter: frame the holistic overview cleanly
        camGoal.pos.copy(camGoal.holisticPos);
        camGoal.target.copy(camGoal.holisticTarget);
        document.body.classList.toggle('holistic-compact', narrow);
      }
    } else {
      camGoal.panRange = null;
      camGoal.holisticPos = null;
      camGoal.holisticTarget = null;
      camGoal.pos.copy(camGoal.basePos);
      camGoal.target.copy(camGoal.baseTarget);
      document.body.classList.remove('holistic-compact');
    }
    camGoal.active = true;
    return;
  }

  const spacing = getRackSpacing();
  const hasBars = state.chart !== 'none' && state.drill === 'rack' && (state.mode === 'lineup' || state.mode === 'compare');
  camGoal.panRange = null;
  camGoal.holisticPos = null;
  camGoal.holisticTarget = null;
  camGoal.sweep = 0;

  // Shifted framing: generous breathing room below top header card & lifted cleanly off bottom edge
  if (state.drill === 'package') {
    const z = fitZForHalfWidth(2.85, 6.4);
    camGoal.pos.set(0.25, narrow ? 4.8 : 4.2, z);
    camGoal.target.set(0.15, narrow ? 2.15 : 1.98, 0.45);
    document.body.classList.toggle('holistic-compact', narrow);
  } else if (state.drill === 'tray') {
    const z = fitZForHalfWidth(1.35, narrow ? 4.95 : 4.45);
    camGoal.pos.set(narrow ? 0.65 : 0.95, narrow ? 6.55 : 6.20, z);
    camGoal.target.set(0.0, narrow ? 3.32 : 3.26, 1.75);
    document.body.classList.remove('holistic-compact');
  } else if (state.mode === 'compare') {
    const z = fitZForHalfWidth(3.0, 9.2);
    camGoal.pos.set(0, hasBars ? 4.7 : 4.0, z);
    camGoal.target.set(0, hasBars ? 2.95 : 2.5, 0);
    document.body.classList.remove('holistic-compact');
  } else if (state.mode === 'focus') {
    const z = fitZForHalfWidth(1.65, narrow ? 9.6 : 7.9);
    camGoal.pos.set(narrow ? 3.5 : 4.2, 4.4, z);
    camGoal.target.set(0, narrow ? 2.48 : 2.38, 0);
    document.body.classList.remove('holistic-compact');
  } else {
    const halfSpan = spacing * 2 + 1.05;
    const z = fitZForHalfWidth(halfSpan, hasBars ? 15.6 : 14.4);
    camGoal.pos.set(0, hasBars ? (narrow ? 5.8 : 5.0) : (narrow ? 5.2 : 4.5), z);
    camGoal.target.set(0, hasBars ? (narrow ? 3.35 : 3.10) : (narrow ? 2.85 : 2.55), 0);
    document.body.classList.toggle('holistic-compact', narrow);
  }

  camGoal.basePos.copy(camGoal.pos);
  camGoal.baseTarget.copy(camGoal.target);
  camGoal.active = true;
}

function syncUIAndScene(reframe = false, chapter = null) {
  const gen = GENERATIONS[state.selectedGen];
  const spacing = getRackSpacing();

  document.body.classList.toggle('mobile-capture', state.mobileSafe);
  document.getElementById('chk-mobile-safe').checked = state.mobileSafe;
  document.getElementById('cap-text').classList.toggle('hidden-cap', !state.showCaption);

  document.getElementById('compare-group').style.display = state.mode === 'compare' ? 'flex' : 'none';
  document.getElementById('gen-group').style.display = state.mode === 'compare' ? 'none' : 'flex';
  document.getElementById('gen-node-val').textContent = `${gen.node} · ${gen.release}`;

  document.querySelectorAll('#locale-btns .seg-btn').forEach(b => b.classList.toggle('active', b.dataset.locale === state.locale));
  document.querySelectorAll('#mode-btns .seg-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === state.mode));
  document.querySelectorAll('#gen-btns .seg-btn').forEach(b => b.classList.toggle('active', Number(b.dataset.gen) === state.selectedGen));
  document.querySelectorAll('#drill-btns .seg-btn').forEach(b => b.classList.toggle('active', b.dataset.drill === state.drill));
  document.querySelectorAll('#orient-btns .seg-btn').forEach(b => b.classList.toggle('active', (b.dataset.flip === '1') === state.rackFlipped));
  document.querySelectorAll('.chart-btn').forEach(b => b.classList.toggle('active', b.dataset.chart === state.chart));
  document.querySelectorAll('#prec-btns .seg-btn').forEach(b => b.classList.toggle('active', b.dataset.prec === state.precision));
  document.querySelectorAll('.ch-item').forEach((el, i) => el.classList.toggle('active', i === state.chapterIdx));

  document.getElementById('flip-group').style.display = (state.drill === 'rack') ? 'flex' : 'none';
  document.getElementById('orient-val').textContent = state.rackFlipped ? tr('oRear') : tr('oFront');

  document.getElementById('explode-slider').value = Math.round(state.explode * 100);
  document.getElementById('explode-val').textContent = `${Math.round(state.explode * 100)}%`;
  document.getElementById('chk-xray').checked = state.xray;
  document.getElementById('chk-pins').checked = state.showPins;
  document.getElementById('chk-bloom').checked = state.bloom;
  document.getElementById('chk-caption').checked = state.showCaption;
  document.getElementById('chk-orbit').checked = state.autoOrbit;

  const badgeEl = document.getElementById('stage-badge');
  const hdrTitle = document.getElementById('hdr-title');
  const capTextEl = document.getElementById('cap-text');
  const zh = state.locale === 'zh';

  if (!state.playing) {
    if (state.drill === 'package') {
      badgeEl.textContent = tr('badgeDie');
      hdrTitle.textContent = zh ? `${gen.id} — 爆炸芯片封装与直连 CPU` : `${gen.id} — Exploded Silicon Package & Paired CPU`;
      capTextEl.textContent = zh
        ? `${gen.dieLayout_zh} · ${gen.transistorsB * 10} 亿晶体管 · ${gen.hbmStacks}× ${gen.hbmGen}（${gen.gpuHbmGB} GB @ ${gen.gpuHbmBW} TB/s）`
        : `${gen.dieLayout} · ${gen.transistorsB}B · ${gen.hbmStacks}× ${gen.hbmGen} (${gen.gpuHbmGB} GB @ ${gen.gpuHbmBW} TB/s)`;
    } else if (state.drill === 'tray') {
      badgeEl.textContent = tr('badgeTray');
      hdrTitle.textContent = zh
        ? `${gen.id} — ${gen.trayU}U 计算${gen.isNVL72 ? '托盘' : '节点'}抽出透视`
        : `${gen.id} — ${gen.trayU}U Compute ${gen.isNVL72 ? 'Tray' : 'Node'} Pull-Out`;
      capTextEl.textContent = `${gen.gpusPerTray} ${tr('gpusUnit')} + 2× ${zh ? gen.cpuName_zh : gen.cpuName} · ${zh ? gen.cooling_zh : gen.cooling}`;
    } else if (state.mode === 'compare') {
      const gL = GENERATIONS[state.compareLeft], gR = GENERATIONS[state.compareRight];
      badgeEl.textContent = tr('badgeCompare');
      hdrTitle.textContent = zh ? `${gL.id} 对比 ${gR.id} — 机柜与 3D 指标对比` : `${gL.id} vs. ${gR.id} — Head-to-Head Rack & 3D Bars`;
      capTextEl.textContent = tr('hdrCompareSub')(zh ? gL.rackSystem_zh : gL.rackSystem, zh ? gR.rackSystem_zh : gR.rackSystem);
    } else if (state.mode === 'focus') {
      badgeEl.textContent = tr('badgeFocus');
      hdrTitle.textContent = `${zh ? gen.rackSystem_zh : gen.rackSystem} (${gen.release})`;
      capTextEl.textContent = zh
        ? `${gen.computeTrays}× ${gen.trayU}U 计算单元 + ${gen.switchTrays} 层 NVLink 交换托盘 · ${state.rackFlipped ? '背面 180°' : '正面 0°'}`
        : `${gen.computeTrays}× ${gen.trayU}U Compute + ${gen.switchTrays} NVLink Switch Trays · ${state.rackFlipped ? 'Rear 180°' : 'Front 0°'}`;
    } else {
      badgeEl.textContent = tr('badgeLineup');
      hdrTitle.textContent = tr('hdrLineupTitle');
      capTextEl.innerHTML = tr('capIntro');
    }
    document.getElementById('cap-chapter').textContent = tr('capExplore');
  }

  const fp4Text = gen.rackFp4DensePF
    ? (state.precision === 'peak'
        ? `${(gen.rackFp4PeakPF / 1000).toFixed(2)} EF ${tr('peakLbl')}`
        : `${(gen.rackFp4DensePF / 1000).toFixed(2)} EF ${tr('denseLbl')}`)
    : tr('naLbl');
  document.getElementById('spec-card').innerHTML = `
    <div class="sg-cell"><div class="k">${tr('specFp')}</div><div class="v" style="color:var(--nv-lime)">${gen.rackFp8DensePF.toFixed(0)} PF · ${fp4Text}</div></div>
    <div class="sg-cell"><div class="k">${tr('specHbm')}</div><div class="v" style="color:var(--cyan)">${gen.gpuHbmGB}GB · ${gen.rackHbmBW.toFixed(0)} TB/s</div></div>
    <div class="sg-cell"><div class="k">${tr('specNvl')}</div><div class="v" style="color:var(--amber)">${gen.nvlinkDomainBW} TB/s (${tr('nvlDomainUnit')(gen.nvlinkDomainGpus)})</div></div>
    <div class="sg-cell"><div class="k">${tr('specPwr')}</div><div class="v" style="color:var(--coral)">${gen.rackPowerKW}kW${gen.powerEst ? '*' : ''} · ${gen.rackFp8PerKw} PF/kW</div></div>
  `;

  const spec = getChartSpec();
  const showBars = spec.visible && state.drill === 'rack' && (state.mode === 'lineup' || state.mode === 'compare');
  const chartHeroMode = showBars;

  const inPackage = state.drill === 'package';
  if (!inPackage) cancelGpuZoom();
  pkgStage.visible = inPackage;
  if (inPackage) {
    pkgStage.position.copy(PKG_HERO_POS);
    pkgStage.scale.setScalar(1.0);
    rebuildPackageStage(gen);
  }

  const cmpX = isNarrowViewport() ? 1.45 : 1.85;
  rackEntries.forEach((entry) => {
    const i = entry.idx;
    let visible = !inPackage;
    let tx = (i - 2) * spacing;
    let tz = chartHeroMode ? 1.65 : 0.0;
    let tScale = chartHeroMode ? 0.23 : 1.0;
    let tRotY = (state.drill === 'rack' && state.rackFlipped) ? Math.PI : 0;

    if (!inPackage) {
      if (state.mode === 'focus' || state.drill === 'tray') {
        visible = (i === state.selectedGen);
        tx = 0; tz = 0; tScale = 1.0;
      } else if (state.mode === 'compare') {
        visible = (i === state.compareLeft || i === state.compareRight);
        tx = (i === state.compareLeft) ? -cmpX : cmpX;
      }
    }

    entry.root.visible = visible;
    entry.targetX = tx;
    entry.targetZ = tz;
    entry.targetScale = tScale;
    entry.targetRotY = tRotY;
    entry.tagEl.style.display = visible ? 'block' : 'none';
    entry.tagEl.classList.toggle('selected', i === state.selectedGen);
    entry.tagEl.querySelector('.t-sub').textContent = `${entry.gen.gpusPerRack} ${tr('gpusUnit')} · ${entry.gen.node}`;

    const xrayOn = state.xray || state.drill === 'tray';
    entry.sideSkinMat.opacity = xrayOn ? 0.12 : 0.86;
    entry.sideSkinMat.depthWrite = !xrayOn;
    entry.wireBox.material.opacity = xrayOn ? 0.72 : 0.25;
    entry.modules.forEach((m) => {
      if (m.bodyMat) {
        let op = 1.0;
        if (state.drill === 'tray') {
          if (m.mesh === entry.heroTrayRef) {
            // Hopper 8U box stays translucent so you can see the 8 GPUs inside; 1U NVL72 blade stays crisp
            op = entry.gen.isNVL72 ? 0.96 : 0.22;
          } else {
            op = 0.14;
          }
        } else if (state.xray) {
          // Uniform X-Ray across ALL servers/trays in Rack Anatomy (keep blanking panels slightly clearer)
          op = m.kind === 'blanking' ? 0.45 : 0.18;
        }
        m.bodyMat.opacity = op;
        m.bodyMat.depthWrite = op >= 0.9;
      }
    });
  });

  document.getElementById('bar-scope-val').textContent = spec.scopeLabel;
  document.getElementById('chart-legend').innerHTML = spec.legend.map(
    l => `<span class="leg-item"><i class="leg-swatch" style="background:${l.color}"></i>${l.text}</span>`
  ).join('');

  barWallGroup.visible = showBars;
  wallGridGroup.visible = showBars;

  if (spec.ref && showBars) {
    refPlane.visible = true;
    refPlane.position.y = spec.ref.norm * BAR_MAX_H;
    refPlaneMat.color.setHex(spec.ref.color);
    refPlaneEdge.material.color.setHex(spec.ref.color);
    refPlaneTag.style.display = 'block';
    refPlaneTag.textContent = spec.ref.text;
    refPlaneTag.style.color = '#' + new THREE.Color(spec.ref.color).getHexString();
    refPlaneTag.style.borderColor = '#' + new THREE.Color(spec.ref.color).getHexString();
    activeRefLabelX = spec.ref.labelX !== undefined ? spec.ref.labelX : -3.6;
  } else {
    refPlane.visible = false;
    refPlaneTag.style.display = 'none';
  }

  const barScaleX = isNarrowViewport() ? 0.82 : 1.0;
  barColumns.forEach((col, i) => {
    if (!showBars) {
      col.g.visible = false;
      col.lblA.style.display = 'none';
      col.lblB.style.display = 'none';
      return;
    }
    const vis = (state.mode === 'compare') ? (i === state.compareLeft || i === state.compareRight) : true;
    col.g.visible = vis;
    if (!vis) {
      col.lblA.style.display = 'none';
      col.lblB.style.display = 'none';
      return;
    }
    const row = spec.rows[i];
    col.stacked = !!spec.stacked;
    const hasBoth = !col.stacked && !!row.lblA && !!(row.lblB && row.hB > 0.001);
    const keepA = row.primary !== 'B';
    col.lblA.className = 'bar-val-tag left' + (hasBoth ? (keepA ? ' squeezy-keep' : ' squeezy-hide') : ' squeezy-keep');
    col.lblB.className = (col.stacked ? 'bar-val-tag center' : 'bar-val-tag right') + (hasBoth ? (keepA ? ' squeezy-hide' : ' squeezy-keep') : '');
    col.targetX = (state.mode === 'compare')
      ? (i === state.compareLeft ? -cmpX : cmpX)
      : (i - 2) * spacing;
    col.targetZ = BAR_Z_LINEUP;
    col.g.scale.set(barScaleX, 1.0, barScaleX);

    col.matA.color.setHex(row.colA);
    col.matA.emissive.setHex(row.colA);
    col.matA.emissiveIntensity = 0.40;
    col.matA.opacity = 0.95;

    col.matB.color.setHex(row.colB);
    col.matB.emissive.setHex(row.colB);
    col.matB.emissiveIntensity = 0.42;
    col.matB.opacity = 0.95;

    col.topA.material.color.setHex(row.colA);
    col.topB.material.color.setHex(row.colB);

    col.tgtHA = Math.max(0.001, row.hA * BAR_MAX_H);
    col.tgtHB = Math.max(0.001, row.hB * BAR_MAX_H);
    col.tgtHCap = row.hCap * BAR_MAX_H;

    col.lblA.textContent = row.lblA;
    col.lblA.style.color = '#' + new THREE.Color(row.colA).getHexString();
    col.lblA.style.display = row.lblA ? 'block' : 'none';

    col.lblB.textContent = row.lblB;
    col.lblB.style.color = '#' + new THREE.Color(row.colB).getHexString();
    col.lblB.style.display = (row.lblB && row.hB > 0.001) ? 'block' : 'none';
  });

  rebuildAnatomyPins();
  controls.autoRotate = state.autoOrbit && !state.playing;
  controls.autoRotateSpeed = 1.0;

  if (reframe) setCameraPreset(chapter);
}

// =============================================================================
// 11. GUIDED PLAY SCRIPT ENGINE & LOCALE SWITCHER
// =============================================================================
function renderChapterHeaderAndCaption() {
  const ch = STORY_CHAPTERS[state.chapterIdx];
  const zh = state.locale === 'zh';
  const badgeTxt = zh ? ch.badge_zh : ch.badge;
  const titleTxt = zh ? ch.title_zh : ch.title;
  const capTxt = zh ? ch.caption_zh : ch.caption;

  document.getElementById('stage-badge').textContent = badgeTxt;
  document.getElementById('hdr-title').textContent = titleTxt;
  document.getElementById('cap-chapter').textContent = tr('capChapterPrefix')(state.chapterIdx + 1, STORY_CHAPTERS.length, badgeTxt);
  document.getElementById('cap-text').innerHTML = capTxt;
}

function applyChapter(idx, keepPlaying = state.playing) {
  const prevDrill = state.drill;
  const prevMode = state.mode;
  const prevGen = state.selectedGen;

  state.chapterIdx = (idx + STORY_CHAPTERS.length) % STORY_CHAPTERS.length;
  state.chapterElapsed = 0;
  const ch = STORY_CHAPTERS[state.chapterIdx];

  cancelGpuZoom();
  state.mode = ch.mode;
  state.drill = ch.drill;
  state.selectedGen = ch.gen;
  state.chart = ch.chart;
  state.explode = ch.explode;
  state.xray = ch.xray;
  state.showPins = ch.pins;
  state.rackFlipped = false;

  state.playing = keepPlaying;
  renderChapterHeaderAndCaption();
  syncUIAndScene(true, ch);
  camGoal.sweep = ch.orbitSweep || 0;

  // Seamless zoom-in animation directly from the rack/tray GPU into the silicon package!
  if (ch.zoomFromRack && keepPlaying) {
    const srcGen = ch.zoomSourceGen !== undefined ? ch.zoomSourceGen : ch.gen;
    const wasOnSrc = (prevDrill === 'rack' || prevDrill === 'tray') && prevMode === 'focus' && prevGen === srcGen;
    triggerGpuZoomIn(srcGen, !!ch.zoomFromTray, true, wasOnSrc);
  }
  updatePlayButtons();
}

function updatePlayButtons() {
  const bTop = document.getElementById('btn-top-play');
  const bMain = document.getElementById('btn-play-main');
  const dot = document.getElementById('live-dot');
  if (state.playing) {
    bTop.textContent = tr('btnPauseTop');
    bTop.classList.add('playing'); bTop.classList.remove('primary');
    bMain.textContent = tr('btnPauseMain');
    bMain.classList.add('playing'); bMain.classList.remove('primary');
    dot.classList.add('rec');
    document.body.classList.add('recording-play');
  } else {
    bTop.textContent = tr('btnPlay');
    bTop.classList.remove('playing'); bTop.classList.add('primary');
    bMain.textContent = tr('btnPlay');
    bMain.classList.remove('playing'); bMain.classList.add('primary');
    dot.classList.remove('rec');
    document.body.classList.remove('recording-play');
  }
}

function startTour(fromBeginning = false) {
  state.playing = true;
  if (state.autoHideOnPlay) togglePanel(true);
  if (fromBeginning) applyChapter(0, true);
  else applyChapter(state.chapterIdx, true);
}

function pauseTour() {
  state.playing = false;
  camGoal.sweep = 0;
  camGoal.panRange = null;
  updatePlayButtons();
}

const chListEl = document.getElementById('chapter-list');
function rebuildChapterList() {
  chListEl.innerHTML = '';
  const zh = state.locale === 'zh';
  STORY_CHAPTERS.forEach((ch, i) => {
    const btn = document.createElement('button');
    btn.className = 'ch-item' + (i === state.chapterIdx ? ' active' : '');
    const label = (zh ? ch.title_zh : ch.title).replace(/^\d+\.\s*/, '');
    btn.innerHTML = `<span class="ch-num">${String(i + 1).padStart(2, '0')}</span><span>${label}</span>`;
    btn.addEventListener('click', () => applyChapter(i, state.playing));
    chListEl.appendChild(btn);
  });
}

function refreshCompareDropdowns() {
  const zh = state.locale === 'zh';
  const elL = document.getElementById('cmp-left');
  const elR = document.getElementById('cmp-right');
  [elL, elR].forEach((sel, idx) => {
    if (!sel) return;
    sel.innerHTML = '';
    GENERATIONS.forEach((g, i) => {
      sel.add(new Option(`${g.id} (${zh ? g.rackSystem_zh : g.rackSystem})`, i));
    });
    sel.value = idx === 0 ? state.compareLeft : state.compareRight;
  });
}

function applyLocale(lang, persist = true) {
  state.locale = lang;
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  document.title = tr('pageTitle');
  if (persist) persistLang(lang);
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const val = tr(key);
    if (typeof val === 'string') el.textContent = val;
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    const val = tr(key);
    if (typeof val === 'string') el.title = val;
  });
  refreshCompareDropdowns();
  rebuildChapterList();
  updatePlayButtons();
  syncUIAndScene(false);
  if (state.playing) renderChapterHeaderAndCaption();
}

// =============================================================================
// 12. CONTROLS, KEYBOARD SHORTCUTS & RAYCASTING
// =============================================================================
const cmpL = document.getElementById('cmp-left');
const cmpR = document.getElementById('cmp-right');
refreshCompareDropdowns();

const panelEl = document.getElementById('control-panel');
let panelAutoClosedForMobile = false;

function togglePanel(forceCollapse) {
  const collapsed = forceCollapse !== undefined ? forceCollapse : !panelEl.classList.contains('collapsed');
  panelEl.classList.toggle('collapsed', collapsed);
  panelAutoClosedForMobile = false;
  setTimeout(resizeRenderer, 280);
}

// Start with panel closed on phones/narrow screens so the 3D scene has full room immediately
if (window.innerWidth <= 860) {
  panelEl.classList.add('collapsed');
  panelAutoClosedForMobile = true;
}

document.getElementById('btn-top-play').addEventListener('click', () => state.playing ? pauseTour() : startTour(false));
document.getElementById('btn-play-main').addEventListener('click', () => state.playing ? pauseTour() : startTour(false));
document.getElementById('btn-prev-ch').addEventListener('click', () => applyChapter(state.chapterIdx - 1, state.playing));
document.getElementById('btn-next-ch').addEventListener('click', () => applyChapter(state.chapterIdx + 1, state.playing));
document.getElementById('btn-restart-ch').addEventListener('click', () => startTour(true));

document.querySelectorAll('#locale-btns .seg-btn').forEach(b => {
  b.addEventListener('click', () => applyLocale(b.dataset.locale, true));
});

document.querySelectorAll('#speed-btns .seg-btn').forEach(b => {
  b.addEventListener('click', () => {
    state.speed = Number(b.dataset.speed);
    document.getElementById('speed-val').textContent = `${state.speed.toFixed(2).replace(/0$/, '')}×`;
    document.querySelectorAll('#speed-btns .seg-btn').forEach(x => x.classList.toggle('active', x === b));
  });
});

document.getElementById('progress-track').addEventListener('click', (e) => {
  const rect = e.currentTarget.getBoundingClientRect();
  const frac = THREE.MathUtils.clamp((e.clientX - rect.left) / rect.width, 0, 0.999);
  applyChapter(Math.floor(frac * STORY_CHAPTERS.length), state.playing);
});

document.getElementById('chk-autohide').addEventListener('change', (e) => { state.autoHideOnPlay = e.target.checked; });

document.querySelectorAll('.chart-btn').forEach(b => {
  b.addEventListener('click', () => {
    if (state.playing) pauseTour();
    state.chart = b.dataset.chart;
    if (state.chart !== 'none' && (state.drill !== 'rack' || state.mode === 'focus')) {
      state.drill = 'rack';
      state.mode = 'lineup';
    }
    syncUIAndScene(true);
  });
});

document.querySelectorAll('#mode-btns .seg-btn').forEach(b => {
  b.addEventListener('click', () => {
    if (state.playing) pauseTour();
    state.mode = b.dataset.mode;
    if (state.mode !== 'focus') state.drill = 'rack';
    syncUIAndScene(true);
  });
});

document.querySelectorAll('#gen-btns .seg-btn').forEach(b => {
  b.addEventListener('click', () => {
    if (state.playing) pauseTour();
    state.selectedGen = Number(b.dataset.gen);
    syncUIAndScene(state.mode === 'focus' || state.drill !== 'rack');
  });
});

cmpL.addEventListener('change', () => { if (state.playing) pauseTour(); state.compareLeft = Number(cmpL.value); syncUIAndScene(true); });
cmpR.addEventListener('change', () => { if (state.playing) pauseTour(); state.compareRight = Number(cmpR.value); syncUIAndScene(true); });

document.querySelectorAll('#drill-btns .seg-btn').forEach(b => {
  b.addEventListener('click', () => {
    if (state.playing) pauseTour();
    const prevDrill = state.drill;
    const prevMode = state.mode;
    state.drill = b.dataset.drill;
    if (state.drill !== 'rack') state.mode = 'focus';
    if (state.drill === 'package' && state.explode < 0.25) state.explode = 0.4;
    syncUIAndScene(true);
    if (state.drill === 'package' && (prevDrill === 'rack' || prevDrill === 'tray')) {
      triggerGpuZoomIn(state.selectedGen, prevDrill === 'tray', false, prevMode === 'focus');
    }
  });
});

document.querySelectorAll('#orient-btns .seg-btn').forEach(b => {
  b.addEventListener('click', () => {
    if (state.playing) pauseTour();
    state.rackFlipped = (b.dataset.flip === '1');
    syncUIAndScene(false);
  });
});

document.getElementById('explode-slider').addEventListener('input', (e) => {
  state.explode = Number(e.target.value) / 100;
  document.getElementById('explode-val').textContent = `${e.target.value}%`;
  if (state.drill === 'package') rebuildAnatomyPins();
});

document.querySelectorAll('#prec-btns .seg-btn').forEach(b => {
  b.addEventListener('click', () => { state.precision = b.dataset.prec; syncUIAndScene(false); });
});

document.getElementById('chk-pins').addEventListener('change', (e) => { state.showPins = e.target.checked; syncUIAndScene(false); });
document.getElementById('chk-xray').addEventListener('change', (e) => { state.xray = e.target.checked; syncUIAndScene(false); });
document.getElementById('chk-bloom').addEventListener('change', (e) => { state.bloom = e.target.checked; bloomPass.enabled = state.bloom; });
document.getElementById('chk-caption').addEventListener('change', (e) => { state.showCaption = e.target.checked; syncUIAndScene(false); });
document.getElementById('chk-orbit').addEventListener('change', (e) => { state.autoOrbit = e.target.checked; syncUIAndScene(false); });
let mobileSafeManualOverride = false;
document.getElementById('chk-mobile-safe').addEventListener('change', (e) => {
  mobileSafeManualOverride = true;
  state.mobileSafe = e.target.checked;
  syncUIAndScene(true);
  setTimeout(resizeRenderer, 270);
});

document.getElementById('btn-reset-cam').addEventListener('click', () => setCameraPreset());
document.getElementById('btn-toggle-panel').addEventListener('click', () => togglePanel());
document.getElementById('btn-close-panel').addEventListener('click', () => togglePanel(true));
document.getElementById('btn-clean-capture').addEventListener('click', () => {
  document.body.classList.add('clean-capture');
  setTimeout(resizeRenderer, 270);
});
document.getElementById('restore-clean-btn').addEventListener('click', () => {
  document.body.classList.remove('clean-capture');
  setTimeout(resizeRenderer, 270);
});

// Keyboard shortcuts matching awesome-ai-visualizations conventions
window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  if (e.code === 'Space') { e.preventDefault(); state.playing ? pauseTour() : startTour(false); }
  else if (e.code === 'ArrowRight') { e.preventDefault(); applyChapter(state.chapterIdx + 1, state.playing); }
  else if (e.code === 'ArrowLeft') { e.preventDefault(); applyChapter(state.chapterIdx - 1, state.playing); }
  else if (e.key === 'r' || e.key === 'R') { startTour(true); }
  else if (e.key === 'h' || e.key === 'H') { togglePanel(); }
  else if (e.key === 'f' || e.key === 'F') {
    if (state.drill === 'rack') {
      if (state.playing) pauseTour();
      state.rackFlipped = !state.rackFlipped;
      syncUIAndScene(false);
    }
  }
});

// Click raycasting on 3D racks
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let downPos = { x: 0, y: 0 };
renderer.domElement.addEventListener('pointerdown', (e) => { downPos = { x: e.clientX, y: e.clientY }; });
renderer.domElement.addEventListener('pointerup', (e) => {
  if (Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y) > 6 || state.drill === 'package') return;
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(clickableMeshes.filter(m => m.parent.visible), false);
  if (hits.length > 0) {
    if (state.playing) pauseTour();
    state.selectedGen = hits[0].object.userData.genIndex;
    if (state.mode === 'lineup') state.mode = 'focus';
    syncUIAndScene(true);
  }
});

// =============================================================================
// 13. RESIZE OBSERVER (Retina HiDPI + Auto Reframe Across Desktop/Mobile)
// =============================================================================
let lastNarrow = isNarrowViewport();
function resizeRenderer() {
  const w = container.clientWidth || window.innerWidth;
  const h = container.clientHeight || window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(dpr);
  renderer.setSize(w, h, true);
  composer.setPixelRatio(dpr);
  composer.setSize(w, h);

  // If viewport crosses desktop <-> narrow mobile threshold, re-open auto-closed panel or reframe cleanly
  if (panelAutoClosedForMobile && window.innerWidth > 860 && !state.playing) {
    panelEl.classList.remove('collapsed');
    panelAutoClosedForMobile = false;
  }
  // Keep mobile status-bar safe-area synced when resizing across desktop <-> mobile unless manually toggled
  if (!mobileSafeManualOverride) {
    const isMob = window.innerWidth <= 860;
    if (state.mobileSafe !== isMob) {
      state.mobileSafe = isMob;
      document.body.classList.toggle('mobile-capture', isMob);
      document.getElementById('chk-mobile-safe').checked = isMob;
    }
  }
  const nowNarrow = isNarrowViewport();
  if (nowNarrow !== lastNarrow) {
    lastNarrow = nowNarrow;
    const ch = state.playing ? STORY_CHAPTERS[state.chapterIdx] : null;
    syncUIAndScene(true, ch);
  }
}
new ResizeObserver(resizeRenderer).observe(container);
window.addEventListener('resize', resizeRenderer);

// =============================================================================
// 14. MAIN ANIMATION LOOP
// =============================================================================
const clock = new THREE.Clock();
const projV = new THREE.Vector3();
const yAxis = new THREE.Vector3(0, 1, 0);
const tmpAnchor = new THREE.Vector3();
const tmpNormal = new THREE.Vector3();
const tmpToCam = new THREE.Vector3();
const tmpPanStartPos = new THREE.Vector3();
const tmpPanStartTgt = new THREE.Vector3();
const tmpSweepOff = new THREE.Vector3();

function projectToOverlay(worldPos, el, w, h) {
  projV.copy(worldPos).project(camera);
  if (projV.z < 1) {
    el.style.left = `${(projV.x * 0.5 + 0.5) * w}px`;
    el.style.top = `${(-projV.y * 0.5 + 0.5) * h}px`;
    el.style.opacity = '1';
  } else {
    el.style.opacity = '0';
  }
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.getElapsedTime();
  const w = container.clientWidth;
  const h = container.clientHeight;

  // Guided Play Script: Rack-GPU Dive-Zoom + Left->Right pan + Holistic Zoom-Out + 180-deg Front->Rear->Front flip
  let tourChFrac = 0;
  let tourCh = null;
  if (state.playing) {
    const ch = STORY_CHAPTERS[state.chapterIdx];
    tourCh = ch;
    state.chapterElapsed += dt * state.speed;
    const chFrac = Math.min(1, state.chapterElapsed / ch.duration);
    tourChFrac = chFrac;
    const totalPct = ((state.chapterIdx + chFrac) / STORY_CHAPTERS.length) * 100;
    document.getElementById('progress-fill').style.width = `${totalPct}%`;

    // Automatic 180-deg Front -> Rear (and optional unflip back to Front before GPU zoom/tray pull-out)
    if (ch.flipAt !== null && ch.flipAt !== undefined) {
      const shouldFlip = chFrac >= ch.flipAt && !(ch.unflipAt && chFrac >= ch.unflipAt);
      if (state.rackFlipped !== shouldFlip) {
        state.rackFlipped = shouldFlip;
        rackEntries.forEach(entry => {
          entry.targetRotY = (state.drill === 'rack' && state.rackFlipped) ? Math.PI : 0;
        });
        document.querySelectorAll('#orient-btns .seg-btn').forEach(b => b.classList.toggle('active', (b.dataset.flip === '1') === state.rackFlipped));
        document.getElementById('orient-val').textContent = state.rackFlipped ? tr('oRear') : tr('oFront');
      }
    }

    const zoomEnd = (ch.zoomFromRack && gpuZoom.active) ? (ch.zoomEnd || 0.22) : 0;
    if (ch.zoomFromRack && gpuZoom.active && chFrac < zoomEnd) {
      // Camera & cross-scale emergence are driven below by gpuZoom
      document.body.classList.remove('holistic-compact');
    } else if (camGoal.panRange && camGoal.holisticPos) {
      // Phase A (zoomEnd -> panEnd): Smooth one-by-one Left -> Right close-up pass
      // Phase B (panEnd -> 1): Smooth zoom-out to centered holistic full view (omitting squeezy text on narrow screens!)
      const panStart = ch.zoomFromRack ? (ch.zoomEnd || 0.22) : 0;
      const panEnd = camGoal.panEnd;
      if (chFrac < panEnd) {
        const panFrac = THREE.MathUtils.clamp((chFrac - panStart) / Math.max(0.05, panEnd - panStart), 0, 1);
        const u = THREE.MathUtils.smoothstep(panFrac, 0.04, 0.96);
        const panX = THREE.MathUtils.lerp(camGoal.panRange[0], camGoal.panRange[1], u);
        camGoal.pos.set(camGoal.basePos.x + panX, camGoal.basePos.y, camGoal.basePos.z);
        camGoal.target.set(camGoal.baseTarget.x + panX, camGoal.baseTarget.y, camGoal.baseTarget.z);
        document.body.classList.remove('holistic-compact');
      } else {
        const v = THREE.MathUtils.smoothstep((chFrac - panEnd) / (1 - panEnd), 0.0, 0.50);
        const endX = camGoal.panRange[1];
        tmpPanStartPos.set(camGoal.basePos.x + endX, camGoal.basePos.y, camGoal.basePos.z);
        tmpPanStartTgt.set(camGoal.baseTarget.x + endX, camGoal.baseTarget.y, camGoal.baseTarget.z);
        camGoal.pos.lerpVectors(tmpPanStartPos, camGoal.holisticPos, v);
        camGoal.target.lerpVectors(tmpPanStartTgt, camGoal.holisticTarget, v);
        if (isNarrowViewport() && v > 0.35) {
          document.body.classList.add('holistic-compact');
        }
      }
      camGoal.active = true;
    } else if (camGoal.sweep !== 0) {
      const angle = (chFrac - 0.5) * camGoal.sweep;
      tmpSweepOff.copy(camGoal.basePos).sub(camGoal.baseTarget).applyAxisAngle(yAxis, angle);
      camGoal.pos.copy(camGoal.baseTarget).add(tmpSweepOff);
      camGoal.target.copy(camGoal.baseTarget);
      camGoal.active = true;
    }

    if (state.chapterElapsed >= ch.duration) {
      if (state.chapterIdx < STORY_CHAPTERS.length - 1) {
        applyChapter(state.chapterIdx + 1, true);
        tourCh = STORY_CHAPTERS[state.chapterIdx];
        tourChFrac = 0;
      } else {
        pauseTour();
        document.getElementById('progress-fill').style.width = '100%';
      }
    }
  }

  // Clean 2-Step Overlapping Cross-Dissolve:
  //   Step 1 (0 -> 0.42): Smoothly zoom camera in toward the glowing GPU card on the rack/tray
  //   Step 2 (0.32 -> 0.88): Rack opacity smoothly fades 100% -> 0% while GPU Silicon Anatomy fades 0% -> 100%
  //   (True alpha overlap between the dissolving rack/tray and emerging GPU silicon package!)
  let zoomAlpha = 1.0;
  let zoomExplodeScale = 1.0;
  if (gpuZoom.active) {
    if (gpuZoom.fromTour && state.playing) {
      const liveCh = STORY_CHAPTERS[state.chapterIdx];
      const liveFrac = Math.min(1, state.chapterElapsed / liveCh.duration);
      gpuZoom.t = THREE.MathUtils.clamp(liveFrac / (liveCh.zoomEnd || 0.30), 0, 1);
    } else {
      gpuZoom.t = Math.min(1, gpuZoom.t + dt / gpuZoom.duration);
    }
    const u = gpuZoom.t;
    zoomAlpha = THREE.MathUtils.smoothstep(u, 0.78, 1.0);
    zoomExplodeScale = THREE.MathUtils.smoothstep(u, 0.48, 0.98);

    // Camera zooms into the card (0 -> 0.42), then glides gently into silicon showcase framing (0.42 -> 1.0)
    if (u < 0.42) {
      const dA = THREE.MathUtils.smoothstep(u, 0.0, 0.42);
      camGoal.pos.lerpVectors(gpuZoom.camStartPos, gpuZoom.camDivePos, dA);
      camGoal.target.lerpVectors(gpuZoom.camStartTgt, gpuZoom.gpuWorld, dA);
    } else {
      const dB = THREE.MathUtils.smoothstep(u, 0.42, 1.0);
      camGoal.pos.lerpVectors(gpuZoom.camDivePos, gpuZoom.camEndPos, dB);
      camGoal.target.lerpVectors(gpuZoom.gpuWorld, gpuZoom.camEndTgt, dB);
    }
    camGoal.active = true;

    // Subtle neon-lime reticle highlights the GPU card during Step 1, then fades out cleanly with the rack
    if (u < 0.58) {
      gpuFocusFrame.visible = true;
      gpuFocusFrame.position.copy(gpuZoom.gpuWorld);
      const pulse = 1.0 + Math.sin(u * Math.PI * 5) * 0.05;
      gpuFocusFrame.scale.setScalar(pulse);
      gpuFocusFrameMat.opacity = 0.92 * (1.0 - THREE.MathUtils.smoothstep(u, 0.32, 0.58));
    } else {
      gpuFocusFrame.visible = false;
    }

    // Rack/tray stays rock-solid (no wild scaling!) and gradually increases transparency from 0% -> 100%
    const srcEntry = rackEntries[gpuZoom.sourceRackIdx];
    if (srcEntry) {
      if (u < 0.82) {
        const rackOpacity = 1.0 - THREE.MathUtils.smoothstep(u, 0.32, 0.80);
        srcEntry.root.visible = true;
        srcEntry.root.scale.setScalar(1.0);
        srcEntry.root.position.set(0, 0, 0);
        setRackFade(rackOpacity);
      } else {
        srcEntry.root.visible = false;
        restoreRackFade();
      }
    }

    // GPU Silicon Anatomy overlaps smoothly, reducing transparency from 100% -> 0% (opacity 0 -> 1)
    if (u > 0.34) {
      const gpuOpacity = THREE.MathUtils.smoothstep(u, 0.34, 0.86);
      const settleS = THREE.MathUtils.lerp(0.92, 1.0, THREE.MathUtils.smoothstep(u, 0.34, 0.92));
      pkgStage.visible = true;
      pkgStage.position.copy(PKG_HERO_POS);
      pkgStage.scale.setScalar(settleS);
      setPkgFade(gpuOpacity);
    } else {
      pkgStage.visible = false;
      setPkgFade(0.0);
    }

    if (u >= 1) {
      if (srcEntry) {
        srcEntry.root.visible = false;
        srcEntry.targetZ = 0;
        srcEntry.targetScale = 1.0;
      }
      cancelGpuZoom();
      pkgStage.visible = (state.drill === 'package');
    }
  }

  if (camGoal.active) {
    const camRate = gpuZoom.active ? 9.5 : 3.8;
    const lerpF = 1 - Math.exp(-camRate * dt);
    camera.position.lerp(camGoal.pos, lerpF);
    controls.target.lerp(camGoal.target, lerpF);
    if (!state.playing && !gpuZoom.active && camera.position.distanceTo(camGoal.pos) < 0.025) camGoal.active = false;
  }

  // Animate 5 Racks
  rackEntries.forEach((entry) => {
    if (!entry.root.visible) return;
    const isZoomSource = gpuZoom.active && entry.idx === gpuZoom.sourceRackIdx;
    const rLerp = 1 - Math.exp(-6.0 * dt);
    const rotLerp = 1 - Math.exp(-4.2 * dt);
    let curS = entry.root.scale.x;
    if (!isZoomSource) {
      entry.root.position.x = THREE.MathUtils.lerp(entry.root.position.x, entry.targetX, rLerp);
      entry.root.position.y = THREE.MathUtils.lerp(entry.root.position.y, 0, rLerp);
      entry.root.position.z = THREE.MathUtils.lerp(entry.root.position.z, entry.targetZ, rLerp);
      entry.root.rotation.y = THREE.MathUtils.lerp(entry.root.rotation.y, entry.targetRotY, rotLerp);
      curS = THREE.MathUtils.lerp(entry.root.scale.x, entry.targetScale, rLerp);
      entry.root.scale.setScalar(curS);
    }

    if (!isZoomSource) {
      entry.modules.forEach((m) => {
        const chPullTray = state.playing && tourCh && tourCh.pullTrayAt && tourChFrac >= tourCh.pullTrayAt;
        const isTrayHero = ((state.drill === 'tray' || chPullTray) && m.mesh === entry.heroTrayRef);
        const pullZ = isTrayHero ? 1.62 : 0;
        const exp = state.explode;
        m.mesh.position.x = THREE.MathUtils.lerp(m.mesh.position.x, m.basePos.x + m.explodeOffset.x * exp, 1 - Math.exp(-7 * dt));
        m.mesh.position.y = THREE.MathUtils.lerp(m.mesh.position.y, m.basePos.y + m.explodeOffset.y * exp, 1 - Math.exp(-7 * dt));
        m.mesh.position.z = THREE.MathUtils.lerp(m.mesh.position.z, m.basePos.z + m.explodeOffset.z * exp + pullZ, 1 - Math.exp(-7 * dt));
      });
    }

    entry.nvlinkPulses.forEach((p) => {
      const u = (t * p.speed + p.phase) % 1.0;
      p.curve.getPointAt(u, p.mesh.position);
    });

    projectToOverlay(new THREE.Vector3(entry.root.position.x, 0.04, entry.root.position.z + RACK_D * 0.64 * curS + 0.36), entry.tagEl, w, h);
  });

  // Animate Embedded 3D Bar Chart Wall
  if (barWallGroup.visible) {
    const barLerp = 1 - Math.exp(-6.2 * dt);
    barColumns.forEach((col) => {
      if (!col.g.visible) return;
      col.g.position.x = THREE.MathUtils.lerp(col.g.position.x, col.targetX, barLerp);
      col.g.position.z = THREE.MathUtils.lerp(col.g.position.z, col.targetZ, barLerp);

      col.curHA = THREE.MathUtils.lerp(col.curHA, col.tgtHA, barLerp);
      col.curHB = THREE.MathUtils.lerp(col.curHB, col.tgtHB, barLerp);
      col.curHCap = THREE.MathUtils.lerp(col.curHCap, col.tgtHCap, barLerp);

      if (col.stacked) {
        col.barA.position.set(0, col.curHA / 2, 0);
        col.barA.scale.set(1.45, col.curHA, 1.45);
        col.topA.visible = false;

        col.barB.position.set(0, col.curHA + col.curHB / 2, 0);
        col.barB.scale.set(1.45, col.curHB, 1.45);
        col.topB.visible = true;
        col.topB.position.set(0, col.curHA + col.curHB + 0.016, 0);
        col.topB.scale.set(1.45, 1, 1.45);
        col.barCap.visible = false;

        if (col.lblB.style.display !== 'none') {
          projectToOverlay(new THREE.Vector3(col.g.position.x, col.curHA + col.curHB + 0.16, col.g.position.z), col.lblB, w, h);
        }
      } else {
        col.barA.position.set(-BAR_PAIR_OFFSET, col.curHA / 2, 0);
        col.barA.scale.set(1, col.curHA, 1);
        col.topA.visible = col.curHA > 0.04;
        col.topA.position.set(-BAR_PAIR_OFFSET, col.curHA + 0.016, 0);
        col.topA.scale.set(1, 1, 1);

        const hasB = col.curHB > 0.03;
        col.barB.visible = hasB;
        col.barB.position.set(BAR_PAIR_OFFSET, col.curHB / 2, 0);
        col.barB.scale.set(1, col.curHB, 1);
        col.topB.visible = hasB;
        col.topB.position.set(BAR_PAIR_OFFSET, col.curHB + 0.016, 0);
        col.topB.scale.set(1, 1, 1);

        const hasCap = col.curHCap > 0.03;
        col.barCap.visible = hasCap;
        if (hasCap) {
          col.barCap.position.set(BAR_PAIR_OFFSET, col.curHB + col.curHCap / 2, 0);
          col.barCap.scale.set(1, col.curHCap, 1);
        }

        const sx = col.g.scale.x;
        if (col.lblA.style.display !== 'none') {
          projectToOverlay(new THREE.Vector3(col.g.position.x - BAR_PAIR_OFFSET * sx, col.curHA + 0.14, col.g.position.z), col.lblA, w, h);
        }
        if (col.lblB.style.display !== 'none') {
          const topY = col.curHB + (hasCap ? col.curHCap : 0);
          projectToOverlay(new THREE.Vector3(col.g.position.x + BAR_PAIR_OFFSET * sx, topY + 0.14, col.g.position.z), col.lblB, w, h);
        }
      }
    });

    if (refPlane.visible) {
      projectToOverlay(new THREE.Vector3(activeRefLabelX, refPlane.position.y + 0.16, BAR_Z_LINEUP + 0.72), refPlaneTag, w, h);
    }
  }

  // Animate Level-3 Package Stage Explode (starts compact during Rack-GPU dive and unfolds in mid-air!)
  if (pkgStage.visible) {
    const effExp = state.explode * zoomExplodeScale;
    pkgStage.rotation.y = Math.sin(t * 0.35) * 0.12 * zoomExplodeScale;
    pkgParts.forEach((p) => {
      p.mesh.position.y = THREE.MathUtils.lerp(p.mesh.position.y, THREE.MathUtils.lerp(p.baseY, p.explodeY, effExp), 1 - Math.exp(-7 * dt));
    });
  }

  // View-Aware 3D Anatomy Callout Pins (Normal-Vector Culling on 180-deg Spins & Fade-In after GPU Dive-Zoom)
  const activeRack = rackEntries[state.selectedGen];
  activePins.forEach((p) => {
    tmpAnchor.copy(p.anchor);
    let visAlpha = state.drill === 'package' ? zoomAlpha : 1.0;

    if (p.attachToRack && activeRack && activeRack.root.visible) {
      const rotY = activeRack.root.rotation.y;
      tmpAnchor.multiplyScalar(activeRack.root.scale.x);
      tmpAnchor.applyAxisAngle(yAxis, rotY);
      tmpAnchor.add(activeRack.root.position);

      if (p.side === 'front' || p.side === 'rear') {
        tmpNormal.set(0, 0, p.side === 'front' ? 1 : -1).applyAxisAngle(yAxis, rotY).normalize();
        tmpToCam.copy(camera.position).sub(tmpAnchor).normalize();
        visAlpha = THREE.MathUtils.clamp((tmpNormal.dot(tmpToCam) - 0.14) / 0.28, 0, 1);
      }
    }

    projV.copy(tmpAnchor).project(camera);
    if (projV.z < 1 && visAlpha > 0.02) {
      let sx = (projV.x * 0.5 + 0.5) * w;
      const sy = (-projV.y * 0.5 + 0.5) * h;
      // Clamp in-frustum callout pills safely inside left/right viewport margins so labels are never cut off
      if (projV.x > -1.08 && projV.x < 1.08) {
        const halfPill = (p.el.offsetWidth || 120) * 0.5 + 8;
        if (halfPill * 2 < w) {
          sx = THREE.MathUtils.clamp(sx, halfPill, w - halfPill);
        }
      } else {
        visAlpha *= 1.0 - THREE.MathUtils.smoothstep(Math.abs(projV.x), 1.08, 1.30);
      }
      p.el.style.left = `${sx}px`;
      p.el.style.top = `${sy}px`;
      p.el.style.opacity = visAlpha.toFixed(3);
      p.el.style.visibility = visAlpha > 0.02 ? 'visible' : 'hidden';
    } else {
      p.el.style.opacity = '0';
      p.el.style.visibility = 'hidden';
    }
  });

  controls.update();
  if (state.bloom) composer.render();
  else renderer.render(scene, camera);
}

// =============================================================================
// 15. BOOT & URL DEEP-LINK (?ch=1..12, ?lang=zh)
// =============================================================================
resizeRenderer();
applyLocale(state.locale, false);

const startParams = new URLSearchParams(window.location.search);
const chParam = Number(startParams.get('ch'));
if (Number.isInteger(chParam) && chParam >= 1 && chParam <= STORY_CHAPTERS.length) {
  applyChapter(chParam - 1, false);
} else {
  syncUIAndScene(true);
}

animate();
