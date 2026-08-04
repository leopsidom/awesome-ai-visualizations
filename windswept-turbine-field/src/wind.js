/**
 * The wind field — the one thing in this scene everything else reads from.
 *
 * The grass bends with it, the rotors take their speed and their yaw from it,
 * the seed heads drift on it, the clouds are carried by it, and the readout in
 * the corner reports it. Because there is a single field rather than a handful
 * of unrelated oscillators, a gust front arrives at the near turbine a beat
 * after it has run through the foreground grass, which is the thing that makes
 * a wind farm look like it is standing in weather.
 *
 * Two details are load-bearing:
 *
 * - **The field is advected by a distance, not by a time.** Every travelling
 *   term is `sin(k·x − k·φ)` where `φ` is metres of air that have gone past,
 *   integrated as `φ += speed·dt`. Writing it the obvious way, `sin(k·x − k·v·t)`,
 *   means changing `v` at `t = 90 s` teleports the pattern by `90·Δv·k` radians —
 *   a visible jolt through the whole field every time the wind picks up. With a
 *   phase, speed changes are exactly as smooth as they are in air.
 * - **The GLSL and the JS are generated from the same constants.** The shaders
 *   need the field per-vertex and the turbines need it per-object, so it exists
 *   twice; emitting the GLSL from the same numbers the JS closes over is what
 *   keeps the blades of grass and the blades of the rotor in the same weather.
 */

const TAU = Math.PI * 2;

/** Gearbox for the `G` key: what the air is doing today. */
export const GEARS = [
  { name: "calm", scale: 0.42 },
  { name: "breeze", scale: 1.0 },
  { name: "fresh", scale: 1.45 },
  { name: "gale", scale: 2.05 },
];

const f = (n) => n.toFixed(6);

