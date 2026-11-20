/**
 * Shared GLSL chunks. Injected into shader strings with template literals.
 * Kept dependency-free so every material compiles standalone.
 *
 * Only two things in this scene are custom shaders — the backdrop and the dust.
 * Everything else is a lit PBR material, so unlike a fully hand-shaded scene
 * there is no manual fog helper here: `scene.fog` reaches the built-in
 * materials on its own, and the two custom ones sit outside its range.
 */

/** Hash + value noise + fbm (2D). */
export const NOISE = /* glsl */ `
  float hash21(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise2(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);

    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));

    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 5; i++) {
      value += amp * noise2(p);
      p *= 2.03;
      amp *= 0.5;
    }
    return value;
  }
`;
