/**
 * Shared GLSL chunks. Injected into shader strings with template literals.
 * Kept dependency-free so every material compiles standalone.
 *
 * Everything is prefixed `gn` (geode noise). These chunks are spliced into
 * stock `MeshStandardMaterial` sources via `onBeforeCompile` as well as into
 * hand-written materials, and an unprefixed `noise3` would eventually collide
 * with a Three.js shader chunk.
 */

/** Hash + value noise + fbm (3D). Used for rock, wherever a UV seam would show. */
export const NOISE3 = /* glsl */ `
  float gnHash13(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float gnNoise3(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);

    return mix(
      mix(
        mix(gnHash13(i + vec3(0.0, 0.0, 0.0)), gnHash13(i + vec3(1.0, 0.0, 0.0)), f.x),
        mix(gnHash13(i + vec3(0.0, 1.0, 0.0)), gnHash13(i + vec3(1.0, 1.0, 0.0)), f.x),
        f.y
      ),
      mix(
        mix(gnHash13(i + vec3(0.0, 0.0, 1.0)), gnHash13(i + vec3(1.0, 0.0, 1.0)), f.x),
        mix(gnHash13(i + vec3(0.0, 1.0, 1.0)), gnHash13(i + vec3(1.0, 1.0, 1.0)), f.x),
        f.y
      ),
      f.z
    );
  }

  float gnFbm3(vec3 p) {
    float value = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 4; i++) {
      value += amp * gnNoise3(p);
      p *= 2.07;
      amp *= 0.5;
    }
    return value;
  }
`;

/**
 * Manual `FogExp2`, for the handful of materials here that are hand-written and
 * therefore never see Three.js's fog chunks. The lit surfaces — rock, crystal —
 * are stock `MeshStandardMaterial`/`MeshPhysicalMaterial` and get `scene.fog`
 * for free; this exists so the water recedes into the same haze they do.
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

/** Hash + value noise + fbm (2D). Used for the beam and the pool surface. */
export const NOISE2 = /* glsl */ `
  float gnHash21(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float gnNoise2(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);

    float a = gnHash21(i);
    float b = gnHash21(i + vec2(1.0, 0.0));
    float c = gnHash21(i + vec2(0.0, 1.0));
    float d = gnHash21(i + vec2(1.0, 1.0));

    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  float gnFbm2(vec2 p) {
    float value = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 5; i++) {
      value += amp * gnNoise2(p);
      p *= 2.03;
      amp *= 0.5;
    }
    return value;
  }
`;
