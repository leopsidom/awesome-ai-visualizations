import * as THREE from "three";

import {
  makeBrushedRoughness,
  makeDeckTextures,
  makePlanetTexture,
  makeRingTexture,
  makeWoodTextures,
} from "./textures.js";

/**
 * The material bench. Everything here is a lit PBR material — no hand-written
 * lighting — which is the whole point of the scene: brass only looks like brass
 * when it has an environment to reflect, so `scene.environment` (see main.js)
 * does most of the work and these values just describe the surfaces.
 *
 * For a metal, `map` tints the reflectance rather than a diffuse albedo, which
 * is exactly what patinated brass wants.
 */

const ENAMELS = [
  "#c9d8e8", // ice
  "#2f5d8c", // lapis
  "#8c2f2f", // oxblood
  "#4f7a4a", // verdigris
  "#d9a441", // ochre
  "#e6dccb", // bone
  "#6f5aa0", // amethyst
  "#c4653a", // terracotta
];

export function createMaterials(rng, { deckRadius, orbitRadii, seedText }) {
  const textures = [];
  const materials = [];

  const track = (list, value) => {
    list.push(value);
    return value;
  };

  const deckMaps = makeDeckTextures(rng, { deckRadius, orbitRadii, seedText });
  const woodMaps = makeWoodTextures(rng);
  const brushed = makeBrushedRoughness(rng);
  textures.push(deckMaps.map, deckMaps.roughnessMap, woodMaps.map, woodMaps.roughnessMap, brushed);

  woodMaps.map.repeat.set(3, 1);
  woodMaps.roughnessMap.repeat.set(3, 1);

  const bench = {
    /** Polished brass — gears, arms, the column. */
    brass: track(
      materials,
      new THREE.MeshStandardMaterial({
        color: 0xd8a851,
        metalness: 1,
        // Not mirror-polished. On a metal this tight, the lamp reduces to a
        // pinpoint that clips white and then blooms into a flare.
        roughness: 0.38,
        envMapIntensity: 1.15,
      }),
    ),

    /** The same alloy, left to darken — fittings and small parts. */
    brassAged: track(
      materials,
      new THREE.MeshStandardMaterial({
        color: 0x9d7734,
        metalness: 1,
        roughness: 0.46,
        envMapIntensity: 0.95,
      }),
    ),

    /** Blued steel — arbors, screws, the crank. */
    steel: track(
      materials,
      new THREE.MeshStandardMaterial({
        color: 0x9aa3ad,
        metalness: 1,
        roughness: 0.34,
        roughnessMap: brushed,
        envMapIntensity: 1.0,
      }),
    ),

    /** The engraved dial plate. */
    deck: track(
      materials,
      new THREE.MeshStandardMaterial({
        map: deckMaps.map,
        roughnessMap: deckMaps.roughnessMap,
        color: 0xffffff,
        metalness: 1,
        roughness: 1,
        envMapIntensity: 0.9,
      }),
    ),

    /** Figured walnut carcase. */
    wood: track(
      materials,
      new THREE.MeshStandardMaterial({
        map: woodMaps.map,
        roughnessMap: woodMaps.roughnessMap,
        color: 0xffffff,
        metalness: 0,
        roughness: 1,
        envMapIntensity: 0.5,
      }),
    ),

    /** The central globe. Dark body, hot emissive — the only thing that blooms. */
    sun: track(
      materials,
      new THREE.MeshStandardMaterial({
        color: 0x1a0e02,
        emissive: 0xffb14a,
        emissiveIntensity: 1.75,
        metalness: 0,
        roughness: 0.5,
      }),
    ),

    /**
     * The vitrine. Kept off by default so the movement reads.
     *
     * Fully clear glass renders as nothing at all — physically right, visually
     * useless. Backing the transmission off and pushing the environment hard
     * buys back the sheet reflections that make a dome legible as glass, and a
     * long attenuation distance gives the thick edges a faint green cast.
     */
    glass: track(
      materials,
      new THREE.MeshPhysicalMaterial({
        color: 0xeaf4f2,
        metalness: 0,
        roughness: 0.03,
        // Whatever is not transmitted shows up as white haze over the movement,
        // so this stays high; the dome is read from its reflections and its
        // brass frame, not from being cloudy.
        transmission: 0.93,
        thickness: 0.7,
        attenuationColor: new THREE.Color(0xcfe4dc),
        attenuationDistance: 16,
        ior: 1.52,
        transparent: true,
        side: THREE.DoubleSide,
        envMapIntensity: 1.8,
      }),
    ),

    /** One enamelled body, plus its own texture, tracked for disposal. */
    makePlanetMaterial() {
      const [ground, band] = rng.sample(ENAMELS, 2);
      const texture = track(textures, makePlanetTexture(rng, ground, band));
      return track(
        materials,
        new THREE.MeshStandardMaterial({
          map: texture,
          metalness: 0.02,
          // Deliberately no shinier than this: a tight highlight on a small
          // sphere clips to white and the body loses its enamel entirely.
          roughness: rng.range(0.45, 0.75),
          envMapIntensity: 0.7,
        }),
      );
    },

    /**
     * A ring system for whichever body draws one. The canvas already carries
     * per-pixel alpha, so `map` alone cuts the gaps — adding an `alphaMap` on
     * top would multiply by the green channel and eat the darker bands.
     */
    makeRingMaterial() {
      const texture = track(textures, makeRingTexture(rng, rng.pick(ENAMELS)));
      return track(
        materials,
        new THREE.MeshStandardMaterial({
          map: texture,
          transparent: true,
          depthWrite: false,
          side: THREE.DoubleSide,
          metalness: 0.1,
          roughness: 0.8,
        }),
      );
    },

    dispose() {
      for (const material of materials) material.dispose();
      for (const texture of textures) texture.dispose();
    },
  };

  return bench;
}
