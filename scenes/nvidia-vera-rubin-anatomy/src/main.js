import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { PARTS, TOUR_CHAPTERS } from './data.js';
import { I18N, detectInitialLang, persistLang } from './i18n.js';
import { createProceduralTextures } from './textures.js';

// =============================================================================
// 1. APPLICATION STATE
// =============================================================================
const state = {
  locale: detectInitialLang(),
  tier: 'rack',            // 'rack' | 'compute_tray' | 'switch_tray' | 'silicon'
  rackFlipped: false,
  isolateBlade: false,
  isolatePart: false,
  selectedPart: null,
  explodeMode: 'left',     // 'left' (GPU A exploded vs Twin B assembled) | 'both'
  explode: 0.0,
  nvlinkFlow: true,
  thermalFlow: false,
  xray: false,
  showPins: true,
  bloom: true,
  showHeaderCard: true,
  showCaption: true,
  autoOrbit: false,
  mobileSafe: window.innerWidth <= 860,
  playing: false,
  chapterIdx: 0,
  chapterElapsed: 0,
  speed: 1.0,
  autoHideOnPlay: true,
};

const tr = (k) => (I18N[state.locale] && I18N[state.locale][k]) || I18N.en[k] || k;

// =============================================================================
// 2. THREE.JS SCENE, 4x MSAA COMPOSER, STUDIO IBL & LIGHTING
// =============================================================================
const container = document.getElementById('canvas-container');
const overlayLayer = document.getElementById('overlay-layer');

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

const TEX = createProceduralTextures(renderer.capabilities.getMaxAnisotropy());

const scene = new THREE.Scene();
scene.background = TEX.studioBackdrop;
scene.fog = new THREE.FogExp2(0x050a07, 0.014);

// Studio PMREM Environment for photorealistic reflections on bare silicon, copper & brushed nickel
const pmrem = new THREE.PMREMGenerator(renderer);
const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
scene.environment = envRT.texture;
scene.environmentIntensity = 0.55;
pmrem.dispose();

const camera = new THREE.PerspectiveCamera(40, 1, 0.03, 180);
camera.position.set(4.2, 4.25, 7.9);

// 4x hardware MSAA HalfFloat render target so EffectComposer + Bloom stays razor-sharp (zero saw edges!)
const initW = Math.max(1, container.clientWidth || window.innerWidth);
const initH = Math.max(1, container.clientHeight || window.innerHeight);
const composerRT = new THREE.WebGLRenderTarget(initW, initH, {
  type: THREE.HalfFloatType,
  samples: renderer.capabilities.isWebGL2 ? 4 : 0,
});
const composer = new EffectComposer(renderer, composerRT);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(new THREE.Vector2(initW, initH), 0.26, 0.42, 0.80);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.065;
controls.maxPolarAngle = Math.PI * 0.495;
controls.minDistance = 1.5;
controls.maxDistance = 30;
controls.target.set(0, 2.38, 0);

// Studio Lighting Rig
scene.add(new THREE.HemisphereLight(0xdaf3e4, 0x09150b, 0.65));

const keyLight = new THREE.DirectionalLight(0xf6fff8, 1.75);
keyLight.position.set(8.5, 14.5, 11);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.near = 2;
keyLight.shadow.camera.far = 42;
keyLight.shadow.camera.left = -10;
keyLight.shadow.camera.right = 10;
keyLight.shadow.camera.top = 10;
keyLight.shadow.camera.bottom = -4;
keyLight.shadow.bias = -0.0002;
keyLight.shadow.normalBias = 0.025;
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0x38bdf8, 0.55);
fillLight.position.set(-10, 7, 8);
scene.add(fillLight);

const backFill = new THREE.DirectionalLight(0xe4f7eb, 0.85);
backFill.position.set(-5, 7, -11);
scene.add(backFill);

const nvRim = new THREE.SpotLight(0x76b900, 16, 36, Math.PI / 2.4, 0.78, 1.3);
nvRim.position.set(0, 9.5, -9);
nvRim.target.position.set(0, 2.35, 0);
scene.add(nvRim, nvRim.target);

// Reflective Obsidian Studio Floor & Grid
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(66, 48),
  new THREE.MeshStandardMaterial({ color: 0x070d09, roughness: 0.38, metalness: 0.52 })
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const grid = new THREE.GridHelper(32, 32, 0x2f5015, 0x111f15);
grid.position.y = 0.005;
grid.material.opacity = 0.48;
grid.material.transparent = true;
scene.add(grid);

// =============================================================================
// 3. SHARED PBR MATERIAL FACTORY & PART REGISTRY
// =============================================================================
function isNarrow() {
  const w = container.clientWidth || window.innerWidth;
  const h = container.clientHeight || window.innerHeight;
  return (w / h) < 0.88 || w < 680;
}

function fitZForHalfWidth(halfWidth, minZ) {
  const aspect = Math.max(0.35, (container.clientWidth || 1) / (container.clientHeight || 1));
  const vfov = THREE.MathUtils.degToRad(camera.fov);
  const hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect);
  return Math.max(minZ, Math.min(26, (halfWidth / Math.tan(hfov / 2)) * 1.15));
}

const MATS = {
  frameDark: () => new THREE.MeshStandardMaterial({ color: 0x131d19, roughness: 0.40, metalness: 0.80 }),
  anodizedSilver: () => new THREE.MeshStandardMaterial({ color: 0x9aa9b2, roughness: 0.28, metalness: 0.88 }),
  stainless: () => new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.22, metalness: 0.92 }),
  trayEmerald: () => new THREE.MeshStandardMaterial({ color: 0x15311b, roughness: 0.34, metalness: 0.74, transparent: true }),
  switchAmber: () => new THREE.MeshStandardMaterial({ color: 0xb8650a, emissive: 0x5c2806, emissiveIntensity: 0.40, roughness: 0.28, metalness: 0.72, transparent: true }),
  powerShelf: () => new THREE.MeshStandardMaterial({ color: 0x1a2632, roughness: 0.44, metalness: 0.68, transparent: true }),
  spineEmerald: () => new THREE.MeshStandardMaterial({ color: 0x76b900, emissive: 0x355c00, emissiveIntensity: 0.72, roughness: 0.24, metalness: 0.74, transparent: true }),
  coolCold: () => new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x0e7490, emissiveIntensity: 0.55, roughness: 0.20, metalness: 0.82, transparent: true }),
  coolWarm: () => new THREE.MeshStandardMaterial({ color: 0xfb7185, emissive: 0xbe123c, emissiveIntensity: 0.52, roughness: 0.22, metalness: 0.78, transparent: true }),
  copper: () => new THREE.MeshStandardMaterial({ color: 0xd48042, emissive: 0x451e06, emissiveIntensity: 0.22, roughness: 0.26, metalness: 0.88 }),
  gold: () => new THREE.MeshStandardMaterial({ color: 0xe6b84c, roughness: 0.22, metalness: 0.94 }),
  pcb: () => new THREE.MeshStandardMaterial({ map: TEX.serverPcb, roughness: 0.46, metalness: 0.30 }),
  substrate: () => new THREE.MeshStandardMaterial({ map: TEX.substrate, roughness: 0.44, metalness: 0.28 }),
  interposer: () => new THREE.MeshStandardMaterial({ map: TEX.interposer, roughness: 0.26, metalness: 0.78 }),
  // Iridescent bare 3nm silicon wafer die (MeshPhysicalMaterial)
  rubinDie: () => new THREE.MeshPhysicalMaterial({
    map: TEX.siliconDie,
    color: 0xdff5eb,
    emissive: 0x2a4d10,
    emissiveIntensity: 0.34,
    metalness: 0.85,
    roughness: 0.16,
    clearcoat: 0.92,
    clearcoatRoughness: 0.08,
    iridescence: 0.85,
    iridescenceIOR: 1.55,
    iridescenceThicknessRange: [180, 480],
  }),
  siliconEdge: () => new THREE.MeshStandardMaterial({ color: 0x26323a, roughness: 0.28, metalness: 0.85 }),
  hbm4Side: () => new THREE.MeshStandardMaterial({
    map: TEX.hbm4Side,
    emissive: 0x083b4c,
    emissiveIntensity: 0.40,
    roughness: 0.24,
    metalness: 0.76,
  }),
  hbm4Top: () => new THREE.MeshPhysicalMaterial({
    map: TEX.hbm4Top,
    roughness: 0.18,
    metalness: 0.82,
    clearcoat: 0.75,
    clearcoatRoughness: 0.10,
    iridescence: 0.45,
    iridescenceIOR: 1.4,
  }),
  hbmBaseLogic: () => new THREE.MeshStandardMaterial({ color: 0x1b2d3b, roughness: 0.30, metalness: 0.82 }),
  ioChiplet: () => new THREE.MeshPhysicalMaterial({
    color: 0xd98a18,
    emissive: 0x854208,
    emissiveIntensity: 0.48,
    roughness: 0.20,
    metalness: 0.86,
    clearcoat: 0.7,
    iridescence: 0.4,
  }),
  veraIhs: () => new THREE.MeshPhysicalMaterial({
    map: TEX.veraIhs,
    roughness: 0.26,
    metalness: 0.86,
    clearcoat: 0.35,
    clearcoatRoughness: 0.22,
  }),
  socammPcb: () => new THREE.MeshStandardMaterial({ map: TEX.socammPcb, roughness: 0.44, metalness: 0.30 }),
  dramPackage: () => new THREE.MeshStandardMaterial({ color: 0x161b20, roughness: 0.42, metalness: 0.26 }),
  coldPlateCore: () => new THREE.MeshStandardMaterial({
    map: TEX.coldPlate,
    roughness: 0.26,
    metalness: 0.82,
    transparent: true,
    opacity: 0.72,
  }),
  nicPurple: () => new THREE.MeshStandardMaterial({ color: 0x9333ea, emissive: 0x4c1d95, emissiveIntensity: 0.42, roughness: 0.28, metalness: 0.74 }),
  switchAsic: () => new THREE.MeshPhysicalMaterial({
    map: TEX.siliconDie,
    color: 0xffd79a,
    emissive: 0x7c3406,
    emissiveIntensity: 0.45,
    roughness: 0.18,
    metalness: 0.88,
    clearcoat: 0.8,
  }),
  vrmChoke: () => new THREE.MeshStandardMaterial({ color: 0x272e35, roughness: 0.56, metalness: 0.48 }),
  smdCeramic: () => new THREE.MeshStandardMaterial({ color: 0xc8a468, roughness: 0.38, metalness: 0.45 }),
};

// Clickable Part Registry
const clickableMeshes = [];
const partGroups = {};
function registerPart(obj, partId) {
  if (!partGroups[partId]) partGroups[partId] = [];
  partGroups[partId].push(obj);
  obj.traverse((child) => {
    if (child.isMesh) {
      child.userData.partId = partId;
      clickableMeshes.push(child);
    }
  });
}

const selHighlight = new THREE.Box3Helper(new THREE.Box3(), 0xd4ff66);
selHighlight.visible = false;
scene.add(selHighlight);

// Helper: Curved Metallic / Coolant Tube
function makeTube(points, radius, mat) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  return new THREE.Mesh(new THREE.TubeGeometry(curve, 20, radius, 10, false), mat);
}

// =============================================================================
// 4. TIER 1 + TIER 2 + TIER 3: 48U VERA RUBIN NVL72 RACK & DETAILED 1U BLADES
// =============================================================================
const RACK_W = 1.26;
const RACK_H = 4.32;
const RACK_D = 1.58;
const U_H = RACK_H / 48;
const innerW = RACK_W - 0.14;
const innerD = RACK_D - 0.16;

const rackRoot = new THREE.Group();
scene.add(rackRoot);

const rackFrameGroup = new THREE.Group();
rackRoot.add(rackFrameGroup);

// Plinth + Trim
const plinth = new THREE.Mesh(
  new THREE.BoxGeometry(RACK_W + 0.18, 0.08, RACK_D + 0.18),
  new THREE.MeshStandardMaterial({ color: 0x0d1511, roughness: 0.44, metalness: 0.74 })
);
plinth.position.y = 0.04; plinth.receiveShadow = true;
rackFrameGroup.add(plinth);

const plinthTrim = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(RACK_W + 0.22, 0.024, RACK_D + 0.22)),
  new THREE.LineBasicMaterial({ color: 0x76b900, transparent: true, opacity: 0.88 })
);
plinthTrim.position.y = 0.084;
rackFrameGroup.add(plinthTrim);

// Frame Posts + Top Cap + Side Skins
const postMat = MATS.frameDark();
const postGeo = new THREE.BoxGeometry(0.056, RACK_H, 0.056);
[[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
  const p = new THREE.Mesh(postGeo, postMat);
  p.position.set(sx * (RACK_W / 2 - 0.03), 0.08 + RACK_H / 2, sz * (RACK_D / 2 - 0.03));
  p.castShadow = true;
  rackFrameGroup.add(p);
});
const topCap = new THREE.Mesh(new THREE.BoxGeometry(RACK_W, 0.05, RACK_D), postMat);
topCap.position.y = 0.08 + RACK_H + 0.025;
rackFrameGroup.add(topCap);

const sideSkinMat = new THREE.MeshStandardMaterial({
  color: 0x0f1914, roughness: 0.46, metalness: 0.70, transparent: true, opacity: 0.84,
});
const leftSkin = new THREE.Mesh(new THREE.BoxGeometry(0.02, RACK_H - 0.06, RACK_D - 0.08), sideSkinMat);
leftSkin.position.set(-RACK_W / 2 + 0.01, 0.08 + RACK_H / 2, 0);
const rightSkin = leftSkin.clone();
rightSkin.position.x = RACK_W / 2 - 0.01;
rackFrameGroup.add(leftSkin, rightSkin);

const wireBox = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(RACK_W + 0.014, RACK_H + 0.014, RACK_D + 0.014)),
  new THREE.LineBasicMaterial({ color: 0x76b900, transparent: true, opacity: 0.28 })
);
wireBox.position.y = 0.08 + RACK_H / 2;
rackFrameGroup.add(wireBox);

const rackModules = [];
const nvlinkParticles = [];
const thermalParticles = [];

// Top & Bottom HVDC Power / BBU Shelves (with realistic modular PSU bay faces)
function buildPowerShelf(yU, heightU, explodeY) {
  const g = new THREE.Group();
  const h = U_H * heightU;
  const mat = MATS.powerShelf();
  const body = new THREE.Mesh(new THREE.BoxGeometry(innerW, h, innerD * 0.92), mat);
  body.castShadow = true;
  g.add(body);
  // 6 hot-swap HVDC rectifier/BBU modules across front face
  const bayMat = MATS.anodizedSilver();
  for (let b = 0; b < 6; b++) {
    const bx = -innerW * 0.40 + b * (innerW * 0.16);
    const face = new THREE.Mesh(new THREE.BoxGeometry(innerW * 0.135, h * 0.72, 0.024), bayMat);
    face.position.set(bx, 0, innerD * 0.46 + 0.012);
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.012, 0.014), new THREE.MeshBasicMaterial({ color: 0x38bdf8 }));
    led.position.set(bx, h * 0.22, innerD * 0.46 + 0.026);
    g.add(face, led);
  }
  g.position.set(0, 0.08 + yU * U_H, 0);
  rackRoot.add(g);
  registerPart(g, 'power_shelves');
  rackModules.push({ mesh: g, basePos: g.position.clone(), explodeOff: new THREE.Vector3(0, explodeY, 0), kind: 'infra', bodyMat: mat, partId: 'power_shelves' });
}
buildPowerShelf(44.8, 5.2, +0.44);
buildPowerShelf(5.8, 7.2, -0.44);

