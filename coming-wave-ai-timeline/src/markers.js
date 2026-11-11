import * as THREE from "three";

/**
 * One marker per event, standing on its thread's lane: a small sphere for a minor
 * event; a faceted gem with a ring and a light beam for a major one.
 */

const MINOR_LIFT = 0.9;
const MAJOR_LIFT = 1.5;

export function createMarkers(scene, { model, swell, laneZ, length }) {
  // Geometry is shared; each marker needs its own materials because opacity is per marker.
  const minorGeometry = new THREE.SphereGeometry(0.5, 16, 12);
  const majorGeometry = new THREE.IcosahedronGeometry(1.05, 1);
  const ringGeometry = new THREE.TorusGeometry(1.9, 0.07, 8, 48);
  const beamGeometry = new THREE.CylinderGeometry(0.08, 0.08, 18, 6);
  const materials = [];
  const basic = (options) => {
    const material = new THREE.MeshBasicMaterial(options);
    materials.push(material);
    return material;
  };

  const byId = {};
  const pickables = [];
  let lastCurrent = null;

  for (const e of model.events) {
    const major = e.tier === "major";
    const color = new THREE.Color(e.color);
    const group = new THREE.Group();
    group.position.set(e.u * length, 0, laneZ[e.thread]);

    const core = new THREE.Mesh(major ? majorGeometry : minorGeometry, basic({ color, transparent: true }));
    core.userData.id = e.id;
    group.add(core);
    pickables.push(core);

    const marker = { e, group, core, ring: null, beam: null, major, pulse: 0 };
    if (major) {
      marker.ring = new THREE.Mesh(ringGeometry, basic({ color, transparent: true, opacity: 0.85 }));
      marker.ring.rotation.x = Math.PI / 2;
      marker.beam = new THREE.Mesh(
        beamGeometry,
        basic({ color, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false }),
      );
      marker.beam.position.y = 9;
      group.add(marker.ring, marker.beam);
    }
    scene.add(group);
    byId[e.id] = marker;
  }

  /** `curId` is the event just reached; `focusId` the one whose story card is open. */
  function update({ u, time: t, dt, curId, focusId }) {
    if (curId !== lastCurrent) {
      lastCurrent = curId;
      if (byId[curId]) byId[curId].pulse = 1;
    }
    for (const id in byId) {
      const m = byId[id];
      if (!m.group.visible) continue;
      const p = m.group.position;
      p.y = swell.height(p.x, p.z, t) + (m.major ? MAJOR_LIFT : MINOR_LIFT);

      const passed = m.e.u <= u + 1e-9;
      const isCurrent = id === curId;
      const isFocus = id === focusId;
      m.pulse = Math.max(0, m.pulse - dt * 1.2);
      m.core.material.opacity = passed ? 1 : 0.4;
      m.core.scale.setScalar((isCurrent ? 1.25 + 0.12 * Math.sin(t * 5) : 1) + m.pulse * 0.8);
      if (m.major) {
        m.core.rotation.y = t * 0.6;
        m.ring.scale.setScalar(1 + m.pulse * 1.6 + (isFocus ? 0.25 + 0.1 * Math.sin(t * 3) : 0));
        m.ring.material.opacity = passed ? 0.9 : 0.4;
        m.beam.material.opacity = isFocus ? 0.6 : passed ? 0.3 : 0.16;
      }
    }
  }

  /** `enabled` is the Set of thread ids switched on in the panel. */
  function setEnabled(enabled) {
    for (const id in byId) byId[id].group.visible = enabled.has(byId[id].e.thread);
  }

  function dispose() {
    for (const id in byId) scene.remove(byId[id].group);
    for (const geometry of [minorGeometry, majorGeometry, ringGeometry, beamGeometry]) geometry.dispose();
    for (const material of materials) material.dispose();
  }

  return { byId, pickables, update, setEnabled, dispose };
}