export function createWind(rng) {
  // Bearing is the direction the wind blows *toward*, measured clockwise from
  // north. World north is -Z, world east is +X.
  const bearing = rng.range(0, TAU);
  const dirX = Math.sin(bearing);
  const dirZ = -Math.cos(bearing);
  const perpX = -dirZ;
  const perpZ = dirX;

  const baseSpeed = rng.range(5.4, 9.8);
  const gustAmp = rng.range(0.17, 0.33);

  // Macro gust fronts: hundreds of metres across, they set what the rotors do.
  const fronts = [
    wave(rng, 0.0072, 0.0104, 0.0022, 0.0042, 0.62, 1.0),
    wave(rng, 0.014, 0.0192, 0.0038, 0.0066, 0.38, 1.16),
  ];

  // Grass-scale ripples: 5–25 m, they are what you actually watch.
  const ripples = [
    wave(rng, 0.26, 0.38, 0.07, 0.14, 0.55, 1.0),
    wave(rng, 0.52, 0.72, 0.13, 0.24, 0.3, 1.24),
    wave(rng, 1.15, 1.65, 0.3, 0.52, 0.15, 0.84),
  ];

  // Slow veering, in radians, on its own clock rather than on the gust phase.
  const veers = [
    { k: rng.range(0.0026, 0.0048), rate: rng.range(0.041, 0.075), amp: rng.range(0.07, 0.14), ph: rng.range(0, TAU) },
    { k: rng.range(0.0051, 0.0092), rate: rng.range(0.023, 0.046), amp: rng.range(0.04, 0.09), ph: rng.range(0, TAU) },
  ];

  // Cloud base moves faster than the surface wind, as it does.
  const cloudFactor = rng.range(1.9, 2.8);

  const uniforms = {
    uWindSpeed: { value: baseSpeed },
    uWindPhase: { value: rng.range(0, 4000) },
    uWindTime: { value: 0 },
  };

  let gear = 1;
  let targetScale = GEARS[gear].scale;
  let scale = targetScale;

  const state = { speed: baseSpeed * scale, phase: uniforms.uWindPhase.value, time: 0 };

  const gustAt = (x, z) => {
    const u = x * dirX + z * dirZ;
    const w = x * perpX + z * perpZ;
    let sum = 0;
    for (const t of fronts) sum += t.weight * Math.sin(u * t.k - state.phase * t.k * t.advect + w * t.kw + t.phase);
    return sum;
  };

  const veerAt = (x, z) => {
    const u = x * dirX + z * dirZ;
    const w = x * perpX + z * perpZ;
    let sum = 0;
    sum += veers[0].amp * Math.sin(w * veers[0].k + state.time * veers[0].rate + veers[0].ph);
    sum += veers[1].amp * Math.sin(u * veers[1].k - state.time * veers[1].rate + veers[1].ph);
    return sum;
  };

  return {
    uniforms,

    /** Mean bearing, in radians clockwise from north. */
    bearing,
    /** Unit vector the mean wind blows toward. */
    direction: { x: dirX, z: dirZ },

    /** Wind speed in m/s at a point on the ground, right now. */
    speedAt(x, z) {
      return state.speed * (1 + gustAmp * gustAt(x, z));
    },

    /** Bearing in radians at a point on the ground, right now. */
    bearingAt(x, z) {
      return bearing + veerAt(x, z);
    },

    get speed() {
      return state.speed;
    },

    get gear() {
      return GEARS[gear];
    },

    /** Step the wind. `phase` accumulates metres so the field never jumps. */
    update(delta) {
      // Frame-rate-independent approach to the selected gear.
      scale += (targetScale - scale) * (1 - Math.exp(-0.55 * delta));
      state.speed = baseSpeed * scale;
      state.phase += state.speed * delta;
      state.time += delta;

      uniforms.uWindSpeed.value = state.speed;
      uniforms.uWindPhase.value = state.phase;
      uniforms.uWindTime.value = state.time;
    },

    /** Cycle calm → breeze → fresh → gale. */
    shiftGear() {
      gear = (gear + 1) % GEARS.length;
      targetScale = GEARS[gear].scale;
      return GEARS[gear];
    },

    cloudDrift: cloudFactor,

    /**
     * The same field, as GLSL. Declares WIND_DIR, windGust, windSpeedAt,
     * windRipple and windFlow; the cloud chunk in glsl.js expects WIND_DIR.
     */
    glsl: /* glsl */ `
      uniform float uWindSpeed;
      uniform float uWindPhase;
      uniform float uWindTime;

      const vec2 WIND_DIR = vec2(${f(dirX)}, ${f(dirZ)});
      const vec2 WIND_PERP = vec2(${f(perpX)}, ${f(perpZ)});
      const float WIND_BEARING = ${f(bearing)};
      const float WIND_GUST = ${f(gustAmp)};

      float windGust(vec2 p) {
        float u = dot(p, WIND_DIR);
        float w = dot(p, WIND_PERP);
        return ${fronts.map((t) => term(t)).join("\n             + ")};
      }

      float windRipple(vec2 p) {
        float u = dot(p, WIND_DIR);
        float w = dot(p, WIND_PERP);
        return ${ripples.map((t) => term(t)).join("\n             + ")};
      }

      float windSpeedAt(vec2 p) {
        return uWindSpeed * (1.0 + WIND_GUST * windGust(p));
      }

      float windBearingAt(vec2 p) {
        float u = dot(p, WIND_DIR);
        float w = dot(p, WIND_PERP);
        return WIND_BEARING
             + ${f(veers[0].amp)} * sin(w * ${f(veers[0].k)} + uWindTime * ${f(veers[0].rate)} + ${f(veers[0].ph)})
             + ${f(veers[1].amp)} * sin(u * ${f(veers[1].k)} - uWindTime * ${f(veers[1].rate)} + ${f(veers[1].ph)});
      }

      /** Unit vector the wind blows toward, at a point on the ground. */
      vec2 windFlow(vec2 p) {
        float b = windBearingAt(p);
        return vec2(sin(b), -cos(b));
      }
    `,
  };
}

function wave(rng, kMin, kMax, kwMin, kwMax, weight, advect) {
  return {
    k: rng.range(kMin, kMax),
    kw: rng.range(kwMin, kwMax) * rng.sign(),
    phase: rng.range(0, TAU),
    weight,
    advect,
  };
}

function term(t) {
  return `${f(t.weight)} * sin(u * ${f(t.k)} - uWindPhase * ${f(t.k * t.advect)} + w * ${f(t.kw)} + ${f(t.phase)})`;
}
