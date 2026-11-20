import * as THREE from "three";

import { skyLit } from "./shading.js";

/**
 * The sward. One `InstancedMesh` of ~120 000 blades, one draw call, all of the
 * motion in the vertex shader.
 *
 * The instance matrices are **translation only**. That is the decision the rest
 * of this file hangs off: a blade's yaw, height, width, bend and flutter are all
 * applied to `position` inside the shader, before Three.js multiplies by
 * `instanceMatrix`, so the instance transform never rotates anything. Which
 * means the blade's local axes *are* the world axes, and bending a blade
 * downwind is `p.xz += flow * amount` rather than a per-instance change of basis.
 * It also means `instanceMatrix[3].xyz` is the blade's world position — the
 * lookup every wind sample needs — for free.
 *
 * The blades are lit as ordinary Lambert geometry so they pick up the sun, the
 * hemisphere fill and the turbines' shadow maps without any hand-written
 * lighting; shading.js adds the two things grass needs that Lambert has no idea
 * about — cloud shadow and translucency.
 *
 * Grass does not *cast* shadows. That is a deliberate trade rather than an
 * oversight: a bent blade would have to bend identically in the depth pass,
 * which means patching `customDepthMaterial` in lockstep with this shader, and
 * the payoff is self-shadowing noise at a scale where the eye reads it as
 * aliasing anyway.
 */

const TAU = Math.PI * 2;

const COUNT = 220000;
const RADIUS = 230;

export function createGrass(rng, field, shared, wind) {
  const geometry = buildBlade();

  const blade = new Float32Array(COUNT * 4);
  const tune = new Float32Array(COUNT * 4);
  geometry.setAttribute("aBlade", new THREE.InstancedBufferAttribute(blade, 4));
  geometry.setAttribute("aTune", new THREE.InstancedBufferAttribute(tune, 4));

  const material = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide });

  skyLit(material, shared, wind, {
    label: "grass",
    cloudShadow: 1,
    // Grass at this hour is lit *through*, not on. The mask keeps the glow in
    // the upper half of the blade, where a real one is thin enough to pass light.
    backlight: 1.0,
    backlightMask: "pow(vBladeHeight, 1.5)",
    backlightPower: 4.4,
    vertex: {
      head: /* glsl */ `
        attribute vec4 aBlade;   // yaw, height, width, phase
        attribute vec4 aTune;    // stiffness, curl, -, -
        varying float vBladeHeight;

        void grassBend(out vec2 flow, out float bend) {
          vec2 ground = instanceMatrix[3].xz;
          flow = windFlow(ground);

          // Gust field for the slow swell, ripple field for the fast waves that
          // actually run across the grass, flutter for the last bit of life.
          float speed = windSpeedAt(ground) * (0.70 + 0.55 * (0.5 + 0.5 * windRipple(ground)));
          float flutter = sin(uWindTime * (4.6 + aTune.x * 4.4) + aBlade.w) * 0.10;

          bend = clamp(speed / 13.0 / max(aTune.x, 0.4) + flutter, 0.0, 1.25);
        }

        vec3 grassYaw(vec3 p, float angle) {
          float c = cos(angle);
          float s = sin(angle);
          return vec3(p.x * c - p.z * s, p.y, p.x * s + p.z * c);
        }
      `,
      normal: /* glsl */ `
        {
          vec2 flow;
          float bend;
          grassBend(flow, bend);
          vec3 n = grassYaw(objectNormal, aBlade.x);
          // Lay the normal over with the blade, and lift it a little so grass
          // flattened by a gale still catches the sun rather than going black.
          objectNormal = normalize(n - vec3(flow.x, -0.55, flow.y) * bend * 0.42);
        }
      `,
      position: /* glsl */ `
        {
          float t = position.y;             // 0..1 along the blade
          vBladeHeight = t;

          vec2 flow;
          float bend;
          grassBend(flow, bend);

          vec3 p = vec3(position.x * aBlade.z, t * aBlade.y, position.z * aBlade.y * aTune.y);
          p = grassYaw(p, aBlade.x);

          // Bend is quadratic in height: the base stays planted, the tip does
          // the travelling.
          float sweep = bend * t * t * aBlade.y * 0.8;
          p.x += flow.x * sweep;
          p.z += flow.y * sweep;
          // Shorten as it leans, so a blade laid flat does not stretch.
          p.y *= 1.0 - clamp(0.42 * bend * bend * t, 0.0, 0.8);

          transformed = p;
        }
      `,
    },
    fragment: {
      head: "varying float vBladeHeight;",
      // Ambient occlusion down in the thatch, and a bleached tip.
      color: "diffuseColor.rgb *= mix(0.62, 1.2, pow(vBladeHeight, 0.7));",
    },
  });

  const mesh = new THREE.InstancedMesh(geometry, material, COUNT);
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;

  // ------------------------------------------------------------- scattering --

  const matrix = new THREE.Matrix4();
  const tint = new THREE.Color();
  const dry = new THREE.Color().setHSL(rng.range(0.1, 0.12), 0.66, 0.56);
  const green = new THREE.Color().setHSL(rng.range(0.16, 0.21), 0.44, 0.3);

  let placed = 0;
  let attempts = 0;
  const maxAttempts = COUNT * 6;

  while (placed < COUNT && attempts < maxAttempts) {
    attempts++;

    // The camera rides eight to eighteen metres up, so the nearest ground it can
    // actually see is about forty metres out. Concentrating blades at the origin
    // would spend most of them under the lens; the exponent puts the bulk in the
    // band that is on screen.
    const radius = 12 + (RADIUS - 12) * Math.pow(rng(), 1.45);
    const angle = rng.range(0, TAU);
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;

    const cover = field.coverAt(x, z);
    if (rng() > cover * 0.94 + 0.06) continue;

    // Distant blades are scaled up so they still land on a pixel; without this
    // the far half of the field quietly turns back into bare ground. Width takes
    // almost all of it — stretching height instead grows grass taller than the
    // fence posts it is supposed to be measured against.
    const height = rng.range(0.5, 1.0) * (0.72 + cover * 0.5) * Math.min(1 + radius * 0.0045, 1.7);
    const width = rng.range(0.018, 0.032) * Math.min(1 + radius * 0.021, 4.6);

    matrix.makeTranslation(x, field.heightAt(x, z) - 0.05, z);
    mesh.setMatrixAt(placed, matrix);

    const i4 = placed * 4;
    blade[i4] = rng.range(0, TAU); // yaw
    blade[i4 + 1] = height;
    blade[i4 + 2] = width;
    blade[i4 + 3] = rng.range(0, TAU); // flutter phase

    tune[i4] = rng.range(0.62, 1.5); // stiffness
    tune[i4 + 1] = rng.range(0.5, 1.7); // how much of the baked-in curl it keeps
    tune[i4 + 2] = 0;
    tune[i4 + 3] = 0;

    tint.copy(dry).lerp(green, THREE.MathUtils.clamp(cover * rng.range(0.3, 1.0), 0, 1));
    tint.multiplyScalar(rng.range(0.88, 1.1));
    mesh.setColorAt(placed, tint);

    placed++;
  }

  mesh.count = placed;
  mesh.instanceMatrix.needsUpdate = true;
  mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();

  return {
    group: mesh,
    count: placed,

    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}

