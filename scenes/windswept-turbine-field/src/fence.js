import * as THREE from "three";

import { skyLit } from "./shading.js";

/**
 * A stock fence along the service track.
 *
 * It is here for one reason: scale. A 120 m machine two hundred metres away
 * reads as a toy until there is something next to the camera that the eye
 * already knows the size of, and a leaning fence post a metre and a bit tall
 * does that job better than any amount of detail on the turbine. The posts are
 * also the only thing close enough for the low sun to throw a *short* shadow
 * from, which is what gives the long ones their length.
 */

export function createFence(rng, field, shared, wind) {
  const group = new THREE.Group();

  const SPACING = rng.range(6.8, 8.4);
  const REACH = 190;
  const side = rng.sign();
  const offset = side * (field.trackHalfWidth + rng.range(1.4, 2.4));

  // A five-sided post: enough to catch the light differently on each face,
  // cheap enough to stamp out two hundred of.
  const postGeometry = new THREE.CylinderGeometry(0.062, 0.085, 1, 5, 1, false);
  postGeometry.translate(0, 0.5, 0);

  const timber = new THREE.MeshLambertMaterial({
    color: new THREE.Color().setHSL(0.09, 0.2, 0.34),
  });
  skyLit(timber, shared, wind, { label: "fence", cloudShadow: 0.9 });

  const posts = [];
  for (let along = -REACH; along <= REACH; along += SPACING) {
    const jitter = rng.gauss() * 0.5;
    const point = field.trackPoint(along + jitter, offset + rng.gauss() * 0.22);
    if (Math.hypot(point.x, point.z) > REACH) continue;
    posts.push({
      x: point.x,
      y: field.heightAt(point.x, point.z),
      z: point.z,
      // Taller than a real stock post. The grass out at fifty metres is scaled
      // up to stay visible, and a 1.2 m post drowns in it — which loses the one
      // thing in frame whose size the eye already knows.
      height: rng.range(1.45, 1.78),
      lean: rng.gauss() * 0.09,
      tip: rng.range(0, Math.PI * 2),
      yaw: rng.range(0, Math.PI * 2),
    });
  }

  const mesh = new THREE.InstancedMesh(postGeometry, timber, posts.length);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  // The lean is built from the axis rather than from Euler angles, so the wire
  // attachment below can just be `foot + axis * height` instead of unpicking a
  // rotation order.
  const dummy = new THREE.Object3D();
  const up = new THREE.Vector3(0, 1, 0);
  const spin = new THREE.Quaternion();

  posts.forEach((post, index) => {
    post.axis = new THREE.Vector3(Math.cos(post.tip) * post.lean, 1, Math.sin(post.tip) * post.lean).normalize();
    dummy.position.set(post.x, post.y - 0.05, post.z);
    dummy.quaternion.setFromUnitVectors(up, post.axis);
    dummy.quaternion.multiply(spin.setFromAxisAngle(up, post.yaw));
    dummy.scale.set(1, post.height, 1);
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  group.add(mesh);

  // Two strands, each span split in three so the wire can sag.
  const points = [];
  for (const strand of [0.82, 0.52]) {
    for (let i = 0; i < posts.length - 1; i++) {
      const a = posts[i];
      const b = posts[i + 1];
      const span = Math.hypot(b.x - a.x, b.z - a.z);
      if (span > SPACING * 2) continue; // a gap in the run, not a span

      const sag = span * 0.022 * rng.range(0.6, 1.5);
      const ends = [a, b].map((post) =>
        post.axis
          .clone()
          .multiplyScalar(post.height * strand)
          .add(new THREE.Vector3(post.x, post.y - 0.05, post.z)),
      );

      let previous = ends[0];
      for (let step = 1; step <= 3; step++) {
        const t = step / 3;
        const next = ends[0].clone().lerp(ends[1], t);
        next.y -= sag * Math.sin(t * Math.PI);
        points.push(previous, next);
        previous = next;
      }
    }
  }

  const wireGeometry = new THREE.BufferGeometry().setFromPoints(points);
  const wireMaterial = new THREE.LineBasicMaterial({
    color: new THREE.Color().setHSL(0.07, 0.16, 0.16),
    transparent: true,
    opacity: 0.72,
    fog: true,
  });
  const wires = new THREE.LineSegments(wireGeometry, wireMaterial);
  group.add(wires);

  return {
    group,
    count: posts.length,

    dispose() {
      postGeometry.dispose();
      timber.dispose();
      wireGeometry.dispose();
      wireMaterial.dispose();
    },
  };
}
