import * as THREE from "three";

import { skyLit } from "./shading.js";

/**
 * The steppe itself: the height field, the grass cover, the service track, and
 * the ground mesh those three get painted onto.
 *
 * Three scalar fields are defined here and then read by everybody else —
 * `heightAt` puts the grass, the turbines, the fence posts and the camera on
 * the ground; `coverAt` decides where grass grows; the track cuts the road
 * through it. The ground texture is painted from the *same* fields, so the bald
 * patch in the map is the bald patch the blades were thinned out of, rather
 * than a decorative pattern that happens to be nearby.
 *
 * The mesh is a radial disc rather than a plane. Ring spacing grows
 * geometrically outward — about a metre under the camera, ninety at the rim
 * four kilometres out — which spends the vertices where the eye is and gives a
 * circular horizon that fog can close off cleanly.
 */

const TAU = Math.PI * 2;

/** How far out the painted ground map reaches, in metres. */
const MAP_EXTENT = 460;

export function createField(rng, wind, shared) {
  // ------------------------------------------------------------ height field --

  const relief = rng.range(0.7, 1.1);
  const waves = [];
  for (const [wavelength, amplitude] of [
    [430, 6.2],
    [246, 3.1],
    [131, 1.5],
    [73, 0.68],
    [41, 0.3],
    [22, 0.13],
    [12, 0.055],
  ]) {
    // Two directions per band: a single one per band reads as corduroy.
    for (let i = 0; i < 2; i++) {
      const angle = rng.range(0, TAU);
      const k = TAU / (wavelength * rng.range(0.86, 1.16));
      waves.push({
        kx: Math.cos(angle) * k,
        kz: Math.sin(angle) * k,
        amp: amplitude * relief * rng.range(0.6, 1.0),
        phase: rng.range(0, TAU),
      });
    }
  }

  function heightAt(x, z) {
    let h = 0;
    for (const w of waves) h += w.amp * Math.sin(x * w.kx + z * w.kz + w.phase);
    return h;
  }

  // ------------------------------------------------------------------- track --

  // Defined in its own rotated frame: `along` runs down the road, `across` is
  // the signed distance from a wandering centreline.
  const trackAngle = rng.range(0, TAU);
  const axis = { x: Math.sin(trackAngle), z: Math.cos(trackAngle) };
  const normal = { x: axis.z, z: -axis.x };
  const bendA = { amp: rng.range(16, 30), k: TAU / rng.range(260, 420), phase: rng.range(0, TAU) };
  const bendB = { amp: rng.range(5, 11), k: TAU / rng.range(95, 150), phase: rng.range(0, TAU) };
  // Chosen so the road passes close to the origin whatever the bends do — the
  // camera works a fifty-metre disc around it, and a track that wanders off to
  // one side takes the fence, and the only near-field scale cue, with it.
  const offset =
    -(bendA.amp * Math.sin(bendA.phase) + bendB.amp * Math.sin(bendB.phase)) + rng.range(-9, 9);
  const TRACK_HALF = 2.3;

  function trackWander(along) {
    return (
      offset + bendA.amp * Math.sin(along * bendA.k + bendA.phase) + bendB.amp * Math.sin(along * bendB.k + bendB.phase)
    );
  }

  /** Distance along the road, and signed distance from its centreline. */
  function trackAt(x, z) {
    const along = x * axis.x + z * axis.z;
    const across = x * normal.x + z * normal.z;
    return { along, across: across - trackWander(along) };
  }

  /** World point `across` metres to one side of the centreline. The track frame
   *  is orthonormal, so going back the other way is just the transpose. */
  function trackPoint(along, across) {
    const lateral = trackWander(along) + across;
    return { x: axis.x * along + normal.x * lateral, z: axis.z * along + normal.z * lateral };
  }

  /** 1 on the road, 0 off it, with a soft shoulder. */
  function trackMask(x, z) {
    const { across } = trackAt(x, z);
    return 1 - THREE.MathUtils.smoothstep(Math.abs(across), TRACK_HALF - 0.5, TRACK_HALF + 2.6);
  }

  // ------------------------------------------------------------- grass cover --

  const coverWaves = [];
  for (const [wavelength, amplitude] of [
    // The long band matters as much as the short ones: without it the ground a
    // few hundred metres out has no variation left at all once the fine detail
    // has blurred away, and the far half of the steppe goes flat.
    [265, 0.34],
    [88, 0.4],
    [47, 0.24],
    [24, 0.16],
    [13, 0.1],
  ]) {
    const angle = rng.range(0, TAU);
    const k = TAU / wavelength;
    coverWaves.push({ kx: Math.cos(angle) * k, kz: Math.sin(angle) * k, amp: amplitude, phase: rng.range(0, TAU) });
  }
  const coverBias = rng.range(0.4, 0.58);

  function coverAt(x, z) {
    let c = coverBias;
    for (const w of coverWaves) c += w.amp * Math.sin(x * w.kx + z * w.kz + w.phase);
    return THREE.MathUtils.smoothstep(c, -0.12, 0.92) * (1 - trackMask(x, z) * 0.95);
  }

  // ------------------------------------------------------------- ground maps --

  const dry = new THREE.Color().setHSL(rng.range(0.095, 0.115), 0.44, 0.3);
  const lush = new THREE.Color().setHSL(rng.range(0.15, 0.19), 0.34, 0.17);
  const dirt = new THREE.Color().setHSL(0.09, 0.3, 0.4);
  // The soil between blades is in shade at this hour, not lit sand: keeping the
  // map darker than the grass is what makes a thin sward read as a thick one.
  const farGround = dry.clone().lerp(lush, 0.55);

  const macro = paintGroundMap(rng, { coverAt, trackPoint, dry, lush, dirt, far: farGround });
  const detail = paintDetailMap(rng);

  // ------------------------------------------------------------------- mesh --

  const geometry = buildDisc({ sectors: 180, rings: 96, first: 1.15, growth: 0.056, heightAt, extent: MAP_EXTENT });

  const material = new THREE.MeshLambertMaterial({ map: macro });
  skyLit(material, shared, wind, {
    label: "terrain",
    cloudShadow: 1,
    detail: { map: detail, scale: 0.19, amount: 0.8 },
    fragment: {
      head: "uniform vec3 uFarGround;",
      // The painted map only reaches 460 m. Past that it is faded into the flat
      // colour the map's own border was painted in, so the seam is invisible
      // and clamped UVs never smear a ring of edge pixels out to the horizon.
      color: `
        float beyond = smoothstep(280.0, 430.0, length(vSkyWorld.xz));
        diffuseColor.rgb = mix(diffuseColor.rgb, uFarGround, beyond);
      `,
    },
  });

  const patched = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    patched(shader, renderer);
    shader.uniforms.uFarGround = { value: farGround };
  };

  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;

  const group = new THREE.Group();
  group.add(mesh);

  return {
    group,
    heightAt,
    coverAt,
    trackAt,
    trackPoint,
    trackMask,
    trackHalfWidth: TRACK_HALF,
    detailMap: detail,
    farGround,

    dispose() {
      geometry.dispose();
      material.dispose();
      macro.dispose();
      detail.dispose();
    },
  };
}

