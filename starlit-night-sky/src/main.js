import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import { createWorld } from "./world.js";
import { createPost } from "./post.js";
import { makeRng, seedLabel, randomSeed } from "./rng.js";

/**
 * Meridian — a wheeling night sky.
 *
 * Built against the threejs-* skills in ../../threejs-skills/skills:
 * fundamentals (scene/camera/renderer/clock/resize/disposal), geometry
 * (Points, custom buffer attributes, cylinder/plane wrapping), shaders (custom
 * ShaderMaterials, value/fbm noise, point sprites, phase shading), materials
 * (additive transparency), postprocessing (EffectComposer, bloom, custom
 * ShaderPass), animation (procedural motion, damping), interaction
 * (OrbitControls, keys).
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
renderer.toneMappingExposure = 1.1;
document.body.appendChild(renderer.domElement);

// ------------------------------------------------------------------- scene --

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x02030a);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 700);
camera.position.set(4.5, 2.2, 0);

// --------------------------------------------------------------- camera rig --

// The observer stands near the centre and turns slowly, so the sky pans across
// the ridge. The gaze sits just above the horizon and drifts to feel handheld.
const lookTarget = new THREE.Vector3(60, 9, 0);
const desiredLook = new THREE.Vector3();

function updateCameraRig(time, delta) {
  const az = 0.6 + time * 0.02;
  const camR = 4.5;

  camera.position.set(Math.cos(az) * camR, 2.2 + Math.sin(time * 0.08) * 0.25, Math.sin(az) * camR);

  const lookR = 60;
  desiredLook.set(Math.cos(az) * lookR, 9 + Math.sin(time * 0.05) * 1.6, Math.sin(az) * lookR);

  // Frame-rate-independent smoothing so turns stay soft.
  lookTarget.lerp(desiredLook, 1 - Math.exp(-1.5 * delta));
  camera.lookAt(lookTarget);
}

// ----------------------------------------------------------------- controls --

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 2;
controls.maxDistance = 120;
controls.maxPolarAngle = Math.PI * 0.92; // don't swing under the ground
controls.target.copy(lookTarget);
controls.enabled = false;

// -------------------------------------------------------------------- world --

const params = new URLSearchParams(location.search);
let seed = Number.parseInt(params.get("seed") ?? "", 36);
if (!Number.isFinite(seed)) seed = randomSeed();

let world = createWorld(scene, makeRng(seed));

const post = createPost(renderer, scene, camera);
post.setSize(window.innerWidth, window.innerHeight);
world.setViewportHeight(renderer.domElement.height);

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
  ui.mode.textContent = paused ? "paused" : orbiting ? "free look" : "auto pan";
}

function reseed() {
  world.dispose();
  seed = randomSeed();
  world = createWorld(scene, makeRng(seed));
  world.setViewportHeight(renderer.domElement.height);

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

    case "KeyM":
      world.triggerMeteor(elapsed);
      break;

    case "KeyR":
      reseed();
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

  world.update(elapsed, delta, camera);

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
  post.dispose();
  controls.dispose();
  renderer.dispose();
});
