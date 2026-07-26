import * as THREE from "three";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";

import { CAVITY, fieldFbm } from "./cavity.js";
import { NOISE3 } from "./glsl.js";

/**
 * The rock the geode is a hole in — an inside-out sphere pushed around by the
 * cavity field, with the triangles over the crack simply deleted.
 *
 * Three things are worth knowing about how it is built:
 *
 *   - `IcosahedronGeometry` is welded with `mergeVertices` before displacement.
 *     Straight out of the constructor it is non-indexed, so `computeVertexNormals`
 *     would hand back one normal per face and the wall would read as folded
 *     paper. UVs are deleted first, otherwise the seam column refuses to weld
 *     (the merge compares every attribute) and leaves a visible crease.
 *   - The opening is cut by dropping index triples, not by CSG. The cavity
 *     field decides membership per triangle, and its noisy threshold is what
 *     makes the lip ragged.
 *   - There are no UVs left, so there is nowhere to put a texture. All the
 *     surface detail is either baked into vertex colours or evaluated in world
 *     space in the fragment shader — see the `onBeforeCompile` at the bottom.
 */

const DETAIL = 32; // 20 × 33² ≈ 21.8k triangles, ~1 unit across the wall

export function createShell(cavity) {
  const geometry = buildGeometry(cavity);

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    metalness: 0,
    roughness: 0.88,
    envMapIntensity: 0.7,
    side: THREE.BackSide,
    // Faceted, not smooth. This wall is lit almost entirely by ambient and by
    // one environment map, neither of which has any direction to it, so smooth
    // normals gave a surface with no shading at all — a grey cloud with mottling
    // painted on. Flat shading gives every triangle its own normal and its own
    // tone, and 22k triangles across the cavity is fine enough to read as broken
    // rock rather than as low-poly. It also costs nothing.
    flatShading: true,
  });

  addRockDetail(material);

  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  // Nothing casts onto the outside of the rock, and leaving it out of the
  // shadow pass is what lets the key light reach in through the crack at all.
  mesh.castShadow = false;

  return {
    object: mesh,

    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}

// ------------------------------------------------------------------ geometry --

