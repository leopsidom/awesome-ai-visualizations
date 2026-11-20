import * as THREE from "three";
import { bannerTexture, questionTexture, valueTexture, curtainTexture, hazardTexture } from "./labels.js";
import { PATH_WIDTH } from "./campus.js";

/**
 * A gate is a question you run through. Two stone arches stand over the two
 * lanes, each with a pennant naming a school (or a program); a crimson sign
 * across both asks the question. Beside each arch is a data column at zero.
 *
 * `commit` world units before the arch is the LOCK LINE, and it is drawn: a
 * gold light curtain reading "ANSWER LOCKS", a hazard strip across the path
 * and a glowing pylon at each edge. Between the line and the arch, each lane
 * has a pair of rails and the lanes are split by a divider. When the runner
 * crosses the line, the curtain flashes, the chosen lane's rails light gold,
 * the other lane's rails and arch go red, and the columns rise to their true
 * values. All of that is in front of the camera, which is the point: a reveal
 * behind the camera is a reveal nobody sees.
 */

export const LANE_X = 2.75;
const ARCH_W = 4.4;
const ARCH_H = 5.2;
const COLUMN_MAX = 8.5;
const BANNER_W = ARCH_W + 0.8;
const BANNER_H = BANNER_W * (560 / 1024);
const SIGN_W = ARCH_W * 2 + 4;
const SIGN_H = SIGN_W * (420 / 2048);
const BANNER_Y = ARCH_H + 0.8 + BANNER_H / 2;
const SIGN_Y = BANNER_Y + BANNER_H / 2 + 0.45 + SIGN_H / 2;

const GOLD = 0xffd257;
const RED = 0xff3b4e;

// Shared by every gate; built once, disposed with the game.
let shared = null;
function getShared(renderer) {
  if (shared) return shared;
  const post = new THREE.BoxGeometry(0.6, ARCH_H, 0.7);
  post.translate(0, ARCH_H / 2, 0);
  const lintel = new THREE.BoxGeometry(ARCH_W + 0.9, 0.7, 0.9);
  const cap = new THREE.BoxGeometry(0.85, 0.3, 0.95);
  const column = new THREE.BoxGeometry(1.3, 1, 1.3);
  column.translate(0, 0.5, 0);
  const plinth = new THREE.BoxGeometry(1.7, 0.25, 1.7);
  const banner = new THREE.PlaneGeometry(BANNER_W, BANNER_H);
  const sign = new THREE.PlaneGeometry(SIGN_W, SIGN_H);
  const veil = new THREE.PlaneGeometry(ARCH_W - 0.6, ARCH_H - 0.4);
  const stone = new THREE.MeshStandardMaterial({ color: 0xd8c9a6, roughness: 0.85 });
  const plinthMat = new THREE.MeshStandardMaterial({ color: 0x8c7f68, roughness: 0.9 });

  // Lock-line kit.
  const curtain = new THREE.PlaneGeometry(PATH_WIDTH + 1.2, 3.4);
  curtain.translate(0, 1.7, 0);
  const strip = new THREE.PlaneGeometry(PATH_WIDTH, 1.1);
  strip.rotateX(-Math.PI / 2);
  const pylon = new THREE.CylinderGeometry(0.16, 0.22, 3.8, 10);
  pylon.translate(0, 1.9, 0);
  const lamp = new THREE.SphereGeometry(0.36, 16, 12);
  const curtainTex = curtainTexture(renderer);
  const hazardTex = hazardTexture(renderer);
  hazardTex.repeat.set(5, 1);
  const stripMat = new THREE.MeshBasicMaterial({ map: hazardTex, toneMapped: false });
  const pylonMat = new THREE.MeshStandardMaterial({ color: 0x24252c, metalness: 0.6, roughness: 0.45 });

  shared = {
    post, lintel, cap, column, plinth, banner, sign, veil, stone, plinthMat,
    curtain, strip, pylon, lamp, curtainTex, hazardTex, stripMat, pylonMat,
  };
  return shared;
}

export function disposeGateShared() {
  if (!shared) return;
  for (const v of Object.values(shared)) v.dispose();
  shared = null;
}

const easeOutBack = (t) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

