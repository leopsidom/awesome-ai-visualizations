/**
 * The 3D gallery: renderer, the hall, the nine plinths, the wall of minor GPUs, the camera rig and
 * picking. main.js owns the state and passes a `view` to render() each frame; nothing here touches
 * the panel or the story card except to read the card's size for framing.
 *
 * The hall is lit to be read, not to be moody: a hemisphere fill, a warm key from the visitor's side,
 * three warm point lights that travel with the camera to wash the stretch of wall in view, a
 * spotlight that picks out the wall card being passed, and a
 * spotlight (with a faint visible cone) on each plinth that comes up as the camera arrives.
 */
import * as THREE from "three";
import { CSS2DRenderer, CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import { ARCH, GPUS } from "./data.js";
import { HEROES, MINORS, U_START, U_END, pathPoint, pathTangent, pathNormal, boardOf } from "./layout.js";
import { createCardFactory } from "./cards.js";

const WALL = 4.2, WALL_H = 4.6, TIERS = [1.05, 2.15, 3.25], WALL_SCALE = 0.55, PLINTH_H = 1;
const v3 = (p, y = 0) => new THREE.Vector3(p.x, y, p.z);
const P = (u) => v3(pathPoint(u)), T = (u) => v3(pathTangent(u)), N = (u) => v3(pathNormal(u));
const orient = (o, u) => { const t = pathTangent(u); o.rotation.y = Math.atan2(-t.z, t.x); };
const shortName = (n) => n.replace(" / STG-2000", "");

export function createWorld(stage, { reduced }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;
  stage.prepend(renderer.domElement);
  const labels = new CSS2DRenderer();
  labels.domElement.className = "labels";
  stage.appendChild(labels.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0e1116);
  scene.fog = new THREE.Fog(0x0e1116, 30, 90);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 300);

  // ---- light
  scene.add(new THREE.HemisphereLight(0xd6dfeb, 0x1b1e24, 1.25), new THREE.AmbientLight(0xffffff, 0.25));
  const key = new THREE.DirectionalLight(0xfff4e6, 1.1);
  key.position.set(-12, 20, 26);
  scene.add(key);
  const WASH = [-10, 0, 10];
  const wash = WASH.map(() => { const l = new THREE.PointLight(0xffe7c2, 14, 16, 1.2); scene.add(l); return l; });
  // follows the wall card being passed during the walk
  const focusSpot = new THREE.SpotLight(0xfff3dc, 0, 0, 0.2, 0.5, 0);
  scene.add(focusSpot, focusSpot.target);
  let focusIdx = -1;

  // ---- hall: floor, runner, wall with LED strips and shelf ledges
  const disposables = [];
  const keep = (x) => { disposables.push(x); return x; };
  const floor = new THREE.Mesh(keep(new THREE.PlaneGeometry(420, 90)), keep(new THREE.MeshStandardMaterial({ color: 0x181c22, roughness: 0.85 })));
  floor.rotation.x = -Math.PI / 2; floor.position.x = U_END / 2; scene.add(floor);

  const strip = (offA, offB, yA, yB, step, material) => {   // a ribbon following the path
    const pos = [], idx = []; let n = 0;
    for (let u = U_START - 8; u <= U_END + 8; u += step) {
      const a = P(u).addScaledVector(N(u), offA), b = P(u).addScaledVector(N(u), offB);
      pos.push(a.x, yA, a.z, b.x, yB, b.z);
      if (n) idx.push(n - 2, n - 1, n, n - 1, n + 1, n);
      n += 2;
    }
    const g = keep(new THREE.BufferGeometry());
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    return new THREE.Mesh(g, material);
  };
  const along = (off, y) => { const pts = []; for (let u = U_START - 8; u <= U_END + 8; u += 0.5) pts.push(P(u).addScaledVector(N(u), off).setY(y)); return keep(new THREE.BufferGeometry().setFromPoints(pts)); };
  const line = (off, y, color, opacity = 1) => new THREE.Line(along(off, y), keep(new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity })));

  scene.add(strip(1.6, -1.6, 0.005, 0.005, 1, keep(new THREE.MeshStandardMaterial({ color: 0x232830, roughness: 0.7, side: THREE.DoubleSide }))));
  scene.add(line(1.6, 0.012, 0x76b900, 0.5), line(-1.6, 0.012, 0x76b900, 0.5));
  scene.add(strip(-WALL, -WALL, 0, WALL_H, 1, keep(new THREE.MeshStandardMaterial({ color: 0x2c333d, roughness: 0.9, side: THREE.DoubleSide }))));
  scene.add(line(-WALL + 0.03, WALL_H - 0.05, 0xfff1d6, 0.9), line(-WALL + 0.03, WALL_H - 0.12, 0x76b900, 0.6), line(-WALL + 0.03, 0.08, 0x76b900, 0.5));
  TIERS.forEach((y) => scene.add(line(-WALL + 0.1, y - 0.38, 0x59626e)));

  // ---- cards
  const cards = createCardFactory();
  const pickables = [];
  const tag = (grp, g) => grp.traverse((o) => { if (o.isMesh) { o.userData.gpu = g; pickables.push(o); } });
  const plinthMat = keep(new THREE.MeshStandardMaterial({ color: 0x2b313a, roughness: 0.7, metalness: 0.1 }));
  const steelMat = keep(new THREE.MeshStandardMaterial({ color: 0xb8bdc3, roughness: 0.3, metalness: 0.9 }));
  const plinthGeo = keep(new THREE.BoxGeometry(4.2, PLINTH_H, 1.6)), standGeo = keep(new THREE.BoxGeometry(0.5, 0.06, 0.4));
  const plinthTop = keep(new THREE.EdgesGeometry(keep(new THREE.BoxGeometry(4.2, 0.001, 1.6)))), greenLine = keep(new THREE.LineBasicMaterial({ color: 0x76b900 }));
  const coneGeo = keep(new THREE.ConeGeometry(2.3, 6.6, 40, 1, true)); coneGeo.translate(0, -3.3, 0);

  const heroes = HEROES.map((g) => {
    const b = boardOf(g), H = b.height / 100;
    const grp = new THREE.Group(); grp.position.copy(P(g.u)); orient(grp, g.u);
    const plinth = new THREE.Mesh(plinthGeo, plinthMat); plinth.position.y = PLINTH_H / 2; grp.add(plinth);
    const top = new THREE.LineSegments(plinthTop, greenLine); top.position.y = PLINTH_H + 0.001; grp.add(top);
    const stand = new THREE.Mesh(standGeo, steelMat); stand.position.y = PLINTH_H + 0.03; grp.add(stand);
    const card = cards.make({ ...b, year: +g.date.slice(0, 4), color: ARCH[g.arch] });
    card.position.set(0, PLINTH_H + 0.12 + H / 2, -0.15); grp.add(card); tag(card, g);
    const spot = new THREE.SpotLight(0xfff6e0, 0, 0, 0.34, 0.6, 0);
    spot.position.set(0, 7.5, 1.4); spot.target.position.set(0, 1.6, 0); grp.add(spot, spot.target);
    const cone = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({ color: 0xe6f5c0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    disposables.push(cone.material);
    cone.position.set(0, 7.5, 0.5); grp.add(cone);
    const el = document.createElement("div"); el.className = "plaque";
    el.innerHTML = `<b>${g.date.slice(0, 4)}</b>${shortName(g.name)}`;
    const plaque = new CSS2DObject(el); plaque.position.set(0, 0.7, 0.82); grp.add(plaque);
    scene.add(grp);
    return { g, card, spot, cone, plaque, H, lit: 0, centre: new THREE.Vector3() };
  });

  let tier = 0;
  const wallItems = MINORS.map((g) => {
    const b = boardOf(g);
    const card = cards.make({ ...b, year: +g.date.slice(0, 4), color: ARCH[g.arch], spin: false });
    card.scale.setScalar(WALL_SCALE);
    const p = P(g.u).addScaledVector(N(g.u), -WALL + 0.1 + b.slots * 0.06); p.y = TIERS[tier]; tier = (tier + 1) % TIERS.length;
    card.position.copy(p); orient(card, g.u); tag(card, g); scene.add(card);
    const el = document.createElement("div"); el.className = "wlab";
    el.innerHTML = `<i>${g.date.slice(0, 4)}</i>${g.name.replace("GeForce ", "")}`;
    const lab = new CSS2DObject(el); lab.center.set(0.5, 0);
    lab.position.set(0, (-b.height / 100) * WALL_SCALE * 0.5 - 0.12, 0.2);
    card.add(lab); lab.scale.setScalar(1 / WALL_SCALE);
    lab.position.divideScalar(WALL_SCALE);
    return { g, lab, el, pos: p.clone(), nearHero: HEROES.some((h) => Math.abs(h.u - g.u) < 3.4) };
  });

  // ---- size
  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    renderer.setSize(w, h); labels.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize); ro.observe(stage); resize();

  // ---- camera rig
  // Walk: close to the wall (6.6 units from it, 6.2 on narrow stages), a little behind the point being
  // passed, looking at the wall at middle-tier height so all three rows stay in frame. About half the
  // old distance, so the minor GPUs read one by one; the milestone views below are still closer.
  // Near a milestone (within 4.5 units) it blends to a three-quarter view of the card, at a distance
  // fitted to the stage width. While the pop-up story card is open, the picture is shifted down by half
  // the card's height (a negative view offset), so there is room for the card above the GPU.
  const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
  let first = true, shift = 0, xOff = 0;
  const fitBox = new THREE.Box3(), fitC = new THREE.Vector3();
  function rig(dt, view) {
    const aspect = camera.aspect;
    const fov = view.narrow ? (aspect < 0.8 ? 52 : 44) : view.short ? 42 : 38;
    if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
    const halfW = Math.tan(THREE.MathUtils.degToRad(fov / 2)) * aspect;
    const fit = Math.max(1, (view.narrow ? 2.0 : 2.9) / (halfW * 8.1));
    const u = view.u, n = N(u), t = T(u), wall = P(u).addScaledVector(n, -WALL);
    const goalPos = wall.clone().addScaledVector(n, view.narrow ? 6.2 : 6.6).addScaledVector(t, -1.4).setY(2.6);
    const goalLook = wall.clone().addScaledVector(t, 0.6).setY(1.65);   // the centred list falls in the gap between the bottom and middle rows
    let best = heroes[0], bd = Infinity;
    for (const h of heroes) { const d = Math.abs(h.g.u - u); if (d < bd) { bd = d; best = h; } }
    const w = THREE.MathUtils.smoothstep(4.5 - bd, 0, 4.5);
    if (w > 0) {
      best.card.getWorldPosition(best.centre);
      const sc = Math.max(1, best.H / 1.1) * fit * (1 + shift * 1.1), hn = N(best.g.u), ht = T(best.g.u);
      const side = view.short ? 1.5 : 0.2;   // landscape phones: card on the left, story column on the right
      goalPos.lerp(best.centre.clone().addScaledVector(hn, 7.4 * sc).addScaledVector(ht, -3.2 * sc).setY(best.centre.y + 1.5 * sc), w);
      goalLook.lerp(best.centre.clone().addScaledVector(ht, side).setY(best.centre.y - 0.2), w);
    }
    const a = first || reduced ? 1 : 1 - Math.exp(-dt * 3.2);
    first = false;
    camPos.lerp(goalPos, a); camLook.lerp(goalLook, a);
    camera.position.copy(camPos); camera.lookAt(camLook);
    const want = view.cardRoom ? Math.min(0.32, view.cardRoom * 0.5) : 0;
    shift += (want - shift) * (reduced ? 1 : Math.min(1, dt * 4));
    const W = stage.clientWidth, Hs = stage.clientHeight;
    // Phones: the three-quarter view leaves the milestone GPU off-centre, so slide the picture sideways until
    // the card's on-screen centre is the stage's centre (measured without any offset, so there is no feedback).
    let wantX = 0;
    if (view.narrow && w > 0) {
      camera.clearViewOffset(); camera.updateMatrixWorld();
      fitBox.setFromObject(best.card).getCenter(fitC).project(camera);
      wantX = ((fitC.x + 1) / 2) * W - W / 2;
      wantX *= w;
    }
    xOff += (wantX - xOff) * (first || reduced ? 1 : Math.min(1, dt * 5));
    if (shift > 0.002 || Math.abs(xOff) > 0.5) camera.setViewOffset(W, Hs, xOff, -Hs * shift, W, Hs); else camera.clearViewOffset();
  }

  // ---- picking and projection
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function pick(clientX, clientY) {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(pickables, false)[0];
    return hit ? hit.object.userData.gpu : null;
  }
  /** Screen-space box (stage pixels) of milestone k's card: the pop-up story card is anchored to it. */
  const box3 = new THREE.Box3(), corner = new THREE.Vector3();
  function heroBox(k) {
    box3.setFromObject(heroes[k].card);
    const W = stage.clientWidth, H = stage.clientHeight;
    let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
    for (let i = 0; i < 8; i++) {
      corner.set(i & 1 ? box3.max.x : box3.min.x, i & 2 ? box3.max.y : box3.min.y, i & 4 ? box3.max.z : box3.min.z).project(camera);
      const x = ((corner.x + 1) / 2) * W, y = ((1 - corner.y) / 2) * H;
      left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
    return { left, right, top, bottom, cx: (left + right) / 2, cy: (top + bottom) / 2 };
  }

  function render(dt, view) {
    rig(dt, view);
    // the wall card being passed: the last one reached, unless a milestone is closer
    let cur = -1;
    for (let i = 0; i < wallItems.length; i++) if (wallItems[i].g.u <= view.u + 1e-6) cur = i;   // same rule as the list in main.js
    const nearestHero = Math.min(...heroes.map((h) => Math.abs(h.g.u - view.u)));
    if (cur >= 0 && (nearestHero < 3 || view.u - wallItems[cur].g.u > 4)) cur = -1;
    wallItems.forEach((w, i) => {
      w.lab.visible = false;   // names are read from the centred list instead: labels drifting with the camera were hard to read
      w.el.classList.toggle("on", i === cur);
    });
    // the pool jumps to each new card and fades in, rather than sliding across the wall between rows
    if (cur !== focusIdx) { focusIdx = cur; focusSpot.intensity = 0; }
    if (cur >= 0) {
      const c = wallItems[cur], cn = N(c.g.u);
      focusSpot.target.position.copy(c.pos);
      focusSpot.position.copy(c.pos).addScaledVector(cn, 3.2).setY(c.pos.y + 0.9);
    }
    focusSpot.intensity += ((cur >= 0 ? 7 : 0) - focusSpot.intensity) * (reduced ? 1 : Math.min(1, dt * 5));
    wash.forEach((l, i) => { const u = view.u + WASH[i], p = P(u).addScaledVector(N(u), -WALL + 2.4); l.position.set(p.x, 3.6, p.z); });
    for (const h of heroes) {
      const on = Math.abs(h.g.u - view.u) < 6 || view.u > h.g.u ? 1 : 0.25;
      h.lit += (on - h.lit) * Math.min(1, dt * 2.5);
      h.spot.intensity = 9 * h.lit;
      h.cone.material.opacity = 0.045 * h.lit;
      h.plaque.visible = Math.abs(h.g.u - view.u) < 20;   // HTML labels ignore fog: hide far plinths' plaques
      h.plaque.element.classList.toggle("on", view.focusK === heroes.indexOf(h));
    }
    if (!reduced) for (const f of cards.fans) f.rotation.z -= dt * 9;
    renderer.render(scene, camera);
    labels.render(scene, camera);
  }

  function dispose() {
    ro.disconnect();
    cards.dispose();
    disposables.forEach((d) => d.dispose());
    renderer.dispose();
    renderer.domElement.remove();
    labels.domElement.remove();
  }

  return { render, pick, heroBox, dispose, gpuCount: GPUS.length };
}
