import * as THREE from "three";
import { FOG } from "./glsl.js";
import { terrainHeight } from "./terrain.js";

/**
 * A bed of glowing siphonophore stalks rooted in the seafloor.
 * One InstancedMesh, one draw call — the bend is per-instance, derived from the
 * instance matrix translation so no extra attribute is needed.
 */
export function createKelp(rng, fogUniforms, count = 260) {
  const height = 1; // scaled per instance
  const geometry = new THREE.PlaneGeometry(1, height, 1, 14);
  geometry.translate(0, height / 2, 0); // pivot at the base so it sways from the root

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uBase: { value: new THREE.Color(0x0b3f4d) },
      uTip: { value: new THREE.Color(0x37ffd0) },
      ...fogUniforms,
    },
    vertexShader: /* glsl */ `
      uniform float uTime;

      varying vec2 vUv;
      varying vec3 vWorld;
      varying float vPhase;

      void main() {
        vUv = uv;

        vec3 origin = instanceMatrix[3].xyz;
        float phase = fract(sin(dot(origin.xz, vec2(12.9898, 78.233))) * 43758.5453);
        vPhase = phase;

        // Quadratic falloff: rooted at the base, loosest at the tip.
        float t = uv.y;
        float bend = t * t * (
          0.55 * sin(uTime * 0.55 + phase * 6.2831 + origin.x * 0.12) +
          0.22 * sin(uTime * 1.30 + phase * 3.1)
        );

        vec3 pos = position;
        // Taper toward the tip so the quad reads as a stalk rather than a card.
        pos.x *= mix(1.0, 0.18, t);
        pos.x += bend;
        pos.z += bend * 0.6 * cos(phase * 6.2831);

        vec4 world = modelMatrix * instanceMatrix * vec4(pos, 1.0);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      ${FOG}

      uniform float uTime;
      uniform vec3 uBase;
      uniform vec3 uTip;

      varying vec2 vUv;
      varying vec3 vWorld;
      varying float vPhase;

      void main() {
        // Soften the ribbon's long edges so the quad reads as a stalk, not a card.
        float edge = smoothstep(0.0, 0.30, vUv.x) * smoothstep(1.0, 0.70, vUv.x);

        float t = vUv.y;
        // Dissolve the last stretch, otherwise every stalk ends on a flat cut.
        float ends = smoothstep(0.0, 0.10, t) * smoothstep(1.0, 0.72, t);

        vec3 color = mix(uBase, uTip, pow(t, 1.5));

        // Nodes of light climbing the stalk.
        float nodes = pow(abs(sin(t * 16.0 - uTime * 0.9 + vPhase * 6.2831)), 9.0);
        color += uTip * nodes * 1.4;

        float alpha = edge * ends * (0.10 + 0.34 * t + 0.42 * nodes);

        float dist = distance(cameraPosition, vWorld);
        alpha *= 1.0 - fogAmount(dist);

        gl_FragColor = vec4(color, alpha);
      }
    `,
  });

  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.frustumCulled = false;

  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);

  for (let i = 0; i < count; i++) {
    // Clustered in loose thickets rather than scattered uniformly.
    const clusterAngle = rng.range(0, Math.PI * 2);
    const clusterRadius = 20 + Math.sqrt(rng()) * 95;
    const jitter = rng.range(0, 7);
    const jitterAngle = rng.range(0, Math.PI * 2);

    const x = Math.cos(clusterAngle) * clusterRadius + Math.cos(jitterAngle) * jitter;
    const z = Math.sin(clusterAngle) * clusterRadius + Math.sin(jitterAngle) * jitter;
    // Sink each stalk slightly into the silt so no base floats free.
    position.set(x, terrainHeight(x, z) - 0.6, z);

    quaternion.setFromAxisAngle(up, rng.range(0, Math.PI * 2));
    scale.set(rng.range(0.25, 0.7), rng.range(6, 20), 1);

    matrix.compose(position, quaternion, scale);
    mesh.setMatrixAt(i, matrix);
  }

  mesh.instanceMatrix.needsUpdate = true;

  return {
    group: mesh,

    update(time) {
      material.uniforms.uTime.value = time;
    },

    dispose() {
      geometry.dispose();
      material.dispose();
      mesh.dispose();
    },
  };
}
