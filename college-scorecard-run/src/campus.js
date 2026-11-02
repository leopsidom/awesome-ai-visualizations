import * as THREE from "three";

/**
 * The quad at dusk: a sky dome, a lawn and a brick walk that travel with the
 * runner (their textures counter-scroll so the ground reads as fixed), and a
 * ring of scenery segments — lamps, trees, brick halls — that leapfrog to the
 * front once they fall behind the camera. Nothing is created after start-up,
 * so a long run allocates nothing.
 */

export const PATH_WIDTH = 11;
export const SEGMENT = 48;
const SEGMENTS = 7;

const SKY_VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SKY_FRAG = /* glsl */ `
  varying vec3 vDir;
  uniform vec3 uTop;
  uniform vec3 uMid;
  uniform vec3 uHorizon;
  void main() {
    float h = clamp(vDir.y, -0.2, 1.0);
    vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.18, h));
    col = mix(col, uTop, smoothstep(0.15, 0.7, h));
    // A warm glow low in the west, where the sun has just gone.
    float glow = pow(max(dot(vDir, normalize(vec3(-0.35, 0.05, -1.0))), 0.0), 8.0);
    col += vec3(1.0, 0.55, 0.25) * glow * 0.35;
    gl_FragColor = vec4(col, 1.0);
  }
`;

function canvasTexture(renderer, w, h, draw, repeat) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d"), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  if (repeat) tex.repeat.set(repeat[0], repeat[1]);
  return tex;
}

function grassTexture(renderer, rng) {
  return canvasTexture(
    renderer,
    256,
    256,
    (ctx, w, h) => {
      ctx.fillStyle = "#2f4a2a";
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 2600; i++) {
        const l = 22 + rng() * 16;
        ctx.fillStyle = `hsl(${95 + rng() * 25}, ${30 + rng() * 15}%, ${l}%)`;
        ctx.fillRect(rng() * w, rng() * h, 1 + rng() * 2, 2 + rng() * 4);
      }
    },
    [60, 60],
  );
}

/** Running-bond brick, with two dashed lane guides baked in. */
function pathTexture(renderer, rng) {
  return canvasTexture(
    renderer,
    512,
    512,
    (ctx, w, h) => {
      ctx.fillStyle = "#5b3a2e";
      ctx.fillRect(0, 0, w, h);
      const bw = 64;
      const bh = 32;
      for (let row = 0; row < h / bh; row++) {
        const off = row % 2 ? bw / 2 : 0;
        for (let x = -bw; x < w + bw; x += bw) {
          const l = 30 + rng() * 10;
          ctx.fillStyle = `hsl(${12 + rng() * 8}, ${35 + rng() * 15}%, ${l}%)`;
          ctx.fillRect(x + off + 2, row * bh + 2, bw - 4, bh - 4);
        }
      }
      // The centre line between the two lanes: pale stone setts.
      ctx.fillStyle = "rgba(230,214,180,0.85)";
      for (let y = 0; y < h; y += 64) ctx.fillRect(w / 2 - 6, y + 8, 12, 40);
      // Edging.
      ctx.fillStyle = "#cdbb94";
      ctx.fillRect(0, 0, 14, h);
      ctx.fillRect(w - 14, 0, 14, h);
    },
    [1, 6],
  );
}

/** A brick façade, with a deterministic scatter of lit windows. */
function facadeTexture(renderer, rng) {
  return canvasTexture(renderer, 512, 512, (ctx, w, h) => {
    ctx.fillStyle = "#6e3b2c";
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 1800; i++) {
      ctx.fillStyle = `rgba(${40 + rng() * 60},${15 + rng() * 20},${10},0.25)`;
      ctx.fillRect(rng() * w, rng() * h, 10, 4);
    }
    const cols = 6;
    const rows = 4;
    for (let r = 0; r < rows; r++) {
      for (let col = 0; col < cols; col++) {
        const x = 26 + col * (w - 40) / cols;
        const y = 40 + r * (h - 60) / rows;
        const lit = rng() < 0.45;
        ctx.fillStyle = "#d9cfb8";
        ctx.fillRect(x - 4, y - 4, 52, 84);
        ctx.fillStyle = lit ? `hsl(${38 + rng() * 10}, 90%, ${60 + rng() * 15}%)` : "#1b2236";
        ctx.fillRect(x, y, 44, 76);
        ctx.fillStyle = "#d9cfb8";
        ctx.fillRect(x + 20, y, 4, 76);
        ctx.fillRect(x, y + 36, 44, 4);
      }
    }
  });
}

