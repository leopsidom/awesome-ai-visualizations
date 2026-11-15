import * as THREE from "three";
import { textLabel, segments, release } from "./marks.js";
import { xOf, X_END, YEAR0, YEAR_END, TOWER_HEIGHT } from "./scales.js";

/**
 * Everything under the towers: the floor, a strip per market lane with its name, the
 * year grid and labels, the architecture bars along the front edge, and the green
 * "now" gate that sweeps along the lanes during playback.
 */

const STRIP_PAD = 0.45; // a lane strip runs this far beyond its outer sub-rows
const LANE_LABEL_X = -1.2;
const ERA_Z = 0.95; // the first row of architecture bars
const ERA_ROW = 0.55;
const ERA_DEPTH = 0.4;
const ERA_HEIGHT = 0.1;
const GATE_HEIGHT = TOWER_HEIGHT * 0.75;

export function createGround(scene, { model }) {
  const root = new THREE.Group();
  scene.add(root);
  const { zFront, zBack } = model;

  // ---- floor
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(X_END + 8, zFront - zBack + 2),
    new THREE.MeshStandardMaterial({ color: 0x0a0f09, roughness: 1 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(X_END / 2, -0.03, (zFront + zBack) / 2);
  root.add(floor);

  // ---- lanes, each with its name off the left end
  const lanes = model.lanes.map((lane) => {
    const z0 = lane.front + STRIP_PAD;
    const z1 = lane.back - STRIP_PAD;
    const material = new THREE.MeshStandardMaterial({ color: 0x131d10, roughness: 1, transparent: true });
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(X_END + 1, z0 - z1), material);
    strip.rotation.x = -Math.PI / 2;
    strip.position.set(X_END / 2 - 0.5, 0, (z0 + z1) / 2);
    const name = textLabel("ll", "", [1, 0.5]);
    name.position.set(LANE_LABEL_X, 0.1, (z0 + z1) / 2);
    root.add(strip, name);
    return { lane, material, name };
  });

  // ---- year grid: a line a year, a brighter one every five, labelled along the front
  const minor = [];
  const major = [];
  for (let y = YEAR0; y <= YEAR_END; y++) {
    const x = xOf(y);
    (y % 5 === 0 ? major : minor).push(x, 0.015, zFront - 0.7, x, 0.015, zBack);
  }
  root.add(segments(minor, 0x1a2715, 0.5), segments(major, 0x2f4a22, 0.9));
  for (let y = YEAR0; y < YEAR_END; y += 5) {
    const label = textLabel("yl", String(y));
    label.position.set(xOf(y), 0, zFront + 0.3);
    root.add(label);
  }

  // ---- architecture bars: first release to last, stacked where families overlap
  const eras = model.eras.map((era) => {
    const x0 = xOf(era.start);
    const x1 = xOf(era.end);
    const color = new THREE.Color(era.color);
    const material = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.3,
      transparent: true,
    });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(Math.max(x1 - x0, 0.3), ERA_HEIGHT, ERA_DEPTH), material);
    bar.position.set((x0 + x1) / 2, ERA_HEIGHT / 2, ERA_Z + era.row * ERA_ROW);
    bar.userData.era = era.id;
    root.add(bar);
    return { era, bar, material };
  });

  // ---- the "now" gate: a faint green veil across the lanes and a bright line at its foot
  const gate = new THREE.Group();
  const veil = new THREE.Mesh(
    new THREE.PlaneGeometry(zFront - zBack, GATE_HEIGHT),
    new THREE.MeshBasicMaterial({
      color: 0x76b900,
      transparent: true,
      opacity: 0.06,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  veil.rotation.y = Math.PI / 2;
  veil.position.set(0, GATE_HEIGHT / 2, (zFront + zBack) / 2);
  gate.add(veil, segments([0, 0.03, zFront, 0, 0.03, zBack], 0x76b900, 0.95));
  root.add(gate);

  /** Called every frame with the shared state from main.js. */
  function update(st) {
    gate.visible = st.year < YEAR_END;
    gate.position.x = xOf(st.year);
    for (const e of eras) e.material.opacity = st.arch && st.arch !== e.era.id ? 0.15 : 1;
    for (const l of lanes) {
      const on = st.markets.has(l.lane.id);
      l.material.opacity = on ? 1 : 0.35;
      l.name.element.style.opacity = on ? "" : "0.4";
    }
  }

  function setText(tx) {
    for (const l of lanes) l.name.element.textContent = tx.s.laneNames[l.lane.id];
  }

  function dispose() {
    release(root);
  }

  return { update, setText, dispose, pickables: eras.map((e) => e.bar) };
}
