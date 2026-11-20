import { NOISE, CLOUD } from "./glsl.js";

/**
 * Everything standing on the steppe gets its sky from here.
 *
 * Rather than hand-writing a lighting model, the ground materials are ordinary
 * lit Three.js materials — the sun is a real `DirectionalLight` with a real
 * shadow map — and this patches three things into them that the built-ins have
 * no notion of:
 *
 * 1. **Cloud shadows.** The same sheet the sky dome draws, projected up the sun
 *    ray, multiplied into the outgoing light.
 * 2. **Translucency.** Grass at this hour is lit *through*, not on. A cheap
 *    forward-scattering term keyed off how close the view ray is to the sun
 *    does most of what a real subsurface model would.
 * 3. **Directional aerial perspective.** Built-in fog is one flat colour, which
 *    is wrong in every direction at once when the sun is on the deck: haze
 *    looking into the sun is a different colour from haze at your back. The fog
 *    chunk is replaced with one that mixes between the two by view angle.
 *
 * Injection points are all long-standing shader chunks (`begin_vertex`,
 * `color_fragment`, `opaque_fragment`, `fog_fragment`). `customProgramCacheKey`
 * matters more than it looks: Three.js keys the compiled-program cache on the
 * material's parameters *and that key* — not on `onBeforeCompile` — so two
 * Lambert materials with the same settings and different injections would
 * otherwise silently share one program.
 */

let patchSerial = 0;

export function skyLit(material, shared, wind, options = {}) {
  const {
    cloudShadow = 1,
    backlight = 0,
    backlightMask = "1.0",
    backlightPower = 3.4,
    detail = null,
    vertex = {},
    fragment = {},
    label = "ground",
  } = options;

  const own = {
    uCloudShadowMix: { value: cloudShadow },
    uBacklight: { value: backlight },
  };

  if (detail) {
    own.uDetailMap = { value: detail.map };
    own.uDetailScale = { value: detail.scale };
    own.uDetailAmount = { value: detail.amount ?? 0.55 };
  }

  const cacheKey = `${label}-${patchSerial++}`;
  const previous = material.onBeforeCompile;

  material.onBeforeCompile = (shader, renderer) => {
    if (previous) previous(shader, renderer);
    Object.assign(shader.uniforms, shared, own);

    shader.vertexShader =
      /* glsl */ `
        varying vec3 vSkyWorld;
        ${wind.glsl}
        ${vertex.head ?? ""}
      ` + shader.vertexShader;

    if (vertex.normal) {
      shader.vertexShader = shader.vertexShader.replace(
        "#include <beginnormal_vertex>",
        `#include <beginnormal_vertex>\n${vertex.normal}`,
      );
    }

    // After any displacement, so the world position a fragment sees is where
    // the vertex actually ended up.
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      /* glsl */ `
        #include <begin_vertex>
        ${vertex.position ?? ""}
        #ifdef USE_INSTANCING
          vSkyWorld = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
        #else
          vSkyWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
        #endif
      `,
    );

    shader.fragmentShader =
      /* glsl */ `
        varying vec3 vSkyWorld;

        uniform vec3 uSunDir;
        uniform vec3 uSunTint;
        uniform vec3 uHazeWarm;
        uniform vec3 uHazeCool;
        uniform float uCloudShadowMix;
        uniform float uBacklight;
        ${detail ? "uniform sampler2D uDetailMap;\nuniform float uDetailScale;\nuniform float uDetailAmount;" : ""}

        ${NOISE}
        ${wind.glsl}
        ${CLOUD}
        ${fragment.head ?? ""}
      ` + shader.fragmentShader;

    if (detail || fragment.color) {
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <color_fragment>",
        /* glsl */ `
          #include <color_fragment>
          ${
            detail
              ? `{
                  vec3 grain = texture2D(uDetailMap, vSkyWorld.xz * uDetailScale).rgb;
                  diffuseColor.rgb *= mix(vec3(1.0), grain * 2.0, uDetailAmount);
                }`
              : ""
          }
          ${fragment.color ?? ""}
        `,
      );
    }

    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <opaque_fragment>",
      /* glsl */ `
        {
          float skyShade = cloudShadowAt(vSkyWorld, uSunDir);
          outgoingLight *= mix(1.0, skyShade, uCloudShadowMix);

          vec3 viewRay = normalize(vSkyWorld - cameraPosition);
          float towardSun = max(dot(viewRay, uSunDir), 0.0);

          outgoingLight += uSunTint * diffuseColor.rgb * uBacklight
                         * pow(towardSun, ${backlightPower.toFixed(2)}) * (${backlightMask}) * skyShade;

          ${fragment.body ?? ""}
        }
        #include <opaque_fragment>
      `,
    );

    // Requires FogExp2 — `fogDensity` is only declared under FOG_EXP2.
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <fog_fragment>",
      /* glsl */ `
        #ifdef USE_FOG
          {
            vec3 hazeRay = normalize(vSkyWorld - cameraPosition);
            float hazeSun = max(dot(hazeRay, uSunDir), 0.0);
            vec3 haze = mix(uHazeCool, uHazeWarm, pow(hazeSun, 2.6));
            haze = mix(haze, uSunTint * 1.5, pow(hazeSun, 30.0) * 0.55);

            float fogFactor = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
            gl_FragColor.rgb = mix(gl_FragColor.rgb, haze, fogFactor);
          }
        #endif
      `,
    );
  };

  material.customProgramCacheKey = () => cacheKey;

  return material;
}
