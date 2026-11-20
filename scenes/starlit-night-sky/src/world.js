import * as THREE from "three";

import { createSky } from "./sky.js";
import { createTerrain } from "./terrain.js";
import { createAurora } from "./aurora.js";
import { createMeteors } from "./meteors.js";
import { createStars } from "./stars.js";
import { createMilkyWay } from "./milkyway.js";
import { createMoon } from "./moon.js";

// Radians/second the sky wheels around the pole — a full turn takes ~17 minutes.
const SPIN_RATE = 0.006;

/**
 * Assembles one seeded night and owns its lifetime. Fixed layers (sky, ridge,
 * aurora, meteors) hang off the scene; the celestial layers (stars, Milky Way,
 * moon) hang off a tilted, slowly spinning group so they wheel together around
 * the pole. Reseeding disposes every geometry, material and buffer first.
 */
export function createWorld(scene, rng) {
  // Two uniforms shared by every star-like material: the clock and the point
  // size scale (set from the drawing-buffer height, see setViewportHeight).
  const shared = {
    uTime: { value: 0 },
    uScale: { value: 600 },
  };

  // ---- fixed to the observer ------------------------------------------------
  const sky = createSky(rng);
  const terrain = createTerrain(rng);
  const aurora = createAurora(rng, shared);
  const meteors = createMeteors(rng, shared);

  const fixed = [sky, terrain, aurora, meteors];
  fixed.forEach((layer) => scene.add(layer.group));

  // ---- wheeling with the pole ----------------------------------------------
  const stars = createStars(rng, shared);
  const milkyway = createMilkyWay(rng, shared);
  const moon = createMoon(rng);

  const celestial = [stars, milkyway, moon];

  const spin = new THREE.Group();
  celestial.forEach((layer) => spin.add(layer.group));

  const tilt = new THREE.Group();
  tilt.rotation.x = -0.55; // lift the pole ~30° off the horizon
  tilt.rotation.z = 0.12;
  tilt.add(spin);
  scene.add(tilt);

  const all = [...fixed, ...celestial];

  return {
    update(time, delta, camera) {
      shared.uTime.value = time;
      spin.rotation.y = time * SPIN_RATE;

      sky.update(time);
      meteors.update(time, delta, camera);
    },

    triggerMeteor(time) {
      meteors.trigger(time);
    },

    setViewportHeight(height) {
      // gl_PointSize is in drawing-buffer pixels; scale by half the buffer height.
      shared.uScale.value = height * 0.5;
    },

    dispose() {
      fixed.forEach((layer) => scene.remove(layer.group));
      scene.remove(tilt);
      all.forEach((layer) => layer.dispose());
    },
  };
}
