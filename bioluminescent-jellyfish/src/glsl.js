/**
 * Shared GLSL chunks. Injected into shader strings with template literals.
 * Kept dependency-free so every material compiles standalone.
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

/**
 * Manual FogExp2. Every material here is a custom ShaderMaterial, so the
 * built-in fog chunks are bypassed in favour of one shared formula.
 * Requires uniforms: uFogColor (vec3), uFogDensity (float).
 */
export const FOG = /* glsl */ `
  uniform vec3 uFogColor;
  uniform float uFogDensity;

  float fogAmount(float dist) {
    float f = uFogDensity * dist;
    return 1.0 - exp(-f * f);
  }
`;