// Rear Vertical Copper HVDC Busbars
const busbarGroup = new THREE.Group();
[-0.45, 0.45].forEach((bx) => {
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.038, RACK_H * 0.84, 0.038), MATS.copper());
  bar.position.set(bx, 0.08 + RACK_H * 0.5, -RACK_D / 2 + 0.08);
  busbarGroup.add(bar);
});
rackRoot.add(busbarGroup);
registerPart(busbarGroup, 'power_shelves');
rackModules.push({ mesh: busbarGroup, basePos: busbarGroup.position.clone(), explodeOff: new THREE.Vector3(0, 0, -0.26), kind: 'infra', partId: 'power_shelves' });

// Build 1U Compute Trays (10 Upper + 8 Lower); U34 is Detailed Hero Compute Tray!
let heroComputeTray = null;
let heroComputeGpu = null;
let heroSwitchTray = null;

function build1UComputeTray(uIdx, bankSign, isHero, bankPartId) {
  const g = new THREE.Group();
  const h = U_H * 0.84;
  const y = 0.08 + (uIdx + 0.5) * U_H;

  const bodyMat = MATS.trayEmerald();
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(innerW, h, innerD * 0.94), bodyMat);
  chassis.castShadow = true;
  g.add(chassis);

  // Front NVIDIA-green status bar + silver release latches
  const led = new THREE.Mesh(new THREE.BoxGeometry(innerW * 0.72, 0.013, 0.016), new THREE.MeshBasicMaterial({ color: isHero ? 0xd4ff66 : 0x76b900 }));
  led.position.set(0, 0, innerD * 0.47 + 0.008);
  g.add(led);
  const latchMat = MATS.anodizedSilver();
  [-1, 1].forEach((s) => {
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.052, h * 0.60, 0.044), latchMat);
    handle.position.set(s * (innerW * 0.45), 0, innerD * 0.47 + 0.022);
    g.add(handle);
  });

  if (isHero) {
    // Low base chassis pan + multi-layer motherboard PCB (clean vertical clearance, zero overlap)
    chassis.scale.y = 0.26;
    chassis.position.y = -h * 0.37;

    const pcb = new THREE.Mesh(new THREE.BoxGeometry(innerW * 0.94, 0.014, innerD * 0.89), MATS.pcb());
    pcb.position.y = -h * 0.06;
    g.add(pcb);

    // Side rails so the 1U blade reads like a real precision server tray
    [-1, 1].forEach((s) => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.018, h * 0.72, innerD * 0.92), MATS.anodizedSilver());
      rail.position.set(s * (innerW * 0.49), -h * 0.08, 0);
      g.add(rail);
    });

    // Two 1:2 Vera-Rubin Superchip Assemblies (Left & Right)
    for (let s = 0; s < 2; s++) {
      const sx = s === 0 ? -0.26 : 0.26;

      // Vera CPU with brushed nickel IHS
      const cpuGroup = new THREE.Group();
      const cpuSub = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.014, 0.22), MATS.substrate());
      cpuSub.position.set(sx, 0.006, -0.27);
      const cpuIhs = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.022, 0.17), MATS.veraIhs());
      cpuIhs.position.set(sx, 0.024, -0.27);
      cpuGroup.add(cpuSub, cpuIhs);
      g.add(cpuGroup);
      registerPart(cpuGroup, 'tray_vera_cpu');

      // 4x Miniature Realistic SOCAMM Memory Cards flanking each Vera CPU (8 per tray)
      const socGroup = new THREE.Group();
      [-0.148, 0.148].forEach((ox) => {
        [-0.064, 0.064].forEach((oz) => {
          const card = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.012, 0.105), MATS.socammPcb());
          card.position.set(sx + ox, 0.010, -0.27 + oz);
          // 2 tiny dark BGA DRAM chips on each mini SOCAMM card
          [-0.024, 0.024].forEach((dz) => {
            const ic = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.010, 0.036), MATS.dramPackage());
            ic.position.set(sx + ox, 0.021, -0.27 + oz + dz);
            socGroup.add(ic);
          });
          socGroup.add(card);
        });
      });
      g.add(socGroup);
      registerPart(socGroup, 'tray_socamm');

      // 2x Rubin GPUs per Superchip (4 per tray) with realistic substrate, dual dies & 12-Hi HBM4
      for (let k = 0; k < 2; k++) {
        const gpuGroup = new THREE.Group();
        const gx = sx + (k === 0 ? -0.115 : 0.115);
        const sub = new THREE.Mesh(new THREE.BoxGeometry(0.195, 0.014, 0.235), MATS.substrate());
        sub.position.set(gx, 0.006, 0.08);
        const dieL = new THREE.Mesh(new THREE.BoxGeometry(0.054, 0.018, 0.145), MATS.rubinDie());
        dieL.position.set(gx - 0.032, 0.022, 0.08);
        const dieR = new THREE.Mesh(new THREE.BoxGeometry(0.054, 0.018, 0.145), MATS.rubinDie());
        dieR.position.set(gx + 0.032, 0.022, 0.08);
        gpuGroup.add(sub, dieL, dieR);

        // Cleanly separated HBM4 stacks on left/right of the dual dies
        [-0.076, 0.076].forEach((hx) => {
          const hbm = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.028, 0.155), MATS.hbm4Side());
          hbm.position.set(gx + hx, 0.027, 0.08);
          gpuGroup.add(hbm);
        });
        g.add(gpuGroup);
        registerPart(gpuGroup, 'tray_rubin_gpu');
        if (s === 0 && k === 0) heroComputeGpu = sub;
      }

      // Curved Direct-to-Chip Copper Cold Plates & Cold/Warm Coolant Tubes
      const cpGroup = new THREE.Group();
      const gpuCp = new THREE.Mesh(new THREE.BoxGeometry(0.41, 0.012, 0.14), MATS.coldPlateCore());
      gpuCp.position.set(sx, 0.048, 0.08);
      const cpuCp = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.012, 0.16), MATS.coldPlateCore());
      cpuCp.position.set(sx, 0.042, -0.27);
      const coldTube = makeTube([
        [sx - 0.16, 0.020, -innerD * 0.45],
        [sx - 0.14, 0.048, -0.27],
        [sx - 0.14, 0.055, 0.04],
        [sx + 0.14, 0.055, 0.04],
      ], 0.010, MATS.coolCold());
      const warmTube = makeTube([
        [sx + 0.14, 0.055, 0.12],
        [sx - 0.08, 0.055, 0.12],
        [sx + 0.08, 0.048, -0.24],
        [sx + 0.16, 0.020, -innerD * 0.45],
      ], 0.010, MATS.coolWarm());
      cpGroup.add(gpuCp, cpuCp, coldTube, warmTube);
      g.add(cpGroup);
      registerPart(cpGroup, 'tray_coldplate');

      // 2x ConnectX-9 1600G SuperNICs per side (4 per tray) + metallic OSFP cages at front edge
      const nicGroup = new THREE.Group();
      [-0.095, 0.095].forEach((nx) => {
        const nic = new THREE.Mesh(new THREE.BoxGeometry(0.135, 0.022, 0.17), MATS.nicPurple());
        nic.position.set(sx + nx, 0.012, 0.43);
        const cage = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.028, 0.095), MATS.stainless());
        cage.position.set(sx + nx, 0.016, 0.56);
        nicGroup.add(nic, cage);
      });
      g.add(nicGroup);
      registerPart(nicGroup, 'tray_nic');
    }

    // Rear Blind-Mate Cartridge Connectors + Turned-Chrome Liquid QDs
    const rearConn = new THREE.Group();
    [-0.27, -0.09, 0.09, 0.27].forEach((bx) => {
      const plug = new THREE.Mesh(new THREE.BoxGeometry(0.086, 0.030, 0.072), MATS.spineEmerald());
      plug.position.set(bx, 0.005, -innerD * 0.47 - 0.032);
      const pins = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.014, 0.018), MATS.gold());
      pins.position.set(bx, 0.005, -innerD * 0.47 - 0.068);
      rearConn.add(plug, pins);
    });
    const qdCold = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.085, 14), MATS.coolCold());
    qdCold.rotation.x = Math.PI / 2; qdCold.position.set(-innerW * 0.42, 0.006, -innerD * 0.47 - 0.036);
    const qdWarm = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.085, 14), MATS.coolWarm());
    qdWarm.rotation.x = Math.PI / 2; qdWarm.position.set(innerW * 0.42, 0.006, -innerD * 0.47 - 0.036);
    rearConn.add(qdCold, qdWarm);
    g.add(rearConn);
    registerPart(rearConn, 'rear_spine');

    chassis.userData.partId = bankPartId;
    clickableMeshes.push(chassis);
    if (!partGroups[bankPartId]) partGroups[bankPartId] = [];
    partGroups[bankPartId].push(chassis);
  } else {
    registerPart(g, bankPartId);
  }

  g.position.set(0, y, 0.02);
  rackRoot.add(g);
  rackModules.push({
    mesh: g,
    basePos: g.position.clone(),
    explodeOff: new THREE.Vector3(0, bankSign * 0.36, isHero ? 0.48 : 0.12),
    kind: 'compute',
    bodyMat,
    isHeroCompute: isHero,
    partId: bankPartId,
  });
  if (isHero) heroComputeTray = g;
}

for (let i = 0; i < 10; i++) build1UComputeTray(31 + i, +1, i === 3, 'compute_upper');
for (let i = 0; i < 8; i++) build1UComputeTray(12 + i, -1, false, 'compute_lower');

// Build 9 Central 1U NVLink 6 Switch Trays (U21–U29); i=4 (U25) is Detailed Hero Switch Tray!
for (let i = 0; i < 9; i++) {
  const isHero = (i === 4);
  const swGroup = new THREE.Group();
  const h = U_H * 0.84;
  const y = 0.08 + (21 + i + 0.5) * U_H;
  const swMat = MATS.switchAmber();
  const body = new THREE.Mesh(new THREE.BoxGeometry(innerW * 0.98, h, innerD * 0.90), swMat);
  body.castShadow = true;
  swGroup.add(body);

  const led = new THREE.Mesh(new THREE.BoxGeometry(innerW * 0.78, 0.014, 0.016), new THREE.MeshBasicMaterial({ color: isHero ? 0xfde68a : 0xf59e0b }));
  led.position.set(0, 0, innerD * 0.45 + 0.008);
  swGroup.add(led);

  if (isHero) {
    body.scale.y = 0.28;
    body.position.y = -h * 0.36;
    const pcb = new THREE.Mesh(new THREE.BoxGeometry(innerW * 0.92, 0.014, innerD * 0.85), MATS.pcb());
    pcb.position.y = -h * 0.06;
    swGroup.add(pcb);

    // 2x Realistic Liquid-Cooled NVLink 6 Switch ASICs + Copper Cold Plates + Curved Loops
    const asicGroup = new THREE.Group();
    [-0.25, 0.25].forEach((ax) => {
      const sub = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.016, 0.30), MATS.substrate());
      sub.position.set(ax, 0.008, -0.04);
      const asic = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.024, 0.21), MATS.switchAsic());
      asic.position.set(ax, 0.028, -0.04);
      const cp = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.014, 0.24), MATS.coldPlateCore());
      cp.position.set(ax, 0.050, -0.04);
      asicGroup.add(sub, asic, cp);
    });
    // Curved supply & return pipes
    const swCold = makeTube([
      [-0.42, 0.022, -innerD * 0.42],
      [-0.25, 0.058, -0.10],
      [0.25, 0.058, -0.10],
    ], 0.011, MATS.coolCold());
    const swWarm = makeTube([
      [-0.25, 0.058, 0.04],
      [0.25, 0.058, 0.04],
      [0.42, 0.022, -innerD * 0.42],
    ], 0.011, MATS.coolWarm());
    asicGroup.add(swCold, swWarm);

    // Front management / optical port bank
    for (let p = 0; p < 6; p++) {
      const cage = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.026, 0.11), MATS.stainless());
      cage.position.set(-0.35 + p * 0.14, 0.016, innerD * 0.39);
      asicGroup.add(cage);
    }

    // Rear blind-mate cartridge plugs
    [-0.27, -0.09, 0.09, 0.27].forEach((bx) => {
      const plug = new THREE.Mesh(new THREE.BoxGeometry(0.086, 0.030, 0.074), MATS.spineEmerald());
      plug.position.set(bx, 0.006, -innerD * 0.45 - 0.032);
      asicGroup.add(plug);
    });
    swGroup.add(asicGroup);
    registerPart(asicGroup, 'switch_asic');
    body.userData.partId = 'switch_bank';
    clickableMeshes.push(body);
    if (!partGroups['switch_bank']) partGroups['switch_bank'] = [];
    partGroups['switch_bank'].push(body);
    heroSwitchTray = swGroup;
  } else {
    registerPart(swGroup, 'switch_bank');
  }

  swGroup.position.set(0, y, 0.01);
  rackRoot.add(swGroup);
  rackModules.push({
    mesh: swGroup,
    basePos: swGroup.position.clone(),
    explodeOff: new THREE.Vector3(0, 0, isHero ? 0.36 : -0.34),
    kind: 'nvlink',
    bodyMat: swMat,
    isHeroSwitch: isHero,
    partId: 'switch_bank',
  });
}

// Rear Cable-Free Emerald Cartridge Spine (4 vertical midplane bus columns + gold blind-mate slots)
const spineGroup = new THREE.Group();
const spineMat = MATS.spineEmerald();
const goldMat = MATS.gold();
for (let b = 0; b < 4; b++) {
  const bx = -0.27 + b * 0.18;
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.11, U_H * 30.2, 0.088), spineMat);
  bar.position.set(bx, 0, 0);
  spineGroup.add(bar);
  for (let t = -13; t <= 13; t += 2) {
    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.118, 0.016, 0.102), goldMat);
    slot.position.set(bx, t * U_H, 0);
    spineGroup.add(slot);
  }
}
spineGroup.position.set(0, 0.08 + 26.2 * U_H, -RACK_D / 2 - 0.035);
rackRoot.add(spineGroup);
registerPart(spineGroup, 'rear_spine');
rackModules.push({ mesh: spineGroup, basePos: spineGroup.position.clone(), explodeOff: new THREE.Vector3(0, 0, -0.62), kind: 'nvlink', bodyMat: spineMat, partId: 'rear_spine' });

// Rear Dual-Loop Liquid Cooling Manifolds + Turned-Chrome QD Collars
const manifoldGroup = new THREE.Group();
const coldPipeMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, RACK_H * 0.88, 16), MATS.coolCold());
coldPipeMesh.position.set(-(RACK_W / 2 - 0.08), 0.08 + RACK_H * 0.5, -RACK_D / 2 + 0.14);
const warmPipeMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, RACK_H * 0.88, 16), MATS.coolWarm());
warmPipeMesh.position.set(+(RACK_W / 2 - 0.08), 0.08 + RACK_H * 0.5, -RACK_D / 2 + 0.14);
manifoldGroup.add(coldPipeMesh, warmPipeMesh);

