import * as THREE from "three";

/**
 * The instrument above the plate: a stepped column of concentric tubes, one arm
 * per body, and a lamp at the centre standing in for the sun.
 *
 * The scene graph does the animation. Each arm is an `Object3D` at the column's
 * axis; the body hangs off its far end inside a tilt frame, and any moon hangs
 * off the body. Three nested rotations — arm, axial spin, moon — then fall out
 * of the parent transforms for free, which is the whole reason to build it this
 * way rather than positioning bodies by hand each frame.
 */

/**
 * The orbit plan is drawn first and on its own, because the engraved dial plate
 * has to scribe a circle at every orbit radius — so the plan has to exist before
 * the textures are painted.
 */
export function planOrbits(rng) {
  const count = rng.int(4, 6);
  const direction = rng.sign();

  // Radii are laid out geometrically between a fixed inner and outer bound
  // rather than grown step by step, so however many bodies are drawn they
  // always land inside the dial plate.
  const inner = rng.range(1.05, 1.25);
  const outer = rng.range(4.0, 4.7);
  const ratio = Math.pow(outer / inner, 1 / (count - 1));

  const orbits = [];

  for (let i = 0; i < count; i++) {
    const radius = inner * Math.pow(ratio, i) * rng.range(0.98, 1.02);
    const bodyRadius = i === 0 ? rng.range(0.13, 0.18) : rng.range(0.16, 0.31);
    // A softened Kepler third law: outer bodies lag, but not so far that they
    // look nailed down over the length of a look.
    const period = 12 * Math.pow(radius / 1.35, 1.1);

    orbits.push({
      radius,
      bodyRadius,
      /** Height above the dial plate, so the plan stays independent of the carcase. */
      armLift: 0.45 + i * 0.3,
      rate: ((Math.PI * 2) / period) * direction,
      spin: rng.range(0.3, 1.2) * rng.sign(),
      tilt: rng.range(-0.45, 0.45),
      phase: rng.range(0, Math.PI * 2),
      moons:
        i > 0 && rng() < 0.5
          ? Array.from({ length: rng.int(1, 2) }, (_, m) => ({
              distance: bodyRadius + 0.16 + m * 0.13,
              radius: rng.range(0.035, 0.062),
              rate: rng.range(0.9, 2.1) * direction,
              phase: rng.range(0, Math.PI * 2),
            }))
          : [],
      ring: false,
    });
  }

  // Exactly one body draws a ring, never the innermost.
  if (count > 1) orbits[rng.int(1, count - 1)].ring = true;

  return orbits;
}

