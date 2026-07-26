import * as THREE from "three";
import { Reflector } from "three/addons/objects/Reflector.js";

import { CAVITY } from "./cavity.js";
import { MINERALS } from "./minerals.js";
import { FOG, NOISE2 } from "./glsl.js";

/**
 * The water that has collected in the bottom of the cavity.
 *
 * This is a real planar mirror, not an environment-map fake: `Reflector` runs a
 * second pass from a camera reflected through the pool plane, so the crystals
 * standing in the water are reflected as *themselves*, with their own parallax.
 * That matters here because the hero cluster stands in it — a cube-map
 * approximation would put the reflections in visibly the wrong place at the
 * waterline, which is the one place the eye checks.
 *
 * `Reflector` takes a replacement shader, which is where the rest comes from:
 * the reflected lookup is displaced by two scrolling fbm fields to make ripples,
 * and mixed against a deep mineral colour by a Fresnel term, so the water is a
 * mirror at grazing angles and nearly black looking straight down. The disc is
 * kept fully opaque and simply fades its reflection out at the rim, which hides
 * the seam where it cuts into the rock.
 *
 * It costs a second render of the scene every frame, so the render target is
 * deliberately half resolution — ripples hide the resampling completely.
 */

// Wide enough that the bumpy bowl cuts through it in places — that is where
// the shoreline gets its ragged edge — but not so wide that it becomes the
// whole floor.
const RADIUS = 23;
const RESOLUTION_SCALE = 0.5;

const PoolShader = {
  uniforms: {
    // The three Reflector fills in for itself. They must exist by these names.
    color: { value: null },
    tDiffuse: { value: null },
    textureMatrix: { value: null },

    uTime: { value: 0 },
    uDeep: { value: new THREE.Color(0x1a1030) },
    uRadius: { value: RADIUS },
    uFogColor: { value: new THREE.Color(0x0b0714) },
    uFogDensity: { value: 0.0072 },
  },

  vertexShader: /* glsl */ `
    uniform mat4 textureMatrix;

    varying vec4 vReflected;
    varying vec2 vLocal;
    varying vec3 vWorld;
    varying float vDepth;

    void main() {
      vLocal = position.xy; // the disc is built in XY, then laid down
      vReflected = textureMatrix * vec4(position, 1.0);

      vec4 world = modelMatrix * vec4(position, 1.0);
      vWorld = world.xyz;

      vec4 mv = viewMatrix * world;
      vDepth = -mv.z;

      gl_Position = projectionMatrix * mv;
    }
  `,

  fragmentShader: /* glsl */ `
    ${NOISE2}
    ${FOG}

    uniform vec3 color;
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform vec3 uDeep;
    uniform float uRadius;

    varying vec4 vReflected;
    varying vec2 vLocal;
    varying vec3 vWorld;
    varying float vDepth;

    void main() {
      // Two fbm fields drifting against each other. One alone reads as a
      // conveyor belt; crossed, they read as a surface that is merely restless.
      vec2 p = vLocal * 0.15;
      float wx = gnFbm2(p + vec2(uTime * 0.045, uTime * -0.031));
      float wz = gnFbm2(p * 2.2 - vec2(uTime * 0.026, uTime * 0.038));
      vec2 ripple = (vec2(wx, wz) - 0.5) * 0.055;

      // Projective coordinates, so the displacement has to be scaled by w or
      // the ripples would shrink with distance instead of staying in the water.
      vec4 uv = vReflected;
      uv.xy += ripple * uv.w;

      vec3 mirrored = texture2DProj(tDiffuse, uv).rgb * color;

      // Fresnel against a flat +Y surface: a mirror at grazing angles, a dark
      // window straight down. This is most of what sells it as water.
      vec3 viewDir = normalize(cameraPosition - vWorld);
      float fresnel = pow(1.0 - abs(viewDir.y), 3.0);

      vec3 water = mix(uDeep, mirrored, 0.09 + 0.85 * fresnel);

      // Specular glitter. It has to be sampled far finer than the ripples that
      // carry it — at ripple scale the threshold picks out whole fbm lobes and
      // the bloom turns them into clouds sitting on the water.
      float sparkle = gnFbm2(p * 7.0 + vec2(uTime * 0.09, uTime * -0.06));
      float crest = max(0.0, sparkle * 1.9 - 1.02);
      water += color * pow(crest, 2.0) * 0.6;

      // Let the reflection go at the rim rather than ending on a hard circle,
      // and wobble where that happens by bearing so the edge is not a drawn arc.
      float rim = length(vLocal);
      vec2 bearing = vLocal / max(rim, 0.001);
      float wobble = (gnFbm2(bearing * 2.7 + 11.3) - 0.5) * 5.0;
      float shore = smoothstep(uRadius + wobble, uRadius * 0.72, rim);
      water = mix(uDeep * 0.45, water, shore);

      water = mix(water, uFogColor, fogAmount(vDepth));

      gl_FragColor = vec4(water, 1.0);
    }
  `,
};

export function createPool(mineralIndex, fogUniforms) {
  const geometry = new THREE.CircleGeometry(RADIUS, 96);

  const pool = new Reflector(geometry, {
    clipBias: 0.004,
    textureWidth: Math.round(window.innerWidth * RESOLUTION_SCALE),
    textureHeight: Math.round(window.innerHeight * RESOLUTION_SCALE),
    color: 0xffffff, // replaced by setMineral below
    shader: PoolShader,
    multisample: 0, // the ripples are already a low-pass filter
  });

  pool.rotation.x = -Math.PI / 2;
  pool.position.y = CAVITY.poolY;

  const uniforms = pool.material.uniforms;
  uniforms.uFogColor = fogUniforms.uFogColor;
  uniforms.uFogDensity = fogUniforms.uFogDensity;

  function setMineral(index) {
    const mineral = MINERALS[index % MINERALS.length];
    uniforms.uDeep.value.set(mineral.water);
    // A mirror is never quite a mirror: the reflection picks up the water.
    uniforms.color.value.set(mineral.body).lerp(new THREE.Color(0xffffff), 0.3);
  }

  setMineral(mineralIndex);

  return {
    object: pool,
    setMineral,

    update(time) {
      uniforms.uTime.value = time;
    },

    setSize(width, height) {
      pool
        .getRenderTarget()
        .setSize(
          Math.round(width * RESOLUTION_SCALE),
          Math.round(height * RESOLUTION_SCALE),
        );
    },

    dispose() {
      geometry.dispose();
      pool.dispose();
    },
  };
}