const collarMat = MATS.stainless();
for (let u = 12; u <= 40; u += 2) {
  if (u === 20 || u === 30) continue;
  const uy = 0.08 + (u + 0.5) * U_H;
  [-1, 1].forEach((side) => {
    const qd = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.12, 10), side < 0 ? MATS.coolCold() : MATS.coolWarm());
    qd.rotation.z = Math.PI / 2;
    qd.position.set(side * (RACK_W / 2 - 0.14), uy, -RACK_D / 2 + 0.14);
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.020, 0.020, 0.032, 10), collarMat);
    collar.rotation.z = Math.PI / 2;
    collar.position.set(side * (RACK_W / 2 - 0.12), uy, -RACK_D / 2 + 0.14);
    manifoldGroup.add(qd, collar);
  });
}
rackRoot.add(manifoldGroup);
registerPart(manifoldGroup, 'coolant_manifolds');
rackModules.push({ mesh: manifoldGroup, basePos: manifoldGroup.position.clone(), explodeOff: new THREE.Vector3(0, 0, -0.32), kind: 'cooling', partId: 'coolant_manifolds' });

// Live Overlay 1: 260 TB/s NVLink 6 Bidirectional Data Pulses
const nvlinkFlowGroup = new THREE.Group();
rackRoot.add(nvlinkFlowGroup);
const arcLineMat = new THREE.LineBasicMaterial({ color: 0xa8e03a, transparent: true, opacity: 0.65 });
[13, 15, 18, 32, 35, 38, 40].forEach((uTray, idx) => {
  const yStart = 0.08 + (uTray + 0.5) * U_H;
  const yEnd = 0.08 + (21.5 + (idx % 7) * 1.15) * U_H;
  const side = idx % 2 === 0 ? -1 : 1;
  const xEdge = side * (RACK_W / 2 + 0.02);
  const xBulge = side * (RACK_W / 2 + 0.22 + Math.abs(yStart - yEnd) * 0.09);
  const zRear = -RACK_D / 2 - 0.02;
  const curve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(xEdge, yStart, zRear),
    new THREE.Vector3(xBulge, (yStart + yEnd) / 2, zRear - 0.20),
    new THREE.Vector3(xEdge, yEnd, zRear)
  );
  nvlinkFlowGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(20)), arcLineMat));
  for (let p = 0; p < 2; p++) {
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.040, 10, 10), new THREE.MeshBasicMaterial({ color: p === 0 ? 0xd4ff66 : 0xf59e0b }));
    nvlinkFlowGroup.add(dot);
    nvlinkParticles.push({ curve, mesh: dot, phase: (idx * 0.17 + p * 0.5) % 1, speed: p === 0 ? 0.85 : -0.85 });
  }
});

// Live Overlay 2: 100% Liquid Cooling Thermal Loop
const thermalFlowGroup = new THREE.Group();
rackRoot.add(thermalFlowGroup);
const coldCurve = new THREE.LineCurve3(
  new THREE.Vector3(-(RACK_W / 2 - 0.08), 0.30, -RACK_D / 2 + 0.14),
  new THREE.Vector3(-(RACK_W / 2 - 0.08), RACK_H - 0.15, -RACK_D / 2 + 0.14)
);
const warmCurve = new THREE.LineCurve3(
  new THREE.Vector3(+(RACK_W / 2 - 0.08), RACK_H - 0.15, -RACK_D / 2 + 0.14),
  new THREE.Vector3(+(RACK_W / 2 - 0.08), 0.30, -RACK_D / 2 + 0.14)
);
for (let i = 0; i < 10; i++) {
  const cDot = new THREE.Mesh(new THREE.SphereGeometry(0.046, 10, 10), new THREE.MeshBasicMaterial({ color: 0x22d3ee }));
  const wDot = new THREE.Mesh(new THREE.SphereGeometry(0.046, 10, 10), new THREE.MeshBasicMaterial({ color: 0xfb7185 }));
  thermalFlowGroup.add(cDot, wDot);
  thermalParticles.push({ curve: coldCurve, mesh: cDot, phase: i / 10, speed: 0.42 });
  thermalParticles.push({ curve: warmCurve, mesh: wDot, phase: i / 10, speed: 0.42 });
}
[14, 18, 25, 34, 38].forEach((u, idx) => {
  const uy = 0.08 + (u + 0.5) * U_H;
  const crossCurve = new THREE.LineCurve3(
    new THREE.Vector3(-(RACK_W / 2 - 0.10), uy, -RACK_D / 2 + 0.18),
    new THREE.Vector3(+(RACK_W / 2 - 0.10), uy, -RACK_D / 2 + 0.18)
  );
  const tDot = new THREE.Mesh(new THREE.SphereGeometry(0.036, 8, 8), new THREE.MeshBasicMaterial({ color: 0x38bdf8 }));
  thermalFlowGroup.add(tDot);
  thermalParticles.push({ curve: crossCurve, mesh: tDot, phase: idx * 0.21, speed: 0.55, colorGradient: true });
});

// =============================================================================
// 5. TIER 4: REALISTIC IDENTICAL TWIN 1:2 VERA-RUBIN SUPERCHIP COMPOSITES
//    Rubin GPU A (Left)  <-- NVLink-C2C -->  Vera CPU + 4x SOCAMM Cards  <-- NVLink-C2C -->  Rubin GPU B (Right)
// =============================================================================
const SIL_HERO_POS = new THREE.Vector3(0, 1.25, 0.2);
const siliconStage = new THREE.Group();
siliconStage.position.copy(SIL_HERO_POS);
siliconStage.visible = false;
scene.add(siliconStage);

const silKeyLight = new THREE.PointLight(0xeafff2, 12, 18, 1.4);
silKeyLight.position.set(0.4, 3.8, 2.5);
siliconStage.add(silKeyLight);

const silExplodeParts = []; // { mesh, baseY, expY, twin: 'A' | 'B' }
const silPulses = [];

// --- Superchip Carrier Motherboard (VR200 Board) with VRM Stages & Rear Gold Edge Fingers ---
const carrierW = 7.40;
const carrierD = 3.15;
const carrierBoard = new THREE.Mesh(new THREE.BoxGeometry(carrierW, 0.085, carrierD), MATS.pcb());
carrierBoard.position.set(0, -0.06, 0);
carrierBoard.receiveShadow = true;
siliconStage.add(carrierBoard);

// VRM Power Delivery Stages (Rows of Ferrite Chokes + Cylindrical Solid-State Capacitors)
const chokeGeo = new THREE.BoxGeometry(0.11, 0.08, 0.11);
const capGeo = new THREE.CylinderGeometry(0.042, 0.042, 0.095, 12);
const chokeMat = MATS.vrmChoke();
const capMat = MATS.stainless();
const vrmChokes = new THREE.InstancedMesh(chokeGeo, chokeMat, 36);
const vrmCaps = new THREE.InstancedMesh(capGeo, capMat, 36);
const dummy = new THREE.Object3D();
let vIdx = 0;
[-carrierD / 2 + 0.22, carrierD / 2 - 0.22].forEach((vz) => {
  for (let i = 0; i < 18; i++) {
    const vx = -3.15 + i * 0.37;
    dummy.position.set(vx, 0.022, vz);
    dummy.updateMatrix();
    vrmChokes.setMatrixAt(vIdx, dummy.matrix);
    dummy.position.set(vx + 0.15, 0.030, vz);
    dummy.updateMatrix();
    vrmCaps.setMatrixAt(vIdx, dummy.matrix);
    vIdx++;
  }
});
siliconStage.add(vrmChokes, vrmCaps);

// Rear Blind-Mate Gold Edge Connector Strip along carrier back edge
const edgeConn = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.055, 0.09), MATS.frameDark());
edgeConn.position.set(0, 0.01, -carrierD / 2 - 0.03);
siliconStage.add(edgeConn);
for (let f = -26; f <= 26; f++) {
  const finger = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.012, 0.075), goldMat);
  finger.position.set(f * 0.105, 0.042, -carrierD / 2 - 0.03);
  siliconStage.add(finger);
}

// --- Reusable Realistic Rubin GPU Composite Factory (Identical Scale & Detail for Twin A & Twin B!) ---
function buildRubinGpuComposite(xPos, twinId) {
  const gpuRoot = new THREE.Group();
  gpuRoot.position.set(xPos, 0, 0);
  siliconStage.add(gpuRoot);

  const subW = 2.38;
  const subD = 2.18;

  // 1. Organic ABF Package Substrate
  const substrate = new THREE.Mesh(new THREE.BoxGeometry(subW, 0.075, subD), MATS.substrate());
  substrate.position.y = 0.025;
  substrate.castShadow = true;
  substrate.receiveShadow = true;
  gpuRoot.add(substrate);

  // 2. Machined Brushed-Steel Perimeter Stiffener Frame (4 rails around outer edge)
  const stMat = MATS.anodizedSilver();
  const stThick = 0.075;
  const stH = 0.055;
  const stTop = new THREE.Mesh(new THREE.BoxGeometry(subW, stH, stThick), stMat);
  stTop.position.set(0, 0.090, -subD / 2 + stThick / 2);
  const stBot = stTop.clone(); stBot.position.z = subD / 2 - stThick / 2;
  const stLeft = new THREE.Mesh(new THREE.BoxGeometry(stThick, stH, subD - stThick * 2), stMat);
  stLeft.position.set(-subW / 2 + stThick / 2, 0.090, 0);
  const stRight = stLeft.clone(); stRight.position.x = subW / 2 - stThick / 2;
  gpuRoot.add(stTop, stBot, stLeft, stRight);

  // 3. Instanced Ring of 44 MLCC SMD Decoupling Capacitors around the interposer perimeter
  const smdGeo = new THREE.BoxGeometry(0.044, 0.024, 0.026);
  const smdMesh = new THREE.InstancedMesh(smdGeo, MATS.smdCeramic(), 44);
  let sIdx = 0;
  for (let i = 0; i < 12; i++) {
    const x = -0.94 + i * 0.171;
    dummy.position.set(x, 0.075, -0.94); dummy.rotation.set(0, 0, 0); dummy.updateMatrix();
    smdMesh.setMatrixAt(sIdx++, dummy.matrix);
    dummy.position.set(x, 0.075, 0.94); dummy.updateMatrix();
    smdMesh.setMatrixAt(sIdx++, dummy.matrix);
  }
  for (let i = 0; i < 10; i++) {
    const z = -0.80 + i * 0.178;
    dummy.position.set(-1.08, 0.075, z); dummy.rotation.set(0, Math.PI / 2, 0); dummy.updateMatrix();
    smdMesh.setMatrixAt(sIdx++, dummy.matrix);
    dummy.position.set(1.08, 0.075, z); dummy.updateMatrix();
    smdMesh.setMatrixAt(sIdx++, dummy.matrix);
  }
  dummy.rotation.set(0, 0, 0);
  gpuRoot.add(smdMesh);

  // 4. CoWoS-L Silicon Interposer Layer
  const interposer = new THREE.Mesh(new THREE.BoxGeometry(subW * 0.84, 0.034, subD * 0.80), MATS.interposer());
  interposer.position.y = 0.082;
  gpuRoot.add(interposer);
  silExplodeParts.push({ mesh: interposer, baseY: 0.082, expY: 0.40, twin: twinId });

  // 5. Dual TSMC N3P Iridescent Silicon Compute Dies (336B) with dark beveled silicon edges
  const diesGroup = new THREE.Group();
  const dieEdgeMat = MATS.siliconEdge();
  const dieTopMat = MATS.rubinDie();
  const dieMats = [dieEdgeMat, dieEdgeMat, dieTopMat, dieEdgeMat, dieEdgeMat, dieEdgeMat];
  [-0.41, 0.41].forEach((dx) => {
    const die = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.056, 1.16), dieMats);
    die.position.set(dx, 0, -0.06);
    die.castShadow = true;
    diesGroup.add(die);
  });
  diesGroup.position.y = 0.130;
  gpuRoot.add(diesGroup);
  registerPart(diesGroup, 'sil_compute_dies');
  silExplodeParts.push({ mesh: diesGroup, baseY: 0.130, expY: 0.96, twin: twinId });

  // 6. 10 TB/s NV-HBI Silicon Interconnect Bridge (glowing micro-trace ribbon between both 3nm dies)
  const bridgeGroup = new THREE.Group();
  const bridgeCore = new THREE.Mesh(
    new THREE.BoxGeometry(0.11, 0.034, 1.02),
    new THREE.MeshStandardMaterial({ color: 0x76b900, emissive: 0x76b900, emissiveIntensity: 0.95, roughness: 0.18, metalness: 0.6 })
  );
  const bridgeBase = new THREE.Mesh(new THREE.BoxGeometry(0.135, 0.016, 1.06), goldMat);
  bridgeBase.position.y = -0.016;
  bridgeGroup.add(bridgeCore, bridgeBase);
  bridgeGroup.position.set(0, 0.122, -0.06);
  gpuRoot.add(bridgeGroup);
  registerPart(bridgeGroup, 'sil_nvhbi');
  silExplodeParts.push({ mesh: bridgeGroup, baseY: 0.122, expY: 0.68, twin: twinId });

  // 7. 2x Dedicated NVLink 6 I/O Chiplets (disaggregated SerDes along front edge)
  const ioGroup = new THREE.Group();
  const ioMat = MATS.ioChiplet();
  [-0.41, 0.41].forEach((dx) => {
    const io = new THREE.Mesh(new THREE.BoxGeometry(0.60, 0.044, 0.19), ioMat);
    io.position.set(dx, 0, 0.68);
    const padStrip = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.012, 0.036), goldMat);
    padStrip.position.set(dx, -0.020, 0.76);
    ioGroup.add(io, padStrip);
  });
  ioGroup.position.y = 0.124;
  gpuRoot.add(ioGroup);
  registerPart(ioGroup, 'sil_io_chiplets');
  silExplodeParts.push({ mesh: ioGroup, baseY: 0.124, expY: 0.78, twin: twinId });

  // 8. 8x True 12-Hi Laminated HBM4 DRAM Stacks (Base Logic Die + 12-layer laminated DRAM body + laser-marked top!)
  const hbmGroup = new THREE.Group();
  const hbmSideM = MATS.hbm4Side();
  const hbmTopM = MATS.hbm4Top();
  const hbmLogicM = MATS.hbmBaseLogic();
  const hbmMats = [hbmSideM, hbmSideM, hbmTopM, hbmLogicM, hbmSideM, hbmSideM];

  for (const side of [-1, 1]) {
    for (let r = 0; r < 4; r++) {
      const zSpan = 1.24;
      const zPos = -zSpan / 2 + (r + 0.5) * (zSpan / 4) - 0.05;
      const hx = side * 0.92;
      // Stepped wider HBM4 Base Logic Die
      const logicBase = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.028, 0.25), hbmLogicM);
      logicBase.position.set(hx, 0.014, zPos);
      // 12-Hi Laminated DRAM Stack above Base Logic Die
      const dramStack = new THREE.Mesh(new THREE.BoxGeometry(0.245, 0.175, 0.215), hbmMats);
      dramStack.position.set(hx, 0.115, zPos);
      dramStack.castShadow = true;
      hbmGroup.add(logicBase, dramStack);
    }
  }
  hbmGroup.position.y = 0.102;
  gpuRoot.add(hbmGroup);
  registerPart(hbmGroup, 'sil_hbm4');
  silExplodeParts.push({ mesh: hbmGroup, baseY: 0.102, expY: 1.26, twin: twinId });

  // 9. Machined Copper Micro-Channel Cold-Plate Assembly (Copper Fin Core + Nickel Flange + 4 Torx Bolts + Curved Coolant Barbs!)
  const cpAssembly = new THREE.Group();
  const cpW = subW * 0.92;
  const cpD = subD * 0.88;

  // Translucent copper micro-channel core plate
  const cpCore = new THREE.Mesh(new THREE.BoxGeometry(cpW * 0.86, 0.068, cpD * 0.84), MATS.coldPlateCore());
  cpCore.position.y = 0;
  cpAssembly.add(cpCore);

  // Outer machined nickel-plated retention flange frame (4 bars so center stays cutaway-visible!)
  const flangeMat = MATS.anodizedSilver();
  const fT = 0.13;
  const fTop = new THREE.Mesh(new THREE.BoxGeometry(cpW, 0.052, fT), flangeMat);
  fTop.position.set(0, 0.008, -cpD / 2 + fT / 2);
  const fBot = fTop.clone(); fBot.position.z = cpD / 2 - fT / 2;
  const fLeft = new THREE.Mesh(new THREE.BoxGeometry(fT, 0.052, cpD - fT * 2), flangeMat);
  fLeft.position.set(-cpW / 2 + fT / 2, 0.008, 0);
  const fRight = fLeft.clone(); fRight.position.x = cpW / 2 - fT / 2;
  cpAssembly.add(fTop, fBot, fLeft, fRight);

  // 4 Stainless Torx Retention Bolts at flange corners
  const boltGeo = new THREE.CylinderGeometry(0.052, 0.052, 0.075, 12);
  const boltMat = MATS.stainless();
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([bx, bz]) => {
    const bolt = new THREE.Mesh(boltGeo, boltMat);
    bolt.position.set(bx * (cpW / 2 - 0.09), 0.032, bz * (cpD / 2 - 0.09));
    cpAssembly.add(bolt);
  });

  // Curved Twin Liquid Coolant Inlet (Cyan) & Outlet (Coral) Barbs on Top of Cold Plate
  const inletBarb = makeTube([
    [-0.45, 0.034, -0.58],
    [-0.45, 0.17, -0.64],
    [-0.45, 0.21, -0.98],
  ], 0.034, MATS.coolCold());
  const outletBarb = makeTube([
    [0.45, 0.034, -0.58],
    [0.45, 0.17, -0.64],
    [0.45, 0.21, -0.98],
  ], 0.034, MATS.coolWarm());
  cpAssembly.add(inletBarb, outletBarb);

  cpAssembly.position.y = 0.345;
  gpuRoot.add(cpAssembly);
  registerPart(cpAssembly, 'sil_coldplate');
  silExplodeParts.push({ mesh: cpAssembly, baseY: 0.345, expY: 1.98, twin: twinId });

  return { root: gpuRoot, diesGroup, hbmGroup, ioGroup, cpAssembly };
}

