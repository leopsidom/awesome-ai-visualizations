import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import {
  createTracker,
  createClayMaterial,
  createGlossMaterial,
  createMetalMaterial,
  createContactShadow,
  enableShadows,
  damp,
} from "./materials.js";
import { createAnimator } from "./animator.js";
import { EXPRESSION_TO_BOT_MOOD } from "./presets.js";

/**
 * Animated emissive Canvas2D LED visor for Pip the AI Companion Bot.
 */
function createLedVisor(tracker, accentHex = "#38e8d4") {
  const width = 512;
  const height = 320;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  const texture = tracker.keep(new THREE.CanvasTexture(canvas));
  texture.colorSpace = THREE.SRGBColorSpace;

  const screenGeo = tracker.keep(new THREE.PlaneGeometry(0.305, 0.195));
  const screenMat = tracker.keep(
    new THREE.MeshBasicMaterial({
      map: texture,
      toneMapped: false,
    }),
  );
  const mesh = new THREE.Mesh(screenGeo, screenMat);

  let mood = "neutral";
  let gazeX = 0;
  let gazeY = 0;
  let smoothGazeX = 0;
  let smoothGazeY = 0;
  let blinkTimer = 2.0 + Math.random() * 2.0;
  let blinkProgress = 0;
  let t = 0;

  function drawRoundedPill(cx, cy, w, h, r) {
    const x = cx - w / 2;
    const y = cy - h / 2;
    const rad = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, rad);
    ctx.fill();
  }

  function drawHeart(cx, cy, size) {
    ctx.beginPath();
    ctx.moveTo(cx, cy + size * 0.42);
    ctx.bezierCurveTo(cx - size, cy - size * 0.1, cx - size * 0.55, cy - size * 0.85, cx, cy - size * 0.25);
    ctx.bezierCurveTo(cx + size * 0.55, cy - size * 0.85, cx + size, cy - size * 0.1, cx, cy + size * 0.42);
    ctx.closePath();
    ctx.fill();
  }

  function renderFrame(activeMood) {
    // Deep OLED screen background
    ctx.fillStyle = "#060b14";
    ctx.fillRect(0, 0, width, height);

    // Subtle radial screen vignette + scanline texture
    const bgGrad = ctx.createRadialGradient(width / 2, height / 2, 20, width / 2, height / 2, 270);
    bgGrad.addColorStop(0, "rgba(56, 232, 212, 0.11)");
    bgGrad.addColorStop(1, "rgba(4, 8, 16, 0.0)");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    const color =
      activeMood === "heart"
        ? "#ff6b8b"
        : activeMood === "alert"
          ? "#ffb84d"
          : accentHex;

    ctx.save();
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 26;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const gx = smoothGazeX * 26;
    const gy = -smoothGazeY * 18;
    const lx = 172 + gx;
    const rx = 340 + gx;
    const ey = 148 + gy;

    const blinkScale =
      blinkProgress > 0 ? Math.max(0.08, 1 - Math.sin(blinkProgress * Math.PI) * 0.94) : 1;

    if (activeMood === "happy") {
      ctx.lineWidth = 18;
      for (const ex of [lx, rx]) {
        ctx.beginPath();
        ctx.arc(ex, ey + 14, 38, Math.PI * 1.15, Math.PI * 1.85);
        ctx.stroke();
      }
      // Small cheerful mouth arc
      ctx.lineWidth = 11;
      ctx.beginPath();
      ctx.arc(256 + gx * 0.6, 212 + gy * 0.5, 24, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
    } else if (activeMood === "heart") {
      const pulse = 1 + Math.sin(t * 7.5) * 0.09;
      drawHeart(lx, ey + 6, 48 * pulse);
      drawHeart(rx, ey + 6, 48 * pulse);
    } else if (activeMood === "curious") {
      // Big left eye, narrowed inquisitive right eye + tiny '?' dot
      drawRoundedPill(lx, ey - 4, 58, 92 * blinkScale, 28);
      drawRoundedPill(rx, ey + 8, 56, 54 * blinkScale, 24);
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(240 + gx * 0.5, 224 + gy * 0.4);
      ctx.quadraticCurveTo(258 + gx * 0.5, 214 + gy * 0.4, 276 + gx * 0.5, 224 + gy * 0.4);
      ctx.stroke();
    } else if (activeMood === "loading") {
      // Three orbiting/bouncing glowing AI thinking dots
      for (let i = 0; i < 3; i++) {
        const bounce = Math.sin(t * 6.2 - i * 0.95) * 24;
        const r = 18 + Math.max(0, Math.sin(t * 6.2 - i * 0.95)) * 7;
        ctx.beginPath();
        ctx.arc(176 + i * 80, 160 + bounce, r, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (activeMood === "alert") {
      // Wide attentive eyes with exclamation gleam
      drawRoundedPill(lx, ey, 64, 98, 30);
      drawRoundedPill(rx, ey, 64, 98, 30);
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#060b14";
      ctx.beginPath();
      ctx.arc(lx, ey, 16, 0, Math.PI * 2);
      ctx.arc(rx, ey, 16, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Neutral or Speaking: friendly rounded pill eyes
      const eyeH = 88 * blinkScale;
      drawRoundedPill(lx, ey - (activeMood === "speaking" ? 14 : 0), 56, eyeH, 28);
      drawRoundedPill(rx, ey - (activeMood === "speaking" ? 14 : 0), 56, eyeH, 28);

      // Cute subtle bright catchlight inside each LED eye
      if (blinkScale > 0.45) {
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#e8fffc";
        ctx.beginPath();
        ctx.arc(lx + 11, ey - (activeMood === "speaking" ? 30 : 16), 8, 0, Math.PI * 2);
        ctx.arc(rx + 11, ey - (activeMood === "speaking" ? 30 : 16), 8, 0, Math.PI * 2);
        ctx.fill();
      }

      if (activeMood === "speaking") {
        // Animated equalizer voice waveform bars
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 16;
        const bars = 7;
        for (let i = 0; i < bars; i++) {
          const centerWeight = 1 - Math.abs(i - 3) * 0.22;
          const wave = 14 + Math.abs(Math.sin(t * 12.5 + i * 1.15)) * 42 * centerWeight;
          drawRoundedPill(196 + i * 20, 232, 11, wave, 5);
        }
      } else {
        // Tiny subtle happy smile indicator
        ctx.strokeStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 14;
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.arc(256 + gx * 0.5, 206 + gy * 0.4, 18, Math.PI * 0.2, Math.PI * 0.8);
        ctx.stroke();
      }
    }

    ctx.restore();

    // Very subtle OLED scanlines for tactile screen feel
    ctx.fillStyle = "rgba(0, 0, 0, 0.16)";
    for (let y = 0; y < height; y += 6) {
      ctx.fillRect(0, y, width, 2);
    }

    texture.needsUpdate = true;
  }

  renderFrame(mood);

  return {
    mesh,
    setExpression(next) {
      mood = EXPRESSION_TO_BOT_MOOD[next] || "neutral";
    },
    getExpression: () => mood,
    setGaze(nx, ny) {
      gazeX = THREE.MathUtils.clamp(nx, -1, 1);
      gazeY = THREE.MathUtils.clamp(ny, -1, 1);
    },
    update(dt, { isTalking = false } = {}) {
      t += dt;
      smoothGazeX = damp(smoothGazeX, gazeX, 12, dt);
      smoothGazeY = damp(smoothGazeY, gazeY, 12, dt);

      blinkTimer -= dt;
      if (blinkTimer <= 0 && blinkProgress === 0) {
        blinkProgress = 0.0001;
        blinkTimer = 2.8 + Math.random() * 2.4;
      }
      if (blinkProgress > 0) {
        blinkProgress += dt / 0.13;
        if (blinkProgress >= 1) blinkProgress = 0;
      }

      const activeMood = isTalking && mood === "neutral" ? "speaking" : mood;
      renderFrame(activeMood);
    },
  };
}

/**
 * Pip — Floating vinyl AI Companion Bot (normalized height = 0.95m, hovering above y = 0, facing +Z).
 */
export function createBot(config) {
  const tracker = createTracker();
  const root = new THREE.Group();
  root.name = `character-${config.id || "pip"}`;

  const rigRoot = new THREE.Group();
  const baseHeight = 0.95;
  const targetHeight = config.height ?? baseHeight;
  rigRoot.scale.setScalar(targetHeight / baseHeight);
  root.add(rigRoot);

  const accentHex = config.accentColor || "#38e8d4";
  const accentColor = new THREE.Color(accentHex);

  // Soft contact shadow + subtle glowing hover halo on floor
  let contactShadow = null;
  if (config.contactShadow !== false) {
    contactShadow = createContactShadow(tracker, 0.28, 0.28);
    rigRoot.add(contactShadow);
  }

  const chassis = new THREE.Group();
  chassis.name = "chassis";
  chassis.position.y = 0.56;
  rigRoot.add(chassis);

  // Materials
  const bodyMat = createGlossMaterial(tracker, config.bodyColor || "#eef2f8", {
    roughness: 0.28,
    clearcoat: 0.65,
    clearcoatRoughness: 0.2,
  });
  const trimMat = createClayMaterial(tracker, config.trimColor || "#232a38", {
    roughness: 0.45,
    metalness: 0.15,
  });
  const bezelMat = createGlossMaterial(tracker, "#0b0f18", {
    roughness: 0.08,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
  });
  const metalMat = createMetalMaterial(tracker, "#b8c4d4", {
    roughness: 0.26,
    metalness: 0.85,
  });
  const glowMat = tracker.keep(
    new THREE.MeshStandardMaterial({
      color: accentColor,
      emissive: accentColor,
      emissiveIntensity: 1.8,
      roughness: 0.2,
      toneMapped: false,
    }),
  );

  // ---- Main vinyl rounded-cube chassis ----
  const headShell = new THREE.Mesh(
    tracker.keep(new RoundedBoxGeometry(0.44, 0.37, 0.36, 6, 0.11)),
    bodyMat,
  );
  chassis.add(headShell);

  // Recessed glossy OLED bezel + glowing LED screen
  const bezel = new THREE.Mesh(
    tracker.keep(new RoundedBoxGeometry(0.34, 0.23, 0.04, 5, 0.055)),
    bezelMat,
  );
  bezel.position.set(0, 0.005, 0.168);
  chassis.add(bezel);

  const visor = createLedVisor(tracker, accentHex);
  visor.mesh.position.set(0, 0.005, 0.19);
  chassis.add(visor.mesh);

  // Side ear-pods with accent glow rings
  const podGeo = tracker.keep(new THREE.CylinderGeometry(0.072, 0.078, 0.045, 22));
  podGeo.rotateZ(Math.PI / 2);
  const podRingGeo = tracker.keep(new THREE.TorusGeometry(0.056, 0.009, 10, 24));
  podRingGeo.rotateY(Math.PI / 2);

  for (const side of [-1, 1]) {
    const pod = new THREE.Mesh(podGeo, trimMat);
    pod.position.set(side * 0.228, 0.01, -0.01);
    chassis.add(pod);

    const ring = new THREE.Mesh(podRingGeo, glowMat);
    ring.position.set(side * 0.25, 0.01, -0.01);
    chassis.add(ring);
  }

  // Rear cooling vent detail (looks finished from 360°)
  const ventPanel = new THREE.Mesh(
    tracker.keep(new RoundedBoxGeometry(0.24, 0.16, 0.03, 3, 0.025)),
    trimMat,
  );
  ventPanel.position.set(0, 0, -0.174);
  chassis.add(ventPanel);

  // ---- Spring-damped top antenna ----
  const antennaPivot = new THREE.Group();
  antennaPivot.position.set(0, 0.18, -0.01);
  chassis.add(antennaPivot);

  const antBase = new THREE.Mesh(
    tracker.keep(new THREE.CylinderGeometry(0.038, 0.05, 0.03, 16)),
    trimMat,
  );
  antBase.position.y = 0.015;
  antennaPivot.add(antBase);

  const antStem = new THREE.Mesh(
    tracker.keep(new THREE.CylinderGeometry(0.01, 0.014, 0.15, 12)),
    metalMat,
  );
  antStem.position.y = 0.095;
  antennaPivot.add(antStem);

  const antOrb = new THREE.Mesh(
    tracker.keep(new THREE.SphereGeometry(0.036, 18, 14)),
    glowMat,
  );
  antOrb.position.y = 0.185;
  antennaPivot.add(antOrb);

  // ---- Tapered lower hover pod + glowing thruster ring ----
  const lowerPodPts = [
    new THREE.Vector2(0.01, 0.0),
    new THREE.Vector2(0.085, 0.01),
    new THREE.Vector2(0.14, 0.09),
    new THREE.Vector2(0.155, 0.15),
    new THREE.Vector2(0.01, 0.15),
  ];
  const lowerPod = new THREE.Mesh(
    tracker.keep(new THREE.LatheGeometry(lowerPodPts, 24)),
    bodyMat,
  );
  lowerPod.position.y = -0.31;
  chassis.add(lowerPod);

  const waistBand = new THREE.Mesh(
    tracker.keep(new THREE.CylinderGeometry(0.155, 0.15, 0.045, 24)),
    trimMat,
  );
  waistBand.position.y = -0.18;
  chassis.add(waistBand);

  const thrusterRing = new THREE.Mesh(
    tracker.keep(new THREE.TorusGeometry(0.082, 0.013, 10, 28)),
    glowMat,
  );
  thrusterRing.rotation.x = Math.PI / 2;
  thrusterRing.position.y = -0.315;
  chassis.add(thrusterRing);

  const thrusterCone = new THREE.Mesh(
    tracker.keep(new THREE.ConeGeometry(0.09, 0.14, 20, 1, true)),
    tracker.keep(
      new THREE.MeshBasicMaterial({
        color: accentColor,
        transparent: true,
        opacity: 0.22,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    ),
  );
  thrusterCone.position.y = -0.385;
  chassis.add(thrusterCone);

  // ---- Articulated floating nub arms ----
  const armGeo = tracker.keep(new THREE.CapsuleGeometry(0.042, 0.105, 8, 14));
  const armTipGeo = tracker.keep(new THREE.SphereGeometry(0.042, 14, 10));

  function buildBotArm(side) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.255, -0.16, 0.01);

    const arm = new THREE.Mesh(armGeo, bodyMat);
    arm.position.y = -0.065;
    pivot.add(arm);

    const tip = new THREE.Mesh(armTipGeo, trimMat);
    tip.position.y = -0.13;
    tip.scale.set(0.92, 0.82, 0.92);
    pivot.add(tip);

    chassis.add(pivot);
    return pivot;
  }

  const rightArm = buildBotArm(-1);
  const leftArm = buildBotArm(1);

  enableShadows(chassis, true, true);
  // Don't cast shadows from the translucent thruster cone or emissive visor
  thrusterCone.castShadow = false;
  visor.mesh.castShadow = false;

  const rig = {
    type: "bot",
    root,
    contactShadow,
    visor,
    joints: {
      chassis,
      antenna: antennaPivot,
      leftArm,
      rightArm,
      thrusterRing,
    },
  };

  const animator = createAnimator(rig);

  return {
    root,
    type: "bot",
    config: { ...config },
    update: (dt) => animator.update(dt),
    setState: (name) => animator.setState(name),
    getState: () => animator.getState(),
    play: (gesture, opts) => animator.play(gesture, opts),
    setExpression: (expr) => visor.setExpression(expr),
    getExpression: () => visor.getExpression(),
    lookAt: (target) => animator.lookAt(target),
    dispose() {
      if (root.parent) root.parent.remove(root);
      tracker.dispose();
    },
  };
}
