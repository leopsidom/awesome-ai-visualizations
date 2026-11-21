import * as THREE from "three";
import { createClayMaterial, createGlossMaterial, createMetalMaterial } from "./materials.js";

/**
 * Modular 3D vinyl-toy hair & headgear builders + glasses.
 * All styles leave the front face window cleanly open so eyes, brows, and mouth shine.
 */

function buildBob(tracker, hairMat) {
  const hair = new THREE.Group();
  hair.name = "hair-bob";

  const crown = new THREE.Mesh(
    tracker.keep(new THREE.SphereGeometry(0.328, 28, 22, 0, Math.PI * 2, 0, Math.PI * 0.58)),
    hairMat,
  );
  crown.position.set(0, 0.018, -0.028);
  crown.rotation.x = -0.44;
  crown.scale.set(1.06, 1.0, 1.03);
  hair.add(crown);

  const back = new THREE.Mesh(
    tracker.keep(new THREE.SphereGeometry(0.312, 24, 18)),
    hairMat,
  );
  back.position.set(0, -0.048, -0.105);
  back.scale.set(1.06, 0.9, 0.78);
  hair.add(back);

  const sideGeo = tracker.keep(new THREE.CapsuleGeometry(0.082, 0.21, 10, 14));
  const tipGeo = tracker.keep(new THREE.SphereGeometry(0.08, 16, 12));
  for (const side of [-1, 1]) {
    const curtain = new THREE.Mesh(sideGeo, hairMat);
    curtain.position.set(side * 0.292, -0.045, -0.02);
    curtain.rotation.z = side * 0.12;
    curtain.rotation.x = 0.06;
    curtain.scale.set(0.84, 1.0, 1.12);
    hair.add(curtain);

    const tip = new THREE.Mesh(tipGeo, hairMat);
    tip.position.set(side * 0.274, -0.165, 0.005);
    tip.scale.set(0.95, 0.72, 1.08);
    hair.add(tip);
  }

  const bangs = [
    { pos: [-0.205, 0.195, 0.175], rot: [0.15, -0.5, 0.45], scale: [1.05, 0.7, 0.65], r: 0.095 },
    { pos: [-0.095, 0.238, 0.222], rot: [0.22, -0.22, 0.28], scale: [1.22, 0.66, 0.62], r: 0.105 },
    { pos: [0.045, 0.246, 0.226], rot: [0.22, 0.14, -0.22], scale: [1.26, 0.66, 0.62], r: 0.105 },
    { pos: [0.175, 0.205, 0.182], rot: [0.16, 0.45, -0.45], scale: [1.08, 0.68, 0.64], r: 0.096 },
  ];
  for (const b of bangs) {
    const piece = new THREE.Mesh(tracker.keep(new THREE.SphereGeometry(b.r, 16, 12)), hairMat);
    piece.position.set(...b.pos);
    piece.rotation.set(...b.rot);
    piece.scale.set(...b.scale);
    hair.add(piece);
  }

  return hair;
}

function buildSpiky(tracker, hairMat) {
  const hair = new THREE.Group();
  hair.name = "hair-spiky";

  // Short cropped base dome tilted back to keep forehead open
  const base = new THREE.Mesh(
    tracker.keep(new THREE.SphereGeometry(0.32, 26, 20, 0, Math.PI * 2, 0, Math.PI * 0.56)),
    hairMat,
  );
  base.position.set(0, 0.022, -0.032);
  base.rotation.x = -0.48;
  base.scale.set(1.06, 1.0, 1.02);
  hair.add(base);

  // Back crop volume
  const back = new THREE.Mesh(tracker.keep(new THREE.SphereGeometry(0.285, 20, 16)), hairMat);
  back.position.set(0, -0.02, -0.095);
  back.scale.set(1.02, 0.88, 0.78);
  hair.add(back);

  // Sculpted chunky vinyl spikes swept upward and slightly right
  const spikeGeo = tracker.keep(new THREE.ConeGeometry(0.088, 0.24, 14));
  const spikes = [
    { pos: [-0.14, 0.29, 0.14], rot: [0.35, 0, 0.45], scale: [0.95, 1.0, 0.85] },
    { pos: [-0.02, 0.34, 0.16], rot: [0.42, 0, 0.15], scale: [1.15, 1.15, 0.9] },
    { pos: [0.12, 0.31, 0.14], rot: [0.38, 0, -0.22], scale: [1.05, 1.05, 0.85] },
    { pos: [-0.18, 0.27, -0.02], rot: [-0.15, 0, 0.62], scale: [0.92, 0.95, 0.9] },
    { pos: [0.02, 0.35, -0.02], rot: [-0.18, 0, -0.08], scale: [1.18, 1.12, 0.95] },
    { pos: [0.19, 0.26, -0.03], rot: [-0.15, 0, -0.58], scale: [0.95, 0.95, 0.9] },
    { pos: [-0.08, 0.28, -0.17], rot: [-0.62, 0, 0.25], scale: [1.0, 0.95, 0.9] },
    { pos: [0.1, 0.27, -0.16], rot: [-0.58, 0, -0.32], scale: [1.0, 0.92, 0.9] },
  ];
  for (const s of spikes) {
    const tuft = new THREE.Mesh(spikeGeo, hairMat);
    tuft.position.set(...s.pos);
    tuft.rotation.set(...s.rot);
    tuft.scale.set(...s.scale);
    hair.add(tuft);
  }

  // Soft sideburn tufts
  const burnGeo = tracker.keep(new THREE.CapsuleGeometry(0.036, 0.09, 6, 10));
  for (const side of [-1, 1]) {
    const burn = new THREE.Mesh(burnGeo, hairMat);
    burn.position.set(side * 0.285, 0.04, 0.045);
    burn.rotation.z = side * 0.12;
    hair.add(burn);
  }

  return hair;
}

