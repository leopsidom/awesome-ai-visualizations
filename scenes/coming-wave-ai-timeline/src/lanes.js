import * as THREE from "three";

/**
 * What is drawn along the route: one ribbon per thread, the year gates that cross
 * them, and the white "now" line. All of it is re-seated on the swell every frame.
 */

const SEGMENTS = 720; // samples along each ribbon
const HALF_WIDTH = 0.16;
const LIFT = 0.25; // ribbons float just above the water, so they never z-fight it
const GATE_SPANS = 8; // line segments per year gate
const NOW_POINTS = 13;
const MARGIN = 2.5; // gates and the now line overhang the outer lanes by this much

function yearSprite(text) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 96;
  const g = canvas.getContext("2d");
  g.font = "600 54px ui-monospace, Menlo, Consolas, monospace";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillStyle = "rgba(205, 220, 245, 0.95)";
  g.fillText(text, 128, 50);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
  sprite.scale.set(8, 3, 1);
  return sprite;
}

export function createLanes(scene, { model, swell, laneZ, halfWidth, length, u0, u1 }) {
  const objects = [];
  const disposables = [];
  const keep = (resource) => {
    disposables.push(resource);
    return resource;
  };
  const place = (object) => {
    object.frustumCulled = false; // heights move every frame; bounds are never recomputed
    objects.push(object);
    scene.add(object);
    return object;
  };

  // ---- thread ribbons: dim along the whole route, lit from the thread's first event up to "now"
  const x0 = u0 * length;
  const dx = ((u1 - u0) * length) / (SEGMENTS - 1);
  const index = [];
  for (let i = 0; i < SEGMENTS - 1; i++) {
    const a = 2 * i;
    index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }

  const ribbons = model.threads.map((thread) => {
    const z = laneZ[thread.id];
    const pos = new Float32Array(SEGMENTS * 6);
    for (let i = 0; i < SEGMENTS; i++) {
      const x = x0 + i * dx;
      pos[i * 6] = x;
      pos[i * 6 + 2] = z - HALF_WIDTH;
      pos[i * 6 + 3] = x;
      pos[i * 6 + 5] = z + HALF_WIDTH;
    }
    // Both meshes share one position attribute; the lit one is revealed with a draw range.
    const attr = new THREE.BufferAttribute(pos, 3);
    const dimGeometry = keep(new THREE.BufferGeometry());
    const litGeometry = keep(new THREE.BufferGeometry());
    for (const geometry of [dimGeometry, litGeometry]) {
      geometry.setAttribute("position", attr);
      geometry.setIndex(index);
    }
    const color = new THREE.Color(thread.color);
    const dimMaterial = keep(
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false }),
    );
    const litMaterial = keep(new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
    const dim = place(new THREE.Mesh(dimGeometry, dimMaterial));
    const lit = place(new THREE.Mesh(litGeometry, litMaterial));
    const first = model.events.find((e) => e.thread === thread.id);
    const start = first ? Math.max(0, Math.floor((first.u * length - x0) / dx)) : SEGMENTS - 1;
    return { id: thread.id, z, pos, attr, litGeometry, dim, lit, start };
  });

  // ---- year gates across the lanes, labelled on the far side: decades, then every year from 2010
  const zMin = -halfWidth - MARGIN;
  const zSpan = 2 * (halfWidth + MARGIN);
  const lastYear = Math.floor(model.axis.knots.at(-1)[0]);
  const years = [];
  for (let y = 1950; y < 2010; y += 10) years.push(y);
  for (let y = 2010; y <= lastYear; y++) years.push(y);

  const gates = years.map((year) => {
    const x = model.axis.toU(year) * length;
    const sprite = yearSprite(String(year));
    keep(sprite.material.map);
    keep(sprite.material);
    sprite.position.set(x, 0, zMin - 3.5);
    objects.push(sprite);
    scene.add(sprite);
    return { x, sprite };
  });
  const gatePos = new Float32Array(gates.length * GATE_SPANS * 6);
  const gateGeometry = keep(new THREE.BufferGeometry());
  gateGeometry.setAttribute("position", new THREE.BufferAttribute(gatePos, 3));
  place(
    new THREE.LineSegments(
      gateGeometry,
      keep(new THREE.LineBasicMaterial({ color: 0x9fb4d8, transparent: true, opacity: 0.3 })),
    ),
  );

  // ---- the "now" line
  const nowPos = new Float32Array(NOW_POINTS * 3);
  const nowGeometry = keep(new THREE.BufferGeometry());
  nowGeometry.setAttribute("position", new THREE.BufferAttribute(nowPos, 3));
  place(
    new THREE.Line(nowGeometry, keep(new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 }))),
  );

  /** `nowX` is the world x of the present moment of the playback. */
  function update(t, nowX) {
    const reached = Math.max(0, Math.min(SEGMENTS - 1, Math.floor((nowX - x0) / dx)));
    for (const r of ribbons) {
      const p = r.pos;
      for (let i = 0; i < SEGMENTS; i++) {
        const y = swell.height(p[i * 6], r.z, t) + LIFT;
        p[i * 6 + 1] = y;
        p[i * 6 + 4] = y;
      }
      r.attr.needsUpdate = true;
      r.litGeometry.setDrawRange(r.start * 6, Math.max(0, reached - r.start) * 6);
    }

    let n = 0;
    const dz = zSpan / GATE_SPANS;
    for (const gate of gates) {
      for (let j = 0; j < GATE_SPANS; j++) {
        const za = zMin + j * dz;
        const zb = za + dz;
        gatePos[n++] = gate.x;
        gatePos[n++] = swell.height(gate.x, za, t) + 0.12;
        gatePos[n++] = za;
        gatePos[n++] = gate.x;
        gatePos[n++] = swell.height(gate.x, zb, t) + 0.12;
        gatePos[n++] = zb;
      }
      gate.sprite.position.y = swell.height(gate.x, gate.sprite.position.z, t) + 2.4;
    }
    gateGeometry.attributes.position.needsUpdate = true;

    for (let j = 0; j < NOW_POINTS; j++) {
      const z = zMin + (j * zSpan) / (NOW_POINTS - 1);
      nowPos[j * 3] = nowX;
      nowPos[j * 3 + 1] = swell.height(nowX, z, t) + 0.3;
      nowPos[j * 3 + 2] = z;
    }
    nowGeometry.attributes.position.needsUpdate = true;
  }

  /** `enabled` is the Set of thread ids switched on in the panel. */
  function setEnabled(enabled) {
    for (const r of ribbons) r.dim.visible = r.lit.visible = enabled.has(r.id);
  }

  function dispose() {
    scene.remove(...objects);
    for (const resource of disposables) resource.dispose();
  }

  return { update, setEnabled, dispose };
}
