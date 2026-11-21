import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import {
  createTracker,
  createClayMaterial,
  createContactShadow,
  enableShadows,
} from "./materials.js";
import { createHumanFace } from "./face.js";
import { buildHair, buildGlasses } from "./hair.js";
import { buildOutfitDetails, buildAccessory } from "./outfits.js";
import { buildProp } from "./props.js";
import { createAnimator } from "./animator.js";

/**
 * Modular stylized vinyl-toy human builder (normalized internal height = 1.60m,
 * feet planted cleanly at y = 0, facing +Z).
 */
export function createHuman(config) {
  const tracker = createTracker();
  const root = new THREE.Group();
  root.name = `character-${config.id || "human"}`;

  const rigRoot = new THREE.Group();
  const baseHeight = 1.6;
  const targetHeight = config.height ?? baseHeight;
  rigRoot.scale.setScalar(targetHeight / baseHeight);
  root.add(rigRoot);

  let contactShadow = null;
  if (config.contactShadow !== false) {
    contactShadow = createContactShadow(tracker, 0.36, 0.32);
    rigRoot.add(contactShadow);
  }

  const body = new THREE.Group();
  body.name = "body";
  rigRoot.add(body);

  // Materials
  const primaryHex = config.primaryColor || "#1f8a8c";
  const sleeveHex = config.sleeveColor || (config.outfit === "jacket" ? "#f3eee4" : primaryHex);
  const accentHex = config.accentColor || "#f2c15a";

  const skinMat = createClayMaterial(tracker, config.skinTone || "#e8b896", { roughness: 0.58 });
  const primaryMat = createClayMaterial(tracker, primaryHex, { roughness: 0.72 });
  const sleeveMat = createClayMaterial(tracker, sleeveHex, { roughness: 0.72 });
  const trimMat = createClayMaterial(
    tracker,
    new THREE.Color(primaryHex).multiplyScalar(0.82),
    { roughness: 0.75 },
  );
  const cuffMat = createClayMaterial(
    tracker,
    config.outfit === "jacket" ? accentHex : new THREE.Color(sleeveHex).multiplyScalar(0.84),
    { roughness: 0.74 },
  );
  const pantsMat = createClayMaterial(tracker, config.secondaryColor || "#263142", { roughness: 0.72 });
  const accentMat = createClayMaterial(tracker, accentHex, { roughness: 0.45 });
  const shoeMat = createClayMaterial(tracker, config.shoeColor || "#eef2f7", { roughness: 0.48 });
  const soleMat = createClayMaterial(tracker, "#d8dee9", { roughness: 0.62 });

  // ---- Torso (smooth bell-tapered vinyl silhouette via LatheGeometry) ----
  const torsoPts = [
    new THREE.Vector2(0.01, 0.0),
    new THREE.Vector2(0.18, 0.0),
    new THREE.Vector2(0.215, 0.04),
    new THREE.Vector2(0.21, 0.16),
    new THREE.Vector2(0.192, 0.3),
    new THREE.Vector2(0.145, 0.41),
    new THREE.Vector2(0.095, 0.44),
    new THREE.Vector2(0.01, 0.44),
  ];
  const torsoGeo = tracker.keep(new THREE.LatheGeometry(torsoPts, 28));
  const torso = new THREE.Mesh(torsoGeo, primaryMat);
  torso.position.y = 0.41;
  torso.scale.set(1.06, 1.0, 0.84);
  body.add(torso);

  const mats = { primaryMat, trimMat, accentMat };

  // Outfit-specific torso layers (sweater / hoodie / jacket / blazer)
  body.add(buildOutfitDetails(tracker, config, mats));

  // Optional wearable accessory (lanyard / headphones / backpack)
  const accessoryGroup = buildAccessory(tracker, config, mats);
  if (accessoryGroup) body.add(accessoryGroup);

  // ---- Pelvis / hip connector ----
  const pelvis = new THREE.Mesh(
    tracker.keep(new THREE.SphereGeometry(0.185, 22, 16)),
    pantsMat,
  );
  pelvis.position.y = 0.4;
  pelvis.scale.set(1.06, 0.55, 0.84);
  body.add(pelvis);

  // ---- Neck ----
  const neck = new THREE.Mesh(
    tracker.keep(new THREE.CylinderGeometry(0.072, 0.084, 0.11, 18)),
    skinMat,
  );
  neck.position.y = 0.885;
  body.add(neck);

  // ---- Head group ----
  const headPivot = new THREE.Group();
  headPivot.name = "head";
  headPivot.position.set(0, 1.18, 0);
  body.add(headPivot);

  const headMesh = new THREE.Mesh(
    tracker.keep(new THREE.SphereGeometry(0.302, 32, 24)),
    skinMat,
  );
  headMesh.scale.set(1.05, 0.98, 0.98);
  headPivot.add(headMesh);

  const face = createHumanFace(tracker, config);
  headPivot.add(face.group);

  // Modular hair/headgear (bob / spiky / puffs / sidepart / beanie)
  headPivot.add(
    buildHair(tracker, config.hairStyle || "bob", config.hairColor || "#262332", accentHex),
  );

  // Modular glasses (none / round / square)
  const glassesGroup = buildGlasses(tracker, config.glasses || "none", accentHex);
  if (glassesGroup) headPivot.add(glassesGroup);

  // ---- Articulated Arms (smooth seamless vinyl sleeves + elbow + hand socket) ----
  const upperArmGeo = tracker.keep(new THREE.CapsuleGeometry(0.052, 0.125, 10, 16));
  const elbowJointGeo = tracker.keep(new THREE.SphereGeometry(0.049, 14, 12));
  const forearmGeo = tracker.keep(new THREE.CapsuleGeometry(0.047, 0.105, 10, 16));
  const cuffGeo = tracker.keep(new THREE.TorusGeometry(0.048, 0.012, 8, 18));
  const handGeo = tracker.keep(new THREE.SphereGeometry(0.052, 16, 12));
  const thumbGeo = tracker.keep(new THREE.CapsuleGeometry(0.015, 0.024, 6, 8));

  function buildArm(side) {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.202, 0.772, 0);

    const upper = new THREE.Mesh(upperArmGeo, sleeveMat);
    upper.position.y = -0.072;
    shoulder.add(upper);

    const elbow = new THREE.Group();
    elbow.position.y = -0.155;
    shoulder.add(elbow);

    const elbowCap = new THREE.Mesh(elbowJointGeo, sleeveMat);
    elbow.add(elbowCap);

    const forearm = new THREE.Mesh(forearmGeo, sleeveMat);
    forearm.position.y = -0.068;
    elbow.add(forearm);

    const cuff = new THREE.Mesh(cuffGeo, cuffMat);
    cuff.rotation.x = Math.PI / 2;
    cuff.position.y = -0.132;
    elbow.add(cuff);

    const hand = new THREE.Mesh(handGeo, skinMat);
    hand.position.y = -0.182;
    hand.scale.set(0.95, 1.05, 0.85);
    elbow.add(hand);

    const thumb = new THREE.Mesh(thumbGeo, skinMat);
    thumb.position.set(-side * 0.042, -0.172, 0.024);
    thumb.rotation.z = side * 0.55;
    elbow.add(thumb);

    const handSocket = new THREE.Group();
    handSocket.name = side < 0 ? "rightHandSocket" : "leftHandSocket";
    handSocket.position.set(0, -0.195, 0.04);
    elbow.add(handSocket);

    body.add(shoulder);
    return { shoulder, elbow, handSocket };
  }

  // Character faces +Z -> right arm is -X, left arm is +X
  const rightArmRig = buildArm(-1);
  const leftArmRig = buildArm(1);

  // ---- Dynamic Handheld Prop Slot (in right hand socket) ----
  let currentPropName = config.prop || "none";
  let currentPropObj = null;
  let propTracker = null;

  function setProp(nextProp) {
    if (currentPropObj) {
      rightArmRig.handSocket.remove(currentPropObj);
      currentPropObj = null;
    }
    if (propTracker) {
      propTracker.dispose();
      propTracker = null;
    }
    currentPropName = nextProp || "none";
    if (currentPropName !== "none") {
      propTracker = createTracker();
      currentPropObj = buildProp(propTracker, currentPropName, accentHex);
      if (currentPropObj) {
        enableShadows(currentPropObj, true, true);
        rightArmRig.handSocket.add(currentPropObj);
      }
    }
  }
  setProp(currentPropName);

  // ---- Articulated Legs & Chunky Rounded Vinyl Sneakers (planted flush at y = 0.000) ----
  const legGeo = tracker.keep(new THREE.CapsuleGeometry(0.065, 0.165, 8, 14));
  const ankleGeo = tracker.keep(new THREE.CylinderGeometry(0.056, 0.06, 0.05, 14));
  const shoeUpperGeo = tracker.keep(new THREE.CapsuleGeometry(0.066, 0.078, 10, 16));
  shoeUpperGeo.rotateX(Math.PI / 2);
  const soleGeo = tracker.keep(new RoundedBoxGeometry(0.134, 0.032, 0.214, 4, 0.015));
  const accentBandGeo = tracker.keep(new RoundedBoxGeometry(0.138, 0.014, 0.095, 2, 0.006));

  function buildLeg(side) {
    const hip = new THREE.Group();
    hip.position.set(side * 0.102, 0.365, 0);

    const leg = new THREE.Mesh(legGeo, pantsMat);
    leg.position.y = -0.135;
    hip.add(leg);

    const ankle = new THREE.Mesh(ankleGeo, shoeMat);
    ankle.position.y = -0.265;
    hip.add(ankle);

    const shoe = new THREE.Group();
    shoe.position.set(0, -0.365, 0.032);

    const sole = new THREE.Mesh(soleGeo, soleMat);
    sole.position.y = 0.016;
    shoe.add(sole);

    const upper = new THREE.Mesh(shoeUpperGeo, shoeMat);
    upper.position.set(0, 0.066, 0.002);
    upper.scale.set(1.02, 0.85, 1.02);
    shoe.add(upper);

    const accentBand = new THREE.Mesh(accentBandGeo, accentMat);
    accentBand.position.set(0, 0.035, 0.004);
    shoe.add(accentBand);

    hip.add(shoe);
    body.add(hip);
    return hip;
  }

  const rightLeg = buildLeg(-1);
  const leftLeg = buildLeg(1);

  enableShadows(body, true, true);

  const rig = {
    type: "human",
    root,
    contactShadow,
    face,
    getProp: () => currentPropName,
    joints: {
      body,
      head: headPivot,
      leftArm: leftArmRig.shoulder,
      leftForearm: leftArmRig.elbow,
      rightArm: rightArmRig.shoulder,
      rightForearm: rightArmRig.elbow,
      leftLeg,
      rightLeg,
    },
    sockets: {
      leftHand: leftArmRig.handSocket,
      rightHand: rightArmRig.handSocket,
    },
  };

  const animator = createAnimator(rig);

  return {
    root,
    type: "human",
    config: { ...config },
    sockets: rig.sockets,
    update: (dt) => animator.update(dt),
    setState: (name) => animator.setState(name),
    getState: () => animator.getState(),
    play: (gesture, opts) => animator.play(gesture, opts),
    setExpression: (expr) => face.setExpression(expr),
    getExpression: () => face.getExpression(),
    setProp,
    getProp: () => currentPropName,
    lookAt: (target) => animator.lookAt(target),
    dispose() {
      if (propTracker) propTracker.dispose();
      if (root.parent) root.parent.remove(root);
      tracker.dispose();
    },
  };
}