// Build Identical Twins: Rubin GPU A (Left) and Rubin GPU B (Right)
const gpuTwinA = buildRubinGpuComposite(-2.30, 'A');
const gpuTwinB = buildRubinGpuComposite(+2.30, 'B');

// --- CENTER: NVIDIA Vera 88-Core CPU + 4x Realistic Modular SOCAMM LPDDR5X Memory Cards ---
const veraCenterGroup = new THREE.Group();
veraCenterGroup.position.set(0, 0, 0);
siliconStage.add(veraCenterGroup);

// Vera CPU Substrate + SMD Ring + Stepped Brushed Nickel IHS + 4 Torx Mounting Bolts
const veraSub = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.072, 1.32), MATS.substrate());
veraSub.position.y = 0.022;
veraCenterGroup.add(veraSub);

const veraStep = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.036, 1.00), MATS.anodizedSilver());
veraStep.position.y = 0.076;
const veraIhsEdge = MATS.anodizedSilver();
const veraIhsTop = MATS.veraIhs();
const veraIhsMesh = new THREE.Mesh(
  new THREE.BoxGeometry(0.92, 0.068, 0.88),
  [veraIhsEdge, veraIhsEdge, veraIhsTop, veraIhsEdge, veraIhsEdge, veraIhsEdge]
);
veraIhsMesh.position.y = 0.125;
veraIhsMesh.castShadow = true;
veraCenterGroup.add(veraStep, veraIhsMesh);

// 4 Corner Torx Bolts on Vera CPU retention bracket
[[-0.58, -0.54], [0.58, -0.54], [-0.58, 0.54], [0.58, 0.54]].forEach(([bx, bz]) => {
  const b = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.07, 10), MATS.stainless());
  b.position.set(bx, 0.072, bz);
  veraCenterGroup.add(b);
});

// 4x Realistic Modular SOCAMM Memory Cards (2 North, 2 South of Vera CPU)
// Each SOCAMM card = compression socket + green PCB with gold fingers + 4 raised BGA DRAM ICs + corner screws + cyan rail!
function buildSocammCard(cx, cz) {
  const cardG = new THREE.Group();
  cardG.position.set(cx, -0.015, cz);

  // Compression connector socket pad underneath
  const socket = new THREE.Mesh(new THREE.BoxGeometry(0.60, 0.028, 0.34), MATS.frameDark());
  socket.position.y = 0.014;
  cardG.add(socket);

  // Thin SOCAMM Memory Card PCB (with gold edge fingers & silkscreen texture)
  const pcbCard = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.024, 0.38), MATS.socammPcb());
  pcbCard.position.y = 0.040;
  pcbCard.castShadow = true;
  cardG.add(pcbCard);

  // 4x Physical Raised Black BGA LPDDR5X DRAM IC Packages on the card face!
  const dramMat = MATS.dramPackage();
  [-0.21, -0.07, 0.07, 0.21].forEach((dx) => {
    const ic = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.024, 0.21), dramMat);
    ic.position.set(dx, 0.064, -0.01);
    // Tiny metallic laser-etched label strip on each DRAM chip
    const mark = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.004, 0.04), MATS.anodizedSilver());
    mark.position.set(dx, 0.078, -0.01);
    cardG.add(ic, mark);
  });

  // Anodized cyan-blue edge stiffening bar + 2 silver compression mounting screws
  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.014, 0.026), MATS.coolCold());
  rail.position.set(0, 0.056, -0.175);
  cardG.add(rail);

  [-0.28, 0.28].forEach((sx) => {
    const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.048, 10), MATS.stainless());
    screw.position.set(sx, 0.052, 0.145);
    cardG.add(screw);
  });

  return cardG;
}

[-0.94, 0.94].forEach((sz) => {
  [-0.36, 0.36].forEach((sx) => {
    veraCenterGroup.add(buildSocammCard(sx, sz));
  });
});
registerPart(veraCenterGroup, 'sil_vera_cpu');

// Twin High-Speed NVLink-C2C Trace Buses (Rubin GPU A <-> Vera CPU <-> Rubin GPU B) + Animated Pulses
const c2cBusMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xb45309, emissiveIntensity: 0.72, roughness: 0.25, metalness: 0.7 });
[-0.91, +0.91].forEach((cx) => {
  for (let lane = -2; lane <= 2; lane++) {
    const trace = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.016, 0.052), c2cBusMat);
    trace.position.set(cx, -0.008, lane * 0.13);
    siliconStage.add(trace);
  }
});

const silPulseGroup = new THREE.Group();
siliconStage.add(silPulseGroup);
[
  new THREE.LineCurve3(new THREE.Vector3(-1.35, 0.07, 0), new THREE.Vector3(-0.55, 0.07, 0)),
  new THREE.LineCurve3(new THREE.Vector3(0.55, 0.07, 0), new THREE.Vector3(1.35, 0.07, 0)),
].forEach((curve, idx) => {
  for (let k = 0; k < 2; k++) {
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.048, 10, 10), new THREE.MeshBasicMaterial({ color: k === 0 ? 0xd4ff66 : 0xf59e0b }));
    silPulseGroup.add(dot);
    silPulses.push({ curve, mesh: dot, phase: (idx * 0.35 + k * 0.5) % 1, speed: k === 0 ? 1.0 : -1.0 });
  }
});

// =============================================================================
// 6. SEAMLESS CROSS-DISSOLVE DIVE-ZOOM (BLADE GPU -> TIER 4 SILICON)
// =============================================================================
const gpuFocusFrameMat = new THREE.LineBasicMaterial({ color: 0xd4ff66, transparent: true, opacity: 0.0 });
const gpuFocusFrame = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(0.24, 0.06, 0.28)),
  gpuFocusFrameMat
);
gpuFocusFrame.visible = false;
scene.add(gpuFocusFrame);

const GPU_A_LOCAL = new THREE.Vector3(-2.30, 0.025, 0.0);
const GPU_A_HERO_WORLD = SIL_HERO_POS.clone().add(GPU_A_LOCAL);

const diveZoom = {
  active: false,
  t: 1,
  duration: 2.35,
  fromTour: false,
  matchScale: 0.195 / 2.38,
  gpuTrayLocal: new THREE.Vector3(-0.375, 3.16, 1.74),
  camStartPos: new THREE.Vector3(),
  camStartTgt: new THREE.Vector3(),
  camMidPos: new THREE.Vector3(),
  camMidTgt: new THREE.Vector3(),
  camEndPos: new THREE.Vector3(),
  camEndTgt: new THREE.Vector3(),
  relEndPos: new THREE.Vector3(),
  relEndTgt: new THREE.Vector3(),
};

let rackFadeSaved = [];
function saveRackMats() {
  restoreRackMats();
  const seen = new Set();
  rackRoot.traverse((o) => {
    if (o.material) {
      const list = Array.isArray(o.material) ? o.material : [o.material];
      list.forEach((m) => {
        if (!seen.has(m)) {
          seen.add(m);
          rackFadeSaved.push({ m, op: m.opacity, tr: m.transparent, dw: m.depthWrite });
        }
      });
    }
  });
}
function setRackFade(alpha) {
  const a = THREE.MathUtils.clamp(alpha, 0, 1);
  rackFadeSaved.forEach((s) => {
    if (a >= 0.995) {
      s.m.opacity = s.op; s.m.transparent = s.tr; s.m.depthWrite = s.dw;
    } else {
      if (!s.m.transparent) { s.m.transparent = true; s.m.needsUpdate = true; }
      s.m.opacity = s.op * a;
      s.m.depthWrite = a > 0.82 ? s.dw : false;
    }
  });
}
function restoreRackMats() {
  rackFadeSaved.forEach((s) => {
    if (s.m.transparent !== s.tr) { s.m.transparent = s.tr; s.m.needsUpdate = true; }
    s.m.opacity = s.op;
    s.m.depthWrite = s.dw;
  });
  rackFadeSaved = [];
}

const silFadeMats = [];
(function cacheSilMats() {
  const seen = new Set();
  siliconStage.traverse((o) => {
    if (o.material) {
      const list = Array.isArray(o.material) ? o.material : [o.material];
      list.forEach((m) => {
        if (!seen.has(m)) {
          seen.add(m);
          silFadeMats.push({ m, op: m.opacity, tr: m.transparent, dw: m.depthWrite });
        }
      });
    }
  });
})();
function setSilFade(alpha) {
  const a = THREE.MathUtils.clamp(alpha, 0, 1);
  silFadeMats.forEach((s) => {
    if (a >= 0.995) {
      if (s.m.transparent !== s.tr) { s.m.transparent = s.tr; s.m.needsUpdate = true; }
      s.m.opacity = s.op; s.m.depthWrite = s.dw;
    } else {
      if (!s.m.transparent) { s.m.transparent = true; s.m.needsUpdate = true; }
      s.m.opacity = s.op * a;
      s.m.depthWrite = a > 0.78 ? s.dw : false;
    }
  });
}

function cancelDiveZoom() {
  restoreRackMats();
  setSilFade(1.0);
  diveZoom.active = false;
  diveZoom.t = 1;
  gpuFocusFrame.visible = false;
  rackRoot.position.set(0, 0, 0);
  rackRoot.scale.setScalar(1.0);
  siliconStage.position.copy(SIL_HERO_POS);
  siliconStage.scale.setScalar(1.0);
}

function triggerDiveZoom(fromTour) {
  cancelDiveZoom();
  rackRoot.visible = true;
  rackRoot.position.set(0, 0, 0);
  rackRoot.scale.setScalar(1.0);
  rackRoot.rotation.y = 0;

  // Ensure the 1U compute tray is cleanly pulled out so its Rubin GPU is unobstructed for 1:1 overlap zoom!
  rackModules.forEach((m) => {
    if (m.isHeroCompute) {
      if (m.mesh.scale.x < 1.1) {
        m.mesh.position.set(m.basePos.x, m.basePos.y, m.basePos.z + 1.66);
      }
      m.mesh.visible = true;
      if (m.bodyMat) { m.bodyMat.opacity = 1.0; m.bodyMat.depthWrite = true; }
    } else if (m.isHeroSwitch) {
      // Return switch tray into rack cleanly if transitioning from Ch. 6
      m.mesh.position.copy(m.basePos);
      m.mesh.scale.setScalar(1.0);
      if (m.bodyMat) { m.bodyMat.opacity = 0.16; m.bodyMat.depthWrite = false; }
    } else if (m.bodyMat) {
      m.bodyMat.opacity = 0.16;
      m.bodyMat.depthWrite = false;
    }
  });
  sideSkinMat.opacity = 0.10;
  sideSkinMat.depthWrite = false;

  rackRoot.updateMatrixWorld(true);
  const trayScale = heroComputeTray ? heroComputeTray.scale.x : 1.0;
  // Exact physical width ratio: blade Rubin GPU substrate (0.195 * trayScale) / Tier 4 Rubin GPU A substrate (2.38)
  diveZoom.matchScale = (0.195 * trayScale) / 2.38;

  if (heroComputeGpu) heroComputeGpu.getWorldPosition(diveZoom.gpuTrayLocal);
  else diveZoom.gpuTrayLocal.set(-0.375, 3.16, 1.74);

  saveRackMats();
  diveZoom.camStartPos.copy(camera.position);
  diveZoom.camStartTgt.copy(controls.target);

  // Compute exact final Tier 4 camera pose (matching Ch. 7's initial sweep angle for zero handoff hitch!)
  diveZoom.camEndPos.copy(camGoal.pos);
  diveZoom.camEndTgt.copy(camGoal.target);
  if (fromTour && camGoal.sweep !== 0) {
    const startAngle = -0.5 * camGoal.sweep;
    const off = diveZoom.camEndPos.clone().sub(diveZoom.camEndTgt).applyAxisAngle(yAxis, startAngle);
    diveZoom.camEndPos.copy(diveZoom.camEndTgt).add(off);
  }

  // Relative camera offset from GPU A in Tier 4 hero space -> scaled down to match the tray GPU identically!
  diveZoom.relEndPos.copy(diveZoom.camEndPos).sub(GPU_A_HERO_WORLD);
  diveZoom.relEndTgt.copy(diveZoom.camEndTgt).sub(GPU_A_HERO_WORLD);

  // Midpoint close-up right over the Rubin GPU on the 1U compute tray (2.1x scaled hero angle)
  const midFactor = diveZoom.matchScale * 2.1;
  diveZoom.camMidPos.copy(diveZoom.gpuTrayLocal).addScaledVector(diveZoom.relEndPos, midFactor);
  diveZoom.camMidTgt.copy(diveZoom.gpuTrayLocal).addScaledVector(diveZoom.relEndTgt, midFactor);

  diveZoom.active = true;
  diveZoom.t = 0;
  diveZoom.fromTour = fromTour;

  // Snap reticle directly onto the blade's Rubin GPU
  gpuFocusFrame.position.copy(diveZoom.gpuTrayLocal);
  gpuFocusFrame.scale.setScalar(trayScale);
  gpuFocusFrame.visible = true;
  gpuFocusFrameMat.opacity = 0.92;

  // Superimpose Tier 4 siliconStage so GPU A occupies the EXACT same 3D space & scale as heroComputeGpu!
  siliconStage.visible = false;
  siliconStage.rotation.y = 0;
  siliconStage.scale.setScalar(diveZoom.matchScale);
  siliconStage.position.copy(diveZoom.gpuTrayLocal).addScaledVector(GPU_A_LOCAL, -diveZoom.matchScale);
  setSilFade(0.0);
}

