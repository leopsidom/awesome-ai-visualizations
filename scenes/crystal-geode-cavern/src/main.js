import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import { createWorld } from "./world.js";
import { createPool } from "./pool.js";
import { createEnvironment } from "./lighting.js";
import { createPost } from "./post.js";
import { makeRng, seedLabel, randomSeed } from "./rng.js";
import { MINERALS } from "./minerals.js";

/**
 * Druse — the inside of a crystal-lined geode, lit through a crack in its roof.
 *
 * Built against the threejs-* skills in ../../threejs-skills/skills:
 * fundamentals (scene/camera/renderer/clock/resize/disposal), geometry
 * (icosphere displacement, vertex welding, merged primitives, instancing),
 * materials (physical PBR, transmission, clearcoat, iridescence), lighting
 * (a shadow-casting key, hemisphere fill, baked IBL), textures (canvas maps),
 * shaders (custom ShaderMaterials plus onBeforeCompile injection into a stock
 * material), postprocessing (EffectComposer, bloom, custom ShaderPass),
 * animation (a swept key light, damped camera), interaction (OrbitControls,
 * keyboard).
 */

const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------------------------------------------------------------- renderer --

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: "high-performance",
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// ------------------------------------------------------------------- scene --

const scene = new THREE.Scene();

// The only thing outside the rock is daylight, and the crack is the only place
// you can see it. Deliberately far above 1.0 in linear terms: the composer runs
// on a half-float target, so the opening stays genuinely blown out and feeds
// the bloom instead of clamping to a flat white patch.
scene.background = new THREE.Color().setRGB(3.2, 3.0, 2.7, THREE.LinearSRGBColorSpace);

const fogUniforms = {
  uFogColor: { value: new THREE.Color(0x0b0714) },
  uFogDensity: { value: 0.0072 },
};
scene.fog = new THREE.FogExp2(fogUniforms.uFogColor.value, fogUniforms.uFogDensity.value);

// Baked once. The cavity it describes is generic — dim rock with one bright
// patch overhead — so it survives a recut without needing to be regenerated.
const environment = createEnvironment(renderer);
scene.environment = environment.texture;
scene.environmentIntensity = 1.0;

const camera = new THREE.PerspectiveCamera(56, window.innerWidth / window.innerHeight, 0.1, 400);
camera.position.set(18, 4, 8);

// -------------------------------------------------------------------- world --

const params = new URLSearchParams(location.search);

let seed = Number.parseInt(params.get("seed") ?? "", 36);
if (!Number.isFinite(seed)) seed = randomSeed();

let mineralIndex = Number.parseInt(params.get("mineral") ?? "", 10);
if (!Number.isFinite(mineralIndex)) mineralIndex = Math.floor(Math.random() * MINERALS.length);

// The waterline never moves between cuts, so the pool is built once and
// outlives them — see the note in world.js for the leak this avoids.
const pool = createPool(mineralIndex, fogUniforms);
pool.setSize(window.innerWidth, window.innerHeight);
scene.add(pool.object);

let world = createWorld(scene, makeRng(seed), fogUniforms, mineralIndex, pool);
world.setViewportHeight(renderer.domElement.height);

const post = createPost(renderer, scene, camera);
post.setSize(window.innerWidth, window.innerHeight);

// --------------------------------------------------------------- camera rig --

/**
 * A closed loop through the cavity, rebuilt for every cut because it has to fit
 * *that* cut. Two constraints, applied in order:
 *
 *   - stay clear of the hero cluster, by pushing control points radially away
 *     from it;
 *   - stay clear of the wall, by asking the cavity field how far away the rock
 *     is in that exact direction and backing off far enough to clear the crust
 *     growing off it.
 *
 * Hard-coded radii cannot do this: the wall moves by ±5 units between seeds and
 * the cluster lands wherever the crack happens to point, so a loop tuned by eye
 * on one cavity flies through a crystal on the next.
 */
function makePath(cavity, focus) {
  const CLEARANCE = 14; // from the hero cluster
  const WALL_MARGIN = 10; // enough to clear the longest crust crystal
  const LOBES = 6;

  const points = [];
  const direction = new THREE.Vector3();

  for (let i = 0; i < LOBES; i++) {
    const angle = (i / LOBES) * Math.PI * 2;
    const radius = 19 + 4 * Math.sin(angle * 2 + 0.7);

    // Kept above the cluster: its tallest crystals reach a little over y = 0.
    const point = new THREE.Vector3(
      Math.cos(angle) * radius,
      5 + 8 * Math.sin(angle * 1.5 + 0.4),
      Math.sin(angle) * radius,
    );

    const dx = point.x - focus.x;
    const dz = point.z - focus.z;
    const distance = Math.hypot(dx, dz);
    if (distance < CLEARANCE) {
      const push = CLEARANCE / Math.max(distance, 0.001);
      point.x = focus.x + dx * push;
      point.z = focus.z + dz * push;
    }

    direction.copy(point).normalize();
    const room = cavity.radiusAt(direction) - WALL_MARGIN;
    if (point.length() > room) point.setLength(room);

    points.push(point);
  }

  return new THREE.CatmullRomCurve3(points, true, "catmullrom", 0.5);
}