function buildPuffs(tracker, hairMat, accentColor) {
  const hair = new THREE.Group();
  hair.name = "hair-puffs";

  // Textured curly crown cap
  const base = new THREE.Mesh(
    tracker.keep(new THREE.SphereGeometry(0.326, 26, 20, 0, Math.PI * 2, 0, Math.PI * 0.56)),
    hairMat,
  );
  base.position.set(0, 0.022, -0.028);
  base.rotation.x = -0.45;
  base.scale.set(1.06, 1.0, 1.02);
  hair.add(base);

  const back = new THREE.Mesh(tracker.keep(new THREE.SphereGeometry(0.295, 22, 16)), hairMat);
  back.position.set(0, -0.025, -0.095);
  back.scale.set(1.04, 0.9, 0.8);
  hair.add(back);

  // Scalloped hairline curls along forehead
  const curlGeo = tracker.keep(new THREE.SphereGeometry(0.068, 14, 12));
  const curlPositions = [
    [-0.22, 0.16, 0.15],
    [-0.13, 0.22, 0.205],
    [-0.02, 0.245, 0.22],
    [0.09, 0.23, 0.21],
    [0.2, 0.175, 0.16],
  ];
  for (const pos of curlPositions) {
    const c = new THREE.Mesh(curlGeo, hairMat);
    c.position.set(...pos);
    c.scale.set(1.08, 0.82, 0.78);
    hair.add(c);
  }

  // Twin high fluffy afro puffs + colorful hair ties
  const tieMat = createClayMaterial(tracker, accentColor || "#ff6b6b", { roughness: 0.45 });
  const puffGeo = tracker.keep(new THREE.SphereGeometry(0.165, 22, 18));
  const bumpGeo = tracker.keep(new THREE.SphereGeometry(0.075, 14, 10));
  const tieGeo = tracker.keep(new THREE.TorusGeometry(0.088, 0.022, 10, 22));

  for (const side of [-1, 1]) {
    const puffGroup = new THREE.Group();
    puffGroup.position.set(side * 0.295, 0.275, -0.045);

    const core = new THREE.Mesh(puffGeo, hairMat);
    puffGroup.add(core);

    // Subtle bumpy silhouette lobes around each puff
    const offsets = [
      [0.09, 0.07, 0.04],
      [-0.08, 0.09, 0.03],
      [0.05, -0.08, 0.07],
      [-0.06, -0.05, -0.08],
      [0.07, 0.03, -0.08],
      [0.0, 0.11, -0.04],
    ];
    for (const [ox, oy, oz] of offsets) {
      const lobe = new THREE.Mesh(bumpGeo, hairMat);
      lobe.position.set(ox * side, oy, oz);
      puffGroup.add(lobe);
    }

    const tie = new THREE.Mesh(tieGeo, tieMat);
    tie.position.set(-side * 0.085, -0.095, 0.01);
    tie.rotation.y = Math.PI / 2;
    tie.rotation.x = side * 0.7;
    puffGroup.add(tie);

    hair.add(puffGroup);
  }

  return hair;
}

