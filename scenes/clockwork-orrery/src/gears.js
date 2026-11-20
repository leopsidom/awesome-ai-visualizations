import * as THREE from "three";

/**
 * The going train, laid out on top of the dial plate in the sun-and-planet
 * arrangement a real orrery uses: one great wheel around the column, and a ring
 * of satellite wheels driven off its teeth.
 *
 * Two bits of maths carry the whole module.
 *
 * 1. Tooth profile. Teeth are cut as trapezoids in a `Shape` and extruded. With
 *    a shared module `m`, a wheel of `N` teeth has pitch radius `mN/2`, so two
 *    wheels mesh when their centres sit `m(N1 + N2)/2` apart — that is how every
 *    satellite is placed, rather than by eye.
 *
 * 2. Phase. Teeth interlock only if a tooth of one wheel meets a *gap* of the
 *    other along the line of centres. Writing u = ψ − (angle to the other wheel),
 *    rolling contact gives N1·u1 = −N2·u2 + π, so
 *
 *      ψ2 = α + π + (π − N1(ψ1 − α)) / N2
 *
 *    which is linear in ψ1 — evaluate it once at ψ1 = 0 for the phase offset,
 *    then spin at ω2 = −ω1·N1/N2 and the teeth stay meshed forever.
 *
 * Everything is worked in *plan* coordinates (u, v), where a wheel at plan angle
 * α sits at world (d·cos α, y, −d·sin α). The mapping is chosen so that after
 * `rotateX(-π/2)` — which stands the extruded profile up on the deck —
 * `mesh.rotation.y` adds directly to a tooth's plan angle.
 */

const MODULE = 0.09;

// -------------------------------------------------------------- one gear body --

/**
 * A spur gear as a closed `Shape`, teeth first, then a central bore and any
 * lightening holes as `Path` holes (wound the other way, per the extruder).
 */
function gearShape({ teeth, module: m, boreRadius, spokeCount }) {
  const pitchRadius = (m * teeth) / 2;
  const tipRadius = pitchRadius + m * 0.85;
  const rootRadius = pitchRadius - m * 1.1;

  const pitch = (Math.PI * 2) / teeth;
  // A tooth spans a quarter-pitch either side at the pitch circle; the flanks
  // then splay out to the root and taper in to the tip.
  const halfAtTip = pitch * 0.25 * 0.55;
  const halfAtRoot = pitch * 0.25 * 1.5;

  const shape = new THREE.Shape();
  let started = false;
  for (let i = 0; i < teeth; i++) {
    const center = i * pitch;
    const points = [
      [rootRadius, center - halfAtRoot],
      [tipRadius, center - halfAtTip],
      [tipRadius, center + halfAtTip],
      [rootRadius, center + halfAtRoot],
      [rootRadius, center + pitch * 0.5], // keeps the root arc from cutting flat
    ];

    for (const [radius, angle] of points) {
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (started) {
        shape.lineTo(x, y);
      } else {
        shape.moveTo(x, y);
        started = true;
      }
    }
  }
  shape.closePath();

  const bore = new THREE.Path();
  bore.absarc(0, 0, boreRadius, 0, Math.PI * 2, true);
  shape.holes.push(bore);

  if (spokeCount > 0 && rootRadius - boreRadius > 0.9) {
    const ringRadius = (boreRadius + rootRadius) / 2;
    const holeRadius = (rootRadius - boreRadius) * 0.28;
    for (let i = 0; i < spokeCount; i++) {
      const angle = (i / spokeCount) * Math.PI * 2 + Math.PI / spokeCount;
      const hole = new THREE.Path();
      hole.absarc(
        Math.cos(angle) * ringRadius,
        Math.sin(angle) * ringRadius,
        holeRadius,
        0,
        Math.PI * 2,
        true,
      );
      shape.holes.push(hole);
    }
  }

  return shape;
}