// =============================================================================
// 7. VIEW-AWARE 3D CALLOUT PINS
// =============================================================================
let activePins = [];
function rebuildPins() {
  activePins.forEach((p) => p.el.remove());
  activePins = [];
  if (!state.showPins) return;
  const zh = state.locale === 'zh';
  let defs = [];

  if (state.tier === 'rack') {
    defs = [
      { pos: [0.68, 3.36, 0.66], color: '#76b900', side: 'front', attachObj: rackRoot, attachToRack: true, partId: 'compute_upper',
        text: zh ? '上层 10× 1U 计算托盘（40 GPU）' : '10× 1U Upper Compute (40 GPUs)', short: zh ? '上10托盘' : '10× Upper' },
      { pos: [-0.68, 2.36, 0.62], color: '#f59e0b', side: 'front', attachObj: rackRoot, attachToRack: true, partId: 'switch_bank',
        text: zh ? '中部 9× NVLink 6 交换机' : '9× Central NVLink 6 Switches', short: zh ? '9× 交换机' : '9× Switches' },
      { pos: [0.68, 1.48, 0.66], color: '#76b900', side: 'front', attachObj: rackRoot, attachToRack: true, partId: 'compute_lower',
        text: zh ? '下层 8× 1U 计算托盘（总计 72 GPU）' : '8× 1U Lower Trays (72 Total)', short: zh ? '下8托盘' : '8× Lower' },
      { pos: [-0.62, 4.10, 0.56], color: '#38bdf8', side: 'front', attachObj: rackRoot, attachToRack: true, partId: 'power_shelves',
        text: zh ? 'HVDC 电源与 BBU（~230 kW*）' : 'HVDC Power & BBU (~230 kW*)', short: zh ? '电源 ~230 kW*' : '~230 kW*' },
      { pos: [0.0, 2.45, -1.08], color: '#a8e03a', side: 'rear', attachObj: rackRoot, attachToRack: true, partId: 'rear_spine',
        text: zh ? '无线缆盲插背板（260 TB/s）' : 'Cable-Free Cartridge Spine (260 TB/s)', short: zh ? '260 TB/s 盲插背板' : '260 TB/s Spine' },
      { pos: [-0.72, 3.45, -0.84], color: '#22d3ee', side: 'rear', attachObj: rackRoot, attachToRack: true, partId: 'coolant_manifolds',
        text: zh ? '冷液供应歧管（左 · 进液）' : 'Cold Supply Manifold (Left)', short: zh ? '冷液进' : 'Cold Supply' },
      { pos: [0.72, 1.65, -0.84], color: '#fb7185', side: 'rear', attachObj: rackRoot, attachToRack: true, partId: 'coolant_manifolds',
        text: zh ? '热液回流歧管（右 · 排热）' : 'Warm Return Manifold (Right)', short: zh ? '热液出' : 'Warm Return' },
    ];
  } else if (state.tier === 'compute_tray') {
    defs = [
      { pos: [-0.26, 0.11, -0.27], color: '#84cc16', side: 'any', attachObj: heroComputeTray, partId: 'tray_vera_cpu',
        text: zh ? '2× Vera CPU（88核/176线程）' : '2× Vera CPUs (88C/176T)', short: zh ? '2× Vera 处理器' : '2× Vera CPU' },
      { pos: [0.40, 0.09, -0.27], color: '#38bdf8', side: 'any', attachObj: heroComputeTray, partId: 'tray_socamm',
        text: zh ? '8× SOCAMM 内存卡（3 TB/层）' : '8× SOCAMM Cards (3 TB/Tray)', short: zh ? 'SOCAMM 内存' : 'SOCAMM 3 TB' },
      { pos: [-0.145, 0.09, 0.08], color: '#76b900', side: 'any', attachObj: heroComputeTray, partId: 'tray_rubin_gpu',
        text: zh ? '4× Rubin GPU（点击钻入芯片）' : '4× Rubin GPUs (Click to Dive-Zoom)', short: zh ? '4× Rubin GPU' : '4× Rubin GPUs' },
      { pos: [0.28, 0.13, 0.08], color: '#22d3ee', side: 'any', attachObj: heroComputeTray, partId: 'tray_coldplate',
        text: zh ? '铜微通道液冷冷板与管路' : 'Copper Cold Plates & Liquid Loops', short: zh ? '铜液冷板' : 'Cold Plates' },
      { pos: [0.0, 0.08, 0.48], color: '#a855f7', side: 'any', attachObj: heroComputeTray, partId: 'tray_nic',
        text: zh ? '4× ConnectX-9（1,600G OSFP）' : '4× ConnectX-9 (1,600G OSFP)', short: zh ? 'ConnectX-9 网卡' : 'ConnectX-9' },
    ];
  } else if (state.tier === 'switch_tray') {
    defs = [
      { pos: [-0.25, 0.11, -0.04], color: '#f59e0b', side: 'any', attachObj: heroSwitchTray, partId: 'switch_asic',
        text: zh ? '双颗液冷 NVLink 6 交换芯片' : 'Dual Liquid-Cooled NVLink 6 ASICs', short: zh ? 'NVLink 6 芯片' : 'NVLink 6 ASIC' },
      { pos: [0.25, 0.11, -0.10], color: '#22d3ee', side: 'any', attachObj: heroSwitchTray, partId: 'coolant_manifolds',
        text: zh ? '交换芯片直接液冷回路' : 'Switch Direct Liquid Loop', short: zh ? '液冷回路' : 'Liquid Loop' },
      { pos: [0.0, 0.09, -0.68], color: '#a8e03a', side: 'any', attachObj: heroSwitchTray, partId: 'rear_spine',
        text: zh ? '后置盲插脊柱接口（260 TB/s）' : 'Rear Blind-Mate Spine Plugs (260 TB/s)', short: zh ? '盲插背板接口' : 'Blind-Mate' },
    ];
  } else if (state.tier === 'silicon') {
    defs = [
      // Clean summary pin on GPU A when assembled or zoomed out (matches GPU B symmetrically!)
      { pos: [0.0, 0.22, 0.0], color: '#76b900', side: 'any', attachObj: gpuTwinA.cpAssembly, partId: 'sil_compute_dies', visMode: 'collapsed',
        text: zh ? 'Rubin GPU A（双生芯片 · 3nm + HBM4）' : 'Rubin GPU A (Twin · 3nm + HBM4)', short: zh ? 'GPU A（双生）' : 'GPU A (Twin)' },
      // Internal layer callouts — shown ONLY when GPU A is exploded & viewed up close (cleared on collapse / zoom-out!)
      { pos: [0.0, 0.14, -0.06], color: '#76b900', side: 'any', attachObj: gpuTwinA.diesGroup, partId: 'sil_compute_dies', visMode: 'exploded',
        text: zh ? 'Rubin GPU A：双 3nm N3P 芯粒（3360亿）' : 'Rubin GPU A: Dual 3nm N3P Dies (336B)', short: zh ? 'GPU A · 3nm 双芯' : 'GPU A · 3nm' },
      { pos: [-0.95, 0.22, -0.05], color: '#22d3ee', side: 'any', attachObj: gpuTwinA.hbmGroup, partId: 'sil_hbm4', visMode: 'exploded',
        text: zh ? '8× 12-Hi 层叠 HBM4（288 GB · 22 TB/s）' : '8× 12-Hi HBM4 Stacks (288 GB · 22 TB/s)', short: zh ? '12 层 HBM4' : '12-Hi HBM4' },
      { pos: [0.0, 0.12, 0.68], color: '#f59e0b', side: 'any', attachObj: gpuTwinA.ioGroup, partId: 'sil_io_chiplets', visMode: 'exploded',
        text: zh ? '独立 I/O 芯粒（NVLink 6）' : 'Dedicated I/O Chiplets (NVLink 6)', short: zh ? 'I/O 芯粒' : 'I/O Chiplets' },
      { pos: [0.0, 0.18, -0.35], color: '#d48042', side: 'any', attachObj: gpuTwinA.cpAssembly, partId: 'sil_coldplate', visMode: 'exploded',
        text: zh ? '铜微通道液冷冷板（1,800 W）' : 'Copper Micro-Channel Cold Plate', short: zh ? '铜液冷板' : 'Cold Plate' },
      { pos: [0.0, 0.30, 0.0], color: '#84cc16', side: 'any', attachObj: veraCenterGroup, partId: 'sil_vera_cpu',
        text: zh ? 'Vera 88核 CPU + 4 张 SOCAMM 内存卡' : 'Vera 88C CPU + 4× SOCAMM Cards', short: zh ? 'Vera + SOCAMM 内存' : 'Vera + SOCAMM' },
      { pos: [0.0, 0.22, 0.0], color: '#a8e03a', side: 'any', attachObj: gpuTwinB.cpAssembly, partId: 'sil_compute_dies',
        text: state.explodeMode === 'both'
          ? (zh ? 'Rubin GPU B（同步展开双生芯片）' : 'Rubin GPU B (Exploded Twin)')
          : (zh ? 'Rubin GPU B（同尺寸整装双生芯片）' : 'Rubin GPU B (Assembled Twin)'),
        short: state.explodeMode === 'both'
          ? (zh ? 'GPU B（展开）' : 'GPU B (Exp.)')
          : (zh ? 'GPU B（双生）' : 'GPU B (Twin)') },
    ];
  }

  defs.forEach((d) => {
    const el = document.createElement('div');
    el.className = 'callout-pin' + (state.selectedPart === d.partId ? ' selected' : '');
    el.innerHTML = `<span class="callout-dot" style="background:${d.color};color:${d.color}"></span><span class="pin-full">${d.text}</span><span class="pin-short">${d.short || d.text}</span>`;
    el.addEventListener('click', (ev) => {
      ev.stopPropagation();
      if (state.playing) pauseTour();
      selectPart(d.partId);
    });
    overlayLayer.appendChild(el);
    activePins.push({
      el,
      anchor: new THREE.Vector3(...d.pos),
      side: d.side,
      attachObj: d.attachObj || null,
      attachToRack: !!d.attachToRack,
      visMode: d.visMode || 'always',
    });
  });
}

// =============================================================================
// 8. CAMERA PRESETS, INSPECTOR & SCENE SYNC
// =============================================================================
const camGoal = {
  pos: new THREE.Vector3(4.2, 4.25, 7.9),
  target: new THREE.Vector3(0, 2.38, 0),
  basePos: new THREE.Vector3(4.2, 4.25, 7.9),
  baseTarget: new THREE.Vector3(0, 2.38, 0),
  holisticPos: null,
  holisticTarget: null,
  panRange: null,
  panEnd: 0.65,
  active: false,
  sweep: 0,
};

controls.addEventListener('start', () => {
  camGoal.active = false;
  if (diveZoom.active) {
    cancelDiveZoom();
    rackRoot.visible = (state.tier !== 'silicon');
    siliconStage.visible = (state.tier === 'silicon');
  }
  if (state.playing) pauseTour();
});

function setCameraForCurrentState(ch = null) {
  const narrow = isNarrow();
  if (ch) {
    const c = ch.cam(narrow);
    camGoal.basePos.set(...c.pos);
    camGoal.baseTarget.set(...c.target);
    camGoal.sweep = ch.sweep || 0;

    if (ch.panRange && ch.holistic) {
      camGoal.panRange = ch.panRange(narrow);
      camGoal.panEnd = ch.panEnd || 0.64;
      const hol = ch.holistic(narrow);
      const holZ = fitZForHalfWidth(hol.halfW, hol.minZ);
      camGoal.holisticPos = new THREE.Vector3(hol.targetX || 0, hol.posY, holZ);
      camGoal.holisticTarget = new THREE.Vector3(hol.targetX || 0, hol.targetY, camGoal.baseTarget.z);

      if (state.playing) {
        const x0 = camGoal.panRange[0];
        camGoal.pos.set(camGoal.basePos.x + x0, camGoal.basePos.y, camGoal.basePos.z);
        camGoal.target.set(camGoal.baseTarget.x + x0, camGoal.baseTarget.y, camGoal.baseTarget.z);
      } else {
        camGoal.pos.copy(camGoal.holisticPos);
        camGoal.target.copy(camGoal.holisticTarget);
      }
    } else {
      camGoal.panRange = null;
      camGoal.holisticPos = null;
      camGoal.holisticTarget = null;
      const lift = ch.explodeCamLift;
      const expF = lift ? state.explode : 0;
      camGoal.pos.set(
        camGoal.basePos.x,
        camGoal.basePos.y + (lift ? lift.posY * expF : 0),
        camGoal.basePos.z + (lift ? lift.posZ * expF : 0)
      );
      camGoal.target.set(
        camGoal.baseTarget.x,
        camGoal.baseTarget.y + (lift ? lift.targetY * expF : 0),
        camGoal.baseTarget.z
      );
    }
    camGoal.active = true;
    return;
  }

  camGoal.panRange = null;
  camGoal.holisticPos = null;
  camGoal.holisticTarget = null;
  camGoal.sweep = 0;

  if (state.tier === 'rack') {
    const z = fitZForHalfWidth(1.68, narrow ? 9.8 : 7.9);
    camGoal.pos.set(narrow ? 3.5 : 4.2, 4.25, z);
    camGoal.target.set(0, 2.38, 0);
  } else if (state.tier === 'compute_tray') {
    if (state.isolateBlade) {
      const z = fitZForHalfWidth(1.18, narrow ? 3.8 : 2.9);
      camGoal.pos.set(0.75, 2.45, z);
      camGoal.target.set(0, 0.35, 0.05);
    } else {
      const z = fitZForHalfWidth(1.32, narrow ? 5.25 : 4.35);
      camGoal.pos.set(narrow ? 0.65 : 1.15, narrow ? 6.45 : 5.75, z);
      camGoal.target.set(0, 3.16, 1.72);
    }
  } else if (state.tier === 'switch_tray') {
    if (state.isolateBlade) {
      const z = fitZForHalfWidth(1.18, narrow ? 3.8 : 2.9);
      camGoal.pos.set(-0.75, 2.45, z);
      camGoal.target.set(0, 0.35, 0.0);
    } else {
      const z = fitZForHalfWidth(1.32, narrow ? 5.05 : 4.15);
      camGoal.pos.set(narrow ? -0.7 : -1.2, narrow ? 5.45 : 4.85, z);
      camGoal.target.set(0, 2.34, 1.66);
    }
  } else if (state.tier === 'silicon') {
    const z = fitZForHalfWidth(4.15, narrow ? 8.2 : 6.9);
    camGoal.pos.set(0.0, narrow ? 5.4 : 4.65, z);
    camGoal.target.set(0.0, 1.92, 0.15);
  }
  camGoal.basePos.copy(camGoal.pos);
  camGoal.baseTarget.copy(camGoal.target);
  camGoal.active = true;
}

