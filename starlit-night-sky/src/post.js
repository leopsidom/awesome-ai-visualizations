import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

/**
 * Screen-space finish: bloom to give the stars and moon their halation, then a
 * night pass (edge chromatic drift, cool grade, vignette, and sensor grain).
 * OutputPass runs last — it applies tone mapping and the sRGB conversion.
 */
const NightShader = {
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
      vec2 centered = vUv - 0.5;
      float r2 = dot(centered, centered);

      // Gentle chromatic separation toward the frame edges (lens dispersion).
      // Kept small so point stars stay crisp rather than splitting into dots.
      vec2 shift = centered * r2 * 0.007;
      vec3 color = vec3(
        texture2D(tDiffuse, vUv + shift).r,
        texture2D(tDiffuse, vUv).g,
        texture2D(tDiffuse, vUv - shift).b
      );

      // Cool night grade with a slightly lifted, blue-tinted black.
      color = mix(color, color * vec3(0.9, 0.98, 1.12), 0.5);
      color += vec3(0.004, 0.007, 0.014);

      // Aspect-corrected vignette so it stays circular.
      vec2 v = centered * vec2(uAspect, 1.0);
      color *= 1.0 - smoothstep(0.42, 1.0, length(v)) * 0.78;

      // Sensor grain, animated so it never sits still.
      float grain = fract(sin(dot(vUv + uTime * 0.09, vec2(12.9898, 78.233))) * 43758.5453);
      color += (grain - 0.5) * 0.016;

      gl_FragColor = vec4(color, 1.0);
    }
  `,
};

export function createPost(renderer, scene, camera) {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.85, // strength
    0.55, // radius
    0.12, // threshold — low, so faint stars still bloom
  );
  composer.addPass(bloom);

  const night = new ShaderPass(NightShader);
  composer.addPass(night);

  composer.addPass(new OutputPass());

  return {
    composer,
    bloom,

    render(time) {
      night.uniforms.uTime.value = time;
      composer.render();
    },

    setSize(width, height) {
      composer.setSize(width, height);
      bloom.setSize(width, height);
      night.uniforms.uAspect.value = width / height;
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
