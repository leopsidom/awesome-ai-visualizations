import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import { createWorld } from "./world.js";
import { createPost } from "./post.js";
import { makeRng, seedLabel, randomSeed } from "./rng.js";

/**
 * Anemoi — a wind farm on a grass steppe, an hour before sunset.
 *
 * Built against the threejs-* skills in ../../threejs-skills/skills:
 * fundamentals (scene/camera/renderer/clock/resize/disposal, Object3D
 * hierarchy), geometry (a radial terrain disc and a lofted blade built from
 * raw BufferGeometry, LatheGeometry nacelles, instancing), materials (lit
 * Lambert and PBR standard, per-instance colour), textures (procedural
 * CanvasTextures, colour space for colour vs. data maps, wrapping, anisotropy),
 * lighting (directional key with a wide shadow map, hemisphere fill),
 * postprocessing (EffectComposer with a multisampled buffer, bloom, a custom
 * ShaderPass, OutputPass), shaders (ShaderMaterial for sky and chaff, and
 * onBeforeCompile injections into the built-in materials), animation (procedural
 * motion from a physical field, frame-rate-independent damping), interaction
 * (OrbitControls, keys).
 */

const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// The composer's buffers cannot be multisampled while bloom is in the chain
// (see post.js), so the anti-aliasing budget is spent on resolution instead.
//
// It is tempting to go further and put a *floor* under the ratio — on a 1×
// display, 220 000 blades of grass at one device pixel each shimmer, and drawing
// at 1.5× and letting the browser downsample cleans it up. Do not. Rendering
// above the device ratio makes the canvas backing store larger than its CSS box,
// so the compositor has to resample the layer every frame, and on Chrome's Metal
// backend that path intermittently presents a black or half-drawn canvas — a
// strobe. Match the device and let the shimmer be shimmer.
const MAX_PIXEL_RATIO = 2;

const pixelRatio = () => Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO);

// ---------------------------------------------------------------- renderer --

const renderer = new THREE.WebGLRenderer({ powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(pixelRatio());
// The sky dome covers every pixel, so this is never seen in a finished frame —
// it is what shows if one is ever presented half-drawn, and black is the one
// colour that reads as a fault. Matched to the splash screen behind the canvas.
renderer.setClearColor(0x8d887f, 1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.92;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
document.body.appendChild(renderer.domElement);

// ------------------------------------------------------------------- scene --

const scene = new THREE.Scene();

// A slightly long lens: it compresses the rows of the farm into each other and
// keeps the near machine reading as something enormous rather than something
// wide-angle-close.
const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.5, 6000);
camera.position.set(0, 12, 0);

// ------------------------------------------------------------------- world --

const params = new URLSearchParams(location.search);
let seed = Number.parseInt(params.get("seed") ?? "", 36);
if (!Number.isFinite(seed)) seed = randomSeed();

let world = createWorld(scene, makeRng(seed));

const post = createPost(renderer, scene, camera);
post.setSize(window.innerWidth, window.innerHeight);

// ---------------------------------------------------------------- controls --

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 4;
controls.maxDistance = 900;
controls.maxPolarAngle = Math.PI * 0.497; // never drop under the ground
controls.enabled = false;

// -------------------------------------------------------------- camera rig --

/**
 * A slow drift over a fifty-metre patch of the steppe, looking out across the
 * farm on a heading that sweeps back and forth through the sun's bearing. The
 * scene's subject is a kilometre deep, so the camera barely has to move to get
 * parallax — what it has to do is keep the sun in shot, because the sun is what
 * every other decision here was made for.
 */
const lookTarget = new THREE.Vector3();
const desiredLook = new THREE.Vector3();
let rigStarted = false;

function updateCameraRig(time, delta) {
  const a = time * 0.026;
  const x = 30 * Math.sin(a) + 14 * Math.sin(2.3 * a + 1.1);
  const z = 27 * Math.cos(a * 0.86) + 11 * Math.sin(1.7 * a + 0.4);

  const lift = 8.5 + 9.5 * (0.5 + 0.5 * Math.sin(a * 0.63 + 0.3));
  camera.position.set(x, world.field.heightAt(x, z) + lift, z);

  // Biased off the sun's bearing rather than centred on it: the sun sits near
  // one edge of frame for most of the cycle and crosses it, rather than sitting
  // in the middle bleaching everything.
  const heading = world.sky.azimuth + 0.2 + 0.46 * Math.sin(time * 0.019 + 0.7);
  const pitch = 0.055 + 0.06 * Math.sin(time * 0.016);
  const reach = 240;

  desiredLook.set(
    x + Math.sin(heading) * reach,
    camera.position.y + Math.tan(pitch) * reach,
    z + Math.cos(heading) * reach,
  );

  // Critically-damped-ish smoothing, frame-rate independent.
  if (!rigStarted) {
    lookTarget.copy(desiredLook);
    rigStarted = true;
  }
  lookTarget.lerp(desiredLook, 1 - Math.exp(-1.4 * delta));
  camera.lookAt(lookTarget);
}

// ----------------------------------------------------------------- overlay --

const ui = {
  root: document.getElementById("ui"),
  seed: document.getElementById("seed"),
  wind: document.getElementById("wind"),
  bearing: document.getElementById("bearing"),
  output: document.getElementById("output"),
  mode: document.getElementById("mode"),
  boot: document.getElementById("boot"),
};

const POINTS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];

let paused = false;
let orbiting = false;

function refreshStatus() {
  ui.seed.textContent = seedLabel(seed);
  ui.mode.textContent = paused ? "still" : orbiting ? "free orbit" : `${world.turbines.count} machines`;
}

function refreshReadout() {
  const speed = world.wind.speed;
  ui.wind.textContent = `${speed.toFixed(1)} m/s · ${world.wind.gear.name}`;

  // Reported the way a met station does: where the wind is coming *from*.
  const from = (THREE.MathUtils.radToDeg(world.wind.bearing) + 180 + 360) % 360;
  ui.bearing.textContent = `${POINTS[Math.round(from / 22.5) % 16]} ${Math.round(from).toString().padStart(3, "0")}°`;

  ui.output.textContent = `${world.turbines.megawatts.toFixed(1)} MW`;
}

function recut() {
  world.dispose();
  seed = randomSeed();
  world = createWorld(scene, makeRng(seed));
  rigStarted = false;

  const url = new URL(location.href);
  url.searchParams.set("seed", seed.toString(36));
  history.replaceState(null, "", url);

  refreshStatus();
}

refreshStatus();

// ------------------------------------------------------------------- input --

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
      } else {
        rigStarted = false;
      }
      refreshStatus();
      break;

    case "KeyB":
      post.toggleBloom();
      break;

    case "KeyG":
      world.wind.shiftGear();
      break;

    case "KeyR":
      recut();
      break;

    case "KeyH":
      ui.root.classList.toggle("hidden");
      break;
  }
});