/** Extrude the profile and stand it up, so the wheel lies flat on the deck. */
function gearGeometry(options) {
  const geometry = new THREE.ExtrudeGeometry(gearShape(options), {
    depth: options.thickness,
    bevelEnabled: true,
    bevelThickness: 0.01,
    bevelSize: 0.01,
    bevelSegments: 1,
    curveSegments: 10,
    steps: 1,
  });
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

// ------------------------------------------------------------------ the train --

export function createGearTrain(rng, materials, { deckTop, deckRadius, driveRate }) {
  const group = new THREE.Group();
  const geometries = [];
  const wheels = []; // { pivot, phase, rate }

  const track = (geometry) => {
    geometries.push(geometry);
    return geometry;
  };

  const mount = (mesh) => {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  };

  // --- the great wheel, fixed to the column and turning with the first orbit ---

  const GREAT_TEETH = 54;
  const greatPitch = (MODULE * GREAT_TEETH) / 2;
  const bedHeight = deckTop + 0.06;

  const greatPivot = new THREE.Object3D();
  greatPivot.position.y = bedHeight;
  group.add(greatPivot);

  greatPivot.add(
    mount(
      new THREE.Mesh(
        track(
          gearGeometry({
            teeth: GREAT_TEETH,
            module: MODULE,
            boreRadius: 0.34,
            spokeCount: 5,
            thickness: 0.11,
          }),
        ),
        materials.brass,
      ),
    ),
  );

  wheels.push({ pivot: greatPivot, phase: 0, rate: driveRate });

  // --- satellites, each meshed straight onto the great wheel -------------------

  // A satellite's outermost tooth sits at m(N_great/2 + N + 0.85) from the axis,
  // so the plate radius caps the tooth count. Deriving the pool instead of
  // hard-coding it keeps a wheel from hanging over the rim if the plate is
  // ever resized.
  const maxTeeth = (deckRadius - 0.25) / MODULE - GREAT_TEETH / 2 - 0.85;
  const candidates = [13, 17, 19, 23, 29, 31].filter((teeth) => teeth <= maxTeeth);

  const satelliteTeeth = rng.sample(candidates, rng.int(3, Math.min(4, candidates.length)));
  const spacing = (Math.PI * 2) / satelliteTeeth.length;

  satelliteTeeth.forEach((teeth, index) => {
    // Evenly spaced with a little jitter — the wheels are far smaller than the
    // gaps between them, so no placement check is needed.
    const alpha = index * spacing + rng.range(-0.3, 0.3);
    const distance = (MODULE * (GREAT_TEETH + teeth)) / 2;

    const phase = alpha + Math.PI + (Math.PI + GREAT_TEETH * alpha) / teeth;
    const rate = (-GREAT_TEETH * driveRate) / teeth;

    const pivot = new THREE.Object3D();
    pivot.position.set(Math.cos(alpha) * distance, bedHeight, -Math.sin(alpha) * distance);
    group.add(pivot);

    pivot.add(
      mount(
        new THREE.Mesh(
          track(
            gearGeometry({
              teeth,
              module: MODULE,
              boreRadius: 0.075,
              spokeCount: 0,
              thickness: 0.085,
            }),
          ),
          materials.brass,
        ),
      ),
    );

    // A pinion stacked on the same arbor. It drives nothing here, but it is what
    // gives each satellite a distinct silhouette from above.
    const pinion = mount(
      new THREE.Mesh(
        track(
          gearGeometry({
            teeth: 9,
            module: MODULE * 0.72,
            boreRadius: 0.055,
            spokeCount: 0,
            thickness: 0.07,
          }),
        ),
        materials.brassAged,
      ),
    );
    pinion.position.y = 0.12;
    pivot.add(pinion);

    // Arbor: a steel rod down through the plate, with a collet above the pinion.
    const arbor = mount(
      new THREE.Mesh(
        track(new THREE.CylinderGeometry(0.045, 0.045, 0.52, 14)),
        materials.steel,
      ),
    );
    arbor.position.y = 0.13;
    pivot.add(arbor);

    const collet = mount(
      new THREE.Mesh(track(new THREE.CylinderGeometry(0.085, 0.085, 0.05, 16)), materials.steel),
    );
    collet.position.y = 0.225;
    pivot.add(collet);

    wheels.push({ pivot, phase, rate });

    // The fastest satellite carries the winding crank.
    if (index === 0) {
      const armLength = (MODULE * teeth) / 2 + 0.18;

      const arm = mount(
        new THREE.Mesh(track(new THREE.BoxGeometry(armLength, 0.05, 0.09)), materials.steel),
      );
      arm.position.set(armLength / 2, 0.4, 0);
      pivot.add(arm);

      const knob = mount(
        new THREE.Mesh(
          track(new THREE.CylinderGeometry(0.06, 0.075, 0.17, 14)),
          materials.brassAged,
        ),
      );
      knob.position.set(armLength, 0.47, 0);
      pivot.add(knob);
    }
  });

  return {
    group,
    /** The great wheel's pitch radius — the orrery's column sits inside it. */
    greatPitchRadius: greatPitch,

    update(time) {
      for (const wheel of wheels) {
        wheel.pivot.rotation.y = wheel.phase + wheel.rate * time;
      }
    },

    dispose() {
      for (const geometry of geometries) geometry.dispose();
    },
  };
}
