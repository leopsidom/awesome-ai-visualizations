import * as THREE from "three";
import { textLabel, release } from "./marks.js";
import { METRICS, towerHeight } from "./scales.js";

/**
 * One tower per GPU: a box whose height is the chosen measure, coloured by its
 * architecture. How solid it looks says how well its row has been checked: solid for
 * verified or corrected, see-through for partly verified, a bright outline around an
 * almost empty box for not yet verified. Nineteen of them carry a milestone label.
 */

const WIDTH = 0.42;
const EASE = 6; // height follow rate, per second
const EMISSIVE = 0.18;
const HOVER_EMISSIVE = 1.1;
const FLASH_DECAY = 1.5; // per second; a tower glows as it first appears during playback
const LABEL_GAP = 0.3;
const GREY = new THREE.Color("#4a524a"); // no figure for the chosen measure
const LOOK = {
  verified: { fill: 0.92, edge: 0.45 },
  corrected: { fill: 0.92, edge: 0.45 },
  partial: { fill: 0.45, edge: 0.6 },
  unverified: { fill: 0.06, edge: 0.95 },
};
const DIM_FILL = 0.1; // opacity factors for towers outside a spotlit architecture
const DIM_EDGE = 0.12;

export function createTowers(scene, { model, reducedMotion }) {
  // One unit-high box with its base at y = 0, shared by every tower and scaled in y.
  const geometry = new THREE.BoxGeometry(WIDTH, 1, WIDTH);
  geometry.translate(0, 0.5, 0);
  const edges = new THREE.EdgesGeometry(geometry);
  const root = new THREE.Group();
  scene.add(root);

  const towers = model.gpus.map((gpu) => {
    const color = new THREE.Color(model.colors[gpu.arch]);
    const look = LOOK[gpu.status] ?? LOOK.unverified;
    const hollow = gpu.status === "unverified";
    const fill = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: EMISSIVE,
      roughness: 0.5,
      metalness: 0.15,
      transparent: true,
      opacity: look.fill,
      depthWrite: !hollow,
    });
    const edge = new THREE.LineBasicMaterial({ color, transparent: true, opacity: look.edge });
    const body = new THREE.Mesh(geometry, fill);
    body.userData.gpu = gpu.i;
    const scaler = new THREE.Group();
    scaler.add(body, new THREE.LineSegments(edges, edge));
    const group = new THREE.Group();
    group.position.set(gpu.x, 0, gpu.z);
    group.add(scaler);
    let label = null;
    if (gpu.milestone) {
      label = textLabel("ms", "", [0.5, 1]);
      group.add(label);
    }
    root.add(group);
    return { gpu, color, look, hollow, fill, edge, body, scaler, group, label, h: 0, flash: 0, shown: false };
  });

  let hovered = -1;

  /** Called every frame with the shared state from main.js. */
  function update(dt, st) {
    const k = reducedMotion ? 1 : 1 - Math.exp(-dt * EASE);
    const field = METRICS[st.metric].field;
    for (const t of towers) {
      const g = t.gpu;
      const shown = st.markets.has(g.market) && g.year <= st.year;
      if (shown && !t.shown && st.playing && !reducedMotion) t.flash = 1;
      t.shown = shown;

      const want = shown ? towerHeight(g, st.metric, st.tscale) : 0;
      t.h += (want - t.h) * k;
      if (Math.abs(want - t.h) < 1e-3) t.h = want;
      const visible = t.h > 0.02;
      t.group.visible = visible;
      t.scaler.scale.y = Math.max(t.h, 0.001);
      t.flash = Math.max(0, t.flash - dt * FLASH_DECAY);

      const dim = Boolean(st.arch) && st.arch !== g.arch;
      const hot = g.i === hovered;
      const c = g[field] == null ? GREY : t.color;
      t.fill.color.copy(c);
      t.fill.emissive.copy(c);
      t.edge.color.copy(c);
      t.fill.emissiveIntensity = (hot ? HOVER_EMISSIVE : EMISSIVE) + t.flash;
      t.fill.opacity = (hot && t.hollow ? 0.35 : t.look.fill) * (dim ? DIM_FILL : 1);
      t.edge.opacity = t.look.edge * (dim ? DIM_EDGE : 1);

      if (t.label) {
        t.label.position.y = t.h + LABEL_GAP;
        // CSS2DRenderer does not look at the parent's visibility, so the label carries its own.
        t.label.visible = visible && st.milestones && !dim;
      }
    }
  }

  function setText(tx) {
    for (const t of towers) {
      if (!t.label) continue;
      const dot = document.createElement("i");
      dot.style.background = model.colors[t.gpu.arch];
      t.label.element.replaceChildren(dot, tx.milestone(t.gpu));
    }
  }

  /** `i` is a GPU index, or -1 for none. */
  function setHover(i) {
    hovered = i;
  }

  /** The tower bodies that can be hit by a ray: only the ones standing. */
  function pickables() {
    return towers.filter((t) => t.group.visible).map((t) => t.body);
  }

  function dispose() {
    release(root);
    geometry.dispose();
    edges.dispose();
  }

  return { update, setText, setHover, pickables, dispose };
}