function buildSidePart(tracker, hairMat) {
  const hair = new THREE.Group();
  hair.name = "hair-sidepart";

  const base = new THREE.Mesh(
    tracker.keep(new THREE.SphereGeometry(0.324, 28, 22, 0, Math.PI * 2, 0, Math.PI * 0.56)),
    hairMat,
  );
  base.position.set(0, 0.02, -0.03);
  base.rotation.x = -0.46;
  base.scale.set(1.06, 1.0, 1.02);
  hair.add(base);

  const back = new THREE.Mesh(tracker.keep(new THREE.SphereGeometry(0.292, 22, 16)), hairMat);
  back.position.set(0, -0.03, -0.095);
  back.scale.set(1.04, 0.9, 0.78);
  hair.add(back);

  // Sculpted sweeping quiff/wave swept from left part over to right
  const waveMain = new THREE.Mesh(
    tracker.keep(new THREE.CapsuleGeometry(0.088, 0.24, 10, 16)),
    hairMat,
  );
  waveMain.position.set(0.045, 0.255, 0.18);
  waveMain.rotation.z = Math.PI / 2 - 0.18;
  waveMain.rotation.y = -0.18;
  waveMain.scale.set(0.95, 1.08, 0.85);
  hair.add(waveMain);

  const waveTip = new THREE.Mesh(
    tracker.keep(new THREE.SphereGeometry(0.088, 16, 12)),
    hairMat,
  );
  waveTip.position.set(0.195, 0.215, 0.165);
  waveTip.scale.set(1.1, 0.85, 0.82);
  hair.add(waveTip);

  // Smaller counter-swept side above the part on left
  const sideSweep = new THREE.Mesh(
    tracker.keep(new THREE.SphereGeometry(0.085, 16, 12)),
    hairMat,
  );
  sideSweep.position.set(-0.18, 0.215, 0.15);
  sideSweep.scale.set(1.15, 0.78, 0.82);
  hair.add(sideSweep);

  // Crisp sideburns
  const burnGeo = tracker.keep(new THREE.CapsuleGeometry(0.034, 0.095, 6, 10));
  for (const side of [-1, 1]) {
    const burn = new THREE.Mesh(burnGeo, hairMat);
    burn.position.set(side * 0.286, 0.04, 0.038);
    burn.rotation.z = side * 0.1;
    hair.add(burn);
  }

  return hair;
}

function buildBeanie(tracker, hairMat, accentColor) {
  const hair = new THREE.Group();
  hair.name = "hair-beanie";

  const knitMat = createClayMaterial(tracker, accentColor || "#d96b43", { roughness: 0.85 });
  const cuffMat = createClayMaterial(
    tracker,
    new THREE.Color(accentColor || "#d96b43").multiplyScalar(0.86),
    { roughness: 0.88 },
  );

  // Peeking hair tufts around temples & back nape
  const backHair = new THREE.Mesh(tracker.keep(new THREE.SphereGeometry(0.288, 20, 14)), hairMat);
  backHair.position.set(0, -0.055, -0.095);
  backHair.scale.set(1.04, 0.78, 0.78);
  hair.add(backHair);

  const tuftGeo = tracker.keep(new THREE.SphereGeometry(0.062, 12, 10));
  for (const side of [-1, 1]) {
    const tuft = new THREE.Mesh(tuftGeo, hairMat);
    tuft.position.set(side * 0.25, 0.095, 0.125);
    tuft.scale.set(0.95, 0.85, 0.75);
    hair.add(tuft);
  }

  // Knit beanie dome tilted slightly back
  const dome = new THREE.Mesh(
    tracker.keep(new THREE.SphereGeometry(0.335, 28, 22, 0, Math.PI * 2, 0, Math.PI * 0.56)),
    knitMat,
  );
  dome.position.set(0, 0.04, -0.025);
  dome.rotation.x = -0.38;
  dome.scale.set(1.06, 1.08, 1.04);
  hair.add(dome);

  // Thick folded ribbed cuff rim
  const cuff = new THREE.Mesh(
    tracker.keep(new THREE.TorusGeometry(0.326, 0.052, 14, 32)),
    cuffMat,
  );
  cuff.position.set(0, 0.145, -0.015);
  cuff.rotation.x = Math.PI / 2 - 0.38;
  cuff.scale.set(1.05, 1.02, 1.0);
  hair.add(cuff);

  // Cute chunky yarn pom-pom on top
  const pom = new THREE.Mesh(
    tracker.keep(new THREE.SphereGeometry(0.088, 18, 14)),
    cuffMat,
  );
  pom.position.set(0, 0.375, -0.155);
  hair.add(pom);

  return hair;
}