function renderInspector() {
  const card = document.getElementById('inspector-card');
  const stateVal = document.getElementById('insp-state-val');
  const zh = state.locale === 'zh';

  if (!state.selectedPart || !PARTS[state.selectedPart]) {
    card.className = 'inspector-card empty';
    card.textContent = tr('inspHint');
    stateVal.textContent = zh ? '点击 3D 部件' : 'Click 3D Part';
    selHighlight.visible = false;
    return;
  }

  const p = PARTS[state.selectedPart];
  stateVal.textContent = state.isolatePart ? (zh ? '已独立高亮' : 'Isolated') : (zh ? '已选中' : 'Selected');
  card.className = 'inspector-card';
  const metricsList = (zh && p.metrics_zh) ? p.metrics_zh : p.metrics;
  const metricsHtml = metricsList.map(([k, v]) => `<div class="insp-m"><div class="k">${k}</div><div class="v">${v}</div></div>`).join('');
  const drillBtn = p.drillTier
    ? `<button class="hud-btn primary" id="btn-insp-drill">${zh ? p.drillLabel_zh : p.drillLabel}</button>`
    : '';

  card.innerHTML = `
    <div>
      <div class="insp-title">${zh ? p.name_zh : p.name}</div>
      <div class="insp-sub">${zh ? p.sub_zh : p.sub}</div>
    </div>
    <div class="insp-desc">${zh ? p.desc_zh : p.desc}</div>
    <div class="insp-metrics">${metricsHtml}</div>
    <div class="insp-actions">
      ${drillBtn}
      <button class="hud-btn" id="btn-insp-iso">${state.isolatePart ? tr('btnUnisolatePart') : tr('btnIsolatePart')}</button>
      <button class="hud-btn" id="btn-insp-clear">${tr('btnClearSel')}</button>
    </div>
  `;

  const bDrill = document.getElementById('btn-insp-drill');
  if (bDrill) {
    bDrill.addEventListener('click', () => {
      if (state.playing) pauseTour();
      const prevTier = state.tier;
      state.tier = p.drillTier;
      state.isolatePart = false;
      if (state.tier === 'silicon' && state.explode < 0.45) state.explode = 0.72;
      syncUIAndScene(true);
      if (state.tier === 'silicon' && (prevTier === 'rack' || prevTier === 'compute_tray')) {
        triggerDiveZoom(false);
      }
    });
  }
  document.getElementById('btn-insp-iso').addEventListener('click', () => {
    state.isolatePart = !state.isolatePart;
    syncUIAndScene(false);
  });
  document.getElementById('btn-insp-clear').addEventListener('click', () => {
    state.selectedPart = null;
    state.isolatePart = false;
    syncUIAndScene(false);
  });
}

function selectPart(partId) {
  state.selectedPart = partId;
  syncUIAndScene(false);
}

let rackTargetRotY = 0;

function syncUIAndScene(reframe = false, chapter = null) {
  const zh = state.locale === 'zh';
  document.body.classList.toggle('mobile-capture', state.mobileSafe);
  document.body.classList.toggle('compact-pins', isNarrow());
  document.body.classList.toggle('hide-header-card', !state.showHeaderCard);
  document.getElementById('chk-mobile-safe').checked = state.mobileSafe;
  document.getElementById('chk-header-card').checked = state.showHeaderCard;
  document.getElementById('cap-text').classList.toggle('hidden-cap', !state.showCaption);

  document.querySelectorAll('#locale-btns .seg-btn').forEach(b => b.classList.toggle('active', b.dataset.locale === state.locale));
  document.querySelectorAll('.tier-btn').forEach(b => b.classList.toggle('active', b.dataset.tier === state.tier));
  document.querySelectorAll('#orient-btns .seg-btn').forEach(b => b.classList.toggle('active', (b.dataset.flip === '1') === state.rackFlipped));
  document.querySelectorAll('#explode-mode-btns .seg-btn').forEach(b => b.classList.toggle('active', b.dataset.emode === state.explodeMode));
  document.querySelectorAll('.ch-item').forEach((el, i) => el.classList.toggle('active', i === state.chapterIdx));

  const tierNums = zh
    ? { rack: '第 1/4 级', compute_tray: '第 2/4 级', switch_tray: '第 3/4 级', silicon: '第 4/4 级' }
    : { rack: 'Tier 1/4', compute_tray: 'Tier 2/4', switch_tray: 'Tier 3/4', silicon: 'Tier 4/4' };
  document.getElementById('tier-val').textContent = tierNums[state.tier];
  document.getElementById('orient-group').style.display = (state.tier === 'rack') ? 'flex' : 'none';
  document.getElementById('orient-val').textContent = state.rackFlipped ? tr('oRear') : tr('oFront');
  document.getElementById('isolate-blade-group').style.display = (state.tier === 'compute_tray' || state.tier === 'switch_tray') ? 'flex' : 'none';
  document.getElementById('explode-mode-group').style.display = (state.tier === 'silicon') ? 'flex' : 'none';
  document.getElementById('chk-isolate-blade').checked = state.isolateBlade;
  document.getElementById('explode-slider').value = Math.round(state.explode * 100);
  document.getElementById('explode-val').textContent = `${Math.round(state.explode * 100)}%`;
  document.getElementById('chk-nvlink-flow').checked = state.nvlinkFlow;
  document.getElementById('chk-thermal-flow').checked = state.thermalFlow;
  document.getElementById('chk-pins').checked = state.showPins;
  document.getElementById('chk-xray').checked = state.xray;
  document.getElementById('chk-bloom').checked = state.bloom;
  document.getElementById('chk-caption').checked = state.showCaption;
  document.getElementById('chk-orbit').checked = state.autoOrbit;

  // Flow Legend Strip
  const legItems = [];
  if (state.nvlinkFlow) legItems.push(`<span class="leg-item"><i class="leg-swatch" style="background:#a8e03a"></i>${tr('legNvlink')}</span>`);
  if (state.thermalFlow && state.tier !== 'silicon') {
    legItems.push(`<span class="leg-item"><i class="leg-swatch" style="background:#22d3ee"></i>${tr('legCold')}</span>`);
    legItems.push(`<span class="leg-item"><i class="leg-swatch" style="background:#fb7185"></i>${tr('legHot')}</span>`);
  }
  document.getElementById('flow-legend').innerHTML = legItems.join('');

  // Top Header Card Update
  const badgeEl = document.getElementById('stage-badge');
  const titleEl = document.getElementById('hdr-title');
  const capEl = document.getElementById('cap-text');
  const eyeEl = document.getElementById('cap-chapter');

  if (!state.playing) {
    eyeEl.textContent = zh ? 'VERA RUBIN NVL72 · 硬件孪生解剖' : 'VERA RUBIN NVL72 · HARDWARE ANATOMY';
    const tierBadges = {
      rack: zh ? '第 1 级 · 48U 整柜' : 'Tier 1 · 48U Rack',
      compute_tray: zh ? '第 2 级 · 1U 计算托盘' : 'Tier 2 · 1U Compute Tray',
      switch_tray: zh ? '第 3 级 · NVLink 6 交换机' : 'Tier 3 · NVLink 6 Switch',
      silicon: zh ? '第 4 级 · 1:2 双生超级芯片' : 'Tier 4 · 1:2 Twin Superchip',
    };
    badgeEl.textContent = tierBadges[state.tier];

    if (state.selectedPart && PARTS[state.selectedPart]) {
      const p = PARTS[state.selectedPart];
      titleEl.textContent = zh ? p.name_zh : p.name;
      capEl.innerHTML = `<strong>${zh ? p.sub_zh : p.sub}:</strong> ${zh ? p.desc_zh : p.desc}`;
    } else if (state.tier === 'rack') {
      titleEl.textContent = zh ? 'Vera Rubin NVL72 — MGX v3 无线缆 48U 超级机柜' : 'Vera Rubin NVL72 — MGX v3 Cable-Free 48U Architecture';
      capEl.innerHTML = zh
        ? '点击任意子系统查看参数，旋转 <strong>180°</strong> 观察翠绿盲插背板，或点击 <strong>▶ 播放导览</strong> 观看 8 章节全自动解剖。'
        : 'Click any 3D subsystem to inspect specs, flip <strong>180°</strong> to inspect the cable-free cartridge spine, or press <strong>▶ Play Tour</strong> for the 8-chapter walkthrough.';
    } else if (state.tier === 'compute_tray') {
      titleEl.textContent = zh ? '1U 液冷计算托盘（4× Rubin GPU + 2× Vera CPU + 8× SOCAMM）' : '1U Liquid-Cooled Compute Tray (4× Rubin + 2× Vera + 8× SOCAMM)';
      capEl.innerHTML = zh
        ? '点击托盘中的 <strong>Rubin GPU</strong> 可一键无缝钻入第 4 级双生超级芯片，或在控制面板勾选「独立展示 1U 刀片」。'
        : 'Click any <strong>Rubin GPU</strong> on the blade to dive-zoom into Tier 4 silicon composites, or toggle <strong>Isolate 1U Blade</strong> for 360° macro inspection.';
    } else if (state.tier === 'switch_tray') {
      titleEl.textContent = zh ? '1U NVLink 6 液冷交换托盘（中部 9 层交换域）' : '1U NVLink 6 Liquid-Cooled Switch Tray (9× Central Bank)';
      capEl.innerHTML = zh
        ? '中部 9 层交换托盘通过后部翠绿盲插脊柱直连全部 18 层计算托盘，提供 <strong>260 TB/s</strong> 无阻塞互联域。'
        : 'Nine central switch blades blind-mate into the rear cartridge spine to link all 18 compute trays at <strong>260 TB/s</strong> unified NVLink 6 bandwidth.';
    } else {
      titleEl.textContent = zh ? 'Vera-Rubin 1:2 双生超级芯片（Rubin A · Vera + SOCAMM · Rubin B）' : 'Vera-Rubin 1:2 Twin Superchip (Rubin A · Vera + SOCAMM · Rubin B)';
      capEl.innerHTML = zh
        ? '拖动<strong>爆炸展开滑块</strong>拆解双 3nm 硅芯粒、12 层叠 HBM4、铜微通道冷板，并切换单芯对比或双芯同步展开。'
        : 'Drag <strong>Explode Separation</strong> to unpack the 3nm silicon dies, 12-Hi laminated HBM4 stacks, and copper cold plates—toggle single-twin comparison or symmetric explode.';
    }
  }

  // Visibility Across Tiers
  const inSilicon = (state.tier === 'silicon');
  const inCompute = (state.tier === 'compute_tray');
  const inSwitch = (state.tier === 'switch_tray');
  const hideRackForIso = (inCompute || inSwitch) && state.isolateBlade;

  if (!inSilicon) cancelDiveZoom();
  rackRoot.visible = !inSilicon;
  siliconStage.visible = inSilicon;
  rackFrameGroup.visible = !hideRackForIso;

  rackTargetRotY = (state.tier === 'rack' && state.rackFlipped) ? Math.PI : 0;

  const xrayOn = state.xray || ((inCompute || inSwitch) && !state.isolateBlade);
  sideSkinMat.opacity = xrayOn ? 0.10 : 0.84;
  sideSkinMat.depthWrite = !xrayOn;
  wireBox.material.opacity = xrayOn ? 0.68 : 0.28;

  rackModules.forEach((m) => {
    const isActiveHero = (inCompute && m.isHeroCompute) || (inSwitch && m.isHeroSwitch);
    m.mesh.visible = hideRackForIso ? isActiveHero : true;
    if (m.bodyMat) {
      let op = 1.0;
      if (state.isolatePart && state.selectedPart && m.partId !== state.selectedPart && !isActiveHero) {
        op = 0.12;
      } else if ((inCompute || inSwitch) && !isActiveHero) {
        op = 0.14;
      } else if (state.xray && !isActiveHero) {
        op = 0.22;
      }
      m.bodyMat.opacity = op;
      m.bodyMat.depthWrite = op >= 0.85;
    }
  });

  nvlinkFlowGroup.visible = state.nvlinkFlow && !hideRackForIso;
  thermalFlowGroup.visible = state.thermalFlow && !hideRackForIso;
  silPulseGroup.visible = state.nvlinkFlow && inSilicon;

  bloomPass.enabled = state.bloom;
  controls.autoRotate = state.autoOrbit && !state.playing;
  controls.autoRotateSpeed = 0.9;

  renderInspector();
  rebuildPins();
  if (reframe) setCameraForCurrentState(chapter);
}

// =============================================================================
// 9. GUIDED 8-CHAPTER TOUR ENGINE & LOCALE SWITCHER
// =============================================================================
function renderChapterHeader() {
  const ch = TOUR_CHAPTERS[state.chapterIdx];
  const zh = state.locale === 'zh';
  document.getElementById('stage-badge').textContent = zh ? ch.badge_zh : ch.badge;
  document.getElementById('hdr-title').textContent = zh ? ch.title_zh : ch.title;
  document.getElementById('cap-chapter').textContent = zh
    ? `第 ${state.chapterIdx + 1}/${TOUR_CHAPTERS.length} 章 · 导览中`
    : `CHAPTER ${state.chapterIdx + 1}/${TOUR_CHAPTERS.length} · GUIDED TOUR`;
  document.getElementById('cap-text').innerHTML = zh ? ch.caption_zh : ch.caption;
}

function applyChapter(idx, keepPlaying = state.playing) {
  const prevTier = state.tier;
  state.chapterIdx = (idx + TOUR_CHAPTERS.length) % TOUR_CHAPTERS.length;
  state.chapterElapsed = 0;
  const ch = TOUR_CHAPTERS[state.chapterIdx];

  cancelDiveZoom();
  state.tier = ch.tier;
  state.rackFlipped = ch.flip;
  state.isolateBlade = ch.isolateBlade;
  state.isolatePart = false;
  state.explodeMode = ch.explodeMode || 'left';
  state.explode = (!keepPlaying && ch.pausedExplode !== undefined) ? ch.pausedExplode : ch.explode;
  state.xray = ch.xray;
  state.nvlinkFlow = ch.nvlinkFlow;
  state.thermalFlow = ch.thermalFlow;
  state.showPins = ch.pins;
  state.selectedPart = ch.selectedPart;
  state.playing = keepPlaying;

  renderChapterHeader();
  syncUIAndScene(true, ch);

  if (ch.zoomFromBlade && keepPlaying && (prevTier === 'rack' || prevTier === 'compute_tray' || prevTier === 'switch_tray')) {
    triggerDiveZoom(true);
  }
  updatePlayButtons();
}

