import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { createClayMaterial, createMetalMaterial } from "./materials.js";

/**
 * Procedural Canvas2D ID badge texture for the conference lanyard.
 */
function createBadgeTexture(tracker, accentColor, primaryColor) {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 160;
  const ctx = c.getContext("2d");

  ctx.fillStyle = "#f7f9fc";
  ctx.fillRect(0, 0, 128, 160);
  ctx.fillStyle = primaryColor;
  ctx.fillRect(0, 0, 128, 34);

  ctx.fillStyle = accentColor;
  ctx.beginPath();
  ctx.arc(64, 74, 24, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#1f2937";
  ctx.beginPath();
  ctx.arc(64, 68, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(64, 92, 14, Math.PI, 0);
  ctx.fill();

  ctx.fillStyle = "#334155";
  ctx.fillRect(24, 114, 80, 9);
  ctx.fillStyle = "#94a3b8";
  ctx.fillRect(36, 132, 56, 7);

  const tex = tracker.keep(new THREE.CanvasTexture(c));
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Adds outfit-specific torso details on top of the standardized bell-tapered vinyl torso.
 * Supported outfits: "sweater" | "hoodie" | "jacket" | "blazer".
 */
export function buildOutfitDetails(tracker, config, mats) {
  const group = new THREE.Group();
  const outfit = config.outfit || "sweater";
  group.name = `outfit-${outfit}`;

  const { primaryMat, trimMat, accentMat } = mats;

  if (outfit === "hoodie") {
    // Draped hood cowl hugging the collar and upper back
    const cowl = new THREE.Mesh(
      tracker.keep(new THREE.TorusGeometry(0.118, 0.036, 12, 26)),
      trimMat,
    );
    cowl.rotation.x = Math.PI / 2 + 0.18;
    cowl.position.set(0, 0.835, -0.02);
    cowl.scale.set(1.12, 1.05, 1.0);
    group.add(cowl);

    const hoodBack = new THREE.Mesh(
      tracker.keep(new THREE.SphereGeometry(0.145, 18, 14)),
      trimMat,
    );
    hoodBack.position.set(0, 0.77, -0.145);
    hoodBack.scale.set(1.18, 0.82, 0.72);
    group.add(hoodBack);

    // Center zip seam in accent color
    const zip = new THREE.Mesh(
      tracker.keep(new THREE.BoxGeometry(0.016, 0.39, 0.018)),
      accentMat,
    );
    zip.position.set(0, 0.62, 0.168);
    zip.rotation.x = -0.14;
    group.add(zip);

    // Twin drawstrings with tiny metallic tips
    const stringGeo = tracker.keep(new THREE.CapsuleGeometry(0.007, 0.11, 5, 8));
    const metalMat = createMetalMaterial(tracker, "#d8e1ee");
    const agletGeo = tracker.keep(new THREE.CylinderGeometry(0.0085, 0.0085, 0.02, 8));
    for (const side of [-1, 1]) {
      const cord = new THREE.Mesh(stringGeo, accentMat);
      cord.position.set(side * 0.042, 0.74, 0.155);
      cord.rotation.x = -0.22;
      cord.rotation.z = side * 0.06;
      group.add(cord);

      const aglet = new THREE.Mesh(agletGeo, metalMat);
      aglet.position.set(side * 0.046, 0.678, 0.169);
      group.add(aglet);
    }

    // Front kangaroo pocket
    const pocket = new THREE.Mesh(
      tracker.keep(new RoundedBoxGeometry(0.24, 0.11, 0.04, 3, 0.018)),
      trimMat,
    );
    pocket.position.set(0, 0.505, 0.168);
    group.add(pocket);

    // Ribbed bottom hem
    const hem = new THREE.Mesh(
      tracker.keep(new THREE.TorusGeometry(0.208, 0.023, 10, 28)),
      trimMat,
    );
    hem.rotation.x = Math.PI / 2;
    hem.position.y = 0.425;
    hem.scale.set(1.06, 0.84, 1.0);
    group.add(hem);

    return group;
  }

  if (outfit === "jacket") {
    // Varsity / bomber jacket: contrasting striped collar & hem, center placket, chest patch
    const creamMat = createClayMaterial(tracker, "#f3eee4", { roughness: 0.72 });
    const collar = new THREE.Mesh(
      tracker.keep(new THREE.TorusGeometry(0.102, 0.028, 12, 24)),
      accentMat,
    );
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 0.845;
    collar.scale.set(1.06, 0.92, 1.0);
    group.add(collar);

    const hem = new THREE.Mesh(
      tracker.keep(new THREE.TorusGeometry(0.208, 0.024, 10, 28)),
      accentMat,
    );
    hem.rotation.x = Math.PI / 2;
    hem.position.y = 0.425;
    hem.scale.set(1.06, 0.84, 1.0);
    group.add(hem);

    // Center snap placket + metallic snaps
    const placket = new THREE.Mesh(
      tracker.keep(new THREE.BoxGeometry(0.032, 0.39, 0.016)),
      creamMat,
    );
    placket.position.set(0, 0.625, 0.166);
    placket.rotation.x = -0.14;
    group.add(placket);

    const snapGeo = tracker.keep(new THREE.SphereGeometry(0.011, 10, 8));
    const snapMat = createMetalMaterial(tracker, "#e2e8f0");
    for (let i = 0; i < 4; i++) {
      const snap = new THREE.Mesh(snapGeo, snapMat);
      snap.position.set(0, 0.76 - i * 0.088, 0.156 + i * 0.012);
      group.add(snap);
    }

    // Little circular chest emblem patch
    const patch = new THREE.Mesh(
      tracker.keep(new THREE.CylinderGeometry(0.036, 0.036, 0.012, 18)),
      creamMat,
    );
    patch.rotation.x = Math.PI / 2 - 0.15;
    patch.position.set(0.085, 0.695, 0.16);
    group.add(patch);

    return group;
  }

  if (outfit === "blazer") {
    // Smart-casual blazer over crisp ivory turtleneck + lapels + brass buttons + lapel pin
    const shirtMat = createClayMaterial(tracker, "#f1f4f9", { roughness: 0.7 });
    const brassMat = createMetalMaterial(tracker, "#e6c36a", { roughness: 0.25, metalness: 0.85 });

    // Inner turtleneck collar
    const turtle = new THREE.Mesh(
      tracker.keep(new THREE.CylinderGeometry(0.092, 0.104, 0.085, 22)),
      shirtMat,
    );
    turtle.position.y = 0.855;
    group.add(turtle);

    // V-shaped inner shirt triangle visible under blazer
    const vShirt = new THREE.Mesh(
      tracker.keep(new THREE.ConeGeometry(0.072, 0.23, 4)),
      shirtMat,
    );
    vShirt.position.set(0, 0.72, 0.145);
    vShirt.rotation.x = Math.PI - 0.16;
    vShirt.rotation.y = Math.PI / 4;
    vShirt.scale.set(1.0, 1.0, 0.35);
    group.add(vShirt);

    // Left & right structured lapels
    const lapelGeo = tracker.keep(new RoundedBoxGeometry(0.052, 0.22, 0.022, 2, 0.008));
    for (const side of [-1, 1]) {
      const lapel = new THREE.Mesh(lapelGeo, trimMat);
      lapel.position.set(side * 0.062, 0.715, 0.158);
      lapel.rotation.z = side * 0.32;
      lapel.rotation.x = -0.18;
      group.add(lapel);
    }

    // Two tailored brass buttons
    const btnGeo = tracker.keep(new THREE.CylinderGeometry(0.014, 0.014, 0.01, 12));
    btnGeo.rotateX(Math.PI / 2);
    for (const by of [0.56, 0.485]) {
      const btn = new THREE.Mesh(btnGeo, brassMat);
      btn.position.set(0.018, by, 0.184);
      group.add(btn);
    }

    // Accent lapel pin
    const pin = new THREE.Mesh(
      tracker.keep(new THREE.SphereGeometry(0.014, 12, 10)),
      accentMat,
    );
    pin.position.set(0.078, 0.735, 0.172);
    group.add(pin);

    // Subtle pocket square on left chest
    const square = new THREE.Mesh(
      tracker.keep(new THREE.BoxGeometry(0.044, 0.022, 0.012)),
      accentMat,
    );
    square.position.set(0.105, 0.655, 0.168);
    square.rotation.z = -0.12;
    group.add(square);

    // Clean jacket hem
    const hem = new THREE.Mesh(
      tracker.keep(new THREE.TorusGeometry(0.208, 0.018, 10, 28)),
      primaryMat,
    );
    hem.rotation.x = Math.PI / 2;
    hem.position.y = 0.422;
    hem.scale.set(1.06, 0.84, 1.0);
    group.add(hem);

    return group;
  }

  // Default: "sweater" — ribbed crew-neck collar + bottom sweater hem
  const collar = new THREE.Mesh(
    tracker.keep(new THREE.TorusGeometry(0.098, 0.026, 12, 24)),
    trimMat,
  );
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 0.845;
  collar.scale.set(1.05, 0.92, 1.0);
  group.add(collar);

  const hem = new THREE.Mesh(
    tracker.keep(new THREE.TorusGeometry(0.206, 0.022, 10, 28)),
    trimMat,
  );
  hem.rotation.x = Math.PI / 2;
  hem.position.y = 0.425;
  hem.scale.set(1.06, 0.84, 1.0);
  group.add(hem);

  return group;
}

/**
 * Wearable accessories attached to the body group:
 * "none" | "lanyard" | "headphones" | "backpack".
 */
export function buildAccessory(tracker, config, mats) {
  const type = config.accessory || "none";
  if (type === "none") return null;

  const group = new THREE.Group();
  group.name = `accessory-${type}`;
  const { accentMat } = mats;

  if (type === "lanyard") {
    const strapGeo = tracker.keep(new THREE.CapsuleGeometry(0.0075, 0.24, 6, 8));
    for (const side of [-1, 1]) {
      const strap = new THREE.Mesh(strapGeo, accentMat);
      strap.position.set(side * 0.044, 0.72, 0.158);
      strap.rotation.z = side * 0.31;
      strap.rotation.x = -0.22;
      group.add(strap);
    }

    const clip = new THREE.Mesh(
      tracker.keep(new THREE.CylinderGeometry(0.011, 0.011, 0.022, 10)),
      createMetalMaterial(tracker, "#cbd5e1"),
    );
    clip.position.set(0, 0.59, 0.182);
    group.add(clip);

    const badgeTex = createBadgeTexture(
      tracker,
      config.accentColor || "#f2c15a",
      config.primaryColor || "#1f8a8c",
    );
    const badgeBodyMat = createClayMaterial(tracker, "#ffffff", { roughness: 0.42 });
    const badgeFaceMat = tracker.keep(
      new THREE.MeshStandardMaterial({ map: badgeTex, roughness: 0.42, metalness: 0.02 }),
    );
    const badge = new THREE.Mesh(
      tracker.keep(new THREE.BoxGeometry(0.092, 0.116, 0.012)),
      [badgeBodyMat, badgeBodyMat, badgeBodyMat, badgeBodyMat, badgeFaceMat, badgeBodyMat],
    );
    badge.position.set(0, 0.525, 0.19);
    badge.rotation.x = -0.05;
    group.add(badge);
    return group;
  }

  if (type === "headphones") {
    // Sleek studio headphones resting comfortably around the neck
    const bandMat = createClayMaterial(tracker, "#1b202b", { roughness: 0.36, metalness: 0.25 });
    const padMat = createClayMaterial(tracker, "#2d3544", { roughness: 0.75 });

    const band = new THREE.Mesh(
      tracker.keep(new THREE.TorusGeometry(0.135, 0.018, 10, 28, Math.PI * 1.25)),
      bandMat,
    );
    band.position.set(0, 0.825, -0.015);
    band.rotation.x = Math.PI / 2 + 0.24;
    band.rotation.z = Math.PI * 0.875;
    group.add(band);

    const cupGeo = tracker.keep(new THREE.CylinderGeometry(0.058, 0.058, 0.045, 20));
    cupGeo.rotateZ(Math.PI / 2);
    const padGeo = tracker.keep(new THREE.TorusGeometry(0.048, 0.017, 10, 20));
    padGeo.rotateY(Math.PI / 2);
    const ringGeo = tracker.keep(new THREE.TorusGeometry(0.044, 0.008, 8, 20));
    ringGeo.rotateY(Math.PI / 2);

    for (const side of [-1, 1]) {
      const cupGroup = new THREE.Group();
      cupGroup.position.set(side * 0.125, 0.785, 0.11);
      cupGroup.rotation.y = side * 0.48;
      cupGroup.rotation.x = -0.25;

      cupGroup.add(new THREE.Mesh(cupGeo, bandMat));

      const pad = new THREE.Mesh(padGeo, padMat);
      pad.position.x = -side * 0.02;
      cupGroup.add(pad);

      const ring = new THREE.Mesh(ringGeo, accentMat);
      ring.position.x = side * 0.024;
      cupGroup.add(ring);

      group.add(cupGroup);
    }
    return group;
  }

  if (type === "backpack") {
    // Rounded vinyl explorer backpack resting on the upper back + shoulder straps
    const packMat = createClayMaterial(tracker, config.accentColor || "#d95d4c", { roughness: 0.65 });
    const packTrimMat = createClayMaterial(
      tracker,
      new THREE.Color(config.accentColor || "#d95d4c").multiplyScalar(0.76),
      { roughness: 0.72 },
    );
    const buckleMat = createMetalMaterial(tracker, "#e2e8f0");

    const mainBag = new THREE.Mesh(
      tracker.keep(new RoundedBoxGeometry(0.28, 0.32, 0.145, 5, 0.055)),
      packMat,
    );
    mainBag.position.set(0, 0.625, -0.22);
    group.add(mainBag);

    const frontPocket = new THREE.Mesh(
      tracker.keep(new RoundedBoxGeometry(0.21, 0.13, 0.055, 4, 0.024)),
      packTrimMat,
    );
    frontPocket.position.set(0, 0.545, -0.295);
    group.add(frontPocket);

    const handle = new THREE.Mesh(
      tracker.keep(new THREE.TorusGeometry(0.045, 0.012, 8, 16, Math.PI)),
      packTrimMat,
    );
    handle.position.set(0, 0.785, -0.215);
    group.add(handle);

    // Shoulder straps hugging front chest + tiny metallic buckles
    const strapGeo = tracker.keep(new THREE.TorusGeometry(0.145, 0.018, 8, 22, Math.PI * 1.15));
    const buckleGeo = tracker.keep(new THREE.BoxGeometry(0.032, 0.024, 0.016));
    for (const side of [-1, 1]) {
      const strap = new THREE.Mesh(strapGeo, packTrimMat);
      strap.position.set(side * 0.135, 0.675, -0.02);
      strap.rotation.y = Math.PI / 2;
      strap.rotation.z = -0.35;
      strap.scale.set(1.15, 1.05, 1.0);
      group.add(strap);

      const buckle = new THREE.Mesh(buckleGeo, buckleMat);
      buckle.position.set(side * 0.138, 0.64, 0.155);
      group.add(buckle);
    }

    return group;
  }

  return null;
}