let path = makePath(world.cavity, world.focus);

const lookTarget = new THREE.Vector3().copy(world.focus);
const desiredLook = new THREE.Vector3();
const pathPoint = new THREE.Vector3();

function updateCameraRig(time, delta) {
  const t = (time * 0.0062) % 1;

  path.getPointAt(t, pathPoint);
  // Gentle handheld drift so the dolly never feels rail-mounted.
  pathPoint.y += Math.sin(time * 0.19) * 1.3;
  pathPoint.x += Math.sin(time * 0.12) * 0.9;
  camera.position.copy(pathPoint);

  // Always roughly on the lit cluster, but never squarely — the wander is what
  // lets the beam and the far wall into the frame.
  desiredLook.copy(world.focus);
  desiredLook.y += 15 + Math.sin(time * 0.117) * 8;
  desiredLook.x += Math.sin(time * 0.11) * 4;
  desiredLook.z += Math.cos(time * 0.13) * 4;

  // Critically-damped-ish smoothing, frame-rate independent.
  lookTarget.lerp(desiredLook, 1 - Math.exp(-1.3 * delta));
  camera.lookAt(lookTarget);
}

// ----------------------------------------------------------------- controls --

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 2;
controls.maxDistance = 60;
controls.target.copy(world.focus);
controls.enabled = false;

// ----------------------------------------------------------------- overlay --

const ui = {
  root: document.getElementById("ui"),
  seed: document.getElementById("seed"),
  mineral: document.getElementById("mineral"),
  mode: document.getElementById("mode"),
  boot: document.getElementById("boot"),
};

let paused = false;
let orbiting = false;

function refreshStatus() {
  ui.seed.textContent = seedLabel(seed);
  ui.mineral.textContent = MINERALS[world.mineral].name;
  ui.mode.textContent = paused ? "paused" : orbiting ? "free orbit" : "auto drift";
}

/** Keep the address bar in step, so any cavity on screen can be linked to. */
function rememberInUrl() {
  const url = new URL(location.href);
  url.searchParams.set("seed", seed.toString(36));
  url.searchParams.set("mineral", String(world.mineral));
  history.replaceState(null, "", url);
}

function recut() {
  const mineral = world.mineral;
  world.dispose();

  seed = randomSeed();
  world = createWorld(scene, makeRng(seed), fogUniforms, mineral, pool);
  world.setViewportHeight(renderer.domElement.height);

  path = makePath(world.cavity, world.focus);
  controls.target.copy(world.focus);

  rememberInUrl();
  refreshStatus();
}

refreshStatus();
rememberInUrl();

// -------------------------------------------------------------------- input --

window.addEventListener("keydown", (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey) return;

  switch (event.code) {
    case "Space":
      event.preventDefault();
      paused = !paused;
      refreshStatus();
      break;

    case "KeyO":
      orbiting = !orbiting;
      controls.enabled = orbiting;
      if (orbiting) {
        controls.target.copy(lookTarget);
        controls.update();
      }
      refreshStatus();
      break;

    case "KeyB":
      post.toggleBloom();
      break;

    case "KeyC":
      world.nextMineral();
      rememberInUrl();
      refreshStatus();
      break;

    case "KeyR":
      recut();
      break;

    case "KeyH":
      ui.root.classList.toggle("hidden");
      break;
  }
});

// ------------------------------------------------------------------- resize --

function onResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height);
  post.setSize(width, height);
  pool.setSize(width, height);
  world.setViewportHeight(renderer.domElement.height);
}

window.addEventListener("resize", onResize);

// --------------------------------------------------------------------- loop --

const clock = new THREE.Clock();
const timeScale = REDUCED_MOTION ? 0.35 : 1;
let elapsed = 0;
let booted = false;

renderer.setAnimationLoop(() => {
  // Clamp so a backgrounded tab does not resume with a huge time step.
  const delta = Math.min(clock.getDelta(), 0.05) * timeScale;
  if (!paused) elapsed += delta;

  world.update(elapsed);

  if (orbiting) {
    controls.update();
  } else if (!paused) {
    updateCameraRig(elapsed, delta || 0.016);
  }

  post.render(elapsed);

  if (!booted) {
    booted = true;
    ui.boot.classList.add("gone");
    setTimeout(() => ui.boot.remove(), 1200);
  }
});

// ------------------------------------------------------------------ cleanup --

window.addEventListener("pagehide", () => {
  renderer.setAnimationLoop(null);
  world.dispose();
  pool.dispose();
  post.dispose();
  controls.dispose();
  environment.dispose();
  renderer.dispose();
});
