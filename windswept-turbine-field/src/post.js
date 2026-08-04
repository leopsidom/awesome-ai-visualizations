import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

/**
 * Screen-space finish: bloom, then a golden-hour grade, then output.
 *
 * The composer buffers are deliberately *not* multisampled, which took a while
 * to accept: a million and a half triangles of grass one pixel wide is exactly
 * the case MSAA exists for. `UnrealBloomPass` cannot run against one. Its final
 * composite samples `readBuffer.texture` while rendering into `readBuffer`
 * itself, and when that target is multisampled the read/resolve overlap comes
 * back as a flat grey frame — or, with another pass behind it, a black one.
 * Verified by elimination: bloom alone on a 4× target is flat, the grade alone
 * on the same target is correct, and both are correct with samples at zero. The
 * scene is supersampled by rendering at the full device pixel ratio instead.
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

    varying vec2 vUv;

    void main() {
      vec2 centered = vUv - 0.5;

      // No lens dispersion here, deliberately. Splitting the channels by even a
      // fifth of a pixel puts rainbow fringes on 200 000 blades of grass a pixel
      // wide: the offset is negligible on smooth geometry and enormous on this.
      vec3 color = texture2D(tDiffuse, vUv).rgb;

      // Crepuscular rays: march back toward the sun, keeping only what is
      // brighter than white, and let the decay do the falloff.
      if (uSunPower > 0.001) {
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

        color += rays * uSunTint * (0.046 * uSunPower);
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

  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.22, // strength
    0.66, // radius
    1.3, // threshold — above white, so only the sun and the hottest rims bloom
  );
  composer.addPass(bloom);

  const grade = new ShaderPass(GoldenHourShader);
  composer.addPass(grade);

  composer.addPass(new OutputPass());

  const projected = new THREE.Vector3();
  const forward = new THREE.Vector3();

  return {
    composer,
    bloom,

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
      // `composer.setSize` takes CSS pixels and already forwards drawing-buffer
      // pixels to every pass, bloom included. Calling `bloom.setSize` again here
      // — the obvious-looking thing to do — hands it CSS pixels instead, halving
      // its mip chain, and the composite comes back black.
      composer.setPixelRatio(composerRatio(renderer));
      composer.setSize(width, height);
      grade.uniforms.uAspect.value = width / height;
    },

    toggleBloom() {
      bloom.enabled = !bloom.enabled;
      return bloom.enabled;
    },

    dispose() {
      composer.dispose();
    },
  };
}
