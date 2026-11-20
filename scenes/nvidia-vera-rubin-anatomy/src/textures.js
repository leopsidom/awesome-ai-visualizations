// High-resolution procedural PBR Canvas textures for realistic silicon, HBM4,
// SOCAMM memory cards, brushed nickel IHS, copper cold plates, and server PCBs.
import * as THREE from 'three';

function finalizeTex(canvas, maxAniso, repeatX = 1, repeatY = 1, srgb = true) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = Math.min(16, maxAniso || 8);
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  if (repeatX !== 1 || repeatY !== 1) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
  }
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createProceduralTextures(maxAniso = 8) {
  // 1. Studio Backdrop
  const bgC = document.createElement('canvas');
  bgC.width = 1024; bgC.height = 1024;
  const bgCtx = bgC.getContext('2d');
  bgCtx.fillStyle = '#050907';
  bgCtx.fillRect(0, 0, 1024, 1024);
  const g1 = bgCtx.createRadialGradient(512, 620, 40, 512, 620, 520);
  g1.addColorStop(0.0, 'rgba(118, 185, 0, 0.22)');
  g1.addColorStop(0.45, 'rgba(42, 90, 14, 0.08)');
  g1.addColorStop(1.0, 'rgba(5, 9, 7, 0.0)');
  bgCtx.fillStyle = g1; bgCtx.fillRect(0, 0, 1024, 1024);
  const g2 = bgCtx.createRadialGradient(512, 170, 20, 512, 170, 420);
  g2.addColorStop(0.0, 'rgba(34, 211, 238, 0.08)');
  g2.addColorStop(1.0, 'rgba(5, 9, 7, 0.0)');
  bgCtx.fillStyle = g2; bgCtx.fillRect(0, 0, 1024, 1024);
  const studioBackdrop = finalizeTex(bgC, 1);

  // 2. Photorealistic TSMC 3nm Silicon Die Floorplan (SM Arrays, L2 Cache Spine, Bus Bars)
  const dieC = document.createElement('canvas');
  dieC.width = 512; dieC.height = 768;
  const dCtx = dieC.getContext('2d');
  const dieGrad = dCtx.createLinearGradient(0, 0, 512, 768);
  dieGrad.addColorStop(0, '#0f1f24');
  dieGrad.addColorStop(0.35, '#19352b');
  dieGrad.addColorStop(0.65, '#132630');
  dieGrad.addColorStop(1, '#1d3822');
  dCtx.fillStyle = dieGrad;
  dCtx.fillRect(0, 0, 512, 768);

  // Outer seal ring
  dCtx.strokeStyle = 'rgba(168, 224, 58, 0.55)';
  dCtx.lineWidth = 6;
  dCtx.strokeRect(10, 10, 492, 748);

  // Central L2 Cache & NoC Spine
  dCtx.fillStyle = 'rgba(20, 45, 58, 0.85)';
  dCtx.fillRect(222, 24, 68, 720);
  dCtx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
  dCtx.lineWidth = 2;
  for (let y = 32; y < 740; y += 18) {
    dCtx.strokeRect(228, y, 56, 12);
  }

  // Left & Right GPC / SM Tensor Core Lithography Blocks (8 rows x 4 cols per side)
  const blockColors = ['#183c28', '#15343f', '#1f4425', '#132d3b', '#224c28'];
  for (let side = 0; side < 2; side++) {
    const startX = side === 0 ? 28 : 302;
    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 4; col++) {
        const bx = startX + col * 46;
        const by = 28 + row * 71;
        dCtx.fillStyle = blockColors[(row * 3 + col + side) % blockColors.length];
        dCtx.fillRect(bx, by, 40, 62);

        // Micro-lithography sub-cell stripes (iridescent silicon sheen)
        dCtx.strokeStyle = (row + col) % 2 === 0 ? 'rgba(118, 185, 0, 0.34)' : 'rgba(34, 211, 238, 0.30)';
        dCtx.lineWidth = 1;
        for (let sy = by + 5; sy < by + 58; sy += 6) {
          dCtx.beginPath(); dCtx.moveTo(bx + 3, sy); dCtx.lineTo(bx + 37, sy); dCtx.stroke();
        }
        // Subtle metallic SRAM corner
        dCtx.fillStyle = 'rgba(212, 255, 102, 0.16)';
        dCtx.fillRect(bx + 3, by + 3, 14, 14);
      }
    }
  }
  // HBM4 PHY strips along outer left/right edges
  dCtx.fillStyle = 'rgba(34, 211, 238, 0.32)';
  dCtx.fillRect(14, 48, 10, 672);
  dCtx.fillRect(488, 48, 10, 672);
  const siliconDie = finalizeTex(dieC, maxAniso);

  // 3. 12-Hi Laminated HBM4 Side Texture (12 distinct stacked DRAM dies + thick base logic die!)
  const hbmSideC = document.createElement('canvas');
  hbmSideC.width = 256; hbmSideC.height = 256;
  const hsCtx = hbmSideC.getContext('2d');
  hsCtx.fillStyle = '#0c1821';
  hsCtx.fillRect(0, 0, 256, 256);

  // Bottom 20% = Base Logic Die (copper/gold TSV pads + slightly darker silicon)
  hsCtx.fillStyle = '#182b3a';
  hsCtx.fillRect(0, 206, 256, 50);
  hsCtx.fillStyle = '#d9a441';
  for (let x = 8; x < 252; x += 12) {
    hsCtx.fillRect(x, 244, 6, 10);
  }
  hsCtx.fillStyle = 'rgba(56, 189, 248, 0.55)';
  hsCtx.fillRect(0, 204, 256, 3);

  // Top 80% = 12 distinct ultra-thin DRAM layers separated by micro-bump bond gaps
  const layerH = 200 / 12;
  for (let i = 0; i < 12; i++) {
    const ly = 4 + i * layerH;
    // Silicon layer body
    const g = hsCtx.createLinearGradient(0, ly, 256, ly);
    g.addColorStop(0, '#133548');
    g.addColorStop(0.5, '#1e5874');
    g.addColorStop(1, '#123142');
    hsCtx.fillStyle = g;
    hsCtx.fillRect(0, ly + 1.5, 256, layerH - 3.5);
    // Bright cyan/silver micro-bump bond line between stacked dies
    hsCtx.fillStyle = 'rgba(34, 211, 238, 0.72)';
    hsCtx.fillRect(0, ly + layerH - 2, 256, 1.8);
    // Tiny vertical TSV micro-bumps
    hsCtx.fillStyle = 'rgba(212, 240, 255, 0.45)';
    for (let x = 10; x < 248; x += 18) {
      hsCtx.fillRect(x, ly + layerH - 3, 4, 2.5);
    }
  }
  const hbm4Side = finalizeTex(hbmSideC, maxAniso);

  // HBM4 Top Cap Texture (brushed dark silicon with subtle laser serial marking)
  const hbmTopC = document.createElement('canvas');
  hbmTopC.width = 256; hbmTopC.height = 256;
  const htCtx = hbmTopC.getContext('2d');
  htCtx.fillStyle = '#152c38';
  htCtx.fillRect(0, 0, 256, 256);
  htCtx.strokeStyle = 'rgba(34, 211, 238, 0.55)';
  htCtx.lineWidth = 6;
  htCtx.strokeRect(10, 10, 236, 236);
  htCtx.fillStyle = 'rgba(186, 230, 253, 0.65)';
  htCtx.font = 'bold 34px -apple-system, sans-serif';
  htCtx.textAlign = 'center';
  htCtx.fillText('HBM4', 128, 122);
  htCtx.font = '600 22px -apple-system, sans-serif';
  htCtx.fillStyle = 'rgba(34, 211, 238, 0.78)';
  htCtx.fillText('12-Hi · 36GB', 128, 158);
  const hbm4Top = finalizeTex(hbmTopC, maxAniso);

  // 4. Organic ABF Package Substrate Texture (radial copper fan-out traces + gold fiducials)
  const subC = document.createElement('canvas');
  subC.width = 512; subC.height = 512;
  const sCtx = subC.getContext('2d');
  sCtx.fillStyle = '#072415';
  sCtx.fillRect(0, 0, 512, 512);
  sCtx.strokeStyle = 'rgba(92, 168, 50, 0.30)';
  sCtx.lineWidth = 1.5;
  for (let i = 16; i < 496; i += 14) {
    sCtx.beginPath(); sCtx.moveTo(16, i); sCtx.lineTo(496, i); sCtx.stroke();
    sCtx.beginPath(); sCtx.moveTo(i, 16); sCtx.lineTo(i, 496); sCtx.stroke();
  }
  // Copper fan-out bus traces around perimeter
  sCtx.strokeStyle = 'rgba(212, 175, 55, 0.42)';
  sCtx.lineWidth = 2;
  sCtx.strokeRect(18, 18, 476, 476);
  sCtx.strokeRect(30, 30, 452, 452);
  // Pin-1 gold corner triangle
  sCtx.fillStyle = '#e6b84c';
  sCtx.beginPath(); sCtx.moveTo(20, 20); sCtx.lineTo(54, 20); sCtx.lineTo(20, 54); sCtx.closePath(); sCtx.fill();
  const substrate = finalizeTex(subC, maxAniso);

  // 5. CoWoS-L Silicon Interposer Texture (RDL metallic routing + micro-bump pads)
  const intC = document.createElement('canvas');
  intC.width = 512; intC.height = 512;
  const iCtx = intC.getContext('2d');
  iCtx.fillStyle = '#1b2730';
  iCtx.fillRect(0, 0, 512, 512);
  iCtx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
  iCtx.lineWidth = 1.2;
  for (let i = 12; i < 500; i += 10) {
    iCtx.beginPath(); iCtx.moveTo(0, i); iCtx.lineTo(512, i); iCtx.stroke();
  }
  // Highlight embedded LSI silicon bridge channel down center
  iCtx.fillStyle = 'rgba(118, 185, 0, 0.22)';
  iCtx.fillRect(236, 44, 40, 424);
  // Gold micro-bump pads under HBM4 left/right sites
  iCtx.fillStyle = 'rgba(217, 170, 65, 0.35)';
  for (let y = 52; y < 460; y += 16) {
    for (let x = 24; x < 92; x += 12) iCtx.fillRect(x, y, 5, 5);
    for (let x = 420; x < 488; x += 12) iCtx.fillRect(x, y, 5, 5);
  }
  const interposer = finalizeTex(intC, maxAniso);

  // 6. Brushed Nickel-Plated Copper IHS for NVIDIA Vera 88-Core CPU
  const ihsC = document.createElement('canvas');
  ihsC.width = 512; ihsC.height = 512;
  const vCtx = ihsC.getContext('2d');
  const vGrad = vCtx.createLinearGradient(0, 0, 512, 512);
  vGrad.addColorStop(0, '#8a9ba8');
  vGrad.addColorStop(0.5, '#b6c5cf');
  vGrad.addColorStop(1, '#798b96');
  vCtx.fillStyle = vGrad;
  vCtx.fillRect(0, 0, 512, 512);
  // Subtle brushed metal horizontal grain
  vCtx.strokeStyle = 'rgba(255,255,255,0.08)';
  for (let y = 0; y < 512; y += 3) {
    vCtx.beginPath(); vCtx.moveTo(0, y); vCtx.lineTo(512, y); vCtx.stroke();
  }
  // Recessed inner border
  vCtx.strokeStyle = 'rgba(20, 34, 26, 0.45)';
  vCtx.lineWidth = 8;
  vCtx.strokeRect(24, 24, 464, 464);
  // Laser-etched typography
  vCtx.fillStyle = '#18241e';
  vCtx.font = '800 44px -apple-system, sans-serif';
  vCtx.textAlign = 'center';
  vCtx.fillText('NVIDIA', 256, 198);
  vCtx.font = '800 66px -apple-system, sans-serif';
  vCtx.fillStyle = '#1c3b08';
  vCtx.fillText('VERA', 256, 278);
  vCtx.font = '700 28px -apple-system, sans-serif';
  vCtx.fillStyle = '#24352c';
  vCtx.fillText('88-CORE ARM · 176T', 256, 336);
  vCtx.font = '600 22px -apple-system, sans-serif';
  vCtx.fillStyle = '#33483d';
  vCtx.fillText('NVLINK-C2C · SOCAMM', 256, 378);
  const veraIhs = finalizeTex(ihsC, maxAniso);

  // 7. SOCAMM Compression-Attached Memory Card PCB Texture (gold fingers + traces + silkscreen)
  const socC = document.createElement('canvas');
  socC.width = 512; socC.height = 256;
  const scCtx = socC.getContext('2d');
  scCtx.fillStyle = '#082c1c';
  scCtx.fillRect(0, 0, 512, 256);
  scCtx.strokeStyle = 'rgba(56, 189, 248, 0.30)';
  scCtx.lineWidth = 1.5;
  for (let x = 18; x < 494; x += 12) {
    scCtx.beginPath(); scCtx.moveTo(x, 22); scCtx.lineTo(x, 224); scCtx.stroke();
  }
  // Gold compression contact fingers along bottom edge
  scCtx.fillStyle = '#e8b948';
  for (let x = 22; x < 490; x += 10) {
    scCtx.fillRect(x, 232, 6, 22);
  }
  // Silkscreen label
  scCtx.fillStyle = 'rgba(226, 248, 240, 0.72)';
  scCtx.font = 'bold 20px -apple-system, sans-serif';
  scCtx.fillText('SOCAMM · LPDDR5X · 384GB', 28, 30);
  const socammPcb = finalizeTex(socC, maxAniso);

  // 8. Copper Micro-Channel Cold Plate Texture (skived parallel cooling channels)
  const cpC = document.createElement('canvas');
  cpC.width = 512; cpC.height = 512;
  const cpCtx = cpC.getContext('2d');
  cpCtx.fillStyle = '#a85f30';
  cpCtx.fillRect(0, 0, 512, 512);
  // Micro-channel skived fins
  for (let x = 24; x < 488; x += 8) {
    cpCtx.fillStyle = (x % 16 === 0) ? '#d68952' : '#733b18';
    cpCtx.fillRect(x, 42, 4, 428);
  }
  // Outer nickel-plated sealing flange
  cpCtx.strokeStyle = '#9db4c0';
  cpCtx.lineWidth = 28;
  cpCtx.strokeRect(14, 14, 484, 484);
  cpCtx.strokeStyle = 'rgba(34, 211, 238, 0.55)';
  cpCtx.lineWidth = 4;
  cpCtx.strokeRect(32, 32, 448, 448);
  const coldPlate = finalizeTex(cpC, maxAniso);

  // 9. Multi-Layer Server Motherboard PCB Texture (Superchip Carrier & 1U Blade)
  const pcbC = document.createElement('canvas');
  pcbC.width = 512; pcbC.height = 512;
  const pCtx = pcbC.getContext('2d');
  pCtx.fillStyle = '#061d11';
  pCtx.fillRect(0, 0, 512, 512);
  pCtx.strokeStyle = 'rgba(118, 185, 0, 0.22)';
  pCtx.lineWidth = 1.6;
  for (let i = 10; i < 512; i += 16) {
    pCtx.beginPath(); pCtx.moveTo(0, i); pCtx.lineTo(512, i); pCtx.stroke();
    pCtx.beginPath(); pCtx.moveTo(i, 0); pCtx.lineTo(i, 512); pCtx.stroke();
  }
  // Serpentine differential pair traces
  pCtx.strokeStyle = 'rgba(212, 175, 55, 0.28)';
  pCtx.lineWidth = 2;
  for (let y = 32; y < 480; y += 64) {
    pCtx.beginPath();
    pCtx.moveTo(0, y);
    for (let x = 0; x < 512; x += 32) {
      pCtx.lineTo(x + 12, y);
      pCtx.lineTo(x + 16, y + 8);
      pCtx.lineTo(x + 28, y + 8);
      pCtx.lineTo(x + 32, y);
    }
    pCtx.stroke();
  }
  // Gold vias
  pCtx.fillStyle = 'rgba(230, 184, 76, 0.50)';
  for (let y = 20; y < 500; y += 32) {
    for (let x = 20; x < 500; x += 32) {
      pCtx.beginPath(); pCtx.arc(x, y, 2.4, 0, Math.PI * 2); pCtx.fill();
    }
  }
  const serverPcb = finalizeTex(pcbC, maxAniso, 2, 2);

  return {
    studioBackdrop,
    siliconDie,
    hbm4Side,
    hbm4Top,
    substrate,
    interposer,
    veraIhs,
    socammPcb,
    coldPlate,
    serverPcb,
  };
}
