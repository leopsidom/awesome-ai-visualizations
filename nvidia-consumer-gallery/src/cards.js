/**
 * Graphics-card models, built from boxes and discs. One world unit is 10 cm, so a card is drawn at
 * its true length and height; its thickness is its slot count × 20.32 mm (the PCIe slot pitch).
 *
 * Local axes: x along the card's length (bracket at -x), y up (gold fingers at the bottom),
 * +z towards the cooler side. The origin is the card's centre.
 *
 * Coolers, in the order they appear:
 *   none        bare chip (NV1)
 *   heatsink    small finned heatsink (RIVA era)
 *   smallfan    heatsink with a small fan (GeForce 256, GeForce 3)
 *   blower      full shroud with one radial fan at the rear (8800 GTX era)
 *   axial       full shroud with two axial fans (RTX 2080 Ti)
 *   flowthrough silver shroud, two fans, short PCB (RTX 4090)
 *   doubleflow  as flowthrough, with the dark centre spine of the RTX 5090 Founders Edition
 * The model is a sketch of the form factor, not a replica of any board.
 */
import * as THREE from "three";

const SLOT = 0.2032;

export function createCardFactory() {
  const fans = [];
  const M = (o) => new THREE.MeshStandardMaterial(o);
  const mat = {
    pcbGreen: M({ color: 0x2a6e36, roughness: 0.55, metalness: 0.1 }),
    pcbBlack: M({ color: 0x1d2024, roughness: 0.5, metalness: 0.3 }),
    gold: M({ color: 0xd4ad32, roughness: 0.3, metalness: 0.9 }),
    steel: M({ color: 0xb8bdc3, roughness: 0.3, metalness: 0.9 }),
    alu: M({ color: 0xa3a8ad, roughness: 0.4, metalness: 0.8 }),
    dark: M({ color: 0x30343a, roughness: 0.45, metalness: 0.6 }),
    silver: M({ color: 0xb0b6bc, roughness: 0.3, metalness: 0.85 }),
    fan: M({ color: 0x141518, roughness: 0.6 }),
    chip: M({ color: 0x333333, roughness: 0.4, metalness: 0.5 }),
    blade: M({ color: 0x4a5058, roughness: 0.6, metalness: 0.2 }),
  };
  const box = new THREE.BoxGeometry(1, 1, 1);
  const disc = new THREE.CylinderGeometry(1, 1, 1, 32);
  disc.rotateX(Math.PI / 2);
  const edges = new THREE.EdgesGeometry(box);
  const edgeMats = new Map();
  const edgeMat = (hex) => {
    if (!edgeMats.has(hex)) edgeMats.set(hex, new THREE.LineBasicMaterial({ color: hex }));
    return edgeMats.get(hex);
  };

  const part = (m, w, h, d, x, y, z, parent, geo = box) => {
    const o = new THREE.Mesh(geo, m);
    o.scale.set(w, h, d); o.position.set(x, y, z); parent.add(o); return o;
  };
  function fan(r, x, y, z, parent, spin) {
    if (!spin) return part(mat.fan, r, r, 0.04, x, y, z, parent, disc);
    const g = new THREE.Group(); g.position.set(x, y, z);
    part(mat.fan, r, r, 0.04, 0, 0, 0, g, disc);
    for (let b = 0; b < 7; b++) {
      const a = (b / 7) * Math.PI * 2;
      const bl = part(mat.blade, r * 0.85, r * 0.16, 0.02, Math.cos(a) * r * 0.45, Math.sin(a) * r * 0.45, 0.03, g);
      bl.rotation.z = a + 0.5;
    }
    part(mat.chip, r * 0.3, r * 0.3, 0.06, 0, 0, 0.03, g, disc);
    parent.add(g); fans.push(g); return g;
  }

  /**
   * @param {{length:number,height:number,slots:number,cooling:string,year:number,color:string,spin?:boolean}} o
   *   length/height in mm; color is the architecture colour used for the edge glow.
   */
  function make({ length, height, slots, cooling, year, color, spin = true }) {
    const L = length / 100, H = height / 100, depth = slots * SLOT, pcbT = 0.016, zc = pcbT / 2;
    const g = new THREE.Group();
    const flow = cooling === "flowthrough" || cooling === "doubleflow";
    const pcbL = flow ? L * 0.62 : L;   // flow-through cards have a short PCB
    const pcb = part(year < 2016 ? mat.pcbGreen : mat.pcbBlack, pcbL, H * 0.92, pcbT, -L / 2 + pcbL / 2, -H * 0.04, 0, g);
    const fingers = Math.min(L * 0.55, 0.9);
    part(mat.gold, fingers, 0.08, pcbT * 1.2, -L / 2 + 0.25 + fingers / 2, -H / 2, 0, g);
    part(mat.steel, 0.012, H * 1.08, depth, -L / 2 - 0.01, 0.03, depth / 2 - pcbT, g);   // bracket
    let edge = pcb;
    if (cooling === "none") {
      part(mat.chip, 0.24, 0.24, 0.02, 0, 0.05, zc + 0.01, g);
    } else if (cooling === "heatsink") {
      part(mat.alu, 0.32, 0.32, 0.03, 0, 0.05, zc + 0.015, g);
      for (let f = 0; f < 6; f++) part(mat.alu, 0.02, 0.32, 0.08, -0.13 + f * 0.052, 0.05, zc + 0.07, g);
    } else if (cooling === "smallfan") {
      part(mat.alu, 0.5, 0.5, 0.06, 0, 0.04, zc + 0.03, g);
      fan(0.2, 0, 0.04, zc + 0.08, g, spin);
    } else if (cooling === "blower") {
      const d = depth - 0.04;
      edge = part(mat.dark, L * 0.94, H * 0.86, d, 0.02 * L, 0, zc + d / 2, g);
      fan(0.34, L * 0.3, -0.02, zc + depth - 0.02, g, spin);
    } else {
      const d = depth - 0.025, r = H * 0.37;
      edge = part(flow ? mat.silver : mat.dark, L * 0.97, H * 0.9, d, 0, 0, zc + d / 2, g);
      fan(r, -L * 0.22, 0, zc + d + 0.005, g, spin);
      fan(r, L * 0.24, 0, zc + d + 0.005, g, spin);
      if (cooling === "doubleflow") part(mat.chip, L * 0.18, H * 0.9, d * 1.001, 0, 0, zc + d / 2, g);
    }
    const glow = new THREE.LineSegments(edges, edgeMat(color));
    glow.scale.copy(edge.scale); glow.position.copy(edge.position); g.add(glow);
    return g;
  }

  function dispose() {
    [box, disc, edges].forEach((x) => x.dispose());
    Object.values(mat).forEach((m) => m.dispose());
    edgeMats.forEach((m) => m.dispose());
  }

  return { make, fans, dispose };
}
