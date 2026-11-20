import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

import { skyLit } from "./shading.js";

/**
 * The machines.
 *
 * Nothing here is keyframed. Each turbine reads the wind field at its own feet
 * every frame and derives two things from it:
 *
 * - **Yaw.** The nacelle turns to face upwind, damped hard, because a real one
 *   yaws at well under a degree a second. A gust front crossing the farm
 *   therefore swings the near machine a beat before the far one.
 * - **Rotor speed.** `ω = λv/R` at a tip-speed ratio of 7.2 — the relation a
 *   variable-speed turbine's controller actually holds — capped at 18 rpm and
 *   dropped to an idle below the 3 m/s cut-in. At 8 m/s that is 11 rpm, which
 *   is why the blades look as unhurried as they do from a distance.
 *
 * The same wind speed goes through a `½ρAv³Cp` power curve, so the megawatts in
 * the corner are the farm's real output for the weather on screen rather than a
 * number chosen to look plausible.
 *
 * The whole farm shares one set of geometries and one set of materials; only
 * the transforms differ, which is also true of a real wind farm.
 */

const HUB_HEIGHT = 72;
const ROTOR_RADIUS = 48;
const NACELLE_LENGTH = 12;
const ROTOR_PLANE = -8.4; // metres forward of the yaw axis

const TIP_SPEED_RATIO = 7.2;
const MAX_RPM = 18;
const CUT_IN = 3.0;
const CUT_OUT = 25;
const RATED = 4.2e6; // W
const CP = 0.45;
const AIR_DENSITY = 1.225;
const SWEPT = Math.PI * ROTOR_RADIUS * ROTOR_RADIUS;

/** Turbines further out than this stop casting: their shadows land off the map. */
const SHADOW_RANGE = 300;

export function createTurbines(rng, field, shared, wind, sunAzimuth) {
  const group = new THREE.Group();

  // ------------------------------------------------------------- materials --

  const paint = new THREE.MeshStandardMaterial({
    color: new THREE.Color().setHSL(0.11, 0.09, 0.86),
    roughness: 0.62,
    metalness: 0,
  });
  const bladePaint = new THREE.MeshStandardMaterial({
    color: new THREE.Color().setHSL(0.11, 0.07, 0.88),
    roughness: 0.42,
    metalness: 0,
  });
  const concrete = new THREE.MeshStandardMaterial({
    color: new THREE.Color().setHSL(0.1, 0.06, 0.52),
    roughness: 0.95,
    metalness: 0,
  });

  for (const [material, label] of [
    [paint, "turbine"],
    [bladePaint, "blade"],
    [concrete, "concrete"],
  ]) {
    skyLit(material, shared, wind, { label, cloudShadow: 0.9 });
  }

  // ------------------------------------------------------------- geometries --

  const towerGeometry = new THREE.CylinderGeometry(1.45, 2.6, HUB_HEIGHT, 26, 1, false);
  towerGeometry.translate(0, HUB_HEIGHT / 2, 0);

  const nacelleGeometry = buildNacelle();
  const rotorGeometry = buildRotor(rng);

  const padGeometry = new THREE.CylinderGeometry(4.4, 4.8, 0.65, 22);
  padGeometry.translate(0, 0.18, 0);

  // ---------------------------------------------------------------- layout --

  const sites = planFarm(rng, field, wind, sunAzimuth);
  const machines = [];

  for (const site of sites) {
    const base = new THREE.Group();
    base.position.set(site.x, field.heightAt(site.x, site.z), site.z);
    group.add(base);

    const casts = site.distance < SHADOW_RANGE;

    const pad = new THREE.Mesh(padGeometry, concrete);
    pad.receiveShadow = true;
    pad.castShadow = casts;
    base.add(pad);

    const tower = new THREE.Mesh(towerGeometry, paint);
    tower.castShadow = casts;
    tower.receiveShadow = true;
    base.add(tower);

    // Yaw about the tower head; the nacelle carries a 5° uptilt with it.
    const yaw = new THREE.Group();
    yaw.position.y = HUB_HEIGHT;
    yaw.rotation.y = Math.PI - wind.bearingAt(site.x, site.z);
    base.add(yaw);

    const tilt = new THREE.Group();
    tilt.rotation.x = THREE.MathUtils.degToRad(5);
    yaw.add(tilt);

    const nacelle = new THREE.Mesh(nacelleGeometry, paint);
    nacelle.castShadow = casts;
    nacelle.receiveShadow = true;
    tilt.add(nacelle);

    const rotor = new THREE.Mesh(rotorGeometry, bladePaint);
    rotor.position.z = ROTOR_PLANE;
    rotor.rotation.z = rng.range(0, Math.PI * 2);
    rotor.castShadow = casts;
    rotor.receiveShadow = true;
    tilt.add(rotor);

    machines.push({ site, yaw, rotor, angle: rotor.rotation.z, yawAngle: yaw.rotation.y });
  }

  // Slowest machine first is meaningless; sort by distance so the readout can
  // quote the nearest one.
  machines.sort((a, b) => a.site.distance - b.site.distance);

  let output = 0;

  return {
    group,
    count: machines.length,

    /** Farm output in megawatts, from the wind each machine is actually in. */
    get megawatts() {
      return output / 1e6;
    },

    /** Rotor speed of the nearest machine, in rpm. */
    get rpm() {
      return machines.length ? (rotorSpeed(wind.speedAt(machines[0].site.x, machines[0].site.z)) * 60) / (Math.PI * 2) : 0;
    },

    update(delta) {
      let total = 0;

      for (const machine of machines) {
        const { x, z } = machine.site;
        const speed = wind.speedAt(x, z);

        // Yaw drives toward the local bearing, but slowly, and by the short way
        // round so it never unwinds through a full turn.
        const target = Math.PI - wind.bearingAt(x, z);
        let error = ((target - machine.yawAngle + Math.PI) % (Math.PI * 2)) - Math.PI;
        if (error < -Math.PI) error += Math.PI * 2;
        machine.yawAngle += error * (1 - Math.exp(-0.35 * delta));
        machine.yaw.rotation.y = machine.yawAngle;

        machine.angle += rotorSpeed(speed) * delta;
        machine.rotor.rotation.z = machine.angle;

        total += power(speed);
      }

      output = total;
    },

    dispose() {
      towerGeometry.dispose();
      nacelleGeometry.dispose();
      rotorGeometry.dispose();
      padGeometry.dispose();
      paint.dispose();
      bladePaint.dispose();
      concrete.dispose();
    },
  };
}

