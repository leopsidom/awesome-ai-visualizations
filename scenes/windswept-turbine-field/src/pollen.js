import * as THREE from "three";

/**
 * Seed heads and chaff torn out of the sward and carried downwind.
 *
 * One `Points` system that never moves on the CPU: the particles ride the same
 * `uWindPhase` the grass does — metres of air travelled, not seconds — so when
 * the wind picks up they accelerate with everything else. Each is then wrapped
 * into a box that follows the camera, which is what lets three thousand of them
 * cover an open steppe: they are only ever spent where they can be seen.
 *
 * They earn their place at this hour specifically. A mote directly between the
 * lens and a low sun is lit from behind through something thin, so it flares;
 * one lit from the front is a grey speck. The vertex shader measures exactly
 * that angle and the fragment shader spends the brightness accordingly.
 */

const COUNT = 3400;

export function createPollen(rng, shared, wind) {
  const box = new THREE.Vector3(190, 34, 190);

  const positions = new Float32Array(COUNT * 3);
  const seeds = new Float32Array(COUNT * 3);

  for (let i = 0; i < COUNT; i++) {
    positions[i * 3] = rng() * box.x;
    positions[i * 3 + 1] = rng() * box.y;
    positions[i * 3 + 2] = rng() * box.z;

    seeds[i * 3] = rng.range(0.72, 1.38); // how fast it rides the wind
    seeds[i * 3 + 1] = rng.range(0.25, 1.4); // bob rate
    seeds[i * 3 + 2] = rng(); // size and phase
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 3));
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);

  const uniforms = {
    ...shared,
    uCamera: { value: new THREE.Vector3() },
    uBox: { value: box },
    uScale: { value: 500 },
    uChaff: { value: new THREE.Color().setHSL(0.11, 0.36, 0.62) },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute vec3 aSeed;

      uniform vec3 uCamera;
      uniform vec3 uBox;
      uniform float uScale;
      uniform vec3 uSunDir;

      varying float vGlow;
      varying float vFade;

      ${wind.glsl}

      void main() {
        vec3 p = position;

        float drift = uWindPhase * aSeed.x;
        p.xz += WIND_DIR * drift;
        p.y += sin(uWindTime * aSeed.y + aSeed.z * 43.0) * 1.5
             + sin(drift * 0.07 + aSeed.z * 17.0) * 2.4;

        // Wrap into a box that rides with the camera. mod() in GLSL floors, so
        // this is correct for the negative side too.
        vec3 anchor = uCamera - uBox * vec3(0.5, 0.42, 0.5);
        p = mod(p - anchor, uBox) + anchor;

        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float depth = max(-mv.z, 0.8);

        vec3 view = normalize(p - cameraPosition);
        vGlow = pow(max(dot(view, uSunDir), 0.0), 2.2);
        vFade = (1.0 - smoothstep(26.0, 115.0, depth)) * smoothstep(1.4, 5.0, depth);

        // uScale is pixels per metre at one metre, so the size below is the
        // seed head's actual width: a centimetre or four, not a screen constant.
        gl_PointSize = clamp((0.010 + aSeed.z * 0.042) * uScale / depth, 1.0, 26.0);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uChaff;
      uniform vec3 uSunTint;

      varying float vGlow;
      varying float vFade;

      void main() {
        float d = length(gl_PointCoord - 0.5);
        float alpha = smoothstep(0.5, 0.08, d);
        if (alpha <= 0.001 || vFade <= 0.001) discard;

        vec3 color = mix(uChaff * 0.5, uSunTint * 3.4, vGlow);
        gl_FragColor = vec4(color, alpha * vFade * 0.34);
      }
    `,
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;

  return {
    group: points,

    update(camera, viewportHeight) {
      uniforms.uCamera.value.copy(camera.position);
      uniforms.uScale.value = viewportHeight / (2 * Math.tan((camera.fov * Math.PI) / 360));
    },

    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
