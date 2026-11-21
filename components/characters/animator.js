import * as THREE from "three";
import { damp } from "./materials.js";

const _tmpVec = new THREE.Vector3();
const _localTarget = new THREE.Vector3();

/**
 * Unified procedural animation controller for both humanoid rigs and Pip.
 * Supports smooth damped blending across looping states (idle, walk, run, talk, think, sit),
 * auto-returning one-shot gestures (wave, point, celebrate, nod, shake),
 * prop-aware idle hold posture, and continuous world-space lookAt gaze tracking.
 */
export function createAnimator(rig) {
  let state = "idle";
  let gesture = null;
  let gestureOpts = null;
  let gestureT = 0;
  let gestureDuration = 1.0;
  let time = 0;
  let lookTarget = null;

  // Secondary spring state (Pip's antenna bounce)
  let springAngle = 0;
  let springVel = 0;

  const GESTURE_DURATIONS = {
    wave: 1.65,
    point: 1.85,
    celebrate: 1.25,
    nod: 0.72,
    shake: 0.82,
  };

  function computeLocalAngles(worldPoint, anchorY) {
    _tmpVec.copy(worldPoint);
    rig.root.worldToLocal(_tmpVec);
    _localTarget.set(_tmpVec.x, _tmpVec.y - anchorY, _tmpVec.z);

    // Character faces +Z
    const yaw = Math.atan2(_localTarget.x, Math.max(0.15, _localTarget.z));
    const horiz = Math.hypot(_localTarget.x, _localTarget.z);
    const pitch = -Math.atan2(_localTarget.y, Math.max(0.25, horiz));
    return { yaw, pitch };
  }

  function computeLookAngles() {
    if (!lookTarget) return { yaw: 0, pitch: 0 };
    const anchorY = rig.type === "bot" ? 0.56 : 1.18;
    const { yaw, pitch } = computeLocalAngles(lookTarget, anchorY);
    return {
      yaw: THREE.MathUtils.clamp(yaw, -0.78, 0.78),
      pitch: THREE.MathUtils.clamp(pitch, -0.45, 0.42),
    };
  }

  function updateHuman(dt) {
    const j = rig.joints;
    const { yaw: lookYaw, pitch: lookPitch } = computeLookAngles();
    const holdingProp = Boolean(rig.getProp && rig.getProp() && rig.getProp() !== "none");

    // Baseline neutral pose targets
    let bodyY = 0;
    let bodyRotX = 0;
    let bodyRotY = 0;
    let bodyRotZ = 0;

    let headRotX = lookPitch * 0.72;
    let headRotY = lookYaw * 0.75;
    let headRotZ = 0;

    let lArmX = 0;
    let lArmZ = 0.14;
    let lForearmX = -0.1;

    let rArmX = 0;
    let rArmZ = -0.14;
    let rForearmX = -0.1;

    let lLegX = 0;
    let rLegX = 0;

    // ---- Base looping state ----
    if (state === "idle") {
      const breath = Math.sin(time * 2.2);
      bodyY = breath * 0.012;
      bodyRotZ = Math.sin(time * 1.1) * 0.018;
      lArmZ = 0.14 + breath * 0.025;
      rArmZ = -0.14 - breath * 0.025;
      headRotZ += Math.sin(time * 0.85) * 0.03;
    } else if (state === "walk") {
      const freq = 5.4;
      const s = Math.sin(time * freq);
      const c = Math.cos(time * freq);
      bodyY = Math.abs(c) * 0.042;
      bodyRotX = 0.06;
      bodyRotY = s * 0.07;
      bodyRotZ = -s * 0.035;
      lLegX = s * 0.56;
      rLegX = -s * 0.56;
      lArmX = -s * 0.48;
      rArmX = s * 0.48;
      lForearmX = -0.22 - Math.max(0, s) * 0.25;
      rForearmX = -0.22 - Math.max(0, -s) * 0.25;
    } else if (state === "run") {
      const freq = 9.4;
      const s = Math.sin(time * freq);
      const c = Math.cos(time * freq);
      bodyY = Math.abs(c) * 0.085 + 0.02;
      bodyRotX = 0.2;
      bodyRotY = s * 0.11;
      bodyRotZ = -s * 0.055;
      lLegX = s * 0.92;
      rLegX = -s * 0.92;
      lArmX = -s * 0.85;
      rArmX = s * 0.85;
      lForearmX = -0.82;
      rForearmX = -0.82;
      headRotX -= 0.1;
    } else if (state === "talk") {
      const beat = Math.sin(time * 3.8);
      const beat2 = Math.sin(time * 2.5 + 1.1);
      bodyY = Math.sin(time * 2.4) * 0.014;
      bodyRotY = beat2 * 0.07;
      headRotZ += beat * 0.065;
      headRotX += Math.sin(time * 4.4) * 0.05;
      lArmX = -0.45 - Math.max(0, beat) * 0.35;
      lArmZ = 0.28 + Math.abs(beat2) * 0.14;
      lForearmX = -0.78 - beat * 0.22;
      rArmX = -0.52 - Math.max(0, -beat2) * 0.42;
      rArmZ = -0.26 - Math.abs(beat) * 0.16;
      rForearmX = -0.85 + beat2 * 0.24;
    } else if (state === "think") {
      const sway = Math.sin(time * 1.4);
      bodyY = sway * 0.008;
      bodyRotZ = -0.04;
      headRotX += 0.12;
      headRotZ += -0.14 + sway * 0.03;
      rArmX = -1.12;
      rArmZ = 0.28;
      rForearmX = -1.25;
      lArmX = -0.3;
      lArmZ = -0.12;
      lForearmX = -0.65;
    } else if (state === "sit") {
      const breath = Math.sin(time * 1.9);
      bodyY = -0.21 + breath * 0.008;
      bodyRotX = -0.04;
      lLegX = -1.32;
      rLegX = -1.32;
      lArmX = -0.36;
      rArmX = -0.36;
      lArmZ = 0.12;
      rArmZ = -0.12;
      lForearmX = -0.62;
      rForearmX = -0.62;
    }

    // If holding a handheld prop (tablet/coffee/laptop/pointer) during idle/walk/sit,
    // raise the right forearm gently so the prop presents naturally in front of the torso.
    if (holdingProp && (state === "idle" || state === "walk" || state === "sit")) {
      rArmX = Math.min(rArmX, -0.34);
      rForearmX = Math.min(rForearmX, -0.92);
      rArmZ = -0.12;
    }

    // ---- One-shot gesture overlay ----
    if (gesture) {
      gestureT += dt / gestureDuration;
      if (gestureT >= 1) {
        gesture = null;
        gestureOpts = null;
        gestureT = 0;
      } else {
        const env = Math.sin(gestureT * Math.PI);
        if (gesture === "wave") {
          const wag = Math.sin(gestureT * Math.PI * 6.5);
          rArmX = THREE.MathUtils.lerp(rArmX, -0.35, env);
          rArmZ = THREE.MathUtils.lerp(rArmZ, -2.55 + wag * 0.32, env);
          rForearmX = THREE.MathUtils.lerp(rForearmX, -0.45, env);
          headRotZ += 0.11 * env;
          bodyRotZ += -0.05 * env;
        } else if (gesture === "point") {
          // Smooth hold envelope: fast raise, steady hold, smooth return
          const holdEnv = Math.min(1, Math.sin(gestureT * Math.PI) * 1.65);
          let aimYaw = -0.42;
          let aimPitch = -0.18;
          if (gestureOpts?.target) {
            const a = computeLocalAngles(gestureOpts.target, 0.78);
            aimYaw = THREE.MathUtils.clamp(a.yaw, -1.0, 0.85);
            aimPitch = THREE.MathUtils.clamp(a.pitch, -0.7, 0.55);
          }
          rArmX = THREE.MathUtils.lerp(rArmX, -1.42 + aimPitch, holdEnv);
          rArmZ = THREE.MathUtils.lerp(rArmZ, -0.25 + aimYaw * 0.55, holdEnv);
          rForearmX = THREE.MathUtils.lerp(rForearmX, -0.08, holdEnv);
          bodyRotY = THREE.MathUtils.lerp(bodyRotY, aimYaw * 0.32, holdEnv);
          headRotY = THREE.MathUtils.lerp(headRotY, aimYaw * 0.6, holdEnv);
          headRotX = THREE.MathUtils.lerp(headRotX, aimPitch * 0.45, holdEnv);
        } else if (gesture === "celebrate") {
          const hop = Math.sin(Math.min(1, gestureT * 1.45) * Math.PI);
          const doubleBounce = Math.abs(Math.sin(gestureT * Math.PI * 2));
          bodyY += hop * 0.24 + doubleBounce * 0.05;
          lArmX = THREE.MathUtils.lerp(lArmX, -0.2, env);
          rArmX = THREE.MathUtils.lerp(rArmX, -0.2, env);
          lArmZ = THREE.MathUtils.lerp(lArmZ, 2.7 + Math.sin(gestureT * 16) * 0.12, env);
          rArmZ = THREE.MathUtils.lerp(rArmZ, -2.7 - Math.sin(gestureT * 16) * 0.12, env);
          lForearmX = THREE.MathUtils.lerp(lForearmX, -0.25, env);
          rForearmX = THREE.MathUtils.lerp(rForearmX, -0.25, env);
          headRotX -= 0.14 * env;
          lLegX -= 0.24 * hop;
          rLegX += 0.24 * hop;
        } else if (gesture === "nod") {
          headRotX += Math.sin(gestureT * Math.PI * 4) * 0.24 * env;
        } else if (gesture === "shake") {
          headRotY += Math.sin(gestureT * Math.PI * 5) * 0.34 * env;
          lArmZ += 0.12 * env;
          rArmZ -= 0.12 * env;
        }
      }
    }

    // ---- Damped joint application ----
    const k = 14;
    j.body.position.y = damp(j.body.position.y, bodyY, k, dt);
    j.body.rotation.x = damp(j.body.rotation.x, bodyRotX, k, dt);
    j.body.rotation.y = damp(j.body.rotation.y, bodyRotY, k, dt);
    j.body.rotation.z = damp(j.body.rotation.z, bodyRotZ, k, dt);

    j.head.rotation.x = damp(j.head.rotation.x, headRotX, k, dt);
    j.head.rotation.y = damp(j.head.rotation.y, headRotY, k, dt);
    j.head.rotation.z = damp(j.head.rotation.z, headRotZ, k, dt);

    j.leftArm.rotation.x = damp(j.leftArm.rotation.x, lArmX, k, dt);
    j.leftArm.rotation.z = damp(j.leftArm.rotation.z, lArmZ, k, dt);
    j.leftForearm.rotation.x = damp(j.leftForearm.rotation.x, lForearmX, k, dt);

    j.rightArm.rotation.x = damp(j.rightArm.rotation.x, rArmX, k, dt);
    j.rightArm.rotation.z = damp(j.rightArm.rotation.z, rArmZ, k, dt);
    j.rightForearm.rotation.x = damp(j.rightForearm.rotation.x, rForearmX, k, dt);

    j.leftLeg.rotation.x = damp(j.leftLeg.rotation.x, lLegX, k, dt);
    j.rightLeg.rotation.x = damp(j.rightLeg.rotation.x, rLegX, k, dt);

    if (rig.contactShadow) {
      const s = THREE.MathUtils.clamp(1 - Math.max(0, bodyY) * 0.9, 0.65, 1.05);
      rig.contactShadow.scale.setScalar(s);
    }

    rig.face.setGaze(lookYaw * 1.15, -lookPitch * 1.15);
    rig.face.update(dt, { isTalking: state === "talk" });
  }

  function updateBot(dt) {
    const j = rig.joints;
    const { yaw: lookYaw, pitch: lookPitch } = computeLookAngles();

    let hoverY = 0.56 + Math.sin(time * 2.6) * 0.035;
    let bodyRotX = lookPitch * 0.45;
    let bodyRotY = lookYaw * 0.65;
    let bodyRotZ = Math.sin(time * 1.4) * 0.035;

    let lArmX = 0;
    let lArmZ = 0.22;
    let rArmX = 0;
    let rArmZ = -0.22;

    if (state === "walk") {
      hoverY = 0.57 + Math.sin(time * 5.2) * 0.04;
      bodyRotX += 0.14;
      bodyRotZ = Math.sin(time * 2.6) * 0.07;
      lArmX = 0.28;
      rArmX = 0.28;
    } else if (state === "run") {
      hoverY = 0.59 + Math.sin(time * 8.5) * 0.05;
      bodyRotX += 0.3;
      bodyRotZ = Math.sin(time * 4.2) * 0.1;
      lArmX = 0.55;
      rArmX = 0.55;
      lArmZ = 0.38;
      rArmZ = -0.38;
    } else if (state === "talk") {
      const b = Math.sin(time * 4.5);
      hoverY = 0.56 + Math.abs(b) * 0.035;
      bodyRotZ = b * 0.08;
      lArmX = -0.55 - Math.max(0, b) * 0.35;
      rArmX = -0.55 - Math.max(0, -b) * 0.35;
      lArmZ = 0.45;
      rArmZ = -0.45;
    } else if (state === "think") {
      hoverY = 0.58 + Math.sin(time * 1.6) * 0.025;
      bodyRotZ = -0.15;
      bodyRotX += 0.08;
      rArmX = -0.85;
      rArmZ = 0.25;
    } else if (state === "sit") {
      hoverY = 0.42 + Math.sin(time * 1.6) * 0.014;
      bodyRotX = 0.04;
      lArmZ = 0.12;
      rArmZ = -0.12;
    }

    let spinY = 0;
    if (gesture) {
      gestureT += dt / gestureDuration;
      if (gestureT >= 1) {
        gesture = null;
        gestureOpts = null;
        gestureT = 0;
      } else {
        const env = Math.sin(gestureT * Math.PI);
        if (gesture === "wave") {
          const wag = Math.sin(gestureT * Math.PI * 7);
          rArmZ = THREE.MathUtils.lerp(rArmZ, -2.35 + wag * 0.35, env);
          rArmX = THREE.MathUtils.lerp(rArmX, -0.3, env);
          bodyRotZ -= 0.12 * env;
        } else if (gesture === "point") {
          const holdEnv = Math.min(1, Math.sin(gestureT * Math.PI) * 1.65);
          let aimYaw = -0.42;
          if (gestureOpts?.target) {
            aimYaw = THREE.MathUtils.clamp(computeLocalAngles(gestureOpts.target, 0.56).yaw, -1.0, 0.85);
          }
          bodyRotY = THREE.MathUtils.lerp(bodyRotY, aimYaw * 0.7, holdEnv);
          rArmX = THREE.MathUtils.lerp(rArmX, -1.35, holdEnv);
          rArmZ = THREE.MathUtils.lerp(rArmZ, -0.35, holdEnv);
        } else if (gesture === "celebrate") {
          const hop = Math.sin(gestureT * Math.PI);
          hoverY += hop * 0.26;
          spinY = gestureT * Math.PI * 2;
          lArmZ = THREE.MathUtils.lerp(lArmZ, 2.5, env);
          rArmZ = THREE.MathUtils.lerp(rArmZ, -2.5, env);
        } else if (gesture === "nod") {
          bodyRotX += Math.sin(gestureT * Math.PI * 4) * 0.26 * env;
        } else if (gesture === "shake") {
          bodyRotY += Math.sin(gestureT * Math.PI * 5) * 0.36 * env;
        }
      }
    }

    const k = 12;
    j.chassis.position.y = damp(j.chassis.position.y, hoverY, k, dt);
    j.chassis.rotation.x = damp(j.chassis.rotation.x, bodyRotX, k, dt);
    j.chassis.rotation.y =
      gesture === "celebrate"
        ? bodyRotY + spinY
        : damp(j.chassis.rotation.y, bodyRotY, k, dt);
    j.chassis.rotation.z = damp(j.chassis.rotation.z, bodyRotZ, k, dt);

    j.leftArm.rotation.x = damp(j.leftArm.rotation.x, lArmX, k, dt);
    j.leftArm.rotation.z = damp(j.leftArm.rotation.z, lArmZ, k, dt);
    j.rightArm.rotation.x = damp(j.rightArm.rotation.x, rArmX, k, dt);
    j.rightArm.rotation.z = damp(j.rightArm.rotation.z, rArmZ, k, dt);

    const kick = -bodyRotZ * 18 + Math.sin(time * 3.1) * 1.4;
    springVel += (-42 * springAngle - 4.2 * springVel + kick) * dt;
    springAngle += springVel * dt;
    j.antenna.rotation.z = THREE.MathUtils.clamp(springAngle * 0.14, -0.55, 0.55);
    j.antenna.rotation.x = THREE.MathUtils.clamp(-bodyRotX * 0.7, -0.45, 0.45);

    if (j.thrusterRing) {
      const pulse = 1 + Math.sin(time * 7.5) * 0.06;
      j.thrusterRing.scale.set(pulse, 1, pulse);
    }

    if (rig.contactShadow) {
      const lift = hoverY - 0.56;
      const s = THREE.MathUtils.clamp(1 - lift * 0.85, 0.6, 1.08);
      rig.contactShadow.scale.setScalar(s);
    }

    rig.visor.setGaze(lookYaw * 1.25, -lookPitch * 1.15);
    rig.visor.update(dt, { isTalking: state === "talk" });
  }

  return {
    getState: () => state,
    setState(next) {
      state = next || "idle";
    },
    play(name, opts = null) {
      if (!GESTURE_DURATIONS[name]) return;
      gesture = name;
      gestureOpts = opts;
      gestureT = 0;
      gestureDuration = GESTURE_DURATIONS[name];
    },
    lookAt(target) {
      if (!target) {
        lookTarget = null;
      } else if (lookTarget) {
        lookTarget.copy(target);
      } else {
        lookTarget = target.clone();
      }
    },
    update(dt) {
      const clampedDt = THREE.MathUtils.clamp(Number.isFinite(dt) ? dt : 0, 0, 0.05);
      time += clampedDt;
      if (rig.type === "bot") {
        updateBot(clampedDt);
      } else {
        updateHuman(clampedDt);
      }
    },
  };
}
