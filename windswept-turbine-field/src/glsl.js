/**
 * Shared GLSL chunks, injected into shader strings with template literals.
 *
 * The pieces here are the ones more than one surface needs to agree about. The
 * cloud sheet is the clearest case: the sky dome draws it, and every material on
 * the ground darkens itself by the *same* function projected along the sun, so
 * the shadows racing over the steppe are cast by the clouds you can actually see
 * overhead rather than by a second, unrelated noise field.
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
      p = mat2(1.6, 1.2, -1.2, 1.6) * p;
      amp *= 0.5;
    }
    return value;
  }
`;

/**
 * The cloud sheet, as a coverage value in 0..1 on a horizontal plane.
 *
 * `uCloudPhase` is a *distance* (metres of air travelled), not a time, so the
 * sheet keeps drifting smoothly when the wind speed changes instead of jumping
 * to a different phase — see wind.js for the same trick.
 *
 * Requires NOISE and the wind chunk (for WIND_DIR) ahead of it.
 */
export const CLOUD = /* glsl */ `
  uniform float uCloudPhase;
  uniform float uCloudScale;
  uniform float uCloudCover;
  uniform float uCloudSoft;
  uniform float uCloudHeight;
  uniform float uCloudShadow;

  float cloudSheet(vec2 q) {
    vec2 p = (q - WIND_DIR * uCloudPhase) * uCloudScale;
    float f = fbm(p) + 0.24 * fbm(p * 3.7 + 11.0);
    return smoothstep(uCloudCover, uCloudCover + uCloudSoft, f);
  }

  /**
   * How much sun reaches a world-space point: project it up the sun ray onto
   * the cloud plane and read the sheet there. With a low sun the shadow lands
   * kilometres downwind of the cloud that casts it, which is exactly right.
   */
  float cloudShadowAt(vec3 world, vec3 sunDir) {
    float rise = max(uCloudHeight - world.y, 0.0);
    vec2 q = world.xz + sunDir.xz * (rise / max(sunDir.y, 0.08));
    return 1.0 - uCloudShadow * cloudSheet(q);
  }
`;
