import * as THREE from "three";

import { NOISE, CLOUD } from "./glsl.js";

/**
 * The sky, the sun and the weather that hangs off them.
 *
 * This module owns the shared uniform block. Every material on the ground is
 * patched (see shading.js) with *these same uniform objects*, by reference, so
 * there is exactly one place where the sun moves, the haze warms up or the
 * clouds drift — no per-material copies to keep in step, and no frame where the
 * grass thinks the sun is somewhere the sky does not.
 *
 * The dome is drawn with `depthTest: false` at `renderOrder: -1000`, so it is
 * a background rather than a sphere: its radius is arbitrary, it never fights
 * the far plane, and the view ray is reconstructed per fragment from the real
 * camera position rather than from the dome's geometry.
 */

const SkyShader = {
  vertex: /* glsl */ `
    varying vec3 vRay;

    void main() {
      vec4 world = modelMatrix * vec4(position, 1.0);
      vRay = world.xyz - cameraPosition;
      gl_Position = projectionMatrix * viewMatrix * world;
    }
  `,
};

export function createSky(rng, wind) {
  const group = new THREE.Group();

  // ------------------------------------------------------------------ sun --

  // Kept inside the golden-hour band. Any lower and the shadows run off the
  // far side of the field; any higher and the grass stops being backlit, which
  // is the whole reason for shooting this scene at this hour.
  const elevation = THREE.MathUtils.degToRad(rng.range(10, 18.5));
  const azimuth = rng.range(0, Math.PI * 2);

  const sunDirection = new THREE.Vector3(
    Math.sin(azimuth) * Math.cos(elevation),
    Math.sin(elevation),
    Math.cos(azimuth) * Math.cos(elevation),
  ).normalize();

  // The lower the sun, the more of the blue end the atmosphere has taken out
  // of it and the redder what is left.
  const warmth = THREE.MathUtils.smoothstep(elevation, THREE.MathUtils.degToRad(8), THREE.MathUtils.degToRad(19));
  const sunTint = new THREE.Color().setHSL(
    THREE.MathUtils.lerp(0.055, 0.085, warmth),
    THREE.MathUtils.lerp(0.85, 0.62, warmth),
    THREE.MathUtils.lerp(0.6, 0.68, warmth),
  );

  const hazeWarm = new THREE.Color().setHSL(0.086, 0.62, THREE.MathUtils.lerp(0.72, 0.79, warmth));
  const hazeCool = new THREE.Color().setHSL(0.58, 0.24, THREE.MathUtils.lerp(0.62, 0.7, warmth));

  // --------------------------------------------------------------- weather --

  const cover = rng.range(0.52, 0.74);

  const uniforms = {
    // The wind uniforms travel with the block: the cloud sheet drifts on the
    // same phase the grass does.
    ...wind.uniforms,

    uSunDir: { value: sunDirection },
    uSunTint: { value: sunTint },
    uZenith: { value: new THREE.Color().setHSL(0.6, 0.55, THREE.MathUtils.lerp(0.3, 0.4, warmth)) },
    uHorizonWarm: { value: new THREE.Color().setHSL(0.088, 0.78, 0.72) },
    uHorizonCool: { value: new THREE.Color().setHSL(0.57, 0.36, 0.66) },
    uHazeWarm: { value: hazeWarm },
    uHazeCool: { value: hazeCool },

    uCloudPhase: { value: rng.range(0, 6000) },
    uCloudScale: { value: rng.range(0.00072, 0.00115) },
    uCloudCover: { value: cover },
    uCloudSoft: { value: rng.range(0.1, 0.2) },
    uCloudHeight: { value: rng.range(760, 1150) },
    uCloudShadow: { value: rng.range(0.42, 0.62) },
    uCloudLit: { value: new THREE.Color().setHSL(0.095, 0.46, 0.84) },
    uCloudDark: { value: new THREE.Color().setHSL(0.62, 0.24, 0.46) },
    uCloudOpacity: { value: rng.range(0.66, 0.88) },
  };

  // ------------------------------------------------------------------ dome --

  const domeMaterial = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthTest: false,
    depthWrite: false,
    fog: false,
    vertexShader: SkyShader.vertex,
    fragmentShader: /* glsl */ `
      uniform vec3 uSunDir;
      uniform vec3 uSunTint;
      uniform vec3 uZenith;
      uniform vec3 uHorizonWarm;
      uniform vec3 uHorizonCool;
      uniform vec3 uHazeWarm;
      uniform vec3 uHazeCool;
      uniform vec3 uCloudLit;
      uniform vec3 uCloudDark;
      uniform float uCloudOpacity;

      varying vec3 vRay;

      ${NOISE}
      ${wind.glsl}
      ${CLOUD}

      void main() {
        vec3 d = normalize(vRay);

        // Warm toward the sun's *bearing*, not toward the sun itself, so the
        // whole quadrant it sits in glows rather than a spot around it.
        vec2 heading = normalize(d.xz + vec2(1e-5));
        float az = max(dot(heading, normalize(uSunDir.xz)), 0.0);

        vec3 horizon = mix(uHorizonCool, uHorizonWarm, pow(az, 2.2));
        vec3 color = mix(horizon, uZenith, pow(clamp(d.y, 0.0, 1.0), 0.62));

        // Forward scattering: a broad halo, a tight one, then the disc.
        float sun = max(dot(d, uSunDir), 0.0);
        color += uSunTint * pow(sun, 11.0) * 0.26;
        color += uSunTint * pow(sun, 260.0) * 2.2;
        color += uSunTint * smoothstep(0.99988, 0.99997, sun) * 22.0;

        // The cloud sheet, read where this ray pierces the cloud plane. Rays
        // near the horizon pierce it tens of kilometres out, so the distance is
        // clamped and the sheet is faded out before the noise loses precision.
        float rise = max(uCloudHeight - cameraPosition.y, 1.0);
        if (d.y > 0.004) {
          float travel = min(rise / d.y, 60000.0);
          vec2 q = cameraPosition.xz + d.xz * travel;

          float here = cloudSheet(q);
          // A step toward the sun: where the sheet thins out ahead, this piece
          // of cloud has its edge lit.
          float ahead = cloudSheet(q + normalize(uSunDir.xz) * 340.0);
          float edge = clamp((here - ahead) * 2.4 + pow(az, 3.0) * 0.45 + 0.1, 0.0, 1.0);

          vec3 cloud = mix(uCloudDark, uCloudLit, edge);
          cloud += uSunTint * pow(sun, 22.0) * 0.6 * here;

          float fade = smoothstep(0.004, 0.16, d.y);
          color = mix(color, cloud, here * fade * uCloudOpacity);
        }

        // A haze band along the horizon in the same colours the ground fog
        // uses, so the steppe dissolves into the sky instead of ending on a line.
        vec3 haze = mix(uHazeCool, uHazeWarm, pow(az, 2.0));
        color = mix(color, haze, smoothstep(0.09, -0.03, d.y) * 0.66);

        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });

  const domeGeometry = new THREE.SphereGeometry(2000, 48, 32);
  const dome = new THREE.Mesh(domeGeometry, domeMaterial);
  dome.renderOrder = -1000;
  dome.frustumCulled = false;
  group.add(dome);

  // ---------------------------------------------------------------- lights --

  // The ground is nearly edge-on to a sun this low — flat steppe only picks up
  // sin(elevation) of it — so the lamp is driven hard and the exposure pulled
  // back, rather than the other way round.
  const sun = new THREE.DirectionalLight(sunTint.getHex(), THREE.MathUtils.lerp(3.6, 4.4, warmth));
  sun.position.copy(sunDirection).multiplyScalar(620);
  sun.target.position.set(0, 0, 0);
  sun.castShadow = true;

  // A low sun throws shadows three or four times the height of what casts them,
  // so the map has to cover far more ground than the camera ever visits. 4096
  // over 620 m is 15 cm a texel — enough to keep a 3 m blade chord readable.
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.camera.left = -310;
  sun.shadow.camera.right = 310;
  sun.shadow.camera.top = 310;
  sun.shadow.camera.bottom = -310;
  sun.shadow.camera.near = 120;
  sun.shadow.camera.far = 1250;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.6;
  group.add(sun);
  group.add(sun.target);

  const skyFill = new THREE.HemisphereLight(
    new THREE.Color().setHSL(0.58, 0.42, 0.62).getHex(),
    new THREE.Color().setHSL(0.1, 0.32, 0.3).getHex(),
    1.2,
  );
  group.add(skyFill);

  const cloudSpeed = wind.cloudDrift;

  return {
    group,
    uniforms,
    sunDirection,
    sunTint,
    hazeWarm,
    hazeCool,
    azimuth,
    elevation,
    /** Cloud cover as a percentage, for the readout. */
    cover: Math.round(THREE.MathUtils.clamp((0.72 - cover) * 210, 3, 96)),

    update(delta) {
      // Cloud base runs faster than the surface wind; same phase trick.
      uniforms.uCloudPhase.value += wind.speed * cloudSpeed * delta;
    },

    dispose() {
      domeGeometry.dispose();
      domeMaterial.dispose();
      sun.dispose();
      skyFill.dispose();
    },
  };
}
