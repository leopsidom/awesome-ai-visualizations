import * as THREE from "three";

import { createWind } from "./wind.js";
import { createSky } from "./sky.js";
import { createField } from "./field.js";
import { createGrass } from "./grass.js";
import { createTurbines } from "./turbines.js";
import { createFence } from "./fence.js";
import { createPollen } from "./pollen.js";

/**
 * Assembles one seeded afternoon and owns its lifetime. Recutting the weather
 * disposes every geometry, material and canvas texture before the next one is
 * built.
 *
 * The build order is forced by the dependencies rather than by taste: the wind
 * exists before anything that reads it; the sky exists next because it owns the
 * shared uniform block and the sun's bearing, which is what the farm is laid
 * out around; the field exists before anything that has to stand on it.
 */

export function createWorld(scene, rng) {
  const wind = createWind(rng);
  const sky = createSky(rng, wind);
  const field = createField(rng, wind, sky.uniforms);
  const grass = createGrass(rng, field, sky.uniforms, wind);
  const turbines = createTurbines(rng, field, sky.uniforms, wind, sky.azimuth);
  const fence = createFence(rng, field, sky.uniforms, wind);
  const pollen = createPollen(rng, sky.uniforms, wind);

  const layers = [sky, field, grass, turbines, fence, pollen];
  for (const layer of layers) scene.add(layer.group);

  // Haze thick enough to swallow the far rows of the farm without fogging the
  // near machine. Colour is only a fallback: shading.js replaces the fog term
  // on the ground with one that reads warm toward the sun and cool away.
  scene.fog = new THREE.FogExp2(sky.hazeWarm.clone().lerp(sky.hazeCool, 0.45), 0.00072);

  return {
    wind,
    sky,
    field,
    turbines,
    grassCount: grass.count,

    update(delta, camera, viewportHeight) {
      wind.update(delta);
      sky.update(delta);
      turbines.update(delta);
      pollen.update(camera, viewportHeight);
    },

    dispose() {
      for (const layer of layers) {
        scene.remove(layer.group);
        layer.dispose();
      }
      scene.fog = null;
    },
  };
}