export function createOrrery(rng, materials, { deckTop, orbits }) {
  const group = new THREE.Group();
  const geometries = [];
  const arms = [];
  const spinners = [];
  const moons = [];

  const track = (geometry) => {
    geometries.push(geometry);
    return geometry;
  };

  const solid = (geometry, material) => {
    const mesh = new THREE.Mesh(track(geometry), material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  };

  const topArm = deckTop + orbits[orbits.length - 1].armLift;
  const columnTop = topArm + 0.45;

  // ------------------------------------------------------------ the column --

  const base = solid(new THREE.CylinderGeometry(0.32, 0.36, 0.14, 28), materials.brass);
  base.position.y = deckTop + 0.07;
  group.add(base);

  // One tube per arm, each thinner and taller than the last — the nested drives
  // a real orrery hides inside its pedestal, brought above the plate.
  orbits.forEach((orbit, index) => {
    const tubeRadius = 0.2 - index * 0.022;
    const height = orbit.armLift;
    const tube = solid(
      new THREE.CylinderGeometry(tubeRadius, tubeRadius, height, 24),
      index % 2 === 0 ? materials.brass : materials.brassAged,
    );
    tube.position.y = deckTop + height / 2;
    group.add(tube);
  });

  // A turned finial carries the last stretch up to the lamp.
  const finialProfile = [
    [0.0, 0.0],
    [0.095, 0.0],
    [0.11, 0.05],
    [0.07, 0.11],
    [0.098, 0.19],
    [0.142, 0.25],
    [0.095, 0.31],
    [0.062, 0.37],
    [0.085, 0.43],
    [0.0, 0.45],
  ].map(([x, y]) => new THREE.Vector2(x, y));

  const finial = solid(new THREE.LatheGeometry(finialProfile, 28), materials.brass);
  finial.position.y = topArm;
  group.add(finial);

  // ------------------------------------------------------------- the lamp --

  const sunRadius = 0.4;
  const sunY = columnTop + 0.3;

  const sun = new THREE.Mesh(track(new THREE.SphereGeometry(sunRadius, 40, 28)), materials.sun);
  sun.position.y = sunY;
  group.add(sun);

  // A single armillary hoop, tipped off the vertical — the one nod to the
  // instrument's older cousin.
  const hoop = solid(new THREE.TorusGeometry(sunRadius + 0.34, 0.014, 8, 96), materials.brassAged);
  hoop.position.y = sunY;
  hoop.rotation.set(Math.PI / 2 - 0.41, 0, 0.18);
  group.add(hoop);

  // Warm light thrown onto the inner bodies. Shadow casting stays off — the key
  // light already owns the shadows, and a second shadow map buys nothing here.
  const lamp = new THREE.PointLight(0xffc071, 3.4, 8, 2);
  lamp.position.y = sunY;
  group.add(lamp);

  // -------------------------------------------------------------- the arms --

  for (const orbit of orbits) {
    const arm = new THREE.Object3D();
    arm.position.y = deckTop + orbit.armLift;
    group.add(arm);
    arms.push({ node: arm, orbit });

    const hub = solid(new THREE.CylinderGeometry(0.1, 0.1, 0.075, 20), materials.brass);
    arm.add(hub);

    // The reach, and a stubbier tail with a ball to balance it.
    const reach = solid(
      new THREE.CylinderGeometry(0.038, 0.03, orbit.radius, 12),
      materials.brass,
    );
    reach.rotation.z = -Math.PI / 2;
    reach.position.x = orbit.radius / 2;
    arm.add(reach);

    const tailLength = orbit.radius * 0.3;
    const tail = solid(
      new THREE.CylinderGeometry(0.024, 0.028, tailLength, 12),
      materials.brassAged,
    );
    tail.rotation.z = Math.PI / 2;
    tail.position.x = -tailLength / 2;
    arm.add(tail);

    const counterweight = solid(new THREE.SphereGeometry(0.075, 20, 14), materials.brassAged);
    counterweight.position.x = -tailLength;
    arm.add(counterweight);

    const post = solid(new THREE.CylinderGeometry(0.021, 0.021, 0.19, 10), materials.brass);
    post.position.set(orbit.radius, 0.095, 0);
    arm.add(post);

    // --- the body ---

    const bodyPivot = new THREE.Object3D();
    bodyPivot.position.set(orbit.radius, 0.19 + orbit.bodyRadius, 0);
    arm.add(bodyPivot);

    const tiltFrame = new THREE.Object3D();
    tiltFrame.rotation.z = orbit.tilt;
    bodyPivot.add(tiltFrame);

    const body = solid(
      new THREE.SphereGeometry(orbit.bodyRadius, 36, 24),
      materials.makePlanetMaterial(),
    );
    tiltFrame.add(body);
    spinners.push({ node: body, rate: orbit.spin });

    if (orbit.ring) {
      const ring = new THREE.Mesh(
        track(
          new THREE.RingGeometry(orbit.bodyRadius * 1.45, orbit.bodyRadius * 2.4, 72, 1),
        ),
        materials.makeRingMaterial(),
      );
      // Flat in the body's own tilted frame, and never a shadow caster: an
      // alpha-cut ring casts a solid disc, which would band the body wrongly.
      ring.rotation.x = -Math.PI / 2;
      tiltFrame.add(ring);
    }

    for (const moon of orbit.moons) {
      const orbitNode = new THREE.Object3D();
      bodyPivot.add(orbitNode);
      moons.push({ node: orbitNode, moon });

      const wire = solid(
        new THREE.CylinderGeometry(0.008, 0.008, moon.distance, 6),
        materials.brassAged,
      );
      wire.rotation.z = -Math.PI / 2;
      wire.position.x = moon.distance / 2;
      orbitNode.add(wire);

      const bead = solid(new THREE.SphereGeometry(moon.radius, 16, 12), materials.brassAged);
      bead.position.x = moon.distance;
      orbitNode.add(bead);
    }
  }

  return {
    group,
    columnTop,
    sunHeight: sunY,
    /** The great wheel is fixed to the first arm, so they share a rate. */
    driveRate: orbits[0].rate,

    update(time) {
      for (const { node, orbit } of arms) node.rotation.y = orbit.phase + orbit.rate * time;
      for (const { node, rate } of spinners) node.rotation.y = rate * time;
      for (const { node, moon } of moons) node.rotation.y = moon.phase + moon.rate * time;

      // The lamp breathes, very slightly, so the inner bodies never sit still.
      lamp.intensity = 3.4 + Math.sin(time * 0.7) * 0.3;
    },

    dispose() {
      lamp.dispose();
      for (const geometry of geometries) geometry.dispose();
    },
  };
}
