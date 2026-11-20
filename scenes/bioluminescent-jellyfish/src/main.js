import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import { createWorld } from "./world.js";
import { createPost } from "./post.js";
import { makeRng, seedLabel, randomSeed } from "./rng.js";

/**
 * Abyssal Drift — a bioluminescent deep-sea scene.
 *
 * Built against the threejs-* skills in ../../threejs-skills/skills:
 * fundamentals (scene/camera/renderer/clock/resize/disposal), geometry
 * (instancing, buffer attributes), shaders (custom ShaderMaterials, fresnel,
 * vertex displacement, noise), materials (additive transparency),
 * postprocessing (EffectComposer, bloom, custom ShaderPass), animation
 * (procedural oscillation, damping), interaction (OrbitControls, keys).
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
renderer.toneMappingExposure = 1.15;
document.body.appendChild(renderer.domElement);

// ------------------------------------------------------------------- scene --

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x01050a);

// One shared fog description. Every material here is a custom ShaderMaterial,
// so the built-in fog chunks are bypassed and this pair of uniforms is spread
// into each of them instead (see src/glsl.js).
const fogUniforms = {
  uFogColor: { value: new THREE.Color(0x02121e) },
  uFogDensity: { value: 0.0135 },
};

const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 600);
camera.position.set(58, 12, 0);

// --------------------------------------------------------------- camera rig --

// A closed loop through the colony. The camera rides it and looks a little way
// down its own path, which keeps turns readable instead of whip-panning.
const path = new THREE.CatmullRomCurve3(
  [
    new THREE.Vector3(62, 8, 4),
    new THREE.Vector3(32, 24, 56),
    new THREE.Vector3(-26, 6, 62),
    new THREE.Vector3(-64, 20, 12),
    new THREE.Vector3(-34, -2, -52),
    new THREE.Vector3(26, 16, -60),
  ],
  true,
  "catmullrom",
  0.6,
);

const lookTarget = new THREE.Vector3(0, 6, 0);
const desiredLook = new THREE.Vector3();
const pathPoint = new THREE.Vector3();

function updateCameraRig(time, delta) {
  const t = (time * 0.0075) % 1;

  path.getPointAt(t, pathPoint);
  // Gentle handheld drift so the dolly never feels rail-mounted.
  pathPoint.y += Math.sin(time * 0.21) * 1.6;
  pathPoint.x += Math.sin(time * 0.13) * 1.2;
  camera.position.copy(pathPoint);

  path.getPointAt((t + 0.22) % 1, desiredLook);
  desiredLook.multiplyScalar(0.35); // bias the gaze inward, toward the colony
  desiredLook.y = 4 + Math.sin(time * 0.17) * 5;

  // Critically-damped-ish smoothing, frame-rate independent.
  lookTarget.lerp(desiredLook, 1 - Math.exp(-1.2 * delta));
  camera.lookAt(lookTarget);
}

// ----------------------------------------------------------------- controls --

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 4;
controls.maxDistance = 220;
controls.target.set(0, 4, 0);
controls.enabled = false;

// -------------------------------------------------------------------- world --

const params = new URLSearchParams(location.search);
let seed = Number.parseInt(params.get("seed") ?? "", 36);
if (!Number.isFinite(seed)) seed = randomSeed();

let world = createWorld(scene, makeRng(seed), fogUniforms);
world.setViewportHeight(renderer.domElement.height);

const post = createPost(renderer, scene, camera);
post.setSize(window.innerWidth, window.innerHeight);

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
  ui.mode.textContent = paused ? "paused" : orbiting ? "free orbit" : "auto drift";
}

function reseed() {
  world.dispose();
  seed = randomSeed();
  world = createWorld(scene, makeRng(seed), fogUniforms);
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
