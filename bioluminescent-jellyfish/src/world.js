import { createEnvironment } from "./environment.js";
import { createColony } from "./jellyfish.js";
import { createKelp } from "./kelp.js";
import { createParticles } from "./particles.js";

/**
 * Assembles one seeded colony and owns its lifetime. Reseeding disposes every
 * geometry, material and instance buffer before the next world is built.
 */
export function createWorld(scene, rng, fogUniforms) {
  const environment = createEnvironment(rng, fogUniforms);
  const kelp = createKelp(rng, fogUniforms, 260);
  const colony = createColony(rng, fogUniforms, rng.int(7, 11));
  const particles = createParticles(rng, fogUniforms);

  const layers = [environment, kelp, colony, particles];
  layers.forEach((layer) => scene.add(layer.group));

  return {
    update(time, delta, camera) {
      environment.update(time, camera);
      kelp.update(time);
      colony.update(time, delta);
      particles.update(time);
    },

    setViewportHeight(height) {
      particles.setViewportHeight(height);
    },

    dispose() {
      for (const layer of layers) {
        scene.remove(layer.group);
        layer.dispose();
      }
    },
  };
}
