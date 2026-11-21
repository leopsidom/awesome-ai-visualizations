import * as THREE from "three";

/**
 * Tracks geometries, materials, and textures owned by a character instance
 * so calling dispose() frees every GPU resource cleanly.
 */
export function createTracker() {
  const resources = [];
  return {
    keep(resource) {
      if (resource) resources.push(resource);
      return resource;
    },
    dispose() {
      for (const r of resources) {
        if (typeof r.dispose === "function") r.dispose();
      }
      resources.length = 0;
    },
  };
}

/**
 * Soft matte/satin vinyl-clay PBR material (Pixar-lite / designer toy finish).
 */
export function createClayMaterial(tracker, color, opts = {}) {
  return tracker.keep(
    new THREE.MeshStandardMaterial({
      color,
      roughness: opts.roughness ?? 0.62,
      metalness: opts.metalness ?? 0.04,
      emissive: opts.emissive ?? 0x000000,
      emissiveIntensity: opts.emissiveIntensity ?? 0,
      transparent: opts.transparent ?? false,
      opacity: opts.opacity ?? 1,
      side: opts.side ?? THREE.FrontSide,
    }),
  );
}

/**
 * Glossy vinyl / lacquered plastic material (eyes, visor bezel, ceramic shell).
 */
export function createGlossMaterial(tracker, color, opts = {}) {
  return tracker.keep(
    new THREE.MeshPhysicalMaterial({
      color,
      roughness: opts.roughness ?? 0.16,
      metalness: opts.metalness ?? 0.05,
      clearcoat: opts.clearcoat ?? 0.85,
      clearcoatRoughness: opts.clearcoatRoughness ?? 0.12,
      transparent: opts.transparent ?? false,
      opacity: opts.opacity ?? 1,
    }),
  );
}

/**
 * Brushed satin metal (glasses frames, zippers, robot trim, antenna stem).
 */
export function createMetalMaterial(tracker, color, opts = {}) {
  return tracker.keep(
    new THREE.MeshStandardMaterial({
      color,
      roughness: opts.roughness ?? 0.3,
      metalness: opts.metalness ?? 0.82,
    }),
  );
}

/**
 * Soft radial contact shadow disc sitting just above y = 0.
 * Keeps characters grounded even in scenes with soft or disabled shadow maps.
 */
export function createContactShadow(tracker, radius = 0.36, opacity = 0.32) {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const grad = ctx.createRadialGradient(size / 2, size / 2, 4, size / 2, size / 2, size / 2);
  grad.addColorStop(0, "rgba(0, 0, 0, 0.72)");
  grad.addColorStop(0.55, "rgba(0, 0, 0, 0.28)");
  grad.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = tracker.keep(new THREE.CanvasTexture(canvas));
  tex.colorSpace = THREE.SRGBColorSpace;

  const geo = tracker.keep(new THREE.PlaneGeometry(radius * 2, radius * 2));
  const mat = tracker.keep(
    new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity,
      depthWrite: false,
    }),
  );

  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.004;
  mesh.renderOrder = 1;
  return mesh;
}

/** Frame-rate independent exponential damping helper. */
export function damp(current, target, lambda, dt) {
  return THREE.MathUtils.lerp(current, target, 1 - Math.exp(-lambda * dt));
}

/** Apply shadow flags recursively to every Mesh inside a Group. */
export function enableShadows(object, cast = true, receive = true) {
  object.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = cast;
      child.receiveShadow = receive;
    }
  });
}