export function createCampus(scene, renderer, rng) {
  const disposables = [];
  const keep = (x) => (disposables.push(x), x);
  const root = new THREE.Group();
  scene.add(root);

  // ------------------------------------------------------------ sky + fog --
  const fogColor = new THREE.Color("#2a2f4f");
  scene.fog = new THREE.Fog(fogColor, 70, 230);

  const sky = new THREE.Mesh(
    keep(new THREE.SphereGeometry(400, 32, 16)),
    keep(
      new THREE.ShaderMaterial({
        vertexShader: SKY_VERT,
        fragmentShader: SKY_FRAG,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          uTop: { value: new THREE.Color("#0b1030") },
          uMid: { value: new THREE.Color("#3a3566") },
          uHorizon: { value: new THREE.Color("#c9756a") },
        },
      }),
    ),
  );
  sky.renderOrder = -1;
  root.add(sky);

  const starCount = 900;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const t = rng() * Math.PI * 2;
    const p = Math.acos(rng() * 0.85);
    starPos.set([Math.sin(p) * Math.cos(t) * 380, Math.cos(p) * 380, Math.sin(p) * Math.sin(t) * 380], i * 3);
  }
  const starGeo = keep(new THREE.BufferGeometry());
  starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
  const stars = new THREE.Points(
    starGeo,
    keep(new THREE.PointsMaterial({ color: 0xdfe7ff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.8 })),
  );
  root.add(stars);

  // --------------------------------------------------------------- lights --
  const hemi = new THREE.HemisphereLight(0x8fa0d8, 0x2b2a1c, 1.25);
  root.add(hemi);

  const moon = new THREE.DirectionalLight(0xffd7b0, 1.6);
  moon.position.set(-30, 40, -20);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  const sc = moon.shadow.camera;
  sc.left = -40;
  sc.right = 40;
  sc.top = 40;
  sc.bottom = -40;
  sc.near = 1;
  sc.far = 140;
  moon.shadow.bias = -0.0008;
  root.add(moon);
  root.add(moon.target);

  // --------------------------------------------------------------- ground --
  const grassTex = keep(grassTexture(renderer, rng));
  const ground = new THREE.Mesh(
    keep(new THREE.PlaneGeometry(600, 600)),
    keep(new THREE.MeshLambertMaterial({ map: grassTex })),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  root.add(ground);

  const pathTex = keep(pathTexture(renderer, rng));
  const PATH_LEN = 600;
  pathTex.repeat.set(1, PATH_LEN / 12);
  const path = new THREE.Mesh(
    keep(new THREE.PlaneGeometry(PATH_WIDTH, PATH_LEN)),
    keep(new THREE.MeshLambertMaterial({ map: pathTex })),
  );
  path.rotation.x = -Math.PI / 2;
  path.position.y = 0.02;
  path.receiveShadow = true;
  root.add(path);

  // ---------------------------------------------------- scenery segments --
  const postGeo = keep(new THREE.CylinderGeometry(0.09, 0.13, 4.2, 8));
  postGeo.translate(0, 2.1, 0);
  const globeGeo = keep(new THREE.SphereGeometry(0.32, 16, 12));
  const ironMat = keep(new THREE.MeshStandardMaterial({ color: 0x1d1f26, metalness: 0.6, roughness: 0.5 }));
  const globeMat = keep(new THREE.MeshBasicMaterial({ color: 0xffd99a }));
  const haloTex = keep(
    canvasTexture(renderer, 128, 128, (ctx, w) => {
      const g = ctx.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
      g.addColorStop(0, "rgba(255,214,150,0.9)");
      g.addColorStop(0.3, "rgba(255,190,120,0.25)");
      g.addColorStop(1, "rgba(255,190,120,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, w);
    }),
  );
  const haloMat = keep(new THREE.SpriteMaterial({ map: haloTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));

  const trunkGeo = keep(new THREE.CylinderGeometry(0.18, 0.28, 2.4, 7));
  trunkGeo.translate(0, 1.2, 0);
  const crownGeo = keep(new THREE.IcosahedronGeometry(1.9, 1));
  const trunkMat = keep(new THREE.MeshLambertMaterial({ color: 0x3b2a1e }));
  const crownMats = ["#2e5a35", "#3f6b33", "#4f6e2c", "#6d6a2a"].map((c) =>
    keep(new THREE.MeshLambertMaterial({ color: c, flatShading: true })),
  );

  const facadeTex = keep(facadeTexture(renderer, rng));
  const hallMat = keep(new THREE.MeshLambertMaterial({ map: facadeTex }));
  const roofMat = keep(new THREE.MeshLambertMaterial({ color: 0x3a4250, flatShading: true }));
  const stoneMat = keep(new THREE.MeshLambertMaterial({ color: 0xcdbb94 }));
  const boxGeo = keep(new THREE.BoxGeometry(1, 1, 1));
  const roofGeo = keep(new THREE.ConeGeometry(0.75, 1, 4, 1));
  roofGeo.rotateY(Math.PI / 4);
  const clockGeo = keep(new THREE.CircleGeometry(0.9, 32));
  const clockMat = keep(new THREE.MeshBasicMaterial({ color: 0xf6e7c0 }));

  const segments = [];
  for (let s = 0; s < SEGMENTS; s++) {
    const seg = new THREE.Group();
    seg.position.z = -s * SEGMENT;

    for (const side of [-1, 1]) {
      // Lamps, two per side per segment.
      for (const dz of [0, -SEGMENT / 2]) {
        const post = new THREE.Mesh(postGeo, ironMat);
        // Set back past the gates' data columns (which reach x ≈ ±7.1).
        post.position.set(side * (PATH_WIDTH / 2 + 2.6), 0, dz);
        post.castShadow = true;
        seg.add(post);
        const globe = new THREE.Mesh(globeGeo, globeMat);
        globe.position.set(post.position.x, 4.4, dz);
        seg.add(globe);
        const halo = new THREE.Sprite(haloMat);
        halo.position.copy(globe.position);
        halo.scale.setScalar(3.2);
        seg.add(halo);
      }

      // Trees in a loose avenue.
      for (let t = 0; t < 3; t++) {
        const x = side * (PATH_WIDTH / 2 + 4 + rng() * 6);
        const z = -rng() * SEGMENT;
        const s2 = 0.8 + rng() * 0.6;
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.set(x, 0, z);
        trunk.scale.setScalar(s2);
        trunk.castShadow = true;
        const crown = new THREE.Mesh(crownGeo, rng.pick(crownMats));
        crown.position.set(x, 3.2 * s2, z);
        crown.scale.set(s2, s2 * (0.9 + rng() * 0.4), s2);
        crown.rotation.y = rng() * 6;
        crown.castShadow = true;
        seg.add(trunk, crown);
      }

      // A brick hall set back from the walk; one segment in three gets a tower.
      const hw = 14 + rng() * 10;
      const hh = 7 + rng() * 6;
      const hd = 10 + rng() * 4;
      const hx = side * (PATH_WIDTH / 2 + 18 + hd / 2 + rng() * 6);
      const hz = -SEGMENT / 2 + (rng() - 0.5) * 10;
      const hall = new THREE.Mesh(boxGeo, hallMat);
      hall.scale.set(hd, hh, hw);
      hall.position.set(hx, hh / 2, hz);
      hall.castShadow = hall.receiveShadow = true;
      seg.add(hall);
      const roof = new THREE.Mesh(roofGeo, roofMat);
      roof.scale.set(hd * 1.05, 3.5, hw * 1.05);
      roof.position.set(hx, hh + 1.75, hz);
      seg.add(roof);
      const plinth = new THREE.Mesh(boxGeo, stoneMat);
      plinth.scale.set(hd + 0.6, 0.8, hw + 0.6);
      plinth.position.set(hx, 0.4, hz);
      seg.add(plinth);

      if (s % 3 === 1 && side === 1) {
        const th = hh + 12;
        const tower = new THREE.Mesh(boxGeo, hallMat);
        tower.scale.set(4, th, 4);
        tower.position.set(hx - side * (hd / 2 - 1), th / 2, hz + hw / 2 - 2);
        tower.castShadow = true;
        seg.add(tower);
        const spire = new THREE.Mesh(roofGeo, roofMat);
        spire.scale.set(4.6, 6, 4.6);
        spire.position.set(tower.position.x, th + 3, tower.position.z);
        seg.add(spire);
        const face = new THREE.Mesh(clockGeo, clockMat);
        face.position.set(tower.position.x - 2.02, th - 2, tower.position.z);
        face.rotation.y = -Math.PI / 2;
        seg.add(face);
      }
    }

    root.add(seg);
    segments.push(seg);
  }

  return {
    /** Keep the world centred on the runner; z decreases as they run. */
    update(runnerZ) {
      sky.position.z = runnerZ;
      stars.position.z = runnerZ;
      // A plane laid flat maps texture v to world −z, so to pin the pattern
      // to the world the offset runs opposite the plane: −z · repeat / size.
      ground.position.z = runnerZ - 150;
      grassTex.offset.y = -(runnerZ - 150) / 10;
      path.position.z = runnerZ - 150;
      pathTex.offset.y = -(runnerZ - 150) / 12;

      moon.position.set(-30, 40, runnerZ - 20);
      moon.target.position.set(0, 0, runnerZ - 20);

      for (const seg of segments) {
        if (seg.position.z > runnerZ + SEGMENT) seg.position.z -= SEGMENT * SEGMENTS;
      }
    },

    dispose() {
      scene.remove(root);
      scene.fog = null;
      for (const d of disposables) d.dispose();
    },
  };
}