export function buildHair(tracker, style = "bob", hairColor = "#262332", accentColor = "#f2c15a") {
  const hairMat = createClayMaterial(tracker, hairColor, { roughness: 0.56 });
  switch (style) {
    case "spiky":
      return buildSpiky(tracker, hairMat);
    case "puffs":
      return buildPuffs(tracker, hairMat, accentColor);
    case "sidepart":
      return buildSidePart(tracker, hairMat);
    case "beanie":
      return buildBeanie(tracker, hairMat, accentColor);
    case "bob":
    default:
      return buildBob(tracker, hairMat);
  }
}

/**
 * Modular eyeglasses builder: "none" | "round" | "square".
 */
export function buildGlasses(tracker, style = "none", accentColor = "#d6a44e") {
  if (!style || style === "none") return null;

  const glasses = new THREE.Group();
  glasses.name = `glasses-${style}`;

  const lensMat = createGlossMaterial(tracker, "#dff4ff", {
    roughness: 0.05,
    clearcoat: 1.0,
    transparent: true,
    opacity: 0.16,
  });

  if (style === "square") {
    const frameMat = createClayMaterial(tracker, "#222634", { roughness: 0.32, metalness: 0.18 });
    const barW = 0.156;
    const barH = 0.122;
    const thick = 0.016;
    const depth = 0.016;

    const topBotGeo = tracker.keep(new THREE.BoxGeometry(barW, thick, depth));
    const sideGeo = tracker.keep(new THREE.BoxGeometry(thick, barH, depth));
    const lensGeo = tracker.keep(new THREE.PlaneGeometry(barW - thick, barH - thick));
    const templeGeo = tracker.keep(new THREE.BoxGeometry(0.014, 0.018, 0.25));

    for (const side of [-1, 1]) {
      const frame = new THREE.Group();
      frame.position.set(side * 0.114, 0.024, 0.304);
      frame.rotation.y = side * 0.14;

      const top = new THREE.Mesh(topBotGeo, frameMat);
      top.position.y = barH / 2 - thick / 2;
      frame.add(top);

      const bot = new THREE.Mesh(topBotGeo, frameMat);
      bot.position.y = -barH / 2 + thick / 2;
      frame.add(bot);

      const left = new THREE.Mesh(sideGeo, frameMat);
      left.position.x = -barW / 2 + thick / 2;
      frame.add(left);

      const right = new THREE.Mesh(sideGeo, frameMat);
      right.position.x = barW / 2 - thick / 2;
      frame.add(right);

      const lens = new THREE.Mesh(lensGeo, lensMat);
      frame.add(lens);

      glasses.add(frame);

      const temple = new THREE.Mesh(templeGeo, frameMat);
      temple.position.set(side * 0.228, 0.036, 0.174);
      temple.rotation.y = -side * 0.26;
      glasses.add(temple);
    }

    const bridge = new THREE.Mesh(
      tracker.keep(new THREE.BoxGeometry(0.068, 0.016, 0.016)),
      frameMat,
    );
    bridge.position.set(0, 0.044, 0.314);
    glasses.add(bridge);

    return glasses;
  }

  // Default: round metallic wire-frame glasses
  const frameMat = createMetalMaterial(tracker, accentColor || "#d6a44e", {
    roughness: 0.28,
    metalness: 0.78,
  });
  const rimGeo = tracker.keep(new THREE.TorusGeometry(0.082, 0.0085, 10, 28));
  const lensGeo = tracker.keep(new THREE.CircleGeometry(0.078, 24));
  const templeGeo = tracker.keep(new THREE.CylinderGeometry(0.006, 0.006, 0.26, 8));
  templeGeo.rotateX(Math.PI / 2);

  for (const side of [-1, 1]) {
    const rim = new THREE.Mesh(rimGeo, frameMat);
    rim.position.set(side * 0.112, 0.024, 0.304);
    rim.rotation.y = side * 0.14;
    glasses.add(rim);

    const lens = new THREE.Mesh(lensGeo, lensMat);
    lens.position.set(side * 0.112, 0.024, 0.303);
    lens.rotation.y = side * 0.14;
    glasses.add(lens);

    const temple = new THREE.Mesh(templeGeo, frameMat);
    temple.position.set(side * 0.228, 0.024, 0.172);
    temple.rotation.y = -side * 0.28;
    glasses.add(temple);
  }

  const bridge = new THREE.Mesh(
    tracker.keep(new THREE.TorusGeometry(0.032, 0.007, 8, 12, Math.PI)),
    frameMat,
  );
  bridge.position.set(0, 0.026, 0.314);
  glasses.add(bridge);

  return glasses;
}
