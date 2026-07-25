import * as THREE from "three";

/**
 * Every map in this scene is drawn at runtime into a 2D canvas — there are no
 * image assets to load, and each map is a pure function of the seed.
 *
 * Two conventions matter and are easy to get wrong:
 *   - colour maps get `SRGBColorSpace`; roughness / alpha maps must NOT, because
 *     they are data rather than colour and a second sRGB decode would skew them.
 *   - `CylinderGeometry` and `CircleGeometry` map their caps as a disc inscribed
 *     in the UV square, so a square canvas drawn concentrically lands exactly on
 *     the dial. That is why the deck art is composed around the canvas centre.
 */

function makeCanvas(size, height = size) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = height;
  return canvas;
}

function finish(canvas, { srgb = false, wrap = THREE.ClampToEdgeWrapping } = {}) {
  const texture = new THREE.CanvasTexture(canvas);
  if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = wrap;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = 8; // clamped to the device maximum by the renderer
  return texture;
}

// ------------------------------------------------------------------- the deck --

/**
 * The engraved dial plate: patinated brass, one scribed circle per orbit, a
 * graduated rim in degrees, and a maker's inscription.
 *
 * Colour and roughness are painted by the same routine so the engraving lines
 * up between them — the grooves come out both darker and duller than the field.
 */
