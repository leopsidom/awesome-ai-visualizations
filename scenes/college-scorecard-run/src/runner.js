import * as THREE from "three";
import { LANE_X } from "./gates.js";

/**
 * The graduate: gown, head, mortarboard and a tassel on a pendulum. Built
 * from primitives so the whole figure is a dozen meshes. The run cycle is
 * procedural — a bob at stride frequency, alternating legs, a gown that
 * swings with them — and the lean into a lane change comes from the lateral
 * velocity, so it is never out of step with the actual move.
 */
export function createRunner(scene, { onStep = null } = {}) {
  const own = [];
  const keep = (x) => (own.push(x), x);

  const root = new THREE.Group();
  scene.add(root);
  const body = new THREE.Group(); // bobs and leans
  root.add(body);

  const gownMat = keep(new THREE.MeshStandardMaterial({ color: 0x1c2a5a, roughness: 0.8 }));
  const trimMat = keep(new THREE.MeshStandardMaterial({ color: 0xe6c36a, roughness: 0.4, metalness: 0.4 }));
  const skinMat = keep(new THREE.MeshStandardMaterial({ color: 0xd9a77f, roughness: 0.7 }));
  const capMat = keep(new THREE.MeshStandardMaterial({ color: 0x14161c, roughness: 0.6 }));
  const legMat = keep(new THREE.MeshStandardMaterial({ color: 0x24242a, roughness: 0.8 }));

  // Gown: a flared lathe, open at the hem.
  const gownGeo = keep(
    new THREE.LatheGeometry(
      [
        new THREE.Vector2(0.62, 0.0),
        new THREE.Vector2(0.55, 0.35),
        new THREE.Vector2(0.42, 0.9),
        new THREE.Vector2(0.36, 1.35),
        new THREE.Vector2(0.3, 1.55),
        new THREE.Vector2(0.14, 1.62),
      ],
      20,
    ),
  );
  const gown = new THREE.Mesh(gownGeo, gownMat);
  gown.position.y = 0.55;
  gown.castShadow = true;
  body.add(gown);

  // Stole: two gold strips down the front.
  const stoleGeo = keep(new THREE.BoxGeometry(0.12, 1.0, 0.04));
  for (const sx of [-0.13, 0.13]) {
    const s = new THREE.Mesh(stoleGeo, trimMat);
    s.position.set(sx, 1.6, -0.39);
    s.rotation.x = 0.17;
    body.add(s);
  }

  const head = new THREE.Mesh(keep(new THREE.SphereGeometry(0.27, 20, 14)), skinMat);
  head.position.y = 2.42;
  head.castShadow = true;
  body.add(head);

  // Mortarboard: skull cap + square board + button + tassel.
  const cap = new THREE.Group();
  cap.position.y = 2.6;
  body.add(cap);
  const skull = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.26, 0.28, 0.16, 16)), capMat);
  cap.add(skull);
  const board = new THREE.Mesh(keep(new THREE.BoxGeometry(0.82, 0.04, 0.82)), capMat);
  board.position.y = 0.1;
  board.rotation.y = Math.PI / 4;
  board.castShadow = true;
  cap.add(board);
  const button = new THREE.Mesh(keep(new THREE.SphereGeometry(0.04, 8, 6)), trimMat);
  button.position.y = 0.14;
  cap.add(button);

  const tasselPivot = new THREE.Group();
  tasselPivot.position.set(0, 0.14, 0);
  cap.add(tasselPivot);
  const cordGeo = keep(new THREE.CylinderGeometry(0.012, 0.012, 0.5, 4));
  cordGeo.rotateZ(Math.PI / 2);
  cordGeo.translate(0.25, 0, 0);
  tasselPivot.add(new THREE.Mesh(cordGeo, trimMat));
  const tasselGeo = keep(new THREE.CylinderGeometry(0.03, 0.06, 0.32, 6));
  tasselGeo.translate(0, -0.16, 0);
  const tassel = new THREE.Mesh(tasselGeo, trimMat);
  tassel.position.x = 0.52;
  tasselPivot.add(tassel);

  // Legs and arms, pivoting at hip and shoulder.
  const legGeo = keep(new THREE.CylinderGeometry(0.09, 0.08, 0.75, 6));
  legGeo.translate(0, -0.37, 0);
  const legs = [-0.16, 0.16].map((x) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.78, 0);
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.castShadow = true;
    pivot.add(leg);
    body.add(pivot);
    return pivot;
  });
  const armGeo = keep(new THREE.CylinderGeometry(0.1, 0.12, 0.7, 6));
  armGeo.translate(0, -0.35, 0);
  const arms = [-0.42, 0.42].map((x) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 2.05, 0);
    pivot.rotation.z = x < 0 ? -0.18 : 0.18;
    pivot.add(new THREE.Mesh(armGeo, gownMat));
    body.add(pivot);
    return pivot;
  });

  // A soft contact shadow so the figure sits on the path even out of the key light's map.
  const blob = new THREE.Mesh(
    keep(new THREE.CircleGeometry(0.7, 24)),
    keep(new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false })),
  );
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.03;
  root.add(blob);

  let x = 0;
  let vx = 0;
  let lane = -1; // −1 = not yet chosen; the runner starts on the centre line
  let phase = 0;
  let tasselAngle = 0;
  let tasselVel = 0;
  let stumbleT = 1;
  let cheerT = 1;
  let lastSign = 0; // sign of sin(phase); each flip is a foot landing

  return {
    root,
    get x() {
      return x;
    },
    get lane() {
      return x < 0 ? 0 : 1;
    },
    get chosen() {
      return lane;
    },

    setLane(l) {
      lane = l;
    },

    reset() {
      x = 0;
      vx = 0;
      lane = -1;
      root.position.set(0, 0, 0);
      stumbleT = cheerT = 1;
    },

    stumble() {
      stumbleT = 0;
    },
    cheer() {
      cheerT = 0;
    },

    /** dt seconds; speed in world units per second (0 when stood still). */
    update(dt, speed) {
      // Critically-damped spring towards the lane centre. It keeps running
      // while a gate is locked — the lock stops new choices, not the move in
      // progress, or a late swerve would freeze between lanes and run the
      // graduate into a stone post.
      const target = lane < 0 ? 0 : (lane === 0 ? -1 : 1) * LANE_X;
      const k = 60;
      const c = 2 * Math.sqrt(k);
      vx += (k * (target - x) - c * vx) * dt;
      x += vx * dt;
      root.position.x = x;

      phase += dt * (speed > 0 ? 2.2 + speed * 0.32 : 0);
      const s = Math.sin(phase);
      const stride = speed > 0 ? Math.min(1, speed / 14) : 0;

      // Footfall: the bob bottoms out where sin(phase) crosses zero, twice a cycle.
      const sign = s >= 0 ? 1 : -1;
      if (speed > 0 && lastSign && sign !== lastSign && onStep) onStep(sign > 0 ? 1 : 0, speed);
      lastSign = sign;
      body.position.y = Math.abs(s) * 0.16 * stride;
      legs[0].rotation.x = s * 0.9 * stride;
      legs[1].rotation.x = -s * 0.9 * stride;
      arms[0].rotation.x = -s * 0.7 * stride;
      arms[1].rotation.x = s * 0.7 * stride;
      gown.rotation.z = s * 0.04 * stride;

      // Lean into lateral motion; pitch forward into the run.
      body.rotation.z = THREE.MathUtils.clamp(-vx * 0.05, -0.35, 0.35);
      body.rotation.x = -0.12 * stride;

      // Stumble: a quick pitch and wobble. Cheer: a hop with the cap tossed up.
      if (stumbleT < 1) {
        stumbleT = Math.min(1, stumbleT + dt / 0.7);
        const w = Math.sin(stumbleT * Math.PI);
        body.rotation.x += 0.5 * w;
        body.rotation.z += 0.3 * Math.sin(stumbleT * Math.PI * 4) * (1 - stumbleT);
      }
      cap.position.y = 2.6;
      if (cheerT < 1) {
        cheerT = Math.min(1, cheerT + dt / 0.8);
        const hop = Math.sin(cheerT * Math.PI);
        body.position.y += hop * 0.5;
        cap.position.y += hop * 1.4;
        cap.rotation.y += dt * 14;
      } else {
        cap.rotation.y *= Math.exp(-6 * dt);
      }

      // Tassel: a damped pendulum, kicked by the bob and the lane change.
      const accel = -vx * 0.6 - Math.cos(phase) * 6 * stride;
      tasselVel += (-30 * tasselAngle - 3 * tasselVel + accel) * dt;
      tasselAngle += tasselVel * dt;
      tasselPivot.rotation.z = THREE.MathUtils.clamp(tasselAngle * 0.2, -0.9, 0.9);
      tasselPivot.rotation.y = 0.6;
    },

    dispose() {
      scene.remove(root);
      for (const o of own) o.dispose();
    },
  };
}