/**
 * A radial grid with geometrically growing ring spacing: dense underfoot,
 * coarse at the horizon, one draw call.
 */
function buildDisc({ sectors, rings, first, growth, heightAt, extent }) {
  const scale = first / growth;
  const radii = [];
  for (let i = 1; i <= rings; i++) radii.push(scale * (Math.exp(growth * i) - 1));

  const count = 1 + sectors * rings;
  const positions = new Float32Array(count * 3);
  const uvs = new Float32Array(count * 2);

  const write = (index, x, z) => {
    positions[index * 3] = x;
    positions[index * 3 + 1] = heightAt(x, z);
    positions[index * 3 + 2] = z;
    uvs[index * 2] = x / (2 * extent) + 0.5;
    uvs[index * 2 + 1] = 0.5 - z / (2 * extent);
  };

  write(0, 0, 0);
  for (let i = 0; i < rings; i++) {
    for (let s = 0; s < sectors; s++) {
      const angle = (s / sectors) * TAU;
      write(1 + i * sectors + s, Math.cos(angle) * radii[i], Math.sin(angle) * radii[i]);
    }
  }

  const indices = new Uint32Array(sectors * 3 + sectors * (rings - 1) * 6);
  let head = 0;
  const at = (ring, sector) => 1 + ring * sectors + (sector % sectors);

  for (let s = 0; s < sectors; s++) {
    indices[head++] = 0;
    indices[head++] = at(0, s + 1);
    indices[head++] = at(0, s);
  }

  for (let i = 0; i < rings - 1; i++) {
    for (let s = 0; s < sectors; s++) {
      const a = at(i, s);
      const b = at(i, s + 1);
      const c = at(i + 1, s + 1);
      const d = at(i + 1, s);
      indices[head++] = a;
      indices[head++] = b;
      indices[head++] = c;
      indices[head++] = a;
      indices[head++] = c;
      indices[head++] = d;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * The ground colour map. The cover field is drawn small and scaled up — a
 * bilinear upscale of a 208² grid is a better blur than anything worth
 * hand-rolling — then the road, its ruts and some scratch detail go on top at
 * full resolution.
 *
 * Canvas pixels are sRGB and `THREE.Color` holds linear-sRGB working values, so
 * the grid is encoded on the way out; the shapes drawn afterwards go through
 * `getHexString`, which does the same conversion.
 */
function paintGroundMap(rng, { coverAt, trackPoint, dry, lush, dirt, far }) {
  const SIZE = 1024;
  const GRID = 208;
  const extent = MAP_EXTENT;

  // Texture v runs bottom-up and CanvasTexture flips on upload, so canvas row 0
  // is v = 1 is z = -extent.
  const small = document.createElement("canvas");
  small.width = GRID;
  small.height = GRID;
  const sctx = small.getContext("2d");
  const image = sctx.createImageData(GRID, GRID);
  const tint = new THREE.Color();

  for (let j = 0; j < GRID; j++) {
    const z = ((j + 0.5) / GRID - 0.5) * 2 * extent;
    for (let i = 0; i < GRID; i++) {
      const x = ((i + 0.5) / GRID - 0.5) * 2 * extent;
      tint.copy(dry).lerp(lush, coverAt(x, z) * 0.92);
      const k = (j * GRID + i) * 4;
      image.data[k] = Math.round(255 * linearToSRGB(tint.r));
      image.data[k + 1] = Math.round(255 * linearToSRGB(tint.g));
      image.data[k + 2] = Math.round(255 * linearToSRGB(tint.b));
      image.data[k + 3] = 255;
    }
  }
  sctx.putImageData(image, 0, 0);

  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(small, 0, 0, SIZE, SIZE);

  const toPixel = (x, z) => [(x / (2 * extent) + 0.5) * SIZE, (z / (2 * extent) + 0.5) * SIZE];
  const metre = SIZE / (2 * extent);

  const drawRibbon = (across, width, style, alpha) => {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = style;
    ctx.lineWidth = Math.max(width * metre, 0.8);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    let first = true;
    for (let along = -extent * 2; along <= extent * 2; along += 4) {
      const world = trackPoint(along, across);
      const [px, py] = toPixel(world.x, world.z);
      if (first) {
        ctx.moveTo(px, py);
        first = false;
      } else {
        ctx.lineTo(px, py);
      }
    }
    ctx.stroke();
    ctx.restore();
  };

  drawRibbon(0, 7.4, css(dirt.clone().lerp(dry, 0.4)), 0.5);
  drawRibbon(0, 4.6, css(dirt), 0.88);
  drawRibbon(-1.1, 0.85, css(dirt.clone().multiplyScalar(0.7)), 0.7);
  drawRibbon(1.1, 0.85, css(dirt.clone().multiplyScalar(0.7)), 0.7);
  drawRibbon(0, 1.5, css(dry.clone().lerp(lush, 0.85)), 0.38);

  // Scratch detail, so the bilinear upscale does not read as a soft blur. Kept
  // short on purpose: at 0.9 m a texel, a 20 px stroke is an eighteen-metre
  // scar dragged across the hillside.
  ctx.save();
  ctx.globalAlpha = 0.07;
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 7000; i++) {
    const px = rng() * SIZE;
    const py = rng() * SIZE;
    const angle = rng.range(0, TAU);
    const length = rng.range(1.5, 7);
    ctx.strokeStyle = rng() < 0.5 ? "#000" : "#fff";
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + Math.cos(angle) * length, py + Math.sin(angle) * length);
    ctx.stroke();
  }
  ctx.restore();

  // The border is painted in the far colour the shader fades toward.
  ctx.save();
  ctx.strokeStyle = css(far);
  ctx.lineWidth = 30;
  ctx.strokeRect(15, 15, SIZE - 30, SIZE - 30);
  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/**
 * Fine tiling grain, multiplied over the macro map so close ground has texture.
 * Deliberately *not* tagged sRGB: it is a multiplier, and 0.5 has to survive the
 * trip as 0.5 so that `grain * 2` comes out neutral.
 */
function paintDetailMap(rng) {
  const SIZE = 256;
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#808080";
  ctx.fillRect(0, 0, SIZE, SIZE);

  for (const [count, length, alpha] of [
    [1400, 11, 0.09],
    [2600, 6, 0.11],
    [4200, 2.5, 0.13],
  ]) {
    ctx.globalAlpha = alpha;
    ctx.lineWidth = 1.3;
    for (let i = 0; i < count; i++) {
      const x = rng() * SIZE;
      const y = rng() * SIZE;
      const angle = rng.range(0, TAU);
      const dx = Math.cos(angle) * length;
      const dy = Math.sin(angle) * length;
      ctx.strokeStyle = rng() < 0.5 ? "#000" : "#fff";
      // Drawn five times so strokes that cross an edge come back on the far
      // side and the tile stays seamless.
      for (const [ox, oy] of [
        [0, 0],
        [SIZE, 0],
        [-SIZE, 0],
        [0, SIZE],
        [0, -SIZE],
      ]) {
        ctx.beginPath();
        ctx.moveTo(x + ox, y + oy);
        ctx.lineTo(x + dx + ox, y + dy + oy);
        ctx.stroke();
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  return texture;
}

function linearToSRGB(c) {
  return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

function css(color) {
  return `#${color.getHexString()}`;
}
