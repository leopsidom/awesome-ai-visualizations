import * as THREE from "three";

/**
 * A small pool of shooting stars. Each is a billboarded quad whose shader fades
 * a bright head into a long tail; the CPU only moves the head, orients the quad
 * toward the camera around its travel axis, and schedules the next appearance.
 * Spawn timing is drawn from the seeded RNG, so a given sky meteors the same way.
 */
const POOL = 7;
const LENGTH = 24;
const WIDTH = 1.3;

export function createMeteors(rng, shared) {
  const group = new THREE.Group();

  // Head at the local +X end so uv.x = 1 is the leading point.
  const geometry = new THREE.PlaneGeometry(LENGTH, WIDTH, 1, 1);

  const vertexShader = /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;
  const fragmentShader = /* glsl */ `
    uniform float uLife;
    uniform vec3 uColor;
    varying vec2 vUv;

    void main() {
      // Head-bright taper down the length.
      float trail = pow(vUv.x, 3.0);
      // Soft across the width.
      float across = 1.0 - smoothstep(0.16, 0.5, abs(vUv.y - 0.5));
      // A hot point right at the head.
      float head = smoothstep(0.9, 1.0, vUv.x);

      float a = (trail * 0.9 + head * 1.2) * across * uLife;
      if (a < 0.002) discard;

      vec3 color = uColor + head * 0.4;
      gl_FragColor = vec4(color, a);
    }
  `;

  const warm = new THREE.Color(0xfff2d6);
  const cool = new THREE.Color(0xcfe0ff);

  const m4 = new THREE.Matrix4();
  const xAxis = new THREE.Vector3();
  const yAxis = new THREE.Vector3();
  const zAxis = new THREE.Vector3();
  const toCam = new THREE.Vector3();

  const meteors = [];
  for (let i = 0; i < POOL; i++) {
    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uLife: { value: 0 },
        uColor: { value: new THREE.Color(0xffffff) },
      },
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.visible = false;
    mesh.frustumCulled = false;
    group.add(mesh);

    meteors.push({
      mesh,
      material,
      head: new THREE.Vector3(),
      vel: new THREE.Vector3(),
      speed: 0,
      life: 0,
      maxLife: 1,
      active: false,
      nextSpawn: rng.range(0.5, 5),
    });
  }

  function spawn(m, time) {
    // Start high on the dome, well above the ridge.
    const az = rng.range(0, Math.PI * 2);
    const el = rng.range(0.35, 0.95);
    const r = 180;
    m.head.set(
      Math.cos(el) * Math.cos(az) * r,
      Math.sin(el) * r,
      Math.cos(el) * Math.sin(az) * r,
    );

    // Travel mostly sideways with a downward bias.
    m.vel
      .set(rng.range(-1, 1), -rng.range(0.2, 0.7), rng.range(-1, 1))
      .normalize();

    m.speed = rng.range(90, 150);
    m.maxLife = rng.range(0.8, 1.4);
    m.life = 0;
    m.active = true;
    m.material.uniforms.uColor.value.copy(rng() < 0.5 ? warm : cool);
    m.mesh.visible = true;
  }

  function orient(m, camera) {
    xAxis.copy(m.vel).normalize();
    toCam.copy(camera.position).sub(m.head).normalize();
    // Face the camera around the travel axis.
    zAxis.copy(toCam).addScaledVector(xAxis, -xAxis.dot(toCam));
    if (zAxis.lengthSq() < 1e-5) zAxis.set(0, 1, 0);
    zAxis.normalize();
    yAxis.crossVectors(zAxis, xAxis).normalize();
    zAxis.crossVectors(xAxis, yAxis).normalize();

    m4.makeBasis(xAxis, yAxis, zAxis);
    m.mesh.quaternion.setFromRotationMatrix(m4);
    // Head sits at +X end of the quad; place the centre half a length back.
    m.mesh.position.copy(m.head).addScaledVector(xAxis, -LENGTH * 0.5);
  }

  return {
    group,

    /** Force the next idle meteor to appear now (the M key). */
    trigger(time) {
      const m = meteors.find((x) => !x.active);
      if (m) {
        m.nextSpawn = time;
        spawn(m, time);
      }
    },

    update(time, delta, camera) {
      for (const m of meteors) {
        if (!m.active) {
          if (time >= m.nextSpawn) spawn(m, time);
          continue;
        }

        m.life += delta;
        m.head.addScaledVector(m.vel, m.speed * delta);

        const t = m.life / m.maxLife;
        if (t >= 1 || m.head.y < -8) {
          m.active = false;
          m.mesh.visible = false;
          m.nextSpawn = time + rng.range(2.5, 9);
          continue;
        }

        // Fade in fast, hold, then fade out over the last 40% of life.
        const fadeIn = Math.min(1, t / 0.12);
        const fadeOut = Math.max(0, 1 - (t - 0.6) / 0.4);
        m.material.uniforms.uLife.value = fadeIn * fadeOut;
        orient(m, camera);
      }
    },

    dispose() {
      geometry.dispose();
      meteors.forEach((m) => m.material.dispose());
    },
  };
}