function updatePlayButtons() {
  const bTop = document.getElementById('btn-top-play');
  const bMain = document.getElementById('btn-play-main');
  const dot = document.getElementById('live-dot');
  if (state.playing) {
    bTop.textContent = tr('btnPauseTop'); bTop.classList.add('playing'); bTop.classList.remove('primary');
    bMain.textContent = tr('btnPauseMain'); bMain.classList.add('playing'); bMain.classList.remove('primary');
    dot.classList.add('rec');
    document.body.classList.add('recording-play');
  } else {
    bTop.textContent = tr('btnPlay'); bTop.classList.remove('playing'); bTop.classList.add('primary');
    bMain.textContent = tr('btnPlay'); bMain.classList.remove('playing'); bMain.classList.add('primary');
    dot.classList.remove('rec');
    document.body.classList.remove('recording-play');
  }
}

const titleSlideEl = document.getElementById('title-slide');
function updateTitleSlideVisual(alpha, liftPx = 0) {
  if (!titleSlideEl) return;
  const visible = alpha > 0.015;
  titleSlideEl.style.opacity = visible ? alpha.toFixed(3) : '0';
  titleSlideEl.style.visibility = visible ? 'visible' : 'hidden';
  titleSlideEl.style.transform = `translateY(${liftPx.toFixed(1)}px)`;
  document.body.classList.toggle('title-slide-active', alpha > 0.08);
}

function startTour(fromStart = false) {
  state.playing = true;
  if (state.autoHideOnPlay) togglePanel(true);
  applyChapter(fromStart ? 0 : state.chapterIdx, true);
}
function pauseTour() {
  state.playing = false;
  camGoal.sweep = 0;
  camGoal.panRange = null;
  updateTitleSlideVisual(0, 0);
  updatePlayButtons();
}

function rebuildChapterList() {
  const list = document.getElementById('chapter-list');
  list.innerHTML = '';
  const zh = state.locale === 'zh';
  TOUR_CHAPTERS.forEach((ch, i) => {
    const btn = document.createElement('button');
    btn.className = 'ch-item' + (i === state.chapterIdx ? ' active' : '');
    const lbl = (zh ? ch.title_zh : ch.title).replace(/^\d+\.\s*/, '');
    btn.innerHTML = `<span class="ch-num">0${i + 1}</span><span>${lbl}</span>`;
    btn.addEventListener('click', () => applyChapter(i, state.playing));
    list.appendChild(btn);
  });
}

function applyLocale(lang, persist = true) {
  state.locale = lang;
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  document.title = tr('pageTitle');
  if (persist) persistLang(lang);
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const v = tr(el.getAttribute('data-i18n'));
    if (typeof v === 'string') el.textContent = v;
  });
  document.querySelectorAll('[data-i18n-title]').forEach((el) => {
    const v = tr(el.getAttribute('data-i18n-title'));
    if (typeof v === 'string') el.title = v;
  });
  rebuildChapterList();
  updatePlayButtons();
  syncUIAndScene(false);
  if (state.playing) renderChapterHeader();
}

// =============================================================================
// 10. UI EVENT WIRING & RAYCAST CLICK-TO-INSPECT
// =============================================================================
const panelEl = document.getElementById('control-panel');
let panelAutoClosed = false;
function togglePanel(forceCollapse) {
  const collapsed = forceCollapse !== undefined ? forceCollapse : !panelEl.classList.contains('collapsed');
  panelEl.classList.toggle('collapsed', collapsed);
  panelAutoClosed = false;
  setTimeout(resizeRenderer, 280);
}
if (window.innerWidth <= 860) {
  panelEl.classList.add('collapsed');
  panelAutoClosed = true;
}

document.querySelectorAll('#locale-btns .seg-btn').forEach(b => b.addEventListener('click', () => applyLocale(b.dataset.locale, true)));

document.querySelectorAll('.tier-btn').forEach(b => b.addEventListener('click', () => {
  if (state.playing) pauseTour();
  const prevTier = state.tier;
  state.tier = b.dataset.tier;
  state.isolatePart = false;
  if (state.tier === 'silicon' && state.explode < 0.40) state.explode = 0.70;
  syncUIAndScene(true);
  if (state.tier === 'silicon' && (prevTier === 'rack' || prevTier === 'compute_tray')) {
    triggerDiveZoom(false);
  }
}));

document.querySelectorAll('#orient-btns .seg-btn').forEach(b => b.addEventListener('click', () => {
  if (state.playing) pauseTour();
  state.rackFlipped = (b.dataset.flip === '1');
  syncUIAndScene(false);
}));

document.querySelectorAll('#explode-mode-btns .seg-btn').forEach(b => b.addEventListener('click', () => {
  if (state.playing) pauseTour();
  state.explodeMode = b.dataset.emode;
  syncUIAndScene(false);
}));

document.getElementById('chk-isolate-blade').addEventListener('change', (e) => {
  if (state.playing) pauseTour();
  state.isolateBlade = e.target.checked;
  syncUIAndScene(true);
});

document.getElementById('explode-slider').addEventListener('input', (e) => {
  state.explode = Number(e.target.value) / 100;
  document.getElementById('explode-val').textContent = `${e.target.value}%`;
});

document.getElementById('chk-nvlink-flow').addEventListener('change', (e) => { state.nvlinkFlow = e.target.checked; syncUIAndScene(false); });
document.getElementById('chk-thermal-flow').addEventListener('change', (e) => { state.thermalFlow = e.target.checked; syncUIAndScene(false); });
document.getElementById('chk-pins').addEventListener('change', (e) => { state.showPins = e.target.checked; syncUIAndScene(false); });
document.getElementById('chk-xray').addEventListener('change', (e) => { state.xray = e.target.checked; syncUIAndScene(false); });
document.getElementById('chk-bloom').addEventListener('change', (e) => { state.bloom = e.target.checked; syncUIAndScene(false); });
document.getElementById('chk-header-card').addEventListener('change', (e) => { state.showHeaderCard = e.target.checked; syncUIAndScene(false); });
document.getElementById('chk-caption').addEventListener('change', (e) => { state.showCaption = e.target.checked; syncUIAndScene(false); });
document.getElementById('chk-orbit').addEventListener('change', (e) => { state.autoOrbit = e.target.checked; syncUIAndScene(false); });
document.getElementById('chk-autohide').addEventListener('change', (e) => { state.autoHideOnPlay = e.target.checked; });

let mobileSafeManual = false;
document.getElementById('chk-mobile-safe').addEventListener('change', (e) => {
  mobileSafeManual = true;
  state.mobileSafe = e.target.checked;
  syncUIAndScene(true);
  setTimeout(resizeRenderer, 270);
});

document.getElementById('btn-top-play').addEventListener('click', () => state.playing ? pauseTour() : startTour(false));
document.getElementById('btn-play-main').addEventListener('click', () => state.playing ? pauseTour() : startTour(false));
document.getElementById('btn-prev-ch').addEventListener('click', () => applyChapter(state.chapterIdx - 1, state.playing));
document.getElementById('btn-next-ch').addEventListener('click', () => applyChapter(state.chapterIdx + 1, state.playing));
document.getElementById('btn-restart-ch').addEventListener('click', () => startTour(true));

document.querySelectorAll('#speed-btns .seg-btn').forEach(b => b.addEventListener('click', () => {
  state.speed = Number(b.dataset.speed);
  document.getElementById('speed-val').textContent = `${state.speed.toFixed(2).replace(/0$/, '')}×`;
  document.querySelectorAll('#speed-btns .seg-btn').forEach(x => x.classList.toggle('active', x === b));
}));

document.getElementById('progress-track').addEventListener('click', (e) => {
  const rect = e.currentTarget.getBoundingClientRect();
  const frac = THREE.MathUtils.clamp((e.clientX - rect.left) / rect.width, 0, 0.999);
  applyChapter(Math.floor(frac * TOUR_CHAPTERS.length), state.playing);
});

document.getElementById('btn-reset-cam').addEventListener('click', () => setCameraForCurrentState());
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

window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  if (e.code === 'Space') { e.preventDefault(); state.playing ? pauseTour() : startTour(false); }
  else if (e.code === 'ArrowRight') { e.preventDefault(); applyChapter(state.chapterIdx + 1, state.playing); }
  else if (e.code === 'ArrowLeft') { e.preventDefault(); applyChapter(state.chapterIdx - 1, state.playing); }
  else if (e.key === 'h' || e.key === 'H') togglePanel();
  else if (e.key === 'f' || e.key === 'F') {
    if (state.tier === 'rack') {
      if (state.playing) pauseTour();
      state.rackFlipped = !state.rackFlipped;
      syncUIAndScene(false);
    }
  } else if (e.key === 'r' || e.key === 'R') startTour(true);
});

// Raycast Hover & Click-to-Inspect
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let downPos = { x: 0, y: 0 };
let lastHoverCheck = 0;

function getVisibleClickables() {
  return clickableMeshes.filter((m) => {
    let o = m;
    while (o) {
      if (!o.visible) return false;
      o = o.parent;
    }
    return true;
  });
}

renderer.domElement.addEventListener('pointermove', (e) => {
  const now = performance.now();
  if (now - lastHoverCheck < 50) return;
  lastHoverCheck = now;
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(getVisibleClickables(), false);
  container.classList.toggle('hover-part', hits.length > 0);
});

renderer.domElement.addEventListener('pointerdown', (e) => { downPos = { x: e.clientX, y: e.clientY }; });
renderer.domElement.addEventListener('pointerup', (e) => {
  if (Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y) > 6) return;
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(getVisibleClickables(), false);
  if (hits.length > 0 && hits[0].object.userData.partId) {
    if (state.playing) pauseTour();
    selectPart(hits[0].object.userData.partId);
  }
});

// =============================================================================
// 11. RESIZE OBSERVER & MAIN ANIMATION LOOP
// =============================================================================
let lastNarrow = isNarrow();
function resizeRenderer() {
  const w = Math.max(1, container.clientWidth || window.innerWidth);
  const h = Math.max(1, container.clientHeight || window.innerHeight);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(dpr);
  renderer.setSize(w, h, true);
  composer.setPixelRatio(dpr);
  composer.setSize(w, h);
  bloomPass.resolution.set(w, h);

  if (panelAutoClosed && window.innerWidth > 860 && !state.playing) {
    panelEl.classList.remove('collapsed');
    panelAutoClosed = false;
  }
  if (!mobileSafeManual) {
    const isMob = window.innerWidth <= 860;
    if (state.mobileSafe !== isMob) {
      state.mobileSafe = isMob;
      document.body.classList.toggle('mobile-capture', isMob);
      document.getElementById('chk-mobile-safe').checked = isMob;
    }
  }
  const nowNarrow = isNarrow();
  if (nowNarrow !== lastNarrow) {
    lastNarrow = nowNarrow;
    syncUIAndScene(true, state.playing ? TOUR_CHAPTERS[state.chapterIdx] : null);
  }
}
new ResizeObserver(resizeRenderer).observe(container);
window.addEventListener('resize', resizeRenderer);

const clock = new THREE.Clock();
const yAxis = new THREE.Vector3(0, 1, 0);
const projV = new THREE.Vector3();
const tmpAnchor = new THREE.Vector3();
const tmpNormal = new THREE.Vector3();
const tmpToCam = new THREE.Vector3();
const tmpSweep = new THREE.Vector3();
const tmpPanPos = new THREE.Vector3();
const tmpPanTgt = new THREE.Vector3();
const selBox = new THREE.Box3();
const tmpColorCold = new THREE.Color(0x22d3ee);
const tmpColorHot = new THREE.Color(0xfb7185);