function rotorSpeed(windSpeed) {
  if (windSpeed < CUT_IN) return 0.055; // parked, drifting
  if (windSpeed > CUT_OUT) return 0;
  return Math.min((TIP_SPEED_RATIO * windSpeed) / ROTOR_RADIUS, (MAX_RPM * Math.PI * 2) / 60);
}

function power(windSpeed) {
  if (windSpeed < CUT_IN || windSpeed > CUT_OUT) return 0;
  return Math.min(0.5 * AIR_DENSITY * SWEPT * CP * windSpeed ** 3, RATED);
}

/**
 * Rows across the prevailing wind, spaced four rotor diameters apart, seven
 * diameters downwind — the arrangement that keeps each row out of the last
 * one's wake, and the reason wind farms look like they were set out with a
 * ruler that was then knocked sideways.
 */
function planFarm(rng, field, wind, sunAzimuth) {
  const diameter = ROTOR_RADIUS * 2;
  const downwind = diameter * rng.range(6.2, 7.8);
  const crosswind = diameter * rng.range(3.4, 4.4);

  const axis = wind.direction;
  const perp = { x: -axis.z, z: axis.x };

  const sites = [];

  // The hero: close enough to read as a machine, and roughly between the camera
  // and the sun so its shadow rakes back toward the lens.
  const heroAngle = sunAzimuth + 0.2 + rng.range(-0.22, 0.22);
  const heroRange = rng.range(190, 250);
  sites.push({ x: Math.sin(heroAngle) * heroRange, z: Math.cos(heroAngle) * heroRange });

  for (let row = -2; row <= 3; row++) {
    for (let column = -3; column <= 3; column++) {
      // Every other row is offset by half a bay.
      const along = row * downwind + rng.gauss() * 40;
      const across = (column + (row % 2 ? 0.5 : 0)) * crosswind + rng.gauss() * 55;

      const x = axis.x * along + perp.x * across;
      const z = axis.z * along + perp.z * across;
      const distance = Math.hypot(x, z);

      if (distance < 330 || distance > 2500) continue;

      // Keep the farm mostly in shot rather than mostly behind the camera.
      const azimuth = Math.atan2(x, z);
      let offset = Math.abs(((azimuth - sunAzimuth + Math.PI) % (Math.PI * 2)) - Math.PI);
      if (rng() > (offset < 1.4 ? 0.98 : 0.22)) continue;

      sites.push({ x, z });
    }
  }

  return sites
    .map((site) => ({ ...site, distance: Math.hypot(site.x, site.z) }))
    .filter((site, index, all) => all.every((other, j) => j >= index || Math.hypot(site.x - other.x, site.z - other.z) > 200))
    .slice(0, 16);
}

