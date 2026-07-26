import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

import { CAVITY } from "./cavity.js";
import { MINERALS } from "./minerals.js";
import { makeCrystalMaps } from "./textures.js";

/**
 * The druse — the crust of crystals lining the cavity — and the hero cluster
 * standing in the light.
 *
 * They are two tiers on purpose, and the split is a rendering decision as much
 * as an artistic one:
 *
 *   - The **crust** is ~900 `InstancedMesh` copies, opaque. It is opaque because
 *     `transmission` refracts through the *mesh's* model matrix, which an
 *     instanced mesh shares across every instance: nine hundred crystals would
 *     all refract as though they were the same crystal. Clearcoat, a low
 *     roughness and a strong environment contribution buy back most of the look
 *     for none of that cost, and opaque geometry also sorts and shadows without
 *     argument.
 *   - The **hero cluster** is a dozen individual meshes with real transmission,
 *     volumetric absorption and iridescence. A dozen model matrices are a dozen
 *     correct refractions, and the transmission pass itself is drawn once per
 *     frame regardless of how many objects use it — so the expensive material
 *     costs about the same whether one crystal wears it or twelve.
 *
 * The contrast between the two tiers is the point: the crust reads as stone,
 * the heroes read as gems.
 */

const UP = new THREE.Vector3(0, 1, 0);

export function createCrystals(rng, cavity, mineralIndex) {
  const group = new THREE.Group();
  const maps = makeCrystalMaps(rng);

  // ----------------------------------------------------------- the geometry --

  // One unit crystal: a hexagonal prism from y=0 to y=1 that narrows slightly
  // toward a six-sided pyramid termination. The crust scales copies of it; the
  // heroes each get their own, sized in place — see below for why.
  const crustGeometry = makeCrystalGeometry({ taper: 0.8, tip: 0.34 });

  // ---------------------------------------------------------------- crust --

  const crustMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, // the tint arrives per instance
    map: maps.map,
    roughnessMap: maps.roughnessMap,
    metalness: 0,
    roughness: 0.22,
    clearcoat: 1,
    clearcoatRoughness: 0.09,
    iridescence: 0.26,
    iridescenceIOR: 1.35,
    iridescenceThicknessRange: [120, 460],
    envMapIntensity: 1.35,
    flatShading: true, // six flat faces and a pyramid, not a smooth cone
  });

  const seats = growCrust(rng, cavity);
  const crust = new THREE.InstancedMesh(crustGeometry, crustMaterial, seats.length);
  crust.castShadow = false; // far too small to resolve in a 2048² map
  crust.receiveShadow = true;

  const matrix = new THREE.Matrix4();
  for (let i = 0; i < seats.length; i++) {
    const seat = seats[i];
    matrix.compose(seat.position, seat.quaternion, seat.scale);
    crust.setMatrixAt(i, matrix);
  }
  crust.instanceMatrix.needsUpdate = true;
  crust.computeBoundingSphere();
  group.add(crust);

  // ----------------------------------------------------------------- heroes --

  const heroMaterial = new THREE.MeshPhysicalMaterial({
    map: maps.map,
    roughnessMap: maps.roughnessMap,
    metalness: 0,
    roughness: 0.06,
    // Not a full 1.0. At 1.0 the diffuse lobe is replaced outright by what is
    // behind the crystal — and what is behind it here is an unlit cavity, so
    // every hero came out a silhouette however hard the key was driven.
    // Holding a little diffuse back is what lets the beam land on them.
    transmission: 0.72,
    thickness: 1.6,
    ior: 1.55,
    attenuationDistance: 12,
    iridescence: 0.26,
    iridescenceIOR: 1.4,
    iridescenceThicknessRange: [140, 520],
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    envMapIntensity: 1.8,
    flatShading: true,
  });

  /**
   * Each hero gets its own geometry, built at its finished size, and sits in
   * the scene at scale 1.
   *
   * This is not fussiness. Three.js measures the refraction ray as
   * `thickness × modelScale`, so a shared unit crystal stretched to twenty-odd
   * units tall would be treated as twenty-odd units *thick* — and Beer-Lambert
   * absorption over that distance takes every one of them to solid black. The
   * scale has to live in the vertices, where the absorption cannot see it.
   */
  const heroGeometries = [];
  for (const seat of growHeroes(rng, cavity)) {
    const geometry = makeCrystalGeometry({ taper: seat.taper, tip: seat.tip });
    geometry.scale(seat.radius, seat.length, seat.radius);
    heroGeometries.push(geometry);

    const mesh = new THREE.Mesh(geometry, heroMaterial);
    mesh.position.copy(seat.position);
    mesh.quaternion.copy(seat.quaternion);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  // ---------------------------------------------------------------- mineral --

  const color = new THREE.Color();

  /**
   * Recolour in place. Habit — where each crystal sits, how big it is, which
   * way its hue jitters — is fixed by the seed; only the mineral changes, so
   * `C` really does show the same cavity cut from a different stone.
   */
  function setMineral(index) {
    const mineral = MINERALS[index % MINERALS.length];
    const body = new THREE.Color(mineral.body);
    const spread = new THREE.Color(mineral.spread);

    heroMaterial.color.copy(body);
    heroMaterial.attenuationColor.set(mineral.attenuation);

    for (let i = 0; i < seats.length; i++) {
      const seat = seats[i];
      color.copy(body).lerp(spread, seat.tint);
      color.offsetHSL(seat.hue, seat.saturation, seat.lightness);
      crust.setColorAt(i, color);
    }
    if (crust.instanceColor) crust.instanceColor.needsUpdate = true;
  }

  setMineral(mineralIndex);

  return {
    group,
    setMineral,

    dispose() {
      crustGeometry.dispose();
      for (const geometry of heroGeometries) geometry.dispose();
      crustMaterial.dispose();
      heroMaterial.dispose();
      maps.map.dispose();
      maps.roughnessMap.dispose();
      crust.dispose();
      group.clear();
    },
  };
}

