import { createGearTrain } from "./gears.js";
import { createMaterials } from "./materials.js";
import { createOrrery, planOrbits } from "./orrery.js";
import { createPlinth } from "./plinth.js";

/**
 * Assembles one seeded instrument and owns its lifetime. Recutting disposes
 * every geometry, material and canvas texture before the next one is built.
 *
 * The build order is forced by one dependency: the dial plate is engraved with a
 * scribed circle per orbit, so the orbit plan has to be drawn before the textures
 * are painted, and the plate has to exist before anything can be stood on it.
 */

const DECK_RADIUS = 5.6;

export function createWorld(scene, rng, seedText) {
  const orbits = planOrbits(rng);

  const materials = createMaterials(rng, {
    deckRadius: DECK_RADIUS,
    orbitRadii: orbits.map((orbit) => orbit.radius),
    seedText,
  });

  const plinth = createPlinth(rng, materials, { deckRadius: DECK_RADIUS });
  const orrery = createOrrery(rng, materials, { deckTop: plinth.deckTop, orbits });
  // The great wheel is fixed to the first arm, so the train is driven off it and
  // every satellite's speed is an exact tooth ratio away.
  const gears = createGearTrain(rng, materials, {
    deckTop: plinth.deckTop,
    deckRadius: DECK_RADIUS,
    driveRate: orrery.driveRate,
  });

  const layers = [plinth, orrery, gears];
  for (const layer of layers) scene.add(layer.group);

  return {
    /** Roughly where the eye wants to sit: the lamp at the top of the column. */
    focusHeight: orrery.sunHeight * 0.62,
    bodyCount: orbits.length,

    update(time) {
      orrery.update(time);
      gears.update(time);
    },

    toggleDome() {
      plinth.setDomeVisible(!plinth.isDomeVisible());
      return plinth.isDomeVisible();
    },

    dispose() {
      for (const layer of layers) {
        scene.remove(layer.group);
        layer.dispose();
      }
      materials.dispose();
    },
  };
}
