import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

import { createStage, HORIZON } from "./stage.js";
import { createWorld } from "./world.js";
import { createPost } from "./post.js";
import { makeRng, seedLabel, randomSeed } from "./rng.js";

/**
 * Ephemeris — a clockwork orrery.
 *
 * Built against the threejs-* skills in ../../threejs-skills/skills:
 * fundamentals (scene/camera/renderer/clock/resize/disposal, Object3D
 * hierarchy), geometry (Shape → ExtrudeGeometry gear teeth, LatheGeometry
 * turning, cap-mapped cylinders), materials (PBR metal/wood/glass, per-group
 * materials), textures (procedural CanvasTextures, colour space, anisotropy),
 * lighting (key + shadow map, hemisphere fill, image-based environment),
 * postprocessing (EffectComposer, bloom, custom ShaderPass, OutputPass),
 * animation (nested procedural rotation, damping), interaction (OrbitControls,
 * keys).
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
renderer.toneMappingExposure = 0.92;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// ------------------------------------------------------------------- scene --

const scene = new THREE.Scene();
// Matched to the backdrop's horizon stop, so the floor dissolves into the wall
// instead of ending on a visible edge.
scene.fog = new THREE.Fog(HORIZON, 34, 100);

const camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.1, 260);
camera.position.set(14, 8, 12);

// --------------------------------------------------------------- environment --

// Image-based lighting. Polished brass is almost entirely reflection, so without
// something to reflect it renders as flat orange no matter how many lamps are
// added — the studio box baked here is doing more work than any of the lights.
const pmrem = new THREE.PMREMGenerator(renderer);
const roomScene = new RoomEnvironment();
const environmentTarget = pmrem.fromScene(roomScene, 0.04);
scene.environment = environmentTarget.texture;
scene.environmentIntensity = 0.85;
disposeSceneContents(roomScene);
pmrem.dispose();

// --------------------------------------------------------------------- stage --

// A fixed seed: the room is not part of what gets recut.
const stage = createStage(makeRng(0x5ee5ed));
scene.add(stage.group);
stage.setViewportHeight(renderer.domElement.height);

// ----------------------------------------------------------------- controls --

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 6;
controls.maxDistance = 52;
controls.maxPolarAngle = Math.PI * 0.495; // never drop under the floor
controls.target.set(0, 2.4, 0);
controls.enabled = false;

// -------------------------------------------------------------------- world --

const params = new URLSearchParams(location.search);
let seed = Number.parseInt(params.get("seed") ?? "", 36);
if (!Number.isFinite(seed)) seed = randomSeed();

let world = createWorld(scene, makeRng(seed), seedLabel(seed).toUpperCase());
let focusHeight = world.focusHeight;

const post = createPost(renderer, scene, camera);
post.setSize(window.innerWidth, window.innerHeight);

// --------------------------------------------------------------- camera rig --

// A slow spherical orbit rather than a fixed path: the instrument is the
// subject, so the camera circles it, breathing in and out and rising and
// falling, and always looking at the column.
const lookTarget = new THREE.Vector3(0, 2.4, 0);
const desiredLook = new THREE.Vector3();

function updateCameraRig(time, delta) {
  const azimuth = 0.7 + time * 0.052;
  const elevation = THREE.MathUtils.degToRad(21 + Math.sin(time * 0.083) * 9);
  const radius = 15.4 + Math.sin(time * 0.045) * 2.2;

  camera.position.set(
    Math.cos(azimuth) * Math.cos(elevation) * radius,
    focusHeight + Math.sin(elevation) * radius,
    Math.sin(azimuth) * Math.cos(elevation) * radius,
  );

  // Aim a little under the column. The eye rides at `focusHeight`, so tipping
  // the gaze down lifts the instrument off the bottom of the frame.
  desiredLook.set(0, focusHeight - 1.1 + Math.sin(time * 0.11) * 0.35, 0);

  // Critically-damped-ish smoothing, frame-rate independent.
  lookTarget.lerp(desiredLook, 1 - Math.exp(-1.6 * delta));
  camera.lookAt(lookTarget);
}

// ----------------------------------------------------------------- overlay --

const ui = {
  root: document.getElementById("ui"),
  seed: document.getElementById("seed"),
  mode: document.getElementById("mode"),
  boot: document.getElementById("boot"),
};

let paused = false;
let orbiting = false;

function refreshStatus() {
  ui.seed.textContent = seedLabel(seed);
  ui.mode.textContent = paused
    ? "stopped"
    : orbiting
      ? "free orbit"
      : `running · ${world.bodyCount} bodies`;
}

function recut() {
  world.dispose();
  seed = randomSeed();
  world = createWorld(scene, makeRng(seed), seedLabel(seed).toUpperCase());
  focusHeight = world.focusHeight;

  const url = new URL(location.href);
  url.searchParams.set("seed", seed.toString(36));
  history.replaceState(null, "", url);

  refreshStatus();
}

refreshStatus();

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

    case "KeyG":
      world.toggleDome();
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
  stage.setViewportHeight(renderer.domElement.height);
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
  stage.update(elapsed);

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
  stage.dispose();
  post.dispose();
  controls.dispose();
  environmentTarget.dispose();
  renderer.dispose();
});

/** Free the throwaway room used to bake the environment map. */
function disposeSceneContents(root) {
  root.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
    else if (child.material) child.material.dispose();
  });
}
