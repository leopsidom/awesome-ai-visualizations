import * as THREE from "three";

/**
 * The carcase the movement stands on: a turned walnut drum, brass bands top and
 * bottom, bun feet, and the engraved dial plate that everything else is set out
 * on. The vitrine is built here too but starts hidden — it reads better once the
 * eye has had the movement without glass in the way.
 *
 * The plate is one `CylinderGeometry` with a material per group: the caps take
 * the engraved dial, the rim takes plain brass. `CylinderGeometry` maps its caps
 * as a disc inscribed in the UV square, which is what lets the concentric
 * artwork in textures.js land on the right radii.
 */

export function createPlinth(rng, materials, { deckRadius }) {
  const group = new THREE.Group();
  const geometries = [];

  const track = (geometry) => {
    geometries.push(geometry);
    return geometry;
  };

  const solid = (geometry, material) => {
    const mesh = new THREE.Mesh(track(geometry), material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  };

  const footHeight = 0.16;
  const carcaseHeight = 1.4;
  const carcaseTop = footHeight + carcaseHeight;
  const plateThickness = 0.09;
  const deckTop = carcaseTop + plateThickness;

  const topRadius = deckRadius + 0.25;
  const bottomRadius = deckRadius + 0.75;

  // --- feet ---------------------------------------------------------------

  const footGeometry = track(new THREE.SphereGeometry(0.3, 20, 14));
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const foot = new THREE.Mesh(footGeometry, materials.brassAged);
    foot.position.set(
      Math.cos(angle) * (bottomRadius - 0.75),
      footHeight * 0.55,
      Math.sin(angle) * (bottomRadius - 0.75),
    );
    foot.scale.y = 0.58;
    foot.castShadow = true;
    foot.receiveShadow = true;
    group.add(foot);
  }

  // --- carcase ------------------------------------------------------------

  const carcase = solid(
    new THREE.CylinderGeometry(topRadius, bottomRadius, carcaseHeight, 96, 1),
    materials.wood,
  );
  carcase.position.y = footHeight + carcaseHeight / 2;
  group.add(carcase);

  const skirt = solid(new THREE.TorusGeometry(bottomRadius - 0.02, 0.09, 10, 120), materials.brass);
  skirt.rotation.x = Math.PI / 2;
  skirt.position.y = footHeight + 0.07;
  group.add(skirt);

  const cornice = solid(new THREE.TorusGeometry(topRadius, 0.1, 10, 120), materials.brass);
  cornice.rotation.x = Math.PI / 2;
  cornice.position.y = carcaseTop - 0.02;
  group.add(cornice);

  // --- dial plate ---------------------------------------------------------

  const plate = new THREE.Mesh(
    track(new THREE.CylinderGeometry(deckRadius, deckRadius, plateThickness, 128, 1)),
    [materials.brassAged, materials.deck, materials.brassAged],
  );
  plate.position.y = carcaseTop + plateThickness / 2;
  plate.castShadow = true;
  plate.receiveShadow = true;
  group.add(plate);

  // Slotted screws pinning the plate down, one every forty-five degrees.
  const screwGeometry = track(new THREE.CylinderGeometry(0.075, 0.075, 0.03, 14));
  const slotGeometry = track(new THREE.BoxGeometry(0.13, 0.012, 0.022));
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2 + rng.range(-0.03, 0.03);
    const x = Math.cos(angle) * (deckRadius - 0.28);
    const z = Math.sin(angle) * (deckRadius - 0.28);

    const screw = new THREE.Mesh(screwGeometry, materials.steel);
    screw.position.set(x, deckTop + 0.012, z);
    screw.castShadow = true;
    group.add(screw);

    const slot = new THREE.Mesh(slotGeometry, materials.brassAged);
    slot.position.set(x, deckTop + 0.028, z);
    slot.rotation.y = angle * 1.7;
    group.add(slot);
  }

  // --- vitrine ------------------------------------------------------------

  // Sized to land inside the cornice, and tall enough to clear the lamp.
  const domeRadius = deckRadius + 0.15;
  const domeSquash = 0.78;
  const vitrine = [];

  const dome = new THREE.Mesh(
    track(new THREE.SphereGeometry(domeRadius, 56, 36, 0, Math.PI * 2, 0, Math.PI / 2)),
    materials.glass,
  );
  dome.scale.y = domeSquash;
  dome.position.y = carcaseTop;
  vitrine.push(dome);

  // Clear glass over an evenly lit backdrop is almost invisible, so the vitrine
  // is read from its brass instead: a seating ring, six meridian ribs and a
  // finial. Each rib is a half-torus, squashed to the dome's profile before
  // being turned about Y — rotating about Y never remixes the squashed axis.
  const ribGeometry = track(new THREE.TorusGeometry(domeRadius + 0.015, 0.05, 8, 84, Math.PI));
  for (let i = 0; i < 6; i++) {
    const rib = new THREE.Mesh(ribGeometry, materials.brass);
    rib.scale.y = domeSquash;
    rib.rotation.y = (i / 6) * Math.PI;
    rib.position.y = carcaseTop;
    rib.castShadow = true;
    vitrine.push(rib);
  }

  const domeRing = new THREE.Mesh(
    track(new THREE.TorusGeometry(domeRadius, 0.07, 10, 120)),
    materials.brass,
  );
  domeRing.rotation.x = Math.PI / 2;
  domeRing.position.y = carcaseTop + 0.05;
  domeRing.castShadow = true;
  vitrine.push(domeRing);

  const finial = new THREE.Mesh(
    track(new THREE.SphereGeometry(0.13, 20, 14)),
    materials.brassAged,
  );
  finial.position.y = carcaseTop + domeRadius * domeSquash;
  finial.castShadow = true;
  vitrine.push(finial);

  for (const part of vitrine) {
    part.visible = false;
    group.add(part);
  }

  return {
    group,
    deckTop,

    setDomeVisible(visible) {
      for (const part of vitrine) part.visible = visible;
    },

    isDomeVisible() {
      return dome.visible;
    },

    dispose() {
      for (const geometry of geometries) geometry.dispose();
    },
  };
}
