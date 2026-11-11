import * as THREE from "three";

/**
 * The swell, the water and the sky.
 *
 * createSwell() is the one height function everything else rides on: the ocean, the
 * thread ribbons, the year gates and the event markers all sample it, so they stay
 * seated on the same water. It builds with time (x) and, past the last event, rears
 * up into the wall the ride ends in front of.
 */

export function createSwell(length) {
  const swell = {
    base: 0, // mean water level at the x last passed to profile()
    amp: 0, // wave amplitude there

    profile(x) {
      const u = x / length;
      const uc = Math.min(Math.max(u, 0), 1);
      swell.base = 16 * Math.pow(uc, 2.4);
      swell.amp = 0.35 + 2.3 * Math.pow(uc, 1.5);
      if (u > 1) {
        const w = Math.min(u - 1, 0.4);
        swell.base += 900 * w * w;
        swell.amp += 6 * w;
      }
    },

    height(x, z, t) {
      swell.profile(x);
      const a = 0.55 * Math.sin(x * 0.09 - t * 0.9);
      const b = 0.45 * Math.sin(x * 0.037 + z * 0.13 + t * 0.55);
      return swell.base + swell.amp * (a + b);
    },
  };
  return swell;
}

// The water is one grid that travels with the camera; its heights and colours are
// recomputed on the CPU each frame (about 7,900 vertices).
const STEP_X = 2.5;
const STEP_Z = 5;
const CELLS_X = 120;
const CELLS_Z = 64;
const OFFSET_Z = -40; // the grid reaches further away from the camera than toward it
const LEAD = 70; // and its centre runs this far ahead of the camera

export function createOcean(scene, swell, length) {
  const geometry = new THREE.PlaneGeometry(CELLS_X * STEP_X, CELLS_Z * STEP_Z, CELLS_X, CELLS_Z);
  geometry.rotateX(-Math.PI / 2);
  const pos = geometry.attributes.position.array;
  const col = new Float32Array(pos.length);
  geometry.setAttribute("color", new THREE.BufferAttribute(col, 3));

  // polygonOffset pushes the fill back so the wireframe drawn over it does not z-fight.
  const fillMaterial = new THREE.MeshBasicMaterial({
    vertexColors: true,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });
  const wireMaterial = new THREE.MeshBasicMaterial({
    color: 0x4aa8ff,
    wireframe: true,
    transparent: true,
    opacity: 0.13,
  });
  const fill = new THREE.Mesh(geometry, fillMaterial);
  const wire = new THREE.Mesh(geometry, wireMaterial);
  // The bounding sphere is never recomputed for the moving heights, so skip culling.
  fill.frustumCulled = wire.frustumCulled = false;
  fill.position.z = wire.position.z = OFFSET_Z;
  scene.add(fill, wire);

  const deep = new THREE.Color(0x07101f);
  const crest = new THREE.Color(0x1d7fb3);

  function update(cameraX, t) {
    // Snap to the grid pitch, so the vertices do not swim as the grid follows the camera.
    const gx = Math.round((cameraX + LEAD) / STEP_X) * STEP_X;
    fill.position.x = wire.position.x = gx;
    for (let i = 0; i < pos.length; i += 3) {
      const x = pos[i] + gx;
      const h = swell.height(x, pos[i + 2] + OFFSET_Z, t);
      const u = x / length;
      pos[i + 1] = h;
      // Brighter on the crests, brighter as the years go by, brightest on the wall.
      const c = 0.5 + (0.5 * (h - swell.base)) / swell.amp;
      const k = c * c * (0.3 + 0.7 * Math.min(1, Math.max(0, u))) + 2 * Math.min(0.4, Math.max(0, u - 1));
      col[i] = deep.r + (crest.r - deep.r) * k;
      col[i + 1] = deep.g + (crest.g - deep.g) * k;
      col[i + 2] = deep.b + (crest.b - deep.b) * k;
    }
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.color.needsUpdate = true;
  }

  function dispose() {
    scene.remove(fill, wire);
    geometry.dispose();
    fillMaterial.dispose();
    wireMaterial.dispose();
  }

  return { update, dispose };
}

const STAR_COUNT = 500;
const STAR_RADIUS = 420;

/** A dome of stars above the horizon. world.js keeps it centred on the camera. */
export function createStars(scene, rng) {
  const pos = new Float32Array(STAR_COUNT * 3);
  for (let i = 0; i < STAR_COUNT; i++) {
    const azimuth = rng.range(0, Math.PI * 2);
    const elevation = rng.range(0.08, 1.28);
    pos[i * 3] = STAR_RADIUS * Math.cos(elevation) * Math.cos(azimuth);
    pos[i * 3 + 1] = STAR_RADIUS * Math.sin(elevation);
    pos[i * 3 + 2] = STAR_RADIUS * Math.cos(elevation) * Math.sin(azimuth);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const material = new THREE.PointsMaterial({
    color: 0xa9c1ee,
    size: 1.6,
    sizeAttenuation: false,
    fog: false,
    transparent: true,
    opacity: 0.75,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  scene.add(points);

  function dispose() {
    scene.remove(points);
    geometry.dispose();
    material.dispose();
  }

  return { points, dispose };
}
