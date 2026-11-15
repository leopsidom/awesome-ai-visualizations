import * as THREE from "three";
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";

/**
 * Small shared builders: HTML labels pinned in the scene, unlit line segments, and
 * the release of a whole object tree.
 */

/** An HTML label pinned to a point. `center` is the anchor on the label, 0..1 on each axis. */
export function textLabel(className, text = "", center = [0.5, 0.5]) {
  const el = document.createElement("div");
  el.className = className;
  el.textContent = text;
  const label = new CSS2DObject(el);
  label.center.set(center[0], center[1]);
  return label;
}

/** Unlit line segments from a flat [x, y, z, x, y, z, ...] list. */
export function segments(points, color, opacity) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
  const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
  return new THREE.LineSegments(geometry, material);
}

/**
 * Takes an object tree out of the scene and frees its geometries, materials and label
 * elements. CSS2DObject only removes its element when it is itself detached, so the
 * labels further down the tree are removed here.
 */
export function release(object) {
  object.removeFromParent();
  object.traverse((o) => {
    o.geometry?.dispose();
    if (o.material) for (const m of [].concat(o.material)) m.dispose();
    if (o.isCSS2DObject) o.element.remove();
  });
}
