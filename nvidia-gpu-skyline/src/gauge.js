import * as THREE from "three";
import { textLabel, segments, release } from "./marks.js";
import { METRICS, BASE, TOWER_HEIGHT, X_END, tickHeight } from "./scales.js";

/**
 * The scale standing beside the towers, and faint guide lines at the same heights
 * along the back of the scene, so a tower anywhere can be read against them. It is
 * rebuilt only when the measure, the transistor scale or the language changes.
 */

const TICK = 0.3; // half-length of a tick mark
const TOP = BASE + TOWER_HEIGHT * 1.03;

export function createGauge(scene, { x, z, zBack }) {
  let group = null;
  let key = "";

  function build(st, tx) {
    const next = `${st.metric}|${st.tscale}|${tx.lang}`;
    if (next === key) return;
    key = next;
    if (group) release(group);
    group = new THREE.Group();

    const axis = [x, 0, z, x, TOP, z];
    const guides = [];
    for (const v of METRICS[st.metric].ticks(st.tscale)) {
      const y = tickHeight(st.metric, v, st.tscale);
      axis.push(x - TICK, y, z, x + TICK, y, z);
      guides.push(0, y, zBack, X_END, y, zBack);
      const tick = textLabel("gl", tx.tick(st.metric, v), [0, 0.5]);
      tick.position.set(x + 0.5, y, z);
      group.add(tick);
    }
    group.add(segments(axis, 0x76b900, 0.8), segments(guides, 0x76b900, 0.12));

    const title = textLabel("gt", tx.measure(st.metric, st.tscale), [0.5, 1]);
    title.position.set(x, TOP + 1, z);
    group.add(title);
    scene.add(group);
  }

  function dispose() {
    if (group) release(group);
    group = null;
    key = "";
  }

  return { build, dispose };
}
