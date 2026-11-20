import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

/**
 * Screen-space finish: bloom for the beam and the glitter off the water, then a
 * grade pass, then `OutputPass` — which must run last, because it is the thing
 * that applies tone mapping and the sRGB conversion.
 *
 * The grade is a split tone. Almost all the light in this scene arrives from a
 * single warm source, so the lit half of every crystal is warm and the rest is
 * lit only by bounce and environment. Pushing the shadows further toward violet
 * and the highlights further toward amber separates the two, which is what
 * gives a cavity lit by one hole its depth.
 *
 * The bloom threshold is set high on purpose. Low thresholds are right for
 * bioluminescence, where everything glows; here only the daylight and the
 * specular hits should, and blooming the whole cavity would read as fog.
 */

const MineralShader = {
  uniforms: {
    tDiffuse: { value: null },
    uAspect: { value: 1 },
    uTime: { value: 0 },
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
    uniform float uAspect;
    uniform float uTime;

    varying vec2 vUv;

    void main() {
      // Chromatic separation that grows toward the edges of the frame — the
      // dispersion of a thick lens, and a quiet echo of what the crystals do.
      vec2 centered = vUv - 0.5;
      float r2 = dot(centered, centered);
      vec2 shift = centered * r2 * 0.010;

      vec3 color = vec3(
        texture2D(tDiffuse, vUv + shift).r,
        texture2D(tDiffuse, vUv).g,
        texture2D(tDiffuse, vUv - shift).b
      );

      // Split tone: cold violet in the shadows, warm in the lit half.
      float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
      vec3 shade = vec3(0.80, 0.79, 1.12);
      vec3 lit = vec3(1.07, 1.00, 0.90);
      color *= mix(shade, lit, smoothstep(0.03, 0.5, luma));

      // Vignette, corrected for aspect so it stays circular.
      vec2 v = centered * vec2(uAspect, 1.0);
      color *= 1.0 - smoothstep(0.34, 0.98, length(v)) * 0.66;

      // Sensor grain.
      float grain = fract(sin(dot(vUv + uTime * 0.07, vec2(12.9898, 78.233))) * 43758.5453);
      color += (grain - 0.5) * 0.018;

      gl_FragColor = vec4(color, 1.0);
    }
  `,
};

export function createPost(renderer, scene, camera) {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.62, // strength
    0.74, // radius
    0.6, // threshold — only daylight and specular hits, not the whole cavity
  );
  composer.addPass(bloom);

  const grade = new ShaderPass(MineralShader);
  composer.addPass(grade);

  composer.addPass(new OutputPass());

  return {
    composer,
    bloom,

    render(time) {
      grade.uniforms.uTime.value = time;
      composer.render();
    },

    setSize(width, height) {
      composer.setSize(width, height);
      bloom.setSize(width, height);
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