// ------------------------------------------------------------------ geometry --

/**
 * A unit crystal along +Y: base at y=0 with radius 1, prism to y=1 narrowing to
 * `taper`, then a pyramid termination `tip` tall. Six radial segments make the
 * prism a hexagon and the termination a six-faced point — quartz habit, near
 * enough. Both caps of the prism are left open because the termination and the
 * base disc close them exactly, and an interior face inside a transmissive
 * solid would show up as a ghost plane.
 */
function makeCrystalGeometry({ sides = 6, taper = 0.8, tip = 0.34 } = {}) {
  const shaft = new THREE.CylinderGeometry(taper, 1, 1, sides, 1, true);
  shaft.translate(0, 0.5, 0);

  const termination = new THREE.ConeGeometry(taper, tip, sides, 1, true);
  termination.translate(0, 1 + tip / 2, 0);

  const base = new THREE.CircleGeometry(1, sides);
  base.rotateX(Math.PI / 2);

  const merged = mergeGeometries([shaft, termination, base]);

  shaft.dispose();
  termination.dispose();
  base.dispose();

  return merged;
}

// ------------------------------------------------------------------ planting --

/**
 * Where the crust grows. Druse nucleates: crystals appear in patches around a
 * seed point rather than evenly, so most of these are scattered around a few
 * dozen nuclei and the rest are sprinkled to break up the patches.
 */
