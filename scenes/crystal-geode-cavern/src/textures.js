import * as THREE from "three";

/**
 * The only maps in the scene, drawn at runtime into a 2D canvas — no image
 * assets, and every map is a pure function of the seed.
 *
 * They exist because a crystal that is uniformly clear reads as plastic. Real
 * quartz has *growth zoning* (bands laid down parallel to the termination, so
 * they run across the prism, not along it) and *veils* (healed fractures that
 * catch light as frosted sheets). Both are drawn once and shared by every
 * crystal in the cavity; the prism UVs run v along the c-axis, so horizontal
 * bands on the canvas land as zones and vertical strokes land as fractures.
 *
 * The usual convention applies: the colour map gets `SRGBColorSpace`, the
 * roughness map must not — it is data, and a second sRGB decode would skew it.
 */

export function makeCrystalMaps(rng) {
  const SIZE = 512;

  // Pre-roll so both passes draw the same crystal.
  const zones = Array.from({ length: rng.int(14, 26) }, () => ({
    y: rng() * SIZE,
    height: rng.range(3, 34),
    strength: rng.range(0.05, 0.4),
    sharp: rng() < 0.4,
  }));

  const veils = Array.from({ length: rng.int(10, 18) }, () => ({
    x: rng() * SIZE,
    tilt: rng.range(-0.5, 0.5),
    width: rng.range(6, 46),
    top: rng.range(0, 0.55) * SIZE,
    bottom: rng.range(0.45, 1) * SIZE,
    strength: rng.range(0.1, 0.55),
  }));

  const flecks = Array.from({ length: 220 }, () => ({
    x: rng() * SIZE,
    y: rng() * SIZE,
    r: rng.range(0.8, 5),
    strength: rng.range(0.04, 0.22),
  }));

  const paint = (ctx, ink) => {
    ctx.fillStyle = ink.field;
    ctx.fillRect(0, 0, SIZE, SIZE);

    // Growth zoning — bands across the prism, denser toward the tip.
    for (const z of zones) {
      const gradient = ctx.createLinearGradient(0, z.y, 0, z.y + z.height);
      gradient.addColorStop(0, "rgba(0,0,0,0)");
      gradient.addColorStop(0.5, ink.zone);
      gradient.addColorStop(1, "rgba(0,0,0,0)");

      ctx.globalAlpha = z.strength * ink.zoneAlpha;
      ctx.fillStyle = z.sharp ? ink.zone : gradient;
      ctx.fillRect(0, z.y, SIZE, z.sharp ? Math.max(1, z.height * 0.25) : z.height);
    }

    // Veils — healed fractures, drawn as soft vertical sheets.
    for (const v of veils) {
      ctx.globalAlpha = v.strength * ink.veilAlpha;
      ctx.strokeStyle = ink.veil;
      ctx.lineWidth = v.width;
      ctx.beginPath();
      ctx.moveTo(v.x, v.top);
      ctx.lineTo(v.x + v.tilt * (v.bottom - v.top), v.bottom);
      ctx.stroke();

      // A brighter hairline down the middle of the sheet.
      ctx.globalAlpha = v.strength * ink.veilAlpha * 1.6;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(v.x, v.top);
      ctx.lineTo(v.x + v.tilt * (v.bottom - v.top), v.bottom);
      ctx.stroke();
    }

    // Trapped inclusions.
    for (const f of flecks) {
      ctx.globalAlpha = f.strength * ink.fleckAlpha;
      ctx.fillStyle = ink.fleck;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
  };

  // Colour: near white, because it multiplies the mineral tint rather than
  // replacing it. Anything darker here would mute every mineral at once.
  const colorCanvas = makeCanvas(SIZE);
  paint(colorCanvas.getContext("2d"), {
    field: "#ffffff",
    zone: "#c9bcd6",
    zoneAlpha: 0.7,
    veil: "#f2ecff",
    veilAlpha: 0.5,
    fleck: "#9c8fae",
    fleckAlpha: 1,
  });

  // Roughness: a polished field with the flaws reading rougher, so veils frost
  // over and the zoning catches a duller line than the faces around it.
  const roughCanvas = makeCanvas(SIZE);
  paint(roughCanvas.getContext("2d"), {
    field: "#141414",
    zone: "#6e6e6e",
    zoneAlpha: 0.85,
    veil: "#c8c8c8",
    veilAlpha: 1,
    fleck: "#8a8a8a",
    fleckAlpha: 1,
  });

  return {
    map: finish(colorCanvas, { srgb: true }),
    roughnessMap: finish(roughCanvas),
  };
}

// --------------------------------------------------------------------- utils --

function makeCanvas(size, height = size) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = height;
  return canvas;
}

function finish(canvas, { srgb = false } = {}) {
  const texture = new THREE.CanvasTexture(canvas);
  if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = 8; // clamped to the device maximum by the renderer
  return texture;
}
