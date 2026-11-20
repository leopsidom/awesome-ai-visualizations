import * as THREE from "three";

import { NOISE } from "./glsl.js";
import { createMotes } from "./motes.js";

/**
 * The room, which never changes: floor, backdrop, the light rig, and the dust.
 * Only the instrument is reseeded, so the stage is built once from a fixed seed
 * and survives every recut — the room you are standing in should not swap out
 * because a wheel was recut.
 *
 * The lighting is the point of contrast with the rest of this gallery. Nothing
 * here is a hand-written lighting model: a key light with a real shadow map, a
 * sky/ground fill, and an image-based environment (wired up in main.js) do all
 * of it, which is the only way polished brass reads as brass.
 */

export const HORIZON = 0xc9b593;

export function createStage(rng) {
  const group = new THREE.Group();
  const disposables = [];

  const track = (value) => {
    disposables.push(value);
    return value;
  };

  // ------------------------------------------------------------- backdrop --

  // A big inward-facing sphere rather than a flat colour: the vertical ramp from
  // ivory down to umber is what gives the brass something to sit against, and
  // scene.fog is tuned to the horizon stop so the floor dissolves into it.
  const backdropMaterial = track(
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uTop: { value: new THREE.Color(0xd2c1a2) },
        uHorizon: { value: new THREE.Color(HORIZON) },
        uBottom: { value: new THREE.Color(0x241a0a) },
        uKeyDir: { value: new THREE.Vector3(10, 15, 8).normalize() },
      },
      vertexShader: /* glsl */ `
        varying vec3 vDirection;

        void main() {
          vDirection = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        ${NOISE}

        uniform vec3 uTop;
        uniform vec3 uHorizon;
        uniform vec3 uBottom;
        uniform vec3 uKeyDir;

        varying vec3 vDirection;

        void main() {
          vec3 dir = normalize(vDirection);

          vec3 color = mix(uBottom, uHorizon, smoothstep(-0.55, 0.02, dir.y));
          color = mix(color, uTop, smoothstep(0.02, 0.62, dir.y));

          // A broad warm lobe where the window would be.
          float lobe = pow(max(dot(dir, uKeyDir), 0.0), 3.0);
          color += vec3(0.16, 0.11, 0.05) * lobe;

          // Enough grain to keep the ramp from banding on an 8-bit display.
          color += (noise2(dir.xz * 220.0 + dir.y * 90.0) - 0.5) * 0.012;

          gl_FragColor = vec4(color, 1.0);
        }
      `,
    }),
  );

  const backdrop = new THREE.Mesh(
    track(new THREE.SphereGeometry(110, 40, 28)),
    backdropMaterial,
  );
  backdrop.frustumCulled = false;
  group.add(backdrop);

  // ---------------------------------------------------------------- floor --

  const floor = new THREE.Mesh(
    track(new THREE.CircleGeometry(78, 96)),
    track(
      new THREE.MeshStandardMaterial({
        color: 0x9d8a68,
        metalness: 0,
        roughness: 0.96,
        envMapIntensity: 0.3,
      }),
    ),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  group.add(floor);

  // ------------------------------------------------------------- the rig --

  // Key: afternoon sun through a high window. The shadow frustum is cropped hard
  // to the instrument, which is what keeps 2048² sharp enough for gear teeth.
  const key = new THREE.DirectionalLight(0xfff1d8, 1.9);
  key.position.set(10, 15, 8);
  key.target.position.set(0, 1.6, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 4;
  key.shadow.camera.far = 44;
  key.shadow.camera.left = -11;
  key.shadow.camera.right = 11;
  key.shadow.camera.top = 11;
  key.shadow.camera.bottom = -11;
  key.shadow.radius = 3;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  group.add(key, key.target);

  // Cool bounce off the far wall, to keep the shadow side from going flat.
  const rim = new THREE.DirectionalLight(0xd6e4ff, 0.5);
  rim.position.set(-12, 6, -13);
  group.add(rim);

  const fill = new THREE.HemisphereLight(0xe3ecff, 0xa98a5f, 0.4);
  group.add(fill);

  // ----------------------------------------------------------------- dust --

  const motes = createMotes(rng);
  group.add(motes.object);

  return {
    group,

    update(time) {
      motes.update(time);
    },

    setViewportHeight(height) {
      motes.setViewportHeight(height);
    },

    dispose() {
      motes.dispose();
      key.dispose();
      for (const item of disposables) item.dispose();
    },
  };
}