function growCrust(rng, cavity) {
  const target = rng.int(1150, 1500);
  const nuclei = [];
  for (let i = 0; i < rng.int(26, 44); i++) nuclei.push(randomDirection(rng));

  const seats = [];
  const dir = new THREE.Vector3();
  const axis = new THREE.Vector3();
  const spin = new THREE.Quaternion();

  // Bounded: rejected candidates (the crack, below the waterline) would
  // otherwise let a bad seed spin here forever.
  for (let attempt = 0; attempt < target * 4 && seats.length < target; attempt++) {
    if (rng() < 0.72) {
      dir.copy(rng.pick(nuclei));
      dir.x += rng.gauss(0, 0.17);
      dir.y += rng.gauss(0, 0.17);
      dir.z += rng.gauss(0, 0.17);
      dir.normalize();
    } else {
      dir.copy(randomDirection(rng));
    }

    // Nothing grows across the opening, and nothing that would drown.
    if (cavity.crackAt(dir) > 0.03) continue;

    const wall = cavity.radiusAt(dir);
    if (dir.y * wall < CAVITY.poolY + 0.5) continue;

    // Mostly small, occasionally not — the tail is what stops the crust
    // reading as gravel.
    const radius = Math.min(0.7, 0.11 + Math.abs(rng.gauss(0, 0.28)));
    const length = radius * rng.range(3.4, 7.5);

    // Crystals grow roughly normal to the wall. Roughly.
    axis.copy(dir).multiplyScalar(-1);
    axis.x += rng.gauss(0, 0.2);
    axis.y += rng.gauss(0, 0.2);
    axis.z += rng.gauss(0, 0.2);
    axis.normalize();

    const quaternion = new THREE.Quaternion().setFromUnitVectors(UP, axis);
    // Roll about its own axis, so neighbouring hexagons do not line up.
    spin.setFromAxisAngle(axis, rng.range(0, Math.PI * 2));
    quaternion.premultiply(spin);

    seats.push({
      // Sunk into the rock far enough to cover the vertex jitter the shell
      // adds on top of this same field — otherwise a crystal occasionally
      // ends up standing on a dimple with its base disc showing.
      position: dir.clone().multiplyScalar(wall - radius * 0.9 - 0.5),
      quaternion,
      scale: new THREE.Vector3(radius, length, radius),
      tint: rng(),
      hue: rng.gauss(0, 0.014),
      saturation: rng.gauss(0, 0.07),
      lightness: rng.gauss(0, 0.055),
    });
  }

  return seats;
}

/**
 * The cluster standing in the beam. Grown at the waterline where the light
 * lands, tilted off vertical, and biased small so the two or three big ones
 * read as big.
 */
function growHeroes(rng, cavity) {
  const focus = cavity.beamTarget();
  const seats = [];
  const axis = new THREE.Vector3();
  const spin = new THREE.Quaternion();

  const count = rng.int(11, 17);
  for (let i = 0; i < count; i++) {
    const angle = rng.range(0, Math.PI * 2);
    const distance = Math.sqrt(rng()) * 4.5;

    const size = Math.pow(rng(), 1.8);
    const radius = 0.5 + size * 1.5;
    const length = radius * rng.range(5.5, 9.5);

    axis.set(rng.gauss(0, 0.2), 1, rng.gauss(0, 0.2)).normalize();

    const quaternion = new THREE.Quaternion().setFromUnitVectors(UP, axis);
    spin.setFromAxisAngle(axis, rng.range(0, Math.PI * 2));
    quaternion.premultiply(spin);

    seats.push({
      position: new THREE.Vector3(
        focus.x + Math.cos(angle) * distance,
        // Rooted just under the surface, so each one stands *in* the water.
        CAVITY.poolY - rng.range(0.4, 1.4),
        focus.z + Math.sin(angle) * distance,
      ),
      quaternion,
      radius,
      length,
      taper: rng.range(0.8, 0.92),
      tip: rng.range(0.3, 0.55),
    });
  }

  return seats;
}

/**
 * Uniform on the sphere. Picking two angles instead would bunch the crust at
 * the top and bottom of the cavity, which is exactly where it would show.
 */
function randomDirection(rng) {
  const height = rng.range(-1, 1);
  const theta = rng.range(0, Math.PI * 2);
  const ring = Math.sqrt(Math.max(0, 1 - height * height));
  return new THREE.Vector3(ring * Math.cos(theta), height, ring * Math.sin(theta));
}
