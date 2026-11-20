import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";

import { createGround } from "./ground.js";
import { createTowers } from "./towers.js";
import { createGauge } from "./gauge.js";
import { X_END, YEAR_UNITS, xOf, clamp } from "./scales.js";

/**
 * Assembles the 3D scene and owns the renderer, the HTML label layer, the camera with
 * its orbit controls, and picking.
 *
 * Time runs along +x (1995 at x = 0), the market lanes step back along -z, and height
 * is +y. The home view looks across the skyline from the front left, a little above it.
 */

const BACKGROUND = 0x070a07;
const MAX_PIXEL_RATIO = 2;
// The home view: 22° left of straight-on and 26° up, aimed at the middle of the skyline.
const HOME_TARGET = new THREE.Vector3(26.5, 3.5, -4.5);
const HOME_DIR = new THREE.Vector3(-0.3367, 0.4384, 0.8334); // unit vector, target to camera
// Distance × aspect that keeps the lane names, all 31 years and the scale in frame
// (fitted offline for stages from 1:1 to 2.2:1), clamped for very wide or tall stages.
const HOME_FIT = 106;
const HOME_MIN = 42;
const HOME_MAX = 150;

// Follow view, for stages too narrow to show 1995–2025 at a readable size (phones, small
// windows): the camera closes in on a window of a few years and slides along x with the
// year being built. Only x is tracked once framed, so an orbit or zoom made meanwhile stays.
const FOLLOW_PX_PER_YEAR = 42; // stage pixels per year in the follow view
const FOLLOW_MIN_YEARS = 7;
const FOLLOW_MAX_YEARS = 14;
const FOLLOW_HEIGHT = 24; // world units kept in view vertically: the tallest tower, lanes and labels
const FOLLOW_LEAD = 0.15; // the year being built sits this share of the view right of centre
const FOLLOW_Y = 6; // aim higher than home, at the middle of the tall towers
const FOLLOW_END = 6; // world units the view may run past the scene's end, so 2025's front lanes stay in
// These were fitted offline: on stages from 360×640 to 760×900, and for any year, the
// front lane, the back lane and the tallest towers stay within 90% of the frame.
const FOLLOW_RATE = 3.5; // 1/s, how quickly the camera closes on its mark

export function createWorld({ container, model, reducedMotion }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
  renderer.setClearColor(BACKGROUND, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const canvas = renderer.domElement;
  container.appendChild(canvas);

  // Milestones, lane names, years and the scale are HTML on a layer over the canvas.
  const labels = new CSS2DRenderer();
  labels.domElement.className = "labels";
  container.appendChild(labels.domElement);

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xdff5cf, 0x0a0f08, 0.9));
  const sun = new THREE.DirectionalLight(0xffffff, 1.5);
  sun.position.set(-25, 45, 30);
  scene.add(sun);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 600);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = !reducedMotion;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI * 0.495; // never below the floor
  controls.minDistance = 4;
  controls.maxDistance = 160;

  const ground = createGround(scene, { model });
  const towers = createTowers(scene, { model, reducedMotion });
  const scaleLane = model.laneById.consumer ?? model.lanes[0];
  const gauge = createGauge(scene, { x: X_END + 1, z: scaleLane.front, zBack: model.zBack });

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let tx = null;

  function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!w || !h) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
    renderer.setSize(w, h);
    labels.setSize(w, h);
    camera.aspect = w / h;
    // A tall, narrow stage needs a wider lens to keep the whole skyline in frame.
    camera.fov = camera.aspect < 1 ? 55 : 45;
    camera.updateProjectionMatrix();
  }

  /** Back to the starting view, framed for the stage's current shape. Ends any following. */
  function home() {
    const distance = Math.min(HOME_MAX, Math.max(HOME_MIN, HOME_FIT / camera.aspect));
    controls.target.copy(HOME_TARGET);
    camera.position.copy(HOME_TARGET).addScaledVector(HOME_DIR, distance);
    follow.framed = false;
    follow.flying = false;
    controls.update();
  }

  // ---------------------------------------------------------------- follow --
  // `framed`: following is under way (set by frameFollow, cleared by home).
  // `flying`: still easing from wherever the camera was into the close follow view;
  // a drag by the user ends the easing but not the following.
  const follow = { framed: false, flying: false };
  const offset = new THREE.Vector3();
  const goal = new THREE.Vector3();
  controls.addEventListener("start", () => {
    follow.flying = false;
  });

  /** How far the follow camera stands back, and how many world units of x it shows. */
  function followFrame() {
    const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const years = clamp(container.clientWidth / FOLLOW_PX_PER_YEAR, FOLLOW_MIN_YEARS, FOLLOW_MAX_YEARS);
    const span = years * YEAR_UNITS;
    const distance = Math.max(span / (2 * tan * camera.aspect), FOLLOW_HEIGHT / (2 * tan));
    return { distance, span };
  }

  /** Starts following: the camera eases into the close view. Once per run, until `home()`. */
  function frameFollow() {
    if (follow.framed) return;
    follow.framed = true;
    follow.flying = true;
  }

  /** Moves the camera toward the view of `year`. Called each frame while the year is moving. */
  function followYear(year, dt) {
    if (!follow.framed) return;
    const { distance, span } = followFrame();
    // Keep the view on the scene: the lane names at the left, the last towers and the scale at the right.
    const lo = span / 2 - 3;
    const hi = X_END + FOLLOW_END - span / 2;
    const x = lo < hi ? clamp(xOf(year) - span * FOLLOW_LEAD, lo, hi) : (lo + hi) / 2;
    const k = reducedMotion ? 1 : 1 - Math.exp(-dt * FOLLOW_RATE);
    const target = controls.target;
    if (follow.flying) {
      offset.subVectors(camera.position, target);
      goal.copy(HOME_DIR).multiplyScalar(distance);
      offset.lerp(goal, k);
      target.x += (x - target.x) * k;
      target.y += (FOLLOW_Y - target.y) * k;
      target.z += (HOME_TARGET.z - target.z) * k;
      camera.position.copy(target).add(offset);
      if (offset.distanceTo(goal) < 0.05 && Math.abs(x - target.x) < 0.05) follow.flying = false;
    } else {
      const dx = (x - target.x) * k;
      target.x += dx;
      camera.position.x += dx;
    }
  }

  /** One frame. `st` is the shared state from main.js. */
  function update(dt, st) {
    towers.update(dt, st);
    ground.update(st);
    if (tx) gauge.build(st, tx);
    controls.update();
    renderer.render(scene, camera);
    labels.render(scene, camera);
  }

  /** What is under the pointer: { gpu: index }, { era: id } or null. */
  function pick(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects([...towers.pickables(), ...ground.pickables], false)[0];
    if (!hit) return null;
    const data = hit.object.userData;
    return data.gpu != null ? { gpu: data.gpu } : { era: data.era };
  }

  function setText(next) {
    tx = next;
    ground.setText(tx);
    towers.setText(tx);
  }

  function setHover(i) {
    towers.setHover(i ?? -1);
  }

  function dispose() {
    controls.dispose();
    gauge.dispose();
    towers.dispose();
    ground.dispose();
    renderer.dispose();
    canvas.remove();
    labels.domElement.remove();
  }

  resize();
  home();
  return { update, resize, home, frameFollow, followYear, pick, setText, setHover, dispose };
}