/**
 * One blade: a tapered ribbon, six rows collapsing to a point, built at unit
 * height so the shader can size it per instance.
 *
 * The normals are splayed outward across the width rather than left flat, which
 * gives each blade a cylinder's worth of shading falloff instead of a hard
 * facet — the cheapest way to stop 120 000 flat quads reading as confetti.
 */
function buildBlade() {
  const rows = [0, 0.2, 0.4, 0.6, 0.78, 0.92, 1];
  const widths = [1, 0.94, 0.84, 0.68, 0.46, 0.24, 0];
  // Baked-in curl: the blade arcs forward, which the shader scales per blade.
  const curl = rows.map((t) => t * t * 0.22);

  const positions = [];
  const normals = [];
  const splay = 0.55;

  for (let i = 0; i < rows.length; i++) {
    const t = rows[i];
    const w = widths[i] * 0.5;
    if (i === rows.length - 1) {
      positions.push(0, t, curl[i]);
      normals.push(0, 0.18, 1);
    } else {
      positions.push(-w, t, curl[i]);
      normals.push(-splay, 0.18, 1);
      positions.push(w, t, curl[i]);
      normals.push(splay, 0.18, 1);
    }
  }

  const indices = [];
  for (let i = 0; i < rows.length - 2; i++) {
    const a = i * 2;
    indices.push(a, a + 1, a + 3, a, a + 3, a + 2);
  }
  const tip = (rows.length - 2) * 2;
  indices.push(tip, tip + 1, tip + 2);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setIndex(indices);
  normalise(geometry.attributes.normal);
  return geometry;
}

function normalise(attribute) {
  const array = attribute.array;
  for (let i = 0; i < array.length; i += 3) {
    const length = Math.hypot(array[i], array[i + 1], array[i + 2]) || 1;
    array[i] /= length;
    array[i + 1] /= length;
    array[i + 2] /= length;
  }
  attribute.needsUpdate = true;
}
