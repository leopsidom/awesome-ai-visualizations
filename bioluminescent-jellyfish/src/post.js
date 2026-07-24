import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

/**
 * Screen-space finish: bloom for the bioluminescence, then a water pass
 * (refraction wobble, chromatic edges, blue grade, vignette, grain).
 * OutputPass runs last — it applies tone mapping and the sRGB conversion.
 */

const AbyssShader = {
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
      // Refraction wobble — as if looking through moving water.
      vec2 uv = vUv + vec2(
        sin(vUv.y * 22.0 + uTime * 0.75),
        cos(vUv.x * 19.0 - uTime * 0.60)
      ) * 0.0018;

      // Chromatic separation that grows toward the edges of the frame.
      vec2 centered = uv - 0.5;
      float r2 = dot(centered, centered);
      vec2 shift = centered * r2 * 0.035;

      vec3 color = vec3(
        texture2D(tDiffuse, uv + shift).r,
        texture2D(tDiffuse, uv).g,
        texture2D(tDiffuse, uv - shift).b
      );

      // Cold grade: water swallows red long before it swallows blue.
      color = mix(color, color * vec3(0.80, 1.02, 1.15), 0.65);

      // Vignette, corrected for aspect so it stays circular.
      vec2 v = centered * vec2(uAspect, 1.0);
      color *= 1.0 - smoothstep(0.32, 0.92, length(v)) * 0.72;

      // Sensor grain.
      float grain = fract(sin(dot(vUv + uTime * 0.07, vec2(12.9898, 78.233))) * 43758.5453);
      color += (grain - 0.5) * 0.02;

      gl_FragColor = vec4(color, 1.0);
    }
  `,
};

export function createPost(renderer, scene, camera) {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.95, // strength
    0.75, // radius
    0.18, // threshold — low, so the dim glow blooms too
  );
  composer.addPass(bloom);

  const abyss = new ShaderPass(AbyssShader);
  composer.addPass(abyss);

  composer.addPass(new OutputPass());

  return {
    composer,
    bloom,

    render(time) {
      abyss.uniforms.uTime.value = time;
      composer.render();
    },

    setSize(width, height) {
      composer.setSize(width, height);
      bloom.setSize(width, height);
      abyss.uniforms.uAspect.value = width / height;
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
