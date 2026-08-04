import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

/**
 * Screen-space finish: a golden-hour grade, then output.
 *
 * There is deliberately no bloom pass. `UnrealBloomPass` was in this chain and
 * was making the scene strobe: roughly one frame in twelve came back black.
 * Measured by reading the canvas back in-page — 293 of 3605 frames black with it
 * enabled, 0 of 3617 with it disabled, and the rate did not move when its
 * threshold was raised past every value in the frame, its strength was zeroed or
 * its radius was zeroed. So it was not the bright pixels: it was the pass. It
 * binds `readBuffer` as its render target for the final composite while
 * `readBuffer.texture` is still bound as a sampler input, and ANGLE resolves that
 * feedback hazard by discarding the draw. A lighter scene gets away with it; this
 * one does not.
 *
 * The sun's glow moved into the sky shader instead, which is where it belongs —
 * a halo around a low sun is atmospheric scattering, not a lens artifact.
 *
 * The composer buffers are not multisampled. That started as a workaround for
 * the bloom pass and outlived it; with bloom gone the chain is a single
 * full-screen shader, where MSAA on the target would buy nothing anyway. The
 * anti-aliasing the grass needs is bought by supersampling instead — see
 * MIN_COMPOSER_RATIO below.
 *
 * The passes run on linear HDR: the composer's buffers are half-float and
 * Three.js skips tone mapping when it draws into a render target, so everything
 * below is arithmetic on real radiance. `OutputPass` is what finally applies
 * ACES and the sRGB conversion.
 *
 * The crepuscular rays are a radial blur of the *thresholded* image toward the
 * sun's screen position. Because they are built from what is actually on screen,
 * a rotor blade crossing the sun cuts them, which is the whole point: nothing
 * about the shafts is animated, they are a consequence of the geometry.
 */

const RAY_SAMPLES = 26;

const GoldenHourShader = {
  uniforms: {
    tDiffuse: { value: null },
    uSun: { value: new THREE.Vector2(0.5, 0.5) },
    uSunPower: { value: 0 },
    uSunTint: { value: new THREE.Color(1, 0.8, 0.55) },
    uTime: { value: 0 },
    uAspect: { value: 1 },
    uGlow: { value: 1 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;

    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 uSun;
    uniform float uSunPower;
    uniform vec3 uSunTint;
    uniform float uTime;
    uniform float uAspect;
    uniform float uGlow;

    varying vec2 vUv;

    void main() {
      vec2 centered = vUv - 0.5;

      // No lens dispersion here, deliberately. Splitting the channels by even a
      // fifth of a pixel puts rainbow fringes on 200 000 blades of grass a pixel
      // wide: the offset is negligible on smooth geometry and enormous on this.
      vec3 color = texture2D(tDiffuse, vUv).rgb;

      // Crepuscular rays: march back toward the sun, keeping only what is
      // brighter than white, and let the decay do the falloff.
      if (uSunPower * uGlow > 0.001) {
        vec2 stride = (vUv - uSun) * (0.76 / float(${RAY_SAMPLES}));
        vec2 probe = vUv;
        float decay = 1.0;
        vec3 rays = vec3(0.0);

        for (int i = 0; i < ${RAY_SAMPLES}; i++) {
          probe -= stride;
          float inside = step(0.0, probe.x) * step(probe.x, 1.0)
                       * step(0.0, probe.y) * step(probe.y, 1.0);
          rays += max(texture2D(tDiffuse, probe).rgb - 1.9, 0.0) * decay * inside;
          decay *= 0.935;
        }

        color += rays * uSunTint * (0.046 * uSunPower * uGlow);
      }

      // Split tone: the shadows on a steppe at this hour are sky, and the sky
      // is blue. Push one stop past what the hemisphere light already does.
      float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
      float t = smoothstep(0.02, 0.85, luma);
      color *= mix(vec3(0.9, 0.965, 1.1), vec3(1.09, 1.015, 0.9), t);

      // Vignette, corrected for aspect so it stays circular.
      vec2 v = centered * vec2(uAspect, 1.0);
      color *= 1.0 - smoothstep(0.36, 1.05, length(v)) * 0.58;

      // Sensor grain.
      float grain = fract(sin(dot(vUv + uTime * 0.09, vec2(12.9898, 78.233))) * 43758.5453);
      color += (grain - 0.5) * 0.014;

      gl_FragColor = vec4(color, 1.0);
    }
  `,
};

/**
 * The resolution the composer works at, as a multiple of CSS pixels.
 *
 * The canvas backing store has to match its CSS box or the compositor resamples
 * the layer every frame, which on Chrome's Metal backend intermittently presents
 * a black canvas (see main.js). Nothing stops the *composer* from working at a
 * higher resolution, though: its buffers are ordinary render targets, and the
 * output pass filters them back down to the canvas. That is supersampling with
 * none of the layer-size mismatch — which is what keeps 220 000 blades of grass
 * from shimmering on a 1× display.
 *
 * It is a floor rather than a multiplier: a 2× display already supersamples four
 * times over, and 2 × 1.5 would be nine times the CSS pixels for nothing.
 */
const MIN_COMPOSER_RATIO = 1.5;

const composerRatio = (renderer) => Math.max(renderer.getPixelRatio(), MIN_COMPOSER_RATIO);

export function createPost(renderer, scene, camera) {
  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(composerRatio(renderer));
  composer.addPass(new RenderPass(scene, camera));

  const grade = new ShaderPass(GoldenHourShader);
  composer.addPass(grade);

  composer.addPass(new OutputPass());

  const projected = new THREE.Vector3();
  const forward = new THREE.Vector3();

  return {
    composer,

    /** Track where the sun lands on screen, and how much of it is in shot. */
    aimSun(sunDirection, sunTint) {
      camera.getWorldDirection(forward);
      const facing = forward.dot(sunDirection);

      if (facing <= 0.02) {
        grade.uniforms.uSunPower.value = 0;
        return;
      }

      projected.copy(sunDirection).multiplyScalar(6000).add(camera.position).project(camera);

      const u = projected.x * 0.5 + 0.5;
      const v = projected.y * 0.5 + 0.5;
      grade.uniforms.uSun.value.set(u, v);
      grade.uniforms.uSunTint.value.copy(sunTint);

      // Fade out as the sun leaves the frame, rather than snapping off.
      const off = Math.max(Math.abs(u - 0.5), Math.abs(v - 0.5));
      grade.uniforms.uSunPower.value =
        THREE.MathUtils.smoothstep(facing, 0.02, 0.3) * (1 - THREE.MathUtils.smoothstep(off, 0.5, 1.15));
    },

    render(time) {
      grade.uniforms.uTime.value = time;
      composer.render();
    },

    setSize(width, height) {
      // `composer.setSize` takes CSS pixels and forwards drawing-buffer pixels to
      // every pass itself; never call a pass's own setSize after it.
      composer.setPixelRatio(composerRatio(renderer));
      composer.setSize(width, height);
      grade.uniforms.uAspect.value = width / height;
    },

    /** Scales the crepuscular rays; paired with the sky's halo by main.js. */
    setGlow(on) {
      grade.uniforms.uGlow.value = on ? 1 : 0;
    },

    dispose() {
      composer.dispose();
    },
  };
}