/** The nacelle: a lathe turned about Y, then laid down to point up-wind (-Z). */
function buildNacelle() {
  const profile = [
    [0.0, 0.0],
    [1.5, 0.12],
    [1.78, 0.9],
    [1.78, 7.6],
    [1.62, 9.4],
    [1.15, 10.9],
    [0.55, 11.7],
    [0.0, NACELLE_LENGTH],
  ].map(([radius, y]) => new THREE.Vector2(radius, y));

  const geometry = new THREE.LatheGeometry(profile, 22);
  geometry.rotateX(-Math.PI / 2); // +Y becomes -Z: the nose now points upwind
  geometry.translate(0, 0, 3.4); // straddle the yaw axis
  geometry.deleteAttribute("uv");
  return geometry;
}

/** Three blades and a spinner, merged into one mesh: one draw call per rotor. */
function buildRotor(rng) {
  const blade = buildBlade();
  const coning = THREE.MathUtils.degToRad(2.4);

  const parts = [];
  for (let i = 0; i < 3; i++) {
    const copy = blade.clone();
    copy.rotateX(coning); // tip downwind, to clear the tower
    copy.rotateZ((i / 3) * Math.PI * 2);
    parts.push(copy);
  }

  const spinner = new THREE.LatheGeometry(
    [
      [0.0, 0.0],
      [1.75, 0.02],
      [1.95, 0.9],
      [1.9, 2.2],
      [1.5, 3.2],
      [0.0, 3.9],
    ].map(([radius, y]) => new THREE.Vector2(radius, y)),
    20,
  );
  spinner.rotateX(-Math.PI / 2);
  // Lathe geometry carries UVs the lofted blades do not; mergeGeometries needs
  // the attribute sets to match exactly.
  spinner.deleteAttribute("uv");
  parts.push(spinner);

  const merged = mergeGeometries(parts);
  parts.forEach((part) => part.dispose());
  blade.dispose();
  return merged;
}

/**
 * One blade, lofted from cambered sections.
 *
 * Span runs along +Y, chord along X, thickness along Z. Each station gets a
 * chord, a twist and a NACA-ish section; the inboard fifth is blended into a
 * cylinder, because that is what a blade root is, and it is the detail that
 * stops the whole thing reading as a bent plank.
 */
function buildBlade() {
  const STATIONS = 20;
  const SECTION = 16;

  const length = ROTOR_RADIUS;
  const rootDiameter = 2.7;
  const maxChord = 3.9;
  const tipChord = 0.5;
  const twist = THREE.MathUtils.degToRad(15);
  const prebend = 2.6;

  const positions = [];

  for (let i = 0; i <= STATIONS; i++) {
    const t = i / STATIONS;

    const chord =
      t < 0.22
        ? THREE.MathUtils.lerp(rootDiameter, maxChord, THREE.MathUtils.smoothstep(t, 0.02, 0.22))
        : THREE.MathUtils.lerp(maxChord, tipChord, Math.pow((t - 0.22) / 0.78, 0.8));

    const round = 1 - THREE.MathUtils.smoothstep(t, 0.03, 0.2); // 1 at the root
    const pitchAxis = THREE.MathUtils.lerp(0.3, 0.5, round);
    const angle = twist * Math.pow(1 - t, 1.7);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    for (let j = 0; j < SECTION; j++) {
      const a = (j / SECTION) * Math.PI * 2;
      const s = 0.5 - 0.5 * Math.cos(a); // cosine spacing: dense at both edges
      const upper = a < Math.PI ? 1 : -1;

      const thickness =
        5 *
        0.19 *
        (0.2969 * Math.sqrt(s) - 0.126 * s - 0.3516 * s * s + 0.2843 * s ** 3 - 0.1036 * s ** 4);
      const camber = 0.055 * 4 * s * (1 - s);
      const wing = camber + upper * thickness;
      const circle = 0.5 * Math.sin(a);

      const across = (s - pitchAxis) * chord;
      const through = THREE.MathUtils.lerp(wing, circle, round) * chord;

      positions.push(
        across * cos - through * sin,
        t * length,
        across * sin + through * cos - prebend * t * t,
      );
    }
  }

  // Tip and root caps.
  const tip = positions.length / 3;
  positions.push(0, length, -prebend);
  const root = positions.length / 3;
  positions.push(0, 0, 0);

  const indices = [];
  const at = (station, j) => station * SECTION + (j % SECTION);

  for (let i = 0; i < STATIONS; i++) {
    for (let j = 0; j < SECTION; j++) {
      const a = at(i, j);
      const b = at(i, j + 1);
      const c = at(i + 1, j + 1);
      const d = at(i + 1, j);
      indices.push(a, b, c, a, c, d);
    }
  }
  for (let j = 0; j < SECTION; j++) {
    indices.push(tip, at(STATIONS, j), at(STATIONS, j + 1));
    indices.push(root, at(0, j + 1), at(0, j));
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