function buildGeometry(cavity) {
  let geometry = new THREE.IcosahedronGeometry(1, DETAIL);
  geometry.deleteAttribute("uv");
  geometry.deleteAttribute("normal");

  const welded = mergeVertices(geometry, 1e-4);
  geometry.dispose();
  geometry = welded;

  const position = geometry.attributes.position;
  const count = position.count;

  const colors = new Float32Array(count * 3);
  const crack = new Float32Array(count);

  const dir = new THREE.Vector3();
  const across = new THREE.Vector3();
  const alsoAcross = new THREE.Vector3();
  const tint = new THREE.Color();

  // Damp umber rock with a cold cast where the mineral has bled into it.
  const host = new THREE.Color(0x5d5150);
  const vein = new THREE.Color(0x3b3244);
  const weathered = new THREE.Color(0x9a8a78);

  for (let i = 0; i < count; i++) {
    dir.fromBufferAttribute(position, i);
    const radius = cavity.radiusAt(dir);

    // Break the lattice. A subdivided icosahedron is a very regular mesh, and
    // flat shading turns that regularity into a visible quilt of parallelograms
    // — the eye finds the pattern instantly. Nudging every vertex by a fraction
    // of an edge, across the surface as well as through it, leaves the facets
    // irregular in size and orientation and the quilt disappears. The offsets
    // are hashed from the vertex index, so they are stable for a given cut.
    across.set(-dir.z, 0, dir.x);
    if (across.lengthSq() < 1e-8) across.set(1, 0, 0);
    across.normalize();
    alsoAcross.copy(dir).cross(across);

    const through = (hash01(i, 17) - 0.5) * 0.55;
    const slideA = (hash01(i, 91) - 0.5) * 0.9;
    const slideB = (hash01(i, 233) - 0.5) * 0.9;

    position.setXYZ(
      i,
      dir.x * (radius + through) + across.x * slideA + alsoAcross.x * slideB,
      dir.y * (radius + through) + across.y * slideA + alsoAcross.y * slideB,
      dir.z * (radius + through) + across.z * slideA + alsoAcross.z * slideB,
    );

    crack[i] = cavity.crackAt(dir);

    // Mottling on two scales: broad veining, then a fine speckle so the wall
    // does not go flat where the druse is thin.
    const broad = fieldFbm(dir.x * 2.7, dir.y * 2.7, dir.z * 2.7, 4);
    const fine = fieldFbm(dir.x * 9.0, dir.y * 9.0, dir.z * 9.0, 2);

    tint.copy(host).lerp(vein, smoothstep(0.42, 0.72, broad));
    tint.multiplyScalar(0.74 + 0.5 * fine);

    // The lip of the crack has been rained on for a few million years.
    tint.lerp(weathered, smoothstep(0.05, 0.85, crack[i]) * 0.55);

    // Down in the bowl, below the waterline, light barely reaches.
    const depth = smoothstep(CAVITY.poolY + 4, CAVITY.poolY - 14, dir.y * radius);
    tint.multiplyScalar(1 - 0.55 * depth);

    colors[i * 3 + 0] = tint.r;
    colors[i * 3 + 1] = tint.g;
    colors[i * 3 + 2] = tint.b;
  }

  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  // ------------------------------------------------------------ cut the hole --

  const index = geometry.index.array;
  const kept = [];

  for (let i = 0; i < index.length; i += 3) {
    const a = index[i];
    const b = index[i + 1];
    const c = index[i + 2];

    // A triangle goes only if all three corners are inside the opening, which
    // leaves a fringe of half-lit rock around the lip instead of a clean bite.
    if (crack[a] > 0.5 && crack[b] > 0.5 && crack[c] > 0.5) continue;

    kept.push(a, b, c);
  }

  geometry.setIndex(kept);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  return geometry;
}

// ------------------------------------------------------------------- surface --

/**
 * Rock detail without a texture. With the UVs gone there is no sane place to
 * sample a map from, so the noise is evaluated in world space in the fragment
 * shader instead — which also means it never repeats and never seams.
 *
 * `MeshStandardMaterial` is kept rather than replaced: the wall has to sit in
 * the same PBR lighting as the crystals, and reimplementing that by hand would
 * be a lot of shader for a surface the druse mostly covers.
 */
function addRockDetail(material) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("void main() {", "varying vec3 vRockPos;\n\nvoid main() {")
      .replace(
        "#include <begin_vertex>",
        /* glsl */ `
        #include <begin_vertex>
        vRockPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        `,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace("void main() {", `varying vec3 vRockPos;\n${NOISE3}\n\nvoid main() {`)
      .replace(
        "#include <color_fragment>",
        /* glsl */ `
        #include <color_fragment>
        // Gentler than it was: with the facets doing the work, heavy albedo
        // noise on top only muddies them.
        float broad = gnFbm3(vRockPos * 0.2);
        float pits = gnFbm3(vRockPos * 1.4);
        diffuseColor.rgb *= 0.86 + 0.26 * broad;
        diffuseColor.rgb *= 0.82 + 0.34 * pits;
        `,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        /* glsl */ `
        #include <roughnessmap_fragment>
        // Damp patches read glossier than dry rock.
        roughnessFactor = clamp(
          roughnessFactor * (0.7 + 0.52 * gnFbm3(vRockPos * 0.85)),
          0.28,
          1.0
        );
        `,
      );
  };
}

function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Deterministic 0..1 from a vertex index and a salt. */
function hash01(index, salt) {
  let h = Math.imul(index ^ salt, 2654435761);
  h = Math.imul(h ^ (h >>> 15), 2246822519);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}
