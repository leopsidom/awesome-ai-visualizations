import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { createClayMaterial, createGlossMaterial, createMetalMaterial } from "./materials.js";

function createScreenTexture(tracker, accentColor, mode = "tablet") {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 192;
  const ctx = c.getContext("2d");

  ctx.fillStyle = "#0b1220";
  ctx.fillRect(0, 0, 256, 192);

  // Header bar
  ctx.fillStyle = "#162238";
  ctx.fillRect(0, 0, 256, 28);
  ctx.fillStyle = accentColor;
  ctx.beginPath();
  ctx.arc(18, 14, 5, 0, Math.PI * 2);
  ctx.fill();

  if (mode === "laptop") {
    // Mini code / metrics lines + glowing bar chart
    const widths = [110, 82, 130, 68, 118, 92];
    for (let i = 0; i < widths.length; i++) {
      ctx.fillStyle = i % 2 === 0 ? accentColor : "#64748b";
      ctx.fillRect(18, 44 + i * 20, widths[i], 8);
    }
    const bars = [48, 76, 62, 108, 94];
    for (let i = 0; i < bars.length; i++) {
      ctx.fillStyle = i === 3 ? "#76b900" : "#38bdf8";
      ctx.fillRect(162 + i * 16, 168 - bars[i], 10, bars[i]);
    }
  } else {
    // Mini analytics dashboard (rising bars + trend line)
    const bars = [42, 68, 56, 95, 84, 118];
    for (let i = 0; i < bars.length; i++) {
      ctx.fillStyle = i >= 4 ? accentColor : "#38bdf8";
      ctx.fillRect(24 + i * 35, 166 - bars[i], 22, bars[i]);
    }
    ctx.strokeStyle = "#f2c15a";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(35, 116);
    ctx.lineTo(70, 92);
    ctx.lineTo(105, 104);
    ctx.lineTo(140, 66);
    ctx.lineTo(175, 76);
    ctx.lineTo(210, 44);
    ctx.stroke();
  }

  const tex = tracker.keep(new THREE.CanvasTexture(c));
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Handheld props attached to a character's handSocket:
 * "none" | "tablet" | "pointer" | "coffee" | "laptop".
 */
export function buildProp(tracker, propName = "none", accentColor = "#38e8d4") {
  if (!propName || propName === "none") return null;

  const group = new THREE.Group();
  group.name = `prop-${propName}`;

  if (propName === "tablet") {
    const bodyMat = createGlossMaterial(tracker, "#1e2533", { roughness: 0.22 });
    const screenTex = createScreenTexture(tracker, accentColor, "tablet");
    const screenMat = tracker.keep(new THREE.MeshBasicMaterial({ map: screenTex }));

    const slate = new THREE.Mesh(
      tracker.keep(new RoundedBoxGeometry(0.22, 0.165, 0.016, 3, 0.008)),
      bodyMat,
    );
    group.add(slate);

    const screen = new THREE.Mesh(tracker.keep(new THREE.PlaneGeometry(0.195, 0.14)), screenMat);
    screen.position.z = 0.009;
    group.add(screen);

    group.position.set(0.02, -0.02, 0.09);
    group.rotation.set(-0.65, -0.35, 0.15);
    return group;
  }

  if (propName === "pointer") {
    const bodyMat = createMetalMaterial(tracker, "#2a3140", { roughness: 0.28, metalness: 0.78 });
    const tipColor = new THREE.Color(accentColor || "#38e8d4");
    const tipMat = tracker.keep(
      new THREE.MeshStandardMaterial({
        color: tipColor,
        emissive: tipColor,
        emissiveIntensity: 2.0,
        toneMapped: false,
      }),
    );

    const wand = new THREE.Mesh(
      tracker.keep(new THREE.CylinderGeometry(0.012, 0.016, 0.34, 12)),
      bodyMat,
    );
    wand.rotation.x = Math.PI / 2;
    wand.position.z = 0.14;
    group.add(wand);

    const tip = new THREE.Mesh(tracker.keep(new THREE.SphereGeometry(0.016, 12, 10)), tipMat);
    tip.position.z = 0.315;
    group.add(tip);

    // Subtle short glowing laser ray segment
    const beam = new THREE.Mesh(
      tracker.keep(new THREE.CylinderGeometry(0.003, 0.003, 0.22, 8)),
      tracker.keep(
        new THREE.MeshBasicMaterial({
          color: tipColor,
          transparent: true,
          opacity: 0.42,
        }),
      ),
    );
    beam.rotation.x = Math.PI / 2;
    beam.position.z = 0.43;
    group.add(beam);

    group.position.set(0, -0.01, 0.02);
    return group;
  }

  if (propName === "coffee") {
    const cupMat = createClayMaterial(tracker, "#f6f2eb", { roughness: 0.55 });
    const sleeveMat = createClayMaterial(tracker, "#c99563", { roughness: 0.78 });
    const lidMat = createClayMaterial(tracker, "#222630", { roughness: 0.38 });

    const cup = new THREE.Mesh(
      tracker.keep(new THREE.CylinderGeometry(0.044, 0.032, 0.13, 18)),
      cupMat,
    );
    group.add(cup);

    const sleeve = new THREE.Mesh(
      tracker.keep(new THREE.CylinderGeometry(0.042, 0.036, 0.056, 18)),
      sleeveMat,
    );
    sleeve.position.y = -0.002;
    group.add(sleeve);

    const lidRim = new THREE.Mesh(
      tracker.keep(new THREE.CylinderGeometry(0.048, 0.048, 0.016, 18)),
      lidMat,
    );
    lidRim.position.y = 0.068;
    group.add(lidRim);

    const lidTop = new THREE.Mesh(
      tracker.keep(new THREE.CylinderGeometry(0.042, 0.046, 0.018, 18)),
      lidMat,
    );
    lidTop.position.y = 0.082;
    group.add(lidTop);

    group.position.set(0, 0.02, 0.045);
    group.rotation.x = 0.2;
    return group;
  }

  if (propName === "laptop") {
    const aluMat = createMetalMaterial(tracker, "#cbd5e1", { roughness: 0.28, metalness: 0.75 });
    const keyMat = createClayMaterial(tracker, "#1e2430", { roughness: 0.65 });
    const screenTex = createScreenTexture(tracker, accentColor, "laptop");
    const screenMat = tracker.keep(new THREE.MeshBasicMaterial({ map: screenTex }));

    const base = new THREE.Mesh(
      tracker.keep(new RoundedBoxGeometry(0.24, 0.014, 0.17, 2, 0.005)),
      aluMat,
    );
    group.add(base);

    const keys = new THREE.Mesh(tracker.keep(new THREE.BoxGeometry(0.2, 0.004, 0.11)), keyMat);
    keys.position.set(0, 0.008, -0.01);
    group.add(keys);

    const lidPivot = new THREE.Group();
    lidPivot.position.set(0, 0.007, -0.082);
    lidPivot.rotation.x = -1.92;
    group.add(lidPivot);

    const lid = new THREE.Mesh(
      tracker.keep(new RoundedBoxGeometry(0.24, 0.012, 0.165, 2, 0.005)),
      aluMat,
    );
    lid.position.set(0, 0, 0.082);
    lidPivot.add(lid);

    const screen = new THREE.Mesh(tracker.keep(new THREE.PlaneGeometry(0.215, 0.14)), screenMat);
    screen.rotation.x = Math.PI / 2;
    screen.position.set(0, 0.007, 0.082);
    lidPivot.add(screen);

    group.position.set(0.04, 0.01, 0.1);
    group.rotation.set(0.15, -0.45, 0.12);
    return group;
  }

  return null;
}