export function createGate(scene, renderer, question, index, z, commit) {
  const S = getShared(renderer);
  const own = []; // per-gate geometries, textures and materials
  const keep = (x) => (own.push(x), x);

  const group = new THREE.Group();
  group.position.z = z;
  scene.add(group);

  const maxValue = Math.max(question.sides[0].value, question.sides[1].value);
  const railGeo = keep(new THREE.BoxGeometry(0.2, 0.08, commit));

  const arches = question.sides.map((side, i) => {
    const x = (i === 0 ? -1 : 1) * LANE_X;
    const arch = new THREE.Group();
    arch.position.x = x;
    group.add(arch);

    // Posts get their own material so the flash at the reveal is per-arch.
    const postMat = keep(S.stone.clone());
    for (const sx of [-ARCH_W / 2, ARCH_W / 2]) {
      const p = new THREE.Mesh(S.post, postMat);
      p.position.x = sx;
      p.castShadow = true;
      arch.add(p);
      const c = new THREE.Mesh(S.cap, postMat);
      c.position.set(sx, ARCH_H + 0.15, 0);
      arch.add(c);
    }
    const lintel = new THREE.Mesh(S.lintel, postMat);
    lintel.position.y = ARCH_H + 0.45;
    lintel.castShadow = true;
    arch.add(lintel);

    // The pennant, unlit and unfogged: it has to be legible from far off.
    const bannerMat = keep(
      new THREE.MeshBasicMaterial({ map: keep(bannerTexture(renderer, side)), fog: false, toneMapped: false }),
    );
    const banner = new THREE.Mesh(S.banner, bannerMat);
    banner.position.set(0, BANNER_Y, 0.05);
    arch.add(banner);

    // A faint veil in the opening; the chosen one is what you burst through.
    const veilMat = keep(
      new THREE.MeshBasicMaterial({
        color: side.color,
        transparent: true,
        opacity: 0.12,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    const veil = new THREE.Mesh(S.veil, veilMat);
    veil.position.y = ARCH_H / 2;
    arch.add(veil);

    // Lane rails from the lock line to the arch: dim until the lock.
    const railMat = keep(
      new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0.3, toneMapped: false }),
    );
    for (const rx of [-ARCH_W / 2 + 0.35, ARCH_W / 2 - 0.35]) {
      const rail = new THREE.Mesh(railGeo, railMat);
      rail.position.set(rx, 0.06, commit / 2);
      arch.add(rail);
    }

    // The data column, outside the arch so it never blocks the lane.
    const colX = (i === 0 ? -1 : 1) * (ARCH_W / 2 + 1.5);
    const plinth = new THREE.Mesh(S.plinth, S.plinthMat);
    plinth.position.set(colX, 0.125, 0);
    arch.add(plinth);
    const colMat = keep(
      new THREE.MeshStandardMaterial({
        color: side.color,
        emissive: side.color,
        emissiveIntensity: 0.25,
        roughness: 0.4,
        metalness: 0.1,
      }),
    );
    const column = new THREE.Mesh(S.column, colMat);
    column.position.set(colX, 0.25, 0);
    column.scale.y = 0.001;
    column.castShadow = true;
    arch.add(column);

    const target = 0.6 + (COLUMN_MAX - 0.6) * (side.value / maxValue);

    const tagMat = keep(
      new THREE.SpriteMaterial({
        map: keep(valueTexture(renderer, side.label, i === question.answer)),
        transparent: true,
        opacity: 0,
        depthWrite: false,
        fog: false,
        toneMapped: false,
      }),
    );
    const tag = new THREE.Sprite(tagMat);
    tag.scale.set(3.2, 1.0, 1);
    tag.position.set(colX, 0.6, 0);
    arch.add(tag);

    return { postMat, veil, veilMat, railMat, column, target, tag, tagMat };
  });

  // ---- the question sign, tipped a little toward the low camera
  const signMat = keep(
    new THREE.MeshBasicMaterial({
      map: keep(questionTexture(renderer, question.metric, index)),
      fog: false,
      toneMapped: false,
    }),
  );
  const sign = new THREE.Mesh(S.sign, signMat);
  sign.position.set(0, SIGN_Y, 0);
  sign.rotation.x = 0.12;
  group.add(sign);

  // Iron rods from the lintels up to the sign; the pennants hang between them.
  const rodLen = SIGN_Y - SIGN_H / 2 - (ARCH_H + 0.8);
  const rodMat = keep(new THREE.MeshStandardMaterial({ color: 0x2a2a30, metalness: 0.7, roughness: 0.4 }));
  const rodGeo = keep(new THREE.CylinderGeometry(0.05, 0.05, rodLen, 6));
  for (const x of [-LANE_X - BANNER_W / 2 + 0.2, -LANE_X + BANNER_W / 2 - 0.2, LANE_X - BANNER_W / 2 + 0.2, LANE_X + BANNER_W / 2 - 0.2]) {
    const rod = new THREE.Mesh(rodGeo, rodMat);
    rod.position.set(x, ARCH_H + 0.8 + rodLen / 2, -0.1);
    group.add(rod);
  }

  // ---- the lock line
  const lock = new THREE.Group();
  lock.position.z = commit;
  group.add(lock);

  const curtainMat = keep(
    new THREE.MeshBasicMaterial({
      map: S.curtainTex,
      color: GOLD,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
      toneMapped: false,
    }),
  );
  const curtain = new THREE.Mesh(S.curtain, curtainMat);
  lock.add(curtain);

  const strip = new THREE.Mesh(S.strip, S.stripMat);
  strip.position.y = 0.05;
  lock.add(strip);

  const lampMat = keep(new THREE.MeshBasicMaterial({ color: GOLD, toneMapped: false, fog: false }));
  for (const sx of [-1, 1]) {
    const p = new THREE.Mesh(S.pylon, S.pylonMat);
    p.position.x = sx * (PATH_WIDTH / 2 + 0.45);
    p.castShadow = true;
    lock.add(p);
    const l = new THREE.Mesh(S.lamp, lampMat);
    l.position.set(sx * (PATH_WIDTH / 2 + 0.45), 4.0, 0);
    lock.add(l);
  }

  // Divider between the lanes, line to arch: the "no swapping now" kerb.
  const dividerMat = keep(
    new THREE.MeshStandardMaterial({ color: 0x3a3320, emissive: GOLD, emissiveIntensity: 0.25, roughness: 0.6 }),
  );
  const divider = new THREE.Mesh(keep(new THREE.BoxGeometry(0.28, 0.24, commit - 1)), dividerMat);
  divider.position.set(0, 0.12, commit / 2);
  group.add(divider);

  let revealT = -1;
  let flashT = -1;
  let chosen = -1;
  let burstT = -1;

  const GOOD = new THREE.Color(0x3ee08a);
  const BAD = new THREE.Color(0xff4a5a);
  const NONE = new THREE.Color(0x000000);
  const WHITE = new THREE.Color(0xffffff);
  const GOLD_C = new THREE.Color(GOLD);

  return {
    z,
    lockZ: z + commit,
    question,
    locked: false,
    passed: false,

    /** Lock the runner's lane, flash the line and start the columns rising. */
    reveal(lane) {
      if (this.locked) return;
      this.locked = true;
      chosen = lane; // −1 if the runner never left the centre line
      revealT = 0;
      flashT = 0;
      arches.forEach((a, i) => {
        if (i === lane) {
          a.veilMat.opacity = 0.32;
          a.railMat.color.set(GOLD);
          a.railMat.opacity = 1;
        } else {
          a.veilMat.color.set(RED);
          a.veilMat.opacity = 0.42;
          a.railMat.color.set(RED);
          a.railMat.opacity = 0.75;
        }
      });
      dividerMat.emissive.set(RED);
      dividerMat.emissiveIntensity = 1.1;
      lampMat.color.set(RED);
    },

    /** Called as the runner crosses the arch line. */
    pass() {
      this.passed = true;
      burstT = 0;
    },

    update(dt, time, runZ) {
      if (!this.locked) {
        // Idle shimmer on the veils, and a lock line that pulses harder the
        // closer the runner gets, so the deadline is felt, not just seen.
        arches.forEach((a, i) => (a.veilMat.opacity = 0.1 + 0.05 * Math.sin(time * 3 + i * 1.7)));
        const dist = runZ - this.lockZ;
        const near = THREE.MathUtils.clamp(1 - dist / 55, 0, 1);
        const rate = 3 + near * 9;
        const pulse = 0.5 + 0.5 * Math.sin(time * rate);
        curtainMat.opacity = 0.45 + 0.3 * near + 0.25 * pulse * (0.4 + near);
        lampMat.color.copy(GOLD_C).multiplyScalar(0.6 + 0.6 * pulse);
        arches.forEach((a) => (a.railMat.opacity = 0.25 + 0.3 * near));
      }

      // The curtain flares white on the lock, then lifts and fades away.
      if (flashT >= 0 && flashT < 1) {
        flashT = Math.min(1, flashT + dt / 0.7);
        curtainMat.color.copy(WHITE).lerp(chosen >= 0 ? GOLD_C : BAD, flashT);
        curtainMat.opacity = 1 - flashT;
        curtain.scale.y = 1 + flashT * 1.5;
        if (flashT >= 1) curtain.visible = false;
      }

      if (revealT >= 0 && revealT < 1) {
        revealT = Math.min(1, revealT + dt / 0.85);
        const e = easeOutBack(revealT);
        arches.forEach((a, i) => {
          const h = Math.max(0.001, a.target * e);
          a.column.scale.y = h;
          a.tag.position.y = 0.25 + h + 0.8;
          a.tagMat.opacity = Math.min(1, revealT * 2.2);
          const good = i === question.answer;
          a.postMat.emissive.copy(good ? GOOD : i === chosen ? BAD : NONE);
          a.postMat.emissiveIntensity = 0.6 * Math.sin(Math.PI * Math.min(1, revealT * 1.4)) + (good ? 0.35 : 0);
        });
      }

      // The chosen veil blows out as the runner goes through it.
      if (burstT >= 0 && burstT < 1 && chosen >= 0) {
        burstT = Math.min(1, burstT + dt / 0.45);
        const a = arches[chosen];
        a.veil.scale.setScalar(1 + burstT * 0.6);
        a.veilMat.opacity = 0.32 * (1 - burstT);
      }
    },

    dispose() {
      scene.remove(group);
      for (const x of own) x.dispose();
    },
  };
}
