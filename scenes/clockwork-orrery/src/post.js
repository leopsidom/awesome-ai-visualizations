import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

/**
 * Screen-space finish. A bright scene needs a much lighter touch than a dark
 * one: the bloom threshold sits above 1.0 so only the lamp and the hottest
 * specular glints on the brass blow out, and everything else is left alone.
 *
 * The passes run on linear HDR — the composer's targets are half-float and the
 * renderer skips tone mapping when drawing to a render target — so the grade
 * below is multiplicative. `OutputPass` runs last and is what actually applies
 * ACES and the sRGB conversion.
 */

const AtriumShader = {
  uniforms: {
    tDiffuse: { value: null },
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
    uniform float uTime;
    uniform float uAspect;

    varying vec2 vUv;

    void main() {
      // Lens dispersion, growing toward the corners.
      vec2 centered = vUv - 0.5;
      vec2 shift = centered * dot(centered, centered) * 0.022;

      vec3 color = vec3(
        texture2D(tDiffuse, vUv + shift).r,
        texture2D(tDiffuse, vUv).g,
        texture2D(tDiffuse, vUv - shift).b
      );

      // Split tone: cool shadows, warm highlights — the look of a warm key
      // against a cool bounce, pushed one stop further than the lights do it.
      float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
      float t = smoothstep(0.04, 0.9, luma);
      color *= mix(vec3(0.965, 0.985, 1.06), vec3(1.075, 1.015, 0.915), t);

      // Vignette, corrected for aspect so it stays circular.
      vec2 v = centered * vec2(uAspect, 1.0);
      color *= 1.0 - smoothstep(0.34, 1.0, length(v)) * 0.66;

      // Sensor grain.
      float grain = fract(sin(dot(vUv + uTime * 0.07, vec2(12.9898, 78.233))) * 43758.5453);
      color += (grain - 0.5) * 0.012;

      gl_FragColor = vec4(color, 1.0);
    }
  `,
};

export function createPost(renderer, scene, camera) {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.2, // strength
    0.38, // radius
    1.3, // threshold — above white, so only the lamp and hot glints bloom
  );
  composer.addPass(bloom);

  const atrium = new ShaderPass(AtriumShader);
  composer.addPass(atrium);

  composer.addPass(new OutputPass());

  return {
    composer,
    bloom,

    render(time) {
      atrium.uniforms.uTime.value = time;
      composer.render();
    },

    setSize(width, height) {
      composer.setSize(width, height);
      bloom.setSize(width, height);
      atrium.uniforms.uAspect.value = width / height;
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