// Smooth keyframe evaluator for animated explode/collapse choreography
function evalKeyframes(kf, frac) {
  if (!kf || !kf.length) return null;
  if (frac <= kf[0].at) return kf[0].val;
  for (let i = 0; i < kf.length - 1; i++) {
    const a = kf[i], b = kf[i + 1];
    if (frac <= b.at) {
      const span = Math.max(0.0001, b.at - a.at);
      const u = THREE.MathUtils.smoothstep((frac - a.at) / span, 0.0, 1.0);
      return THREE.MathUtils.lerp(a.val, b.val, u);
    }
  }
  return kf[kf.length - 1].val;
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.getElapsedTime();
  const w = container.clientWidth;
  const h = container.clientHeight;

  // Guided Tour Playback (Opening Title Slide + Animated GPU A Explode/Collapse + Pan -> Holistic Choreography)
  let titleSlideAlpha = 0.0;
  if (state.playing) {
    const ch = TOUR_CHAPTERS[state.chapterIdx];
    state.chapterElapsed += dt * state.speed;
    const chFrac = Math.min(1, state.chapterElapsed / ch.duration);
    document.getElementById('progress-fill').style.width = `${((state.chapterIdx + chFrac) / TOUR_CHAPTERS.length) * 100}%`;

    // Opening Presentation Title Frame (Slide 1 over the 48U rack at the start of Ch. 1)
    if (ch.titleSlide) {
      const endF = ch.titleSlideEnd || 0.42;
      const fadeIn = THREE.MathUtils.smoothstep(chFrac, 0.0, 0.07);
      const fadeOut = 1.0 - THREE.MathUtils.smoothstep(chFrac, endF - 0.10, endF);
      titleSlideAlpha = fadeIn * fadeOut;
      const liftPx = THREE.MathUtils.lerp(14, 0, fadeIn) - THREE.MathUtils.lerp(0, 12, 1 - fadeOut);
      updateTitleSlideVisual(titleSlideAlpha, liftPx);
    } else {
      updateTitleSlideVisual(0, 0);
    }

    // Drive animated explode / collapse keyframes (e.g. Ch. 7: 0% -> 84%, Ch. 8: 84% -> 0% on holistic zoom-out)
    if (ch.explodeKeyframes) {
      const nextExp = evalKeyframes(ch.explodeKeyframes, chFrac);
      if (nextExp !== null) {
        state.explode = nextExp;
        const pct = Math.round(nextExp * 100);
        document.getElementById('explode-slider').value = pct;
        document.getElementById('explode-val').textContent = `${pct}%`;
      }
    }

    const zoomEnd = (ch.zoomFromBlade && diveZoom.active) ? (ch.zoomEnd || 0.22) : 0;
    if (ch.zoomFromBlade && diveZoom.active && chFrac < zoomEnd) {
      // Driven by diveZoom below
    } else if (camGoal.panRange && camGoal.holisticPos) {
      const panStart = ch.zoomFromBlade ? (ch.zoomEnd || 0.22) : 0;
      const panEnd = camGoal.panEnd;
      if (chFrac < panEnd) {
        const pf = THREE.MathUtils.clamp((chFrac - panStart) / Math.max(0.05, panEnd - panStart), 0, 1);
        const u = THREE.MathUtils.smoothstep(pf, 0.04, 0.96);
        const panX = THREE.MathUtils.lerp(camGoal.panRange[0], camGoal.panRange[1], u);
        camGoal.pos.set(camGoal.basePos.x + panX, camGoal.basePos.y, camGoal.basePos.z);
        camGoal.target.set(camGoal.baseTarget.x + panX, camGoal.baseTarget.y, camGoal.baseTarget.z);
      } else {
        // Pull back smoothly in lockstep with GPU A collapsing (panEnd -> ~0.86)
        const v = THREE.MathUtils.smoothstep((chFrac - panEnd) / (1 - panEnd), 0.0, 0.68);
        const endX = camGoal.panRange[1];
        tmpPanPos.set(camGoal.basePos.x + endX, camGoal.basePos.y, camGoal.basePos.z);
        tmpPanTgt.set(camGoal.baseTarget.x + endX, camGoal.baseTarget.y, camGoal.baseTarget.z);
        camGoal.pos.lerpVectors(tmpPanPos, camGoal.holisticPos, v);
        camGoal.target.lerpVectors(tmpPanTgt, camGoal.holisticTarget, v);
      }
      camGoal.active = true;
    } else if (camGoal.sweep !== 0 || ch.explodeCamLift) {
      const lift = ch.explodeCamLift;
      const expFactor = lift ? state.explode : 0;
      tmpPanTgt.set(
        camGoal.baseTarget.x,
        camGoal.baseTarget.y + (lift ? lift.targetY * expFactor : 0),
        camGoal.baseTarget.z
      );
      tmpPanPos.set(
        camGoal.basePos.x,
        camGoal.basePos.y + (lift ? lift.posY * expFactor : 0),
        camGoal.basePos.z + (lift ? lift.posZ * expFactor : 0)
      );
      const sweepFrac = ch.zoomFromBlade ? THREE.MathUtils.clamp((chFrac - (ch.zoomEnd || 0.22)) / (1 - (ch.zoomEnd || 0.22)), 0, 1) : chFrac;
      const angle = (sweepFrac - 0.5) * camGoal.sweep;
      tmpSweep.copy(tmpPanPos).sub(tmpPanTgt).applyAxisAngle(yAxis, angle);
      camGoal.pos.copy(tmpPanTgt).add(tmpSweep);
      camGoal.target.copy(tmpPanTgt);
      camGoal.active = true;
    }

    if (state.chapterElapsed >= ch.duration) {
      if (state.chapterIdx < TOUR_CHAPTERS.length - 1) applyChapter(state.chapterIdx + 1, true);
      else { pauseTour(); document.getElementById('progress-fill').style.width = '100%'; }
    }
  }

  // Seamless 1:1 Overlapping Dive-Zoom:
  //   Phase 1 (u: 0 -> 0.42): Zoom smoothly onto the exact Rubin GPU on the pulled-out 1U compute tray
  //   Phase 2 (u: 0.42 -> 1.0): Lock heroComputeGpu & Tier-4 GPU A together in 3D space (exact same world center & size!)
  //            as both scale up smoothly to hero scale while the rest of the rack/blade dissolves away around the GPU!
  let zoomPinAlpha = 1.0;
  let zoomExplodeScale = 1.0;
  if (diveZoom.active) {
    if (diveZoom.fromTour && state.playing) {
      const ch = TOUR_CHAPTERS[state.chapterIdx];
      const frac = Math.min(1, state.chapterElapsed / ch.duration);
      diveZoom.t = THREE.MathUtils.clamp(frac / (ch.zoomEnd || 0.28), 0, 1);
    } else {
      diveZoom.t = Math.min(1, diveZoom.t + dt / diveZoom.duration);
    }
    const u = diveZoom.t;
    zoomPinAlpha = THREE.MathUtils.smoothstep(u, 0.82, 1.0);
    zoomExplodeScale = THREE.MathUtils.smoothstep(u, 0.85, 1.0);

    const splitU = 0.40;
    const m0 = diveZoom.matchScale;

    if (u < splitU) {
      const a = THREE.MathUtils.smoothstep(u, 0.0, splitU);
      // Rack & blade stay stationary while camera zooms tightly onto the Rubin GPU
      rackRoot.position.set(0, 0, 0);
      rackRoot.scale.setScalar(1.0);
      siliconStage.scale.setScalar(m0);
      siliconStage.position.copy(diveZoom.gpuTrayLocal).addScaledVector(GPU_A_LOCAL, -m0);
      siliconStage.rotation.y = 0;

      camGoal.pos.lerpVectors(diveZoom.camStartPos, diveZoom.camMidPos, a);
      camGoal.target.lerpVectors(diveZoom.camStartTgt, diveZoom.camMidTgt, a);

      gpuFocusFrame.visible = true;
      gpuFocusFrame.position.copy(diveZoom.gpuTrayLocal);
      gpuFocusFrameMat.opacity = 0.90 * (1.0 - THREE.MathUtils.smoothstep(u, 0.26, splitU));
    } else {
      gpuFocusFrame.visible = false;
      const p = THREE.MathUtils.smoothstep(u, splitU, 1.0);
      // Smooth exponential scale-up from matchScale -> 1.0 (constant perceptual zoom velocity!)
      const silScale = Math.pow(m0, 1.0 - p);
      const rackScale = silScale / m0;
      const gCur = tmpPanPos.lerpVectors(diveZoom.gpuTrayLocal, GPU_A_HERO_WORLD, p);

      // Lock BOTH rackRoot (heroComputeGpu) AND siliconStage (gpuTwinA) to the EXACT same world center gCur & size!
      siliconStage.scale.setScalar(silScale);
      siliconStage.position.copy(gCur).addScaledVector(GPU_A_LOCAL, -silScale);
      siliconStage.rotation.y = 0;

      rackRoot.scale.setScalar(rackScale);
      rackRoot.position.copy(gCur).addScaledVector(diveZoom.gpuTrayLocal, -rackScale);

      // Camera stays locked to gCur at continuously tightening relative offset (2.1x -> 1.0x)
      const camDistScale = silScale * THREE.MathUtils.lerp(2.1, 1.0, p);
      camGoal.pos.copy(gCur).addScaledVector(diveZoom.relEndPos, camDistScale);
      camGoal.target.copy(gCur).addScaledVector(diveZoom.relEndTgt, camDistScale);
    }

    // Apply camera directly during diveZoom so there is zero lag between camera & locked 3D overlap!
    camera.position.copy(camGoal.pos);
    controls.target.copy(camGoal.target);
    camGoal.active = false;

    // Cross-dissolve: rack & surrounding tray fade out (0.38 -> 0.78) while superimposed GPU A fades in (0.34 -> 0.70)
    if (u < 0.78) {
      rackRoot.visible = true;
      setRackFade(1.0 - THREE.MathUtils.smoothstep(u, 0.38, 0.78));
    } else {
      rackRoot.visible = false;
      restoreRackMats();
    }

    if (u > 0.34) {
      siliconStage.visible = true;
      setSilFade(THREE.MathUtils.smoothstep(u, 0.34, 0.70));
    } else {
      siliconStage.visible = false;
      setSilFade(0.0);
    }

    if (u >= 1.0) {
      rackRoot.visible = false;
      cancelDiveZoom();
      siliconStage.visible = (state.tier === 'silicon');
    }
  }

  // Smooth Camera Interpolation
  if (camGoal.active) {
    const rate = diveZoom.active ? 9.0 : 4.0;
    const lf = 1 - Math.exp(-rate * dt);
    camera.position.lerp(camGoal.pos, lf);
    controls.target.lerp(camGoal.target, lf);
    if (!state.playing && !diveZoom.active && camera.position.distanceTo(camGoal.pos) < 0.025) camGoal.active = false;
  }

  // Animate Rack Rotation & Blade Pull-Out / Explode
  const lerpF = 1 - Math.exp(-6.5 * dt);
  if (!diveZoom.active) {
    rackRoot.rotation.y = THREE.MathUtils.lerp(rackRoot.rotation.y, rackTargetRotY, 1 - Math.exp(-4.5 * dt));
    const inCompute = state.tier === 'compute_tray';
    const inSwitch = state.tier === 'switch_tray';
    rackModules.forEach((m) => {
      const isPulledHero = (inCompute && m.isHeroCompute) || (inSwitch && m.isHeroSwitch);
      let tx = m.basePos.x + m.explodeOff.x * state.explode;
      let ty = m.basePos.y + m.explodeOff.y * state.explode;
      let tz = m.basePos.z + m.explodeOff.z * state.explode;
      let tScale = 1.0;

      if (isPulledHero) {
        if (state.isolateBlade) {
          tx = 0; ty = 0.35; tz = 0; tScale = 1.55;
        } else {
          tz = m.basePos.z + 1.66 + m.explodeOff.z * state.explode * 0.2;
        }
      }
      m.mesh.position.x = THREE.MathUtils.lerp(m.mesh.position.x, tx, lerpF);
      m.mesh.position.y = THREE.MathUtils.lerp(m.mesh.position.y, ty, lerpF);
      m.mesh.position.z = THREE.MathUtils.lerp(m.mesh.position.z, tz, lerpF);
      m.mesh.scale.setScalar(THREE.MathUtils.lerp(m.mesh.scale.x, tScale, lerpF));
    });
  }

  // Animate NVLink 6 Data Pulses
  if (nvlinkFlowGroup.visible) {
    nvlinkParticles.forEach((p) => {
      let u = (t * p.speed + p.phase) % 1.0;
      if (u < 0) u += 1.0;
      p.curve.getPointAt(u, p.mesh.position);
    });
  }

  // Animate Liquid Cooling Thermal Flow
  if (thermalFlowGroup.visible) {
    thermalParticles.forEach((p) => {
      const u = (t * p.speed + p.phase) % 1.0;
      p.curve.getPointAt(u, p.mesh.position);
      if (p.colorGradient) p.mesh.material.color.lerpColors(tmpColorCold, tmpColorHot, u);
    });
  }

  // Animate Tier 4 Identical Twin Superchip Explode (strictly aligned & assembled during 1:1 dive-zoom!)
  if (siliconStage.visible) {
    const tgtRotY = diveZoom.active ? 0 : Math.sin(t * 0.30) * 0.04;
    siliconStage.rotation.y = diveZoom.active ? 0 : THREE.MathUtils.lerp(siliconStage.rotation.y, tgtRotY, 1 - Math.exp(-3.5 * dt));
    silExplodeParts.forEach((p) => {
      const activeExp = diveZoom.active ? 0 : ((p.twin === 'A' || state.explodeMode === 'both') ? state.explode : 0);
      const targetY = THREE.MathUtils.lerp(p.baseY, p.expY, activeExp);
      p.mesh.position.y = diveZoom.active ? p.baseY : THREE.MathUtils.lerp(p.mesh.position.y, targetY, lerpF);
    });
    if (silPulseGroup.visible) {
      silPulses.forEach((p) => {
        let u = (t * p.speed + p.phase) % 1.0;
        if (u < 0) u += 1.0;
        p.curve.getPointAt(u, p.mesh.position);
      });
    }
  }

  // Update Selection Highlight Box
  if (state.selectedPart && partGroups[state.selectedPart] && !diveZoom.active) {
    selBox.makeEmpty();
    let anyVis = false;
    partGroups[state.selectedPart].forEach((obj) => {
      let vis = true; let cur = obj;
      while (cur) { if (!cur.visible) { vis = false; break; } cur = cur.parent; }
      if (vis) { selBox.expandByObject(obj); anyVis = true; }
    });
    if (anyVis && !selBox.isEmpty()) {
      selBox.expandByScalar(0.03);
      selHighlight.box.copy(selBox);
      selHighlight.visible = true;
    } else {
      selHighlight.visible = false;
    }
  } else {
    selHighlight.visible = false;
  }

  // View-Aware 3D Callout Pins (true 3D world attachment + strict frustum & HUD culling — zero edge-sticking!)
  if (rackRoot.visible) rackRoot.updateMatrixWorld(false);
  if (siliconStage.visible) siliconStage.updateMatrixWorld(false);
  const hudCard = document.querySelector('.brand-card');
  const hudVisible = hudCard && state.showHeaderCard && !document.body.classList.contains('clean-capture');
  const hudBottom = hudVisible
    ? (hudCard.getBoundingClientRect().bottom - container.getBoundingClientRect().top + 10)
    : 12;
  const camDist = camera.position.distanceTo(controls.target);
  // Show GPU A's 4 internal layer labels ONLY when exploded & zoomed in; cross-fade cleanly to 1 summary pill on collapse or holistic zoom-out!
  const silDetailAlpha = THREE.MathUtils.smoothstep(state.explode, 0.24, 0.48)
    * (1.0 - THREE.MathUtils.smoothstep(camDist, 6.6, 8.0));

  activePins.forEach((p) => {
    tmpAnchor.copy(p.anchor);
    if (p.attachObj) {
      tmpAnchor.applyMatrix4(p.attachObj.matrixWorld);
    }

    let alpha = state.tier === 'silicon' ? zoomPinAlpha : 1.0;
    if (titleSlideAlpha > 0.01) {
      alpha *= (1.0 - THREE.MathUtils.smoothstep(titleSlideAlpha, 0.0, 0.45));
    }
    if (p.visMode === 'exploded') alpha *= silDetailAlpha;
    else if (p.visMode === 'collapsed') alpha *= (1.0 - silDetailAlpha);
    if (p.attachToRack && rackRoot.visible && (p.side === 'front' || p.side === 'rear')) {
      tmpNormal.set(0, 0, p.side === 'front' ? 1 : -1).applyAxisAngle(yAxis, rackRoot.rotation.y).normalize();
      tmpToCam.copy(camera.position).sub(tmpAnchor).normalize();
      alpha *= THREE.MathUtils.clamp((tmpNormal.dot(tmpToCam) - 0.12) / 0.28, 0, 1);
    }

    projV.copy(tmpAnchor).project(camera);

    // Hide cleanly when behind camera or outside the visible camera frustum
    const inDepth = projV.z > -1.0 && projV.z < 1.0;
    const edgeFadeX = 1.0 - THREE.MathUtils.smoothstep(Math.abs(projV.x), 0.78, 0.96);
    const edgeFadeY = 1.0 - THREE.MathUtils.smoothstep(Math.abs(projV.y), 0.78, 0.95);
    alpha *= edgeFadeX * edgeFadeY;

    const sx = (projV.x * 0.5 + 0.5) * w;
    const sy = (-projV.y * 0.5 + 0.5) * h;

    // Also fade out smoothly if a part scrolls behind the top header card
    const hudFade = THREE.MathUtils.smoothstep(sy, hudBottom - 16, hudBottom + 18);
    alpha *= hudFade;

    if (inDepth && alpha > 0.02) {
      p.el.style.left = `${sx}px`;
      p.el.style.top = `${sy}px`;
      p.el.style.opacity = alpha.toFixed(3);
      p.el.style.visibility = 'visible';
      p.el.style.pointerEvents = alpha > 0.35 ? 'auto' : 'none';
    } else {
      p.el.style.opacity = '0';
      p.el.style.visibility = 'hidden';
      p.el.style.pointerEvents = 'none';
    }
  });

  controls.update();
  if (state.bloom) composer.render();
  else renderer.render(scene, camera);
}

// =============================================================================
// 12. BOOT & URL DEEP-LINK (?ch=1..8, ?lang=zh)
// =============================================================================
resizeRenderer();
applyLocale(state.locale, false);

const startParams = new URLSearchParams(window.location.search);
const chParam = Number(startParams.get('ch'));
if (Number.isInteger(chParam) && chParam >= 1 && chParam <= TOUR_CHAPTERS.length) {
  applyChapter(chParam - 1, false);
} else {
  syncUIAndScene(true);
}

animate();
