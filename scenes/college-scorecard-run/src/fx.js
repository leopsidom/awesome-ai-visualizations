import * as THREE from "three";

/**
 * Confetti: one InstancedMesh of 240 paper chips, pooled. A burst claims the
 * next run of slots in the ring, so overlapping bursts never allocate. Each
 * chip has ballistic motion with drag, and tumbles about its own axis.
 */
const COUNT = 240;
const PALETTE = ["#f4b740", "#5aa9ff", "#3ee08a", "#ff6f9a", "#fbf3dc", "#b58cff"];

export function createFx(scene) {
  const geo = new THREE.PlaneGeometry(0.16, 0.24);
  const mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false });
  const mesh = new THREE.InstancedMesh(geo, mat, COUNT);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  scene.add(mesh);

  const pos = new Float32Array(COUNT * 3);
  const vel = new Float32Array(COUNT * 3);
  const spin = new Float32Array(COUNT * 3);
  const rot = new Float32Array(COUNT * 3);
  const life = new Float32Array(COUNT);
  const color = new THREE.Color();
  for (let i = 0; i < COUNT; i++) {
    mesh.setColorAt(i, color.set(PALETTE[i % PALETTE.length]));
  }
  mesh.instanceColor.needsUpdate = true;

  const dummy = new THREE.Object3D();
  let cursor = 0;

  function hideAll() {
    dummy.scale.setScalar(0);
    dummy.updateMatrix();
    for (let i = 0; i < COUNT; i++) mesh.setMatrixAt(i, dummy.matrix);
    mesh.instanceMatrix.needsUpdate = true;
    life.fill(0);
  }
  hideAll();

  return {
    /** Throw `n` chips from `origin` with a forward drift `vz`. */
    burst(origin, n = 90, vz = 0) {
      for (let k = 0; k < n; k++) {
        const i = cursor;
        cursor = (cursor + 1) % COUNT;
        pos[i * 3] = origin.x + (Math.random() - 0.5) * 2;
        pos[i * 3 + 1] = origin.y + Math.random();
        pos[i * 3 + 2] = origin.z + (Math.random() - 0.5);
        const a = Math.random() * Math.PI * 2;
        const r = 2 + Math.random() * 5;
        vel[i * 3] = Math.cos(a) * r;
        vel[i * 3 + 1] = 5 + Math.random() * 7;
        vel[i * 3 + 2] = Math.sin(a) * r + vz;
        for (let j = 0; j < 3; j++) {
          spin[i * 3 + j] = (Math.random() - 0.5) * 16;
          rot[i * 3 + j] = Math.random() * 6;
        }
        life[i] = 1.6 + Math.random() * 0.8;
      }
    },

    update(dt) {
      let any = false;
      for (let i = 0; i < COUNT; i++) {
        if (life[i] <= 0) continue;
        any = true;
        life[i] -= dt;
        const drag = Math.exp(-1.8 * dt);
        vel[i * 3] *= drag;
        vel[i * 3 + 1] = vel[i * 3 + 1] * drag - 9.8 * dt;
        vel[i * 3 + 2] *= drag;
        for (let j = 0; j < 3; j++) {
          pos[i * 3 + j] += vel[i * 3 + j] * dt;
          rot[i * 3 + j] += spin[i * 3 + j] * dt;
        }
        dummy.position.set(pos[i * 3], Math.max(0.05, pos[i * 3 + 1]), pos[i * 3 + 2]);
        dummy.rotation.set(rot[i * 3], rot[i * 3 + 1], rot[i * 3 + 2]);
        dummy.scale.setScalar(life[i] > 0 ? Math.min(1, life[i] * 2) : 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      if (any) mesh.instanceMatrix.needsUpdate = true;
    },

    reset: hideAll,

    dispose() {
      scene.remove(mesh);
      geo.dispose();
      mat.dispose();
    },
  };
}
