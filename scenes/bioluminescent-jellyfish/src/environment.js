import * as THREE from "three";
import { NOISE, FOG } from "./glsl.js";
import { terrainHeight, terrainRelief, FLOOR_Y } from "./terrain.js";

/**
 * The water column itself: a gradient dome for the far background, a displaced
 * seafloor lit by bacterial mats, and shafts of surface light raking down.
 */
export function createEnvironment(rng, fogUniforms) {
  const group = new THREE.Group();
  const disposables = [];

  const track = (mesh) => {
    disposables.push(mesh.geometry, mesh.material);
    group.add(mesh);
    return mesh;
  };

  const dome = track(createDome());
  const floor = track(createSeafloor(fogUniforms));
  const shafts = createGodrays(rng, fogUniforms);
  shafts.forEach(track);

  return {
    group,

    update(time, camera) {
      floor.material.uniforms.uTime.value = time;
      dome.material.uniforms.uTime.value = time;

      // Keep the dome centred on the camera so it never clips.
      dome.position.copy(camera.position);

      for (const shaft of shafts) {
        shaft.material.uniforms.uTime.value = time;
        // Billboard each shaft around Y only — they stay vertical columns.
        shaft.rotation.y = Math.atan2(
          camera.position.x - shaft.position.x,
          camera.position.z - shaft.position.z,
        );
      }
    },

    dispose() {
      disposables.forEach((d) => d.dispose());
    },
  };
}

function createDome() {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uTime: { value: 0 },
      uTop: { value: new THREE.Color(0x0a3a52) },
      uMid: { value: new THREE.Color(0x031a2a) },
      uBottom: { value: new THREE.Color(0x00060c) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;

      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      ${NOISE}

      uniform float uTime;
      uniform vec3 uTop;
      uniform vec3 uMid;
      uniform vec3 uBottom;

      varying vec3 vDir;

      void main() {
        float h = vDir.y * 0.5 + 0.5;

        vec3 color = mix(uBottom, uMid, smoothstep(0.30, 0.62, h));
        color = mix(color, uTop, smoothstep(0.66, 1.0, h));

        // Faint surface caustics smeared across the ceiling of the water column.
        float caustic = fbm(vDir.xz * 6.0 + vec2(uTime * 0.02, uTime * 0.015));
        color += uTop * pow(smoothstep(0.72, 1.0, h), 2.0) * caustic * 0.35;

        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });

  const mesh = new THREE.Mesh(new THREE.SphereGeometry(420, 48, 32), material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -100;
  return mesh;
}

function createSeafloor(fogUniforms) {
  const geometry = new THREE.PlaneGeometry(420, 420, 160, 160);
  geometry.rotateX(-Math.PI / 2);

  // Displace once on the CPU against the shared height field, so the kelp bed
  // can root itself to the same surface.
  const position = geometry.attributes.position;
  const relief = new Float32Array(position.count);

  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    position.setY(i, terrainHeight(x, z) - FLOOR_Y);
    relief[i] = terrainRelief(x, z);
  }

  position.needsUpdate = true;
  geometry.setAttribute("aRelief", new THREE.BufferAttribute(relief, 1));
  geometry.computeBoundingSphere();

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uSilt: { value: new THREE.Color(0x07161f) },
      uRidge: { value: new THREE.Color(0x0d2c37) },
      uMat: { value: new THREE.Color(0x1de3c8) },
      ...fogUniforms,
    },
    vertexShader: /* glsl */ `
      attribute float aRelief;

      varying vec3 vWorld;
      varying float vHeight;

      void main() {
        vHeight = aRelief;

        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      ${NOISE}
      ${FOG}

      uniform float uTime;
      uniform vec3 uSilt;
      uniform vec3 uRidge;
      uniform vec3 uMat;

      varying vec3 vWorld;
      varying float vHeight;

      void main() {
        float grain = fbm(vWorld.xz * 0.6);
        vec3 color = mix(uSilt, uRidge, smoothstep(0.25, 0.85, vHeight + grain * 0.25));

        // Bacterial mats: slow blotches that breathe out of phase with each other.
        // ("patch" is a reserved word in GLSL ES — hence the name.)
        float blotch = fbm(vWorld.xz * 0.045 + vec2(0.0, uTime * 0.008));
        float mats = smoothstep(0.58, 0.80, blotch);
        float breath = 0.45 + 0.55 * sin(uTime * 0.5 + blotch * 18.0);
        color += uMat * mats * breath * 0.55;

        float dist = distance(cameraPosition, vWorld);
        color = mix(color, uFogColor, fogAmount(dist));

        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = FLOOR_Y;
  return mesh;
}

function createGodrays(rng, fogUniforms) {
  const shafts = [];
  const count = 7;

  for (let i = 0; i < count; i++) {
    const width = rng.range(14, 34);
    const geometry = new THREE.PlaneGeometry(width, 190, 1, 1);

    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uSeed: { value: rng.range(0, 100) },
        uColor: { value: new THREE.Color().setHSL(rng.range(0.46, 0.55), 0.55, 0.6) },
        uStrength: { value: rng.range(0.05, 0.13) },
        ...fogUniforms,
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        varying vec3 vWorld;

        void main() {
          vUv = uv;
          vec4 world = modelMatrix * vec4(position, 1.0);
          vWorld = world.xyz;
          gl_Position = projectionMatrix * viewMatrix * world;
        }
      `,
      fragmentShader: /* glsl */ `
        ${FOG}

        uniform float uTime;
        uniform float uSeed;
        uniform float uStrength;
        uniform vec3 uColor;

        varying vec2 vUv;
        varying vec3 vWorld;

        void main() {
          // Soft-edged column, brightest at the top where the light enters.
          float across = 1.0 - abs(vUv.x - 0.5) * 2.0;
          float shaft = pow(smoothstep(0.0, 1.0, across), 2.5);
          shaft *= pow(vUv.y, 2.2);

          // Surface chop rippling the beam.
          shaft *= 0.65 + 0.35 * sin(uTime * 0.45 + uSeed + vUv.y * 5.0);

          float dist = distance(cameraPosition, vWorld);
          float alpha = shaft * uStrength * (1.0 - fogAmount(dist));

          gl_FragColor = vec4(uColor, alpha);
        }
      `,
    });

    const mesh = new THREE.Mesh(geometry, material);
    const angle = (i / count) * Math.PI * 2 + rng.range(-0.4, 0.4);
    const radius = rng.range(20, 95);
    mesh.position.set(Math.cos(angle) * radius, 62, Math.sin(angle) * radius);
    mesh.renderOrder = -10;

    shafts.push(mesh);
  }

  return shafts;
}
