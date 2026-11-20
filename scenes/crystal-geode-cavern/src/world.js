import { createCavity } from "./cavity.js";
import { createShell } from "./shell.js";
import { createCrystals } from "./crystals.js";
import { createShaft } from "./shaft.js";
import { createLighting } from "./lighting.js";
import { MINERALS } from "./minerals.js";

/**
 * Assembles one seeded cavity and owns its lifetime. Recutting disposes every
 * geometry, material and instance buffer before the next one is built.
 *
 * Build order is not arbitrary. The cavity field comes first because everything
 * else is measured against it; the shaft comes before the lighting because the
 * key light is aimed by the beam rather than the other way round, which is the
 * only way the drawn shaft and the lit patch stay in agreement while it sweeps.
 *
 * The `pool` is handed in rather than built here, and is *not* disposed on a
 * recut. The waterline is the same for every cut, so there is nothing to
 * rebuild — and rebuilding it anyway turned out to leak. `Reflector` owns a
 * virtual camera, and Three.js caches the render target for the transmission
 * pass in a `WeakMap` keyed by camera. A fresh Reflector per cut therefore
 * stranded a full-size half-float target every time the hero crystals were
 * drawn into a reflection, with no public handle left to dispose it. Keeping
 * one pool for the life of the page sidesteps the whole thing.
 */
export function createWorld(scene, rng, fogUniforms, mineralIndex, pool) {
  const cavity = createCavity(rng);

  const shell = createShell(cavity);
  const crystals = createCrystals(rng, cavity, mineralIndex);
  const shaft = createShaft(rng, cavity, fogUniforms);
  const lighting = createLighting(shaft);

  scene.add(shell.object, crystals.group, shaft.group, lighting.group);

  let mineral = wrap(mineralIndex);

  function applyMineral(index) {
    mineral = wrap(index);
    crystals.setMineral(mineral);
    pool.setMineral(mineral);
    return MINERALS[mineral];
  }

  applyMineral(mineral);

  return {
    /** The camera rig measures itself against the wall, so it needs the field. */
    cavity,
    /** Where the light lands. The camera rig and the free-orbit pivot use it. */
    focus: cavity.beamTarget(),

    get mineral() {
      return mineral;
    },

    update(time) {
      // The shaft moves the beam and hands back where it now points; the key
      // light and the bounce follow it in the same frame, so nothing lags.
      lighting.update(shaft.update(time));
      pool.update(time);
    },

    setMineral: applyMineral,

    nextMineral() {
      return applyMineral(mineral + 1);
    },

    setViewportHeight(height) {
      shaft.setViewportHeight(height);
    },

    dispose() {
      scene.remove(shell.object, crystals.group, shaft.group, lighting.group);
      shell.dispose();
      crystals.dispose();
      shaft.dispose();
      lighting.dispose();
    },
  };
}

const wrap = (index) => ((index % MINERALS.length) + MINERALS.length) % MINERALS.length;
