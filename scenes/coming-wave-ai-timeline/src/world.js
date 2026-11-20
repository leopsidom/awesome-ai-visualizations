import * as THREE from "three";

import { createSwell, createOcean, createStars } from "./ocean.js";
import { createLanes } from "./lanes.js";
import { createMarkers } from "./markers.js";
import { makeRng } from "./rng.js";

/**
 * Assembles the 3D scene and owns the renderer, the camera rig and picking.
 *
 * Time runs along +x: 1950 at x = 0, today at x = LENGTH. Each thread is a lane at a
 * fixed z. The camera rides behind and above the "now" line, on the +z side.
 */

const LENGTH = 640; // world units from 1950 to today
const LANE_GAP = 5;
const BACKGROUND = 0x060a14;
const MAX_PIXEL_RATIO = 2;
const STAR_SEED = 0x1950;
const DAMPING = 2.4; // camera follow rate, per second

export function createWorld({ container, model, u0, u1 }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
  renderer.setClearColor(BACKGROUND, 1);
  // No tone mapping: every material is unlit, so thread colours match the HTML legend.
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const canvas = renderer.domElement;
  container.appendChild(canvas);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(BACKGROUND, 45, 240);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.5, 700);

  const halfWidth = ((model.threads.length - 1) / 2) * LANE_GAP;
  const laneZ = {};
  model.threads.forEach((thread, i) => {
    laneZ[thread.id] = i * LANE_GAP - halfWidth;
  });

  const swell = createSwell(LENGTH);
  const ocean = createOcean(scene, swell, LENGTH);
  const stars = createStars(scene, makeRng(STAR_SEED));
  const lanes = createLanes(scene, { model, swell, laneZ, halfWidth, length: LENGTH, u0, u1 });
  const markers = createMarkers(scene, { model, swell, laneZ, length: LENGTH });

  // ---- camera rig
  const camPos = new THREE.Vector3();
  const camTarget = new THREE.Vector3();
  const wantPos = new THREE.Vector3();
  const wantTarget = new THREE.Vector3();
  const projected = new THREE.Vector3();
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let width = 1;
  let height = 1;
  let shift = 0;
  let snap = true; // the first frame jumps straight to its pose
  let mouseX = 0;
  let mouseY = 0;

  // Shifting the view (not the camera) moves the picture sideways without changing
  // its perspective, which keeps the "now" line clear of the event list.
  function applyShift() {
    if (shift) camera.setViewOffset(width, height, -width * shift, 0, width, height);
    else camera.clearViewOffset();
  }

  function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!w || !h) return;
    width = w;
    height = h;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
    renderer.setSize(w, h);
    camera.aspect = w / h;
    // A tall, narrow stage needs a wider lens to keep all the lanes in frame.
    camera.fov = camera.aspect < 1 ? 72 : 55;
    camera.updateProjectionMatrix();
    applyShift();
  }

  /** One frame. `s` = { u, time, dt, curId, focusId, shift } from main.js. */
  function update(s) {
    const t = s.time;
    const nowX = s.u * LENGTH;
    if (s.shift !== shift) {
      shift = s.shift;
      applyShift();
    }

    swell.profile(nowX);
    const level = swell.base;
    const focus = s.focusId ? markers.byId[s.focusId] : null;
    if (focus) {
      // A story card is open: drift in close to its marker.
      const p = focus.group.position;
      wantPos.set(p.x - 15, level + 8.5, p.z + 15 + 2.5 * Math.sin(t * 0.5));
      wantTarget.set(p.x + 1.5, level + 1.5, p.z);
    } else {
      // Ride behind and above the "now" line; the pointer leans the view a little.
      wantPos.set(nowX - 26 + mouseX * 3, level + 12 - mouseY * 2.5, 22 + mouseX * 2);
      wantTarget.set(nowX + 16, level + 1, -3);
    }
    const k = snap ? 1 : 1 - Math.exp(-s.dt * DAMPING);
    snap = false;
    camPos.lerp(wantPos, k);
    camTarget.lerp(wantTarget, k);
    camera.position.copy(camPos);
    camera.lookAt(camTarget);
    stars.points.position.copy(camPos);

    ocean.update(camPos.x, t);
    lanes.update(t, nowX);
    markers.update(s);
    renderer.render(scene, camera);
  }

  function pointer(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    mouseX = ((clientX - r.left) / r.width) * 2 - 1;
    mouseY = ((clientY - r.top) / r.height) * 2 - 1;
  }

  /** The id of the event whose marker is under the pointer, or null. */
  function pick(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    for (const hit of raycaster.intersectObjects(markers.pickables, false)) {
      const id = hit.object.userData.id;
      if (markers.byId[id].group.visible) return id;
    }
    return null;
  }

  /** Where an event's marker is on the stage, in CSS pixels: the story card grows from there. */
  function project(id) {
    const marker = markers.byId[id];
    if (!marker) return null;
    projected.copy(marker.group.position).project(camera);
    return {
      x: ((projected.x + 1) / 2) * width,
      y: ((1 - projected.y) / 2) * height,
      visible: projected.z > -1 && projected.z < 1,
    };
  }

  function setEnabled(enabled) {
    lanes.setEnabled(enabled);
    markers.setEnabled(enabled);
  }

  function dispose() {
    ocean.dispose();
    stars.dispose();
    lanes.dispose();
    markers.dispose();
    renderer.dispose();
    canvas.remove();
  }

  resize();
  return { update, resize, pick, pointer, project, setEnabled, dispose };
}
