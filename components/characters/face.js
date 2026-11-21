import * as THREE from "three";
import { createClayMaterial, createGlossMaterial, damp } from "./materials.js";

/**
 * Sculpted 3D vinyl-toy face for the modular humanoid head.
 * Features glossy eyes with bright catchlight dots, articulated 3D brows,
 * soft cheek blush, button nose, ears, auto-blink, gaze offset, and
 * swappable/animated 3D mouths.
 *
 * Head center is at (0, 0, 0) in local head space; face looks toward +Z.
 */
export function createHumanFace(tracker, config) {
  const group = new THREE.Group();
  group.name = "face";

  const skinMat = createClayMaterial(tracker, config.skinTone, { roughness: 0.58 });
  const noseMat = createClayMaterial(
    tracker,
    new THREE.Color(config.skinTone).lerp(new THREE.Color("#d97f72"), 0.22),
    { roughness: 0.56 },
  );
  const blushMat = createClayMaterial(tracker, config.cheekTone || "#ea8a82", {
    roughness: 0.85,
    transparent: true,
    opacity: 0.42,
  });
  const eyeMat = createGlossMaterial(tracker, "#16141d", {
    roughness: 0.08,
    clearcoat: 1.0,
    clearcoatRoughness: 0.06,
  });
  const catchlightMat = tracker.keep(
    new THREE.MeshBasicMaterial({ color: 0xffffff }),
  );
  const browMat = createClayMaterial(tracker, config.hairColor, { roughness: 0.65 });
  const mouthDarkMat = createClayMaterial(tracker, "#3e2228", { roughness: 0.6 });
  const mouthInnerMat = createClayMaterial(tracker, "#8f3240", { roughness: 0.5 });
  const tongueMat = createClayMaterial(tracker, "#e36c7a", { roughness: 0.55 });

  // ---- Ears ----
  const earGeo = tracker.keep(new THREE.SphereGeometry(0.052, 16, 12));
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(earGeo, skinMat);
    ear.position.set(side * 0.308, -0.025, -0.015);
    ear.scale.set(0.6, 1.0, 0.72);
    group.add(ear);
  }

  // ---- Cute button nose ----
  const nose = new THREE.Mesh(
    tracker.keep(new THREE.SphereGeometry(0.03, 14, 12)),
    noseMat,
  );
  nose.position.set(0, -0.038, 0.296);
  nose.scale.set(1.05, 0.78, 0.82);
  group.add(nose);

  // ---- Soft cheek blush ----
  const blushGeo = tracker.keep(new THREE.SphereGeometry(0.048, 16, 12));
  for (const side of [-1, 1]) {
    const blush = new THREE.Mesh(blushGeo, blushMat);
    blush.position.set(side * 0.168, -0.068, 0.254);
    blush.rotation.y = side * 0.45;
    blush.scale.set(1.1, 0.68, 0.16);
    group.add(blush);
  }

  // ---- Glossy 3D eyes + catchlights ----
  const eyeGeo = tracker.keep(new THREE.SphereGeometry(0.045, 20, 16));
  const bigHighlightGeo = tracker.keep(new THREE.SphereGeometry(0.0135, 10, 8));
  const smallHighlightGeo = tracker.keep(new THREE.SphereGeometry(0.0065, 8, 6));

  const eyeGroups = [];
  const pupilGroups = [];

  for (const side of [-1, 1]) {
    const socket = new THREE.Group();
    socket.position.set(side * 0.108, 0.024, 0.268);
    socket.rotation.y = side * 0.2;

    const pupil = new THREE.Group();
    const eyeBall = new THREE.Mesh(eyeGeo, eyeMat);
    eyeBall.scale.set(0.84, 1.08, 0.48);
    pupil.add(eyeBall);

    const hi1 = new THREE.Mesh(bigHighlightGeo, catchlightMat);
    hi1.position.set(0.013, 0.017, 0.021);
    pupil.add(hi1);

    const hi2 = new THREE.Mesh(smallHighlightGeo, catchlightMat);
    hi2.position.set(-0.012, -0.014, 0.021);
    pupil.add(hi2);

    socket.add(pupil);
    group.add(socket);
    eyeGroups.push(socket);
    pupilGroups.push(pupil);
  }

  // ---- Articulated 3D eyebrows ----
  const browGeo = tracker.keep(new THREE.CapsuleGeometry(0.0135, 0.055, 6, 10));
  browGeo.rotateZ(Math.PI / 2);

  const brows = [];
  for (const side of [-1, 1]) {
    const brow = new THREE.Mesh(browGeo, browMat);
    brow.position.set(side * 0.11, 0.106, 0.266);
    brow.rotation.y = side * 0.2;
    group.add(brow);
    brows.push(brow);
  }

  // ---- 3D Mouth variants ----
  const mouthRoot = new THREE.Group();
  mouthRoot.position.set(0, -0.108, 0.278);
  group.add(mouthRoot);

  // 1. Neutral gentle smile arc
  const neutralMouth = new THREE.Mesh(
    tracker.keep(new THREE.TorusGeometry(0.044, 0.0105, 8, 18, Math.PI * 0.72)),
    mouthDarkMat,
  );
  neutralMouth.rotation.z = Math.PI + (Math.PI - Math.PI * 0.72) / 2;
  neutralMouth.position.y = 0.028;
  mouthRoot.add(neutralMouth);

  // 2. Happy wide cheerful smile
  const happyMouth = new THREE.Group();
  const happyArc = new THREE.Mesh(
    tracker.keep(new THREE.TorusGeometry(0.056, 0.012, 8, 20, Math.PI * 0.85)),
    mouthDarkMat,
  );
  happyArc.rotation.z = Math.PI + (Math.PI - Math.PI * 0.85) / 2;
  happyArc.position.y = 0.036;
  happyMouth.add(happyArc);
  mouthRoot.add(happyMouth);

  // 3. Excited open smile (D-shape with tongue)
  const excitedMouth = new THREE.Group();
  const openCavity = new THREE.Mesh(
    tracker.keep(new THREE.SphereGeometry(0.048, 16, 12, 0, Math.PI * 2, Math.PI * 0.48, Math.PI * 0.52)),
    mouthInnerMat,
  );
  openCavity.scale.set(1.18, 0.95, 0.42);
  openCavity.position.y = 0.018;
  excitedMouth.add(openCavity);
  const openLip = new THREE.Mesh(
    tracker.keep(new THREE.CapsuleGeometry(0.0085, 0.09, 6, 8)),
    mouthDarkMat,
  );
  openLip.rotation.z = Math.PI / 2;
  openLip.position.set(0, 0.018, 0.008);
  excitedMouth.add(openLip);
  const tongue = new THREE.Mesh(
    tracker.keep(new THREE.SphereGeometry(0.028, 12, 10)),
    tongueMat,
  );
  tongue.scale.set(1.1, 0.55, 0.45);
  tongue.position.set(0, -0.012, 0.01);
  excitedMouth.add(tongue);
  mouthRoot.add(excitedMouth);

  // 4. Surprised O-mouth
  const surprisedMouth = new THREE.Group();
  const oRing = new THREE.Mesh(
    tracker.keep(new THREE.TorusGeometry(0.028, 0.0105, 8, 18)),
    mouthDarkMat,
  );
  surprisedMouth.add(oRing);
  const oFill = new THREE.Mesh(
    tracker.keep(new THREE.CircleGeometry(0.025, 16)),
    mouthInnerMat,
  );
  oFill.position.z = -0.002;
  surprisedMouth.add(oFill);
  mouthRoot.add(surprisedMouth);

  // 5. Thinking offset pursed dash
  const thinkingMouth = new THREE.Mesh(
    tracker.keep(new THREE.CapsuleGeometry(0.0105, 0.044, 6, 10)),
    mouthDarkMat,
  );
  thinkingMouth.rotation.z = Math.PI / 2 + 0.14;
  thinkingMouth.position.set(0.022, 0.0, 0);
  mouthRoot.add(thinkingMouth);

  // 6. Speaking animated oval mouth
  const speakingMouth = new THREE.Group();
  const speakCavity = new THREE.Mesh(
    tracker.keep(new THREE.SphereGeometry(0.036, 14, 12)),
    mouthInnerMat,
  );
  speakCavity.scale.set(1.15, 0.72, 0.32);
  speakingMouth.add(speakCavity);
  const speakTongue = new THREE.Mesh(
    tracker.keep(new THREE.SphereGeometry(0.02, 10, 8)),
    tongueMat,
  );
  speakTongue.scale.set(1.0, 0.5, 0.35);
  speakTongue.position.set(0, -0.012, 0.008);
  speakingMouth.add(speakTongue);
  mouthRoot.add(speakingMouth);

  const mouths = {
    neutral: neutralMouth,
    happy: happyMouth,
    excited: excitedMouth,
    surprised: surprisedMouth,
    thinking: thinkingMouth,
    speaking: speakingMouth,
  };

  let expression = config.expression || "neutral";
  let blinkTimer = 1.6 + Math.random() * 2.2;
  let blinkProgress = 0; // 0 = open, >0 = blinking
  let speakTime = 0;
  let gazeX = 0;
  let gazeY = 0;

  function applyMouthVisibility() {
    for (const [key, obj] of Object.entries(mouths)) {
      obj.visible = key === expression;
    }
  }
  applyMouthVisibility();

  // Target brow & eye parameters per expression
  const EXPR_PARAMS = {
    neutral: { browY: [0.106, 0.106], browRot: [0.06, -0.06], eyeScaleY: 1.0 },
    happy: { browY: [0.118, 0.118], browRot: [0.14, -0.14], eyeScaleY: 0.92 },
    excited: { browY: [0.132, 0.132], browRot: [0.16, -0.16], eyeScaleY: 1.12 },
    surprised: { browY: [0.138, 0.138], browRot: [0.08, -0.08], eyeScaleY: 1.2 },
    thinking: { browY: [0.128, 0.094], browRot: [0.22, 0.18], eyeScaleY: 0.94 },
    speaking: { browY: [0.115, 0.115], browRot: [0.1, -0.1], eyeScaleY: 1.02 },
  };

  return {
    group,
    setExpression(next) {
      if (mouths[next]) {
        expression = next;
        applyMouthVisibility();
      }
    },
    getExpression() {
      return expression;
    },
    /** Set eye gaze offset in normalized [-1, 1] range. */
    setGaze(nx, ny) {
      gazeX = THREE.MathUtils.clamp(nx, -1, 1);
      gazeY = THREE.MathUtils.clamp(ny, -1, 1);
    },
    update(dt, { isTalking = false } = {}) {
      // Natural randomized auto-blink every ~2.6–5.2s
      blinkTimer -= dt;
      if (blinkTimer <= 0 && blinkProgress === 0) {
        blinkProgress = 0.0001;
        blinkTimer = 2.6 + Math.random() * 2.6;
      }

      let blinkFactor = 1.0;
      if (blinkProgress > 0) {
        blinkProgress += dt / 0.14;
        if (blinkProgress >= 1) {
          blinkProgress = 0;
        } else {
          // Smooth close-and-reopen curve
          blinkFactor = 1 - Math.sin(blinkProgress * Math.PI) * 0.92;
        }
      }

      const activeExpr = isTalking && expression === "neutral" ? "speaking" : expression;
      for (const [key, obj] of Object.entries(mouths)) {
        obj.visible = key === activeExpr;
      }

      const params = EXPR_PARAMS[activeExpr] || EXPR_PARAMS.neutral;

      for (let i = 0; i < 2; i++) {
        brows[i].position.y = damp(brows[i].position.y, params.browY[i], 12, dt);
        brows[i].rotation.z = damp(brows[i].rotation.z, params.browRot[i], 12, dt);

        const targetEyeY = params.eyeScaleY * blinkFactor;
        eyeGroups[i].scale.y = damp(eyeGroups[i].scale.y, targetEyeY, 34, dt);

        pupilGroups[i].position.x = damp(pupilGroups[i].position.x, gazeX * 0.015, 14, dt);
        pupilGroups[i].position.y = damp(pupilGroups[i].position.y, gazeY * 0.012, 14, dt);
      }

      if (activeExpr === "speaking") {
        speakTime += dt;
        const syllable =
          0.45 +
          0.35 * Math.abs(Math.sin(speakTime * 11.5)) +
          0.2 * Math.abs(Math.sin(speakTime * 7.2 + 0.9));
        speakingMouth.scale.set(
          0.92 + syllable * 0.18,
          0.35 + syllable * 0.9,
          1,
        );
      }
    },
  };
}