export function makeDeckTextures(rng, { deckRadius, orbitRadii, seedText }) {
  const SIZE = 1024;
  const half = SIZE / 2;
  const toPx = (worldRadius) => (worldRadius / deckRadius) * half;

  // Pre-roll every random number so the two passes draw identical geometry.
  const blotches = Array.from({ length: 260 }, () => ({
    angle: rng.range(0, Math.PI * 2),
    radius: Math.sqrt(rng()) * half,
    size: rng.range(6, 54),
    alpha: rng.range(0.01, 0.06),
    warm: rng() < 0.55,
  }));

  const brushing = Array.from({ length: 320 }, () => ({
    radius: rng.range(0.06, 1.0) * half,
    start: rng.range(0, Math.PI * 2),
    sweep: rng.range(0.15, 1.6),
    alpha: rng.range(0.012, 0.05),
    light: rng() < 0.5,
  }));

  const paint = (ctx, ink) => {
    ctx.save();
    ctx.translate(half, half);

    // Field.
    const field = ctx.createRadialGradient(0, 0, 0, 0, 0, half);
    field.addColorStop(0, ink.fieldInner);
    field.addColorStop(0.72, ink.fieldMid);
    field.addColorStop(1, ink.fieldOuter);
    ctx.fillStyle = field;
    ctx.beginPath();
    ctx.arc(0, 0, half, 0, Math.PI * 2);
    ctx.fill();

    // Patina.
    for (const b of blotches) {
      ctx.globalAlpha = b.alpha * ink.patina;
      ctx.fillStyle = b.warm ? ink.patinaWarm : ink.patinaCool;
      ctx.beginPath();
      ctx.ellipse(
        Math.cos(b.angle) * b.radius,
        Math.sin(b.angle) * b.radius,
        b.size,
        b.size * 0.62,
        b.angle,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }

    // Circular brushing — short concentric arcs, the mark of a turned plate.
    ctx.lineWidth = 1;
    for (const s of brushing) {
      ctx.globalAlpha = s.alpha;
      ctx.strokeStyle = s.light ? ink.brushLight : ink.brushDark;
      ctx.beginPath();
      ctx.arc(0, 0, s.radius, s.start, s.start + s.sweep);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // One scribed circle per orbit, cut as a dark groove with a bright lip.
    for (const radius of orbitRadii) {
      const r = toPx(radius);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = ink.groove;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();

      ctx.lineWidth = 1;
      ctx.strokeStyle = ink.lip;
      ctx.beginPath();
      ctx.arc(0, 0, r + 1.6, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Graduated rim: a tick every two degrees, taller every ten, tallest at the
    // thirty-degree houses, which also carry a numeral.
    const rimOuter = half * 0.965;
    ctx.strokeStyle = ink.groove;
    for (let deg = 0; deg < 360; deg += 2) {
      const major = deg % 30 === 0;
      const medium = deg % 10 === 0;
      const length = major ? 30 : medium ? 19 : 10;
      const angle = (deg * Math.PI) / 180;

      ctx.lineWidth = major ? 3 : medium ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * rimOuter, Math.sin(angle) * rimOuter);
      ctx.lineTo(
        Math.cos(angle) * (rimOuter - length),
        Math.sin(angle) * (rimOuter - length),
      );
      ctx.stroke();
    }

    // Two thin bands fencing the graduation in.
    for (const r of [rimOuter, rimOuter - 30]) {
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = ink.groove;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Numerals, upright relative to the plate's centre.
    ctx.fillStyle = ink.groove;
    ctx.font = "600 26px ui-monospace, Menlo, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let deg = 0; deg < 360; deg += 30) {
      const angle = (deg * Math.PI) / 180;
      ctx.save();
      ctx.translate(Math.cos(angle) * (rimOuter - 52), Math.sin(angle) * (rimOuter - 52));
      ctx.rotate(angle + Math.PI / 2);
      ctx.fillText(String(deg), 0, 0);
      ctx.restore();
    }

    // Maker's inscription, set letter by letter around an inner arc.
    arcText(ctx, `EPHEMERIS · MOVEMENT No. ${seedText}`, half * 0.60, -Math.PI / 2, {
      fill: ink.groove,
      font: "500 22px ui-monospace, Menlo, monospace",
      spacing: 0.0345,
    });

    ctx.restore();
  };

  const colorCanvas = makeCanvas(SIZE);
  paint(colorCanvas.getContext("2d"), {
    fieldInner: "#cfa960",
    fieldMid: "#b58c47",
    fieldOuter: "#8e6a31",
    patina: 1,
    patinaWarm: "#e5c98d",
    patinaCool: "#4d5f45",
    brushLight: "#f0dcaa",
    brushDark: "#6d5124",
    groove: "#4b3616",
    lip: "#f3e0b0",
  });

  const roughCanvas = makeCanvas(SIZE);
  paint(roughCanvas.getContext("2d"), {
    // A satin plate, not a mirror: pushing the field this light keeps the key
    // light's specular lobe broad instead of burning a hard patch into the
    // brass. The grooves read lighter still — rougher — so engraving catches
    // the light rather than mirroring it.
    fieldInner: "#a4a4a4",
    fieldMid: "#aeaeae",
    fieldOuter: "#bcbcbc",
    patina: 0.55,
    patinaWarm: "#8a8a8a",
    patinaCool: "#9c9c9c",
    brushLight: "#3a3a3a",
    brushDark: "#7a7a7a",
    groove: "#a8a8a8",
    lip: "#3e3e3e",
  });

  return {
    map: finish(colorCanvas, { srgb: true }),
    roughnessMap: finish(roughCanvas),
  };
}

/** Lay `text` around a circle of `radius`, centred on `centerAngle`. */
function arcText(ctx, text, radius, centerAngle, { fill, font, spacing }) {
  ctx.save();
  ctx.fillStyle = fill;
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const start = centerAngle - ((text.length - 1) * spacing) / 2;
  for (let i = 0; i < text.length; i++) {
    const angle = start + i * spacing;
    ctx.save();
    ctx.translate(Math.cos(angle) * radius, Math.sin(angle) * radius);
    ctx.rotate(angle + Math.PI / 2);
    ctx.fillText(text[i], 0, 0);
    ctx.restore();
  }
  ctx.restore();
}

// -------------------------------------------------------------------- walnut --

/** Figured walnut for the plinth: growth lines, a couple of knots, end shading. */
export function makeWoodTextures(rng) {
  const SIZE = 1024;

  const grains = Array.from({ length: 190 }, () => ({
    y: rng.range(-40, SIZE + 40),
    amp: rng.range(4, 26),
    freq: rng.range(1.2, 4.4),
    phase: rng.range(0, Math.PI * 2),
    width: rng.range(0.6, 3.4),
    alpha: rng.range(0.05, 0.3),
    dark: rng() < 0.72,
  }));

  const knots = Array.from({ length: rng.int(2, 4) }, () => ({
    x: rng.range(0.08, 0.92) * SIZE,
    y: rng.range(0.15, 0.85) * SIZE,
    rings: rng.int(5, 10),
    step: rng.range(5, 11),
    squash: rng.range(0.28, 0.55),
    tilt: rng.range(-0.5, 0.5),
  }));

  const paint = (ctx, ink) => {
    const base = ctx.createLinearGradient(0, 0, 0, SIZE);
    base.addColorStop(0, ink.top);
    base.addColorStop(0.5, ink.middle);
    base.addColorStop(1, ink.bottom);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, SIZE, SIZE);

    for (const g of grains) {
      ctx.globalAlpha = g.alpha * ink.grainAlpha;
      ctx.strokeStyle = g.dark ? ink.grainDark : ink.grainLight;
      ctx.lineWidth = g.width;
      ctx.beginPath();
      for (let x = 0; x <= SIZE; x += 8) {
        // Two octaves of sine is enough to stop the lines reading as ruled.
        const t = (x / SIZE) * Math.PI * 2;
        const y =
          g.y +
          Math.sin(t * g.freq + g.phase) * g.amp +
          Math.sin(t * g.freq * 2.7 + g.phase * 1.7) * g.amp * 0.35;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    for (const k of knots) {
      for (let i = 1; i <= k.rings; i++) {
        ctx.globalAlpha = (0.34 - i * 0.026) * ink.grainAlpha;
        ctx.strokeStyle = ink.grainDark;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.ellipse(k.x, k.y, i * k.step, i * k.step * k.squash, k.tilt, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    ctx.globalAlpha = 1;
  };

  const colorCanvas = makeCanvas(SIZE);
  paint(colorCanvas.getContext("2d"), {
    top: "#4a2f1c",
    middle: "#6b452a",
    bottom: "#39230f",
    grainDark: "#221207",
    grainLight: "#a5764a",
    grainAlpha: 1,
  });

  const roughCanvas = makeCanvas(SIZE);
  paint(roughCanvas.getContext("2d"), {
    // A french-polished carcase: fairly smooth overall, with the open grain
    // reading as the rougher lines.
    top: "#4a4a4a",
    middle: "#454545",
    bottom: "#525252",
    grainDark: "#8f8f8f",
    grainLight: "#333333",
    grainAlpha: 0.8,
  });

  return {
    map: finish(colorCanvas, { srgb: true, wrap: THREE.RepeatWrapping }),
    roughnessMap: finish(roughCanvas, { wrap: THREE.RepeatWrapping }),
  };
}

// ------------------------------------------------------------------- planets --

/**
 * Enamelled planet bodies: latitude bands over a mottled ground, drawn on a 2:1
 * canvas so it wraps as an equirectangular map. `wrapS` repeats to hide the seam.
 */
export function makePlanetTexture(rng, groundHex, bandHex) {
  const W = 512;
  const H = 256;
  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = groundHex;
  ctx.fillRect(0, 0, W, H);

  // Latitude bands.
  const bands = rng.int(5, 12);
  for (let i = 0; i < bands; i++) {
    const y = rng() * H;
    const h = rng.range(4, 26);
    ctx.globalAlpha = rng.range(0.1, 0.42);
    ctx.fillStyle = rng() < 0.5 ? bandHex : "#000000";
    ctx.fillRect(0, y, W, h);
  }

  // Mottling — soft blobs stretched along latitude, so they read as weather.
  for (let i = 0; i < 260; i++) {
    ctx.globalAlpha = rng.range(0.02, 0.12);
    ctx.fillStyle = rng() < 0.5 ? "#ffffff" : "#000000";
    const x = rng() * W;
    const y = rng() * H;
    ctx.beginPath();
    ctx.ellipse(x, y, rng.range(6, 34), rng.range(2, 9), 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Poles, slightly paler.
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, 10);
  ctx.fillRect(0, H - 10, W, 10);
  ctx.globalAlpha = 1;

  return finish(canvas, { srgb: true, wrap: THREE.RepeatWrapping });
}

/**
 * A ring system. `RingGeometry` projects its UVs planar-square, so concentric
 * bands drawn from the canvas centre land as true annuli. Alpha carries the gaps.
 */
export function makeRingTexture(rng, tintHex) {
  const SIZE = 512;
  const half = SIZE / 2;
  const canvas = makeCanvas(SIZE);
  const ctx = canvas.getContext("2d");

  ctx.translate(half, half);
  for (let r = half; r > half * 0.42; r -= 1) {
    const t = (r - half * 0.42) / (half * 0.58);
    // Two beat frequencies give the Cassini-ish gaps without hand-placing them.
    const density =
      0.45 +
      0.45 * Math.sin(t * 34 + rng.range(0, 0.0006) * r) * Math.sin(t * 7.3 + 1.1);
    ctx.globalAlpha = Math.max(0, Math.min(0.95, density));
    ctx.strokeStyle = t > 0.55 ? tintHex : "#e8dcc0";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  return finish(canvas, { srgb: true });
}

// -------------------------------------------------------------------- steel --

/** Fine linear streaks — the brushed key on the steel parts. */
export function makeBrushedRoughness(rng) {
  const SIZE = 512;
  const canvas = makeCanvas(SIZE);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#616161";
  ctx.fillRect(0, 0, SIZE, SIZE);

  for (let i = 0; i < 1400; i++) {
    const y = rng() * SIZE;
    const shade = Math.floor(rng.range(60, 190));
    ctx.globalAlpha = rng.range(0.05, 0.3);
    ctx.strokeStyle = `rgb(${shade},${shade},${shade})`;
    ctx.lineWidth = rng.range(0.5, 2.2);
    ctx.beginPath();
    ctx.moveTo(rng.range(-40, SIZE), y);
    ctx.lineTo(rng.range(0, SIZE + 40), y + rng.range(-1.5, 1.5));
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const texture = finish(canvas, { wrap: THREE.RepeatWrapping });
  texture.repeat.set(3, 3);
  return texture;
}