// ------------------------------------------------------------------ resize --

function onResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  renderer.setPixelRatio(pixelRatio());
  renderer.setSize(width, height);
  post.setSize(width, height);
}

window.addEventListener("resize", onResize);

// -------------------------------------------------------------------- loop --

// Link every program in the scene before the first frame is asked for.
// Otherwise frame one is not a frame, it is twenty shader links, and the boot
// screen begins fading over a canvas that has nothing in it yet — which is a
// flash of the clear colour between the splash and the steppe.
await renderer.compileAsync(scene, camera).catch(() => {});

const timer = new THREE.Timer();
timer.setTimescale(REDUCED_MOTION ? 0.35 : 1);
let elapsed = 0;
let framesDrawn = 0;
let readoutDue = 0;

// Frames to get on screen before the splash is allowed to fade. One is not
// enough: the class change and the canvas swap are composited independently, so
// the fade can start a beat ahead of the picture it is uncovering.
const BOOT_FRAMES = 3;

renderer.setAnimationLoop(() => {
  // Clamp so a backgrounded tab does not resume with a huge time step — which
  // for a field advected by distance would be a very long gust indeed.
  timer.update();
  const delta = Math.min(timer.getDelta(), 0.05);
  const step = paused ? 0 : delta;
  elapsed += step;

  world.update(step, camera, renderer.domElement.height);

  if (orbiting) {
    controls.update();
  } else if (!paused) {
    updateCameraRig(elapsed, delta || 0.016);
  }

  post.aimSun(world.sky.sunDirection, world.sky.sunTint);
  post.render(elapsed);

  readoutDue -= delta;
  if (readoutDue <= 0) {
    refreshReadout();
    readoutDue = 0.2;
  }

  framesDrawn++;
  if (framesDrawn === BOOT_FRAMES) {
    ui.boot.classList.add("gone");
    setTimeout(() => ui.boot.remove(), 1200);
  }
});

// ----------------------------------------------------------------- cleanup --

window.addEventListener("pagehide", () => {
  renderer.setAnimationLoop(null);
  world.dispose();
  post.dispose();
  controls.dispose();
  renderer.dispose();
});
