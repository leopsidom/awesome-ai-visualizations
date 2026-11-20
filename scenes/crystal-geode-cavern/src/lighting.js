import * as THREE from "three";

import { CAVITY } from "./cavity.js";

/**
 * One light does almost all of the work here, and getting it to behave like
 * daylight rather than a lamp is most of what this file is about.
 *
 * A `SpotLight` is a point source: its cone diverges, and its intensity falls
 * off with distance. Sunlight does neither. So the key is parked 200 units back
 * up the beam with `decay` set to zero — at that range the cone is near enough
 * parallel over the width of the crack, and with no falloff the far wall is lit
 * as brightly as the near one. What remains is a hard-edged, tightly cropped
 * shaft, which is what a hole in a rock produces.
 *
 * The rock shell does not cast shadows (see `shell.js`), so the light passes
 * through the wall and only the crystals inside interrupt it.
 */

const KEY_DISTANCE = 200;

export function createLighting(shaft) {
  const group = new THREE.Group();

  // The cone is aimed to match the drawn beam: same half-angle at the same
  // range, so the lit patch on the water lands exactly where the shaft points.
  const angle = Math.atan(shaft.coneRadius / (KEY_DISTANCE + shaft.length));

  const key = new THREE.SpotLight(0xfff2dc, 7.5, 0, angle, 0.34, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = KEY_DISTANCE * 0.6;
  key.shadow.camera.far = KEY_DISTANCE + shaft.length + 40;
  key.shadow.bias = -0.0008;
  key.shadow.normalBias = 0.06;
  key.shadow.radius = 2;
  group.add(key, key.target);

  // Light that has already bounced off the lit crystals and back up into the
  // cavity. Cheap, and it is the only thing stopping the shadow side reading
  // as a hole cut in the frame.
  const bounce = new THREE.PointLight(0xffd9a8, 26, 60, 2);
  group.add(bounce);

  // The cavity's own ambient: cold from above, where the crack is, and almost
  // nothing from the drowned bottom.
  const fill = new THREE.HemisphereLight(0x8496c8, 0x1a1220, 1.1);
  group.add(fill);

  const origin = shaft.origin;
  const bouncePoint = new THREE.Vector3();

  return {
    group,

    /** `axis` is the beam's current direction, handed over by the shaft. */
    update(axis) {
      key.position.copy(origin).addScaledVector(axis, -KEY_DISTANCE);
      key.target.position.copy(origin).addScaledVector(axis, shaft.length);

      // Follow the beam down to where it lands, then sit just above it.
      const travel = (origin.y - CAVITY.poolY) / Math.max(0.25, -axis.y);
      bouncePoint.copy(origin).addScaledVector(axis, travel);
      bounce.position.set(bouncePoint.x, bouncePoint.y + 6, bouncePoint.z);
    },

    dispose() {
      key.dispose();
      bounce.dispose();
      fill.dispose();
    },
  };
}

/**
 * The image-based environment, baked once from a throwaway scene.
 *
 * The crystals are the reason this exists. Clearcoat and low roughness are
 * mostly *reflection*, and with only one real light in the cavity there is
 * almost nothing for them to reflect — without an environment they come out as
 * dark facets with a single specular dot. This bakes a plausible cavity into a
 * cube map: dim violet rock all round, and one bright warm patch overhead where
 * the daylight gets in.
 */
export function createEnvironment(renderer) {
  const scene = new THREE.Scene();
  const geometry = new THREE.SphereGeometry(10, 32, 24);

  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      uFloor: { value: new THREE.Color(0x07050c) },
      uWall: { value: new THREE.Color(0x241b2e) },
      uRoof: { value: new THREE.Color(0x39304a) },
      uWindow: { value: new THREE.Vector3(0.25, 1, -0.15).normalize() },
      uDaylight: { value: new THREE.Color(0xfff0d6) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDirection;

      void main() {
        vDirection = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uFloor;
      uniform vec3 uWall;
      uniform vec3 uRoof;
      uniform vec3 uWindow;
      uniform vec3 uDaylight;

      varying vec3 vDirection;

      void main() {
        vec3 dir = normalize(vDirection);

        vec3 color = mix(uFloor, uWall, smoothstep(-0.75, 0.1, dir.y));
        color = mix(color, uRoof, smoothstep(0.1, 0.85, dir.y));

        // The crack. Deliberately over 1.0 — PMREM keeps its float precision,
        // so this stays a genuine highlight for the crystals to catch rather
        // than a white patch.
        float lobe = pow(max(dot(dir, uWindow), 0.0), 9.0);
        color += uDaylight * lobe * 4.0;

        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });

  scene.add(new THREE.Mesh(geometry, material));

  const pmrem = new THREE.PMREMGenerator(renderer);
  const target = pmrem.fromScene(scene, 0.02);

  geometry.dispose();
  material.dispose();
  pmrem.dispose();

  return target;
}
