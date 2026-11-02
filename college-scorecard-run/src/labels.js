import * as THREE from "three";

/**
 * Text in the world is drawn into CanvasTextures. Each banner gets its own
 * canvas, drawn once when the gate is built, and is disposed with the gate.
 * Drawn at 2× the world aspect so the type stays crisp at the distance the
 * player reads it from.
 */

const FONT = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';

function wrap(ctx, text, maxWidth) {
  const words = text.split(" ");
  const lines = [];
  let line = "";
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function fitTitle(ctx, text, maxWidth, maxLines, start, min) {
  let size = start;
  let lines;
  for (; size >= min; size -= 4) {
    ctx.font = `600 ${size}px ${FONT}`;
    lines = wrap(ctx, text, maxWidth);
    if (lines.length <= maxLines && lines.every((l) => ctx.measureText(l).width <= maxWidth)) break;
  }
  return { size: Math.max(size, min), lines };
}

function makeTexture(canvas, renderer) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}

/** The card hung above each arch: school or program, its place and sector. */
export function bannerTexture(renderer, card) {
  const W = 1024;
  const H = 560;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d");

  // Pennant body: deep navy with a sector-coloured band down the left.
  ctx.fillStyle = "#101a33";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = card.color;
  ctx.fillRect(0, 0, 26, H);
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, W - 6, H - 6);

  ctx.fillStyle = card.color;
  ctx.font = `600 40px ${FONT}`;
  ctx.textBaseline = "top";
  ctx.fillText(card.tagline.toUpperCase(), 64, 34);

  // The name is the only thing that has to be read at speed: as big as it
  // will go, two lines preferred, heavy weight, with a dark outline so it
  // holds up against bloom-ish dusk light and texture minification.
  let fit = fitTitle(ctx, card.title, W - 110, 2, 150, 84);
  if (fit.lines.length > 2) fit = fitTitle(ctx, card.title, W - 110, 3, 110, 64);
  const { size, lines } = fit;
  ctx.font = `800 ${size}px ${FONT}`;
  const lh = size * 1.06;
  const block = lines.length * lh;
  const top = 92 + (H - 92 - 86 - block) / 2;
  ctx.lineJoin = "round";
  ctx.lineWidth = 10;
  ctx.strokeStyle = "#060a16";
  ctx.fillStyle = "#fffaf0";
  lines.forEach((l, i) => {
    ctx.strokeText(l, 60, top + i * lh);
    ctx.fillText(l, 60, top + i * lh);
  });

  ctx.font = `500 40px ${FONT}`;
  ctx.fillStyle = "rgba(246,241,227,0.8)";
  ctx.fillText(card.line, 64, H - 70);

  return makeTexture(c, renderer);
}

/** The sign across the top of a gate: the question being asked. */
export function questionTexture(renderer, metric, index) {
  const W = 2048;
  const H = 420;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d");

  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#7a1f2b");
  g.addColorStop(1, "#4e1119");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "#e6c36a";
  ctx.lineWidth = 8;
  ctx.strokeRect(14, 14, W - 28, H - 28);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#e6c36a";
  ctx.font = `600 46px ${FONT}`;
  ctx.fillText(`GATE ${index}  ·  ${metric.tag.toUpperCase()}`, W / 2, 74);
  ctx.fillStyle = "#fffaf0";
  let size = 150;
  do {
    ctx.font = `800 ${size}px ${FONT}`;
    size -= 4;
  } while (ctx.measureText(metric.ask).width > W - 100 && size > 60);
  ctx.fillText(metric.ask, W / 2, 214);
  ctx.fillStyle = "rgba(251,243,220,0.82)";
  ctx.font = `500 48px ${FONT}`;
  ctx.fillText(metric.sub, W / 2, 346);

  return makeTexture(c, renderer);
}

/**
 * The lock line's light curtain: a gold wash fading upward, with the words
 * written across it. Shared by every gate; tinted per gate by the material.
 */
export function curtainTexture(renderer) {
  const W = 1024;
  const H = 320;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d");
  const g = ctx.createLinearGradient(0, H, 0, 0);
  g.addColorStop(0, "rgba(255,255,255,0.85)");
  g.addColorStop(0.35, "rgba(255,255,255,0.35)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // A bright floor seam so the line itself reads even edge-on.
  ctx.fillStyle = "rgba(255,255,255,1)";
  ctx.fillRect(0, H - 14, W, 14);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `800 92px ${FONT}`;
  ctx.lineWidth = 12;
  ctx.strokeStyle = "rgba(0,0,0,0.55)";
  ctx.fillStyle = "#ffffff";
  ctx.strokeText("▼ ANSWER LOCKS ▼", W / 2, H * 0.6);
  ctx.fillText("▼ ANSWER LOCKS ▼", W / 2, H * 0.6);
  return makeTexture(c, renderer);
}

/** Hazard stripes for the lock strip painted across the path. */
export function hazardTexture(renderer) {
  const W = 512;
  const H = 64;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#14110a";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#ffd257";
  for (let x = -H; x < W + H; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, H);
    ctx.lineTo(x + 24, H);
    ctx.lineTo(x + 24 + H, 0);
    ctx.lineTo(x + H, 0);
    ctx.fill();
  }
  const tex = makeTexture(c, renderer);
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

/** The value tag that rides on top of a rising column at the reveal. */
export function valueTexture(renderer, text, good) {
  const W = 512;
  const H = 160;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d");
  ctx.fillStyle = good ? "rgba(26,92,58,0.92)" : "rgba(110,28,36,0.92)";
  const r = 34;
  ctx.beginPath();
  ctx.roundRect(6, 6, W - 12, H - 12, r);
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = good ? "#7df0b0" : "#ff9a9a";
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 84px ${FONT}`;
  ctx.fillText(text, W / 2, H / 2 + 4);
  return makeTexture(c, renderer);
}
