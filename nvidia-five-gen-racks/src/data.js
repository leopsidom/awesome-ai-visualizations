// Verified 5-generation NVIDIA datacenter GPU & 48U rack dataset (H100 -> Vera Rubin)
// Derived from nvidia_gpu_generations_v2.csv & DuckDB profiling.

export const GENERATIONS = [
  {
    id: 'H100', gpuName: 'H100 SXM5', arch: 'Hopper', release: '2022 Q4',
    node: 'TSMC 4N', dies: 1, dieLayout: 'Monolithic (1 die)', dieLayout_zh: '单芯片封装（1 Die）', transistorsB: 80,
    gpuTdpW: 700, hbmGen: 'HBM3', hbmStacks: 5, hbmSites: 6,
    gpuHbmGB: 80, gpuHbmBW: 3.35,
    gpuFp8Dense: 1979, gpuFp4Dense: null, gpuFp4Peak: null,
    nvlinkGen: 'NVLink 4', gpuNvlinkBW: 0.9,
    rackSystem: 'DGX/HGX H100 Rack', rackSystem_zh: 'DGX/HGX H100 机柜', isNVL72: false, cableFree: false,
    computeTrays: 4, trayU: 8, gpusPerTray: 8, switchTrays: 0,
    gpusPerRack: 32, cpusPerRack: 8,
    nvlinkDomainGpus: 8, nvlinkDomainBW: 7.2,
    rackHbmTB: 2.56, rackHbmBW: 107.2,
    rackFp8DensePF: 63.33, rackFp4DensePF: null, rackFp4PeakPF: null,
    cpuName: 'Intel Xeon 8480C (56C)', cpuName_zh: 'Intel Xeon 8480C（56 核）', rackHostRamTB: 8.0, totalFastMemTB: 10.56,
    nic: 'ConnectX-7', nicGbps: 400,
    cooling: 'Air-Cooled', cooling_zh: '风冷散热', rackPowerKW: 45, powerEst: true,
    rackFp8PerKw: 1.41, gpuFp8PerW: 2.83,
    accent: 0xd4af37,
  },
  {
    id: 'H200', gpuName: 'H200 SXM5', arch: 'Hopper', release: '2024 Q2',
    node: 'TSMC 4N', dies: 1, dieLayout: 'Monolithic (1 die)', dieLayout_zh: '单芯片封装（1 Die）', transistorsB: 80,
    gpuTdpW: 700, hbmGen: 'HBM3e', hbmStacks: 6, hbmSites: 6,
    gpuHbmGB: 141, gpuHbmBW: 4.80,
    gpuFp8Dense: 1979, gpuFp4Dense: null, gpuFp4Peak: null,
    nvlinkGen: 'NVLink 4', gpuNvlinkBW: 0.9,
    rackSystem: 'DGX/HGX H200 Rack', rackSystem_zh: 'DGX/HGX H200 机柜', isNVL72: false, cableFree: false,
    computeTrays: 4, trayU: 8, gpusPerTray: 8, switchTrays: 0,
    gpusPerRack: 32, cpusPerRack: 8,
    nvlinkDomainGpus: 8, nvlinkDomainBW: 7.2,
    rackHbmTB: 4.51, rackHbmBW: 153.6,
    rackFp8DensePF: 63.33, rackFp4DensePF: null, rackFp4PeakPF: null,
    cpuName: 'Intel Xeon 8480C (56C)', cpuName_zh: 'Intel Xeon 8480C（56 核）', rackHostRamTB: 8.0, totalFastMemTB: 12.51,
    nic: 'ConnectX-7', nicGbps: 400,
    cooling: 'Air-Cooled', cooling_zh: '风冷散热', rackPowerKW: 45, powerEst: true,
    rackFp8PerKw: 1.41, gpuFp8PerW: 2.83,
    accent: 0x38bdf8,
  },
  {
    id: 'B200', gpuName: 'B200 (GB200)', arch: 'Blackwell', release: '2024 Q4',
    node: 'TSMC 4NP', dies: 2, dieLayout: 'Dual-Die (10 TB/s NV-HBI)', dieLayout_zh: '双芯互连封装（10 TB/s NV-HBI）', transistorsB: 208,
    gpuTdpW: 1200, hbmGen: 'HBM3e', hbmStacks: 8, hbmSites: 8,
    gpuHbmGB: 192, gpuHbmBW: 8.00,
    gpuFp8Dense: 5000, gpuFp4Dense: 10000, gpuFp4Peak: 20000,
    nvlinkGen: 'NVLink 5', gpuNvlinkBW: 1.8,
    rackSystem: 'GB200 NVL72', rackSystem_zh: 'GB200 NVL72 机柜', isNVL72: true, cableFree: false,
    computeTrays: 18, trayU: 1, gpusPerTray: 4, switchTrays: 9,
    gpusPerRack: 72, cpusPerRack: 36,
    nvlinkDomainGpus: 72, nvlinkDomainBW: 130.0,
    rackHbmTB: 13.82, rackHbmBW: 576.0,
    rackFp8DensePF: 360.0, rackFp4DensePF: 720.0, rackFp4PeakPF: 1440.0,
    cpuName: 'NVIDIA Grace (72C)', cpuName_zh: 'NVIDIA Grace（72 核）', rackHostRamTB: 17.3, totalFastMemTB: 31.12,
    nic: 'ConnectX-7', nicGbps: 400,
    cooling: 'Direct Liquid-Cooled', cooling_zh: '直接液冷（DLC）', rackPowerKW: 120, powerEst: false,
    rackFp8PerKw: 3.00, gpuFp8PerW: 4.17,
    accent: 0x22d3ee,
  },
  {
    id: 'B300', gpuName: 'B300 (GB300)', arch: 'Blackwell Ultra', release: '2025 Q3',
    node: 'TSMC 4NP', dies: 2, dieLayout: 'Dual-Die (10 TB/s NV-HBI)', dieLayout_zh: '双芯互连封装（10 TB/s NV-HBI）', transistorsB: 208,
    gpuTdpW: 1400, hbmGen: 'HBM3e (12-Hi)', hbmStacks: 8, hbmSites: 8,
    gpuHbmGB: 288, gpuHbmBW: 8.00,
    gpuFp8Dense: 5000, gpuFp4Dense: 15000, gpuFp4Peak: 20000,
    nvlinkGen: 'NVLink 5', gpuNvlinkBW: 1.8,
    rackSystem: 'GB300 NVL72', rackSystem_zh: 'GB300 NVL72 机柜', isNVL72: true, cableFree: false,
    computeTrays: 18, trayU: 1, gpusPerTray: 4, switchTrays: 9,
    gpusPerRack: 72, cpusPerRack: 36,
    nvlinkDomainGpus: 72, nvlinkDomainBW: 130.0,
    rackHbmTB: 20.74, rackHbmBW: 576.0,
    rackFp8DensePF: 360.0, rackFp4DensePF: 1080.0, rackFp4PeakPF: 1440.0,
    cpuName: 'NVIDIA Grace (72C)', cpuName_zh: 'NVIDIA Grace（72 核）', rackHostRamTB: 17.3, totalFastMemTB: 38.04,
    nic: 'ConnectX-8', nicGbps: 800,
    cooling: 'Direct Liquid-Cooled', cooling_zh: '直接液冷（DLC）', rackPowerKW: 142, powerEst: false,
    rackFp8PerKw: 2.54, gpuFp8PerW: 3.57,
    accent: 0x06b6d4,
  },
  {
    id: 'Vera Rubin', gpuName: 'Rubin', arch: 'Rubin', release: '2026 H2',
    node: 'TSMC N3P', dies: 2, dieLayout: 'Dual-Die + I/O Chiplets', dieLayout_zh: '双芯计算 + I/O 芯粒', transistorsB: 336,
    gpuTdpW: 1800, hbmGen: 'HBM4 (12-Hi)', hbmStacks: 8, hbmSites: 8,
    gpuHbmGB: 288, gpuHbmBW: 22.00,
    gpuFp8Dense: 17500, gpuFp4Dense: 35000, gpuFp4Peak: 50000,
    nvlinkGen: 'NVLink 6', gpuNvlinkBW: 3.6,
    rackSystem: 'Vera Rubin NVL72', rackSystem_zh: 'Vera Rubin NVL72 机柜', isNVL72: true, cableFree: true,
    computeTrays: 18, trayU: 1, gpusPerTray: 4, switchTrays: 9,
    gpusPerRack: 72, cpusPerRack: 36,
    nvlinkDomainGpus: 72, nvlinkDomainBW: 260.0,
    rackHbmTB: 20.74, rackHbmBW: 1584.0,
    rackFp8DensePF: 1260.0, rackFp4DensePF: 2520.0, rackFp4PeakPF: 3600.0,
    cpuName: 'NVIDIA Vera (88C/176T)', cpuName_zh: 'NVIDIA Vera（88 核 / 176 线程）', rackHostRamTB: 54.0, totalFastMemTB: 74.74,
    nic: 'ConnectX-9', nicGbps: 1600,
    cooling: 'Cable-Free DLC (MGX v3)', cooling_zh: '无线缆直接液冷（MGX v3）', rackPowerKW: 230, powerEst: true,
    rackFp8PerKw: 5.48, gpuFp8PerW: 9.72,
    accent: 0x76b900,
  },
];

// 12-Chapter Bilingual Guided Play Script (Interleaved by Architecture Family)
// Flow:
//   Act I   (Ch. 1)    : All 5 Racks Lineup (L->R pan -> Holistic view)
//   Act II  (Ch. 2–3)  : Hopper 48U Rack -> Seamless Zoom-In to H100/H200 Silicon Die
//   Act III (Ch. 4–5)  : Blackwell NVL72 Rack (180° Rear Spin) -> Seamless Zoom-In to B200/B300 Dual-Die
//   Act IV  (Ch. 6–8)  : Vera Rubin NVL72 Rack (180° Rear Spin) -> 1U Tray Pull-Out -> Seamless Zoom-In to Rubin 3nm + HBM4
//   Act V   (Ch. 9–12) : Embedded 3D Comparative Bar Charts (L->R pan -> Holistic view)
export const STORY_CHAPTERS = [
  {
    title: '1. Five Generations of 48U AI Racks',
    title_zh: '1. 五代 48U AI 超级机柜全景演进',
    badge: 'Act I · Lineup', badge_zh: '第一幕 · 五代全景',
    duration: 9.5, flipAt: null,
    mode: 'lineup', drill: 'rack', gen: 4, chart: 'none', explode: 0, xray: false, pins: false,
    cam: (narrow) => narrow
      ? { pos: [0, 3.6, 10.2], target: [0, 2.35, 0] }
      : { pos: [0, 4.0, 11.4], target: [0, 2.45, 0] },
    panRange: (narrow) => narrow ? [-4.2, 4.2] : [-3.1, 3.1],
    panEnd: 0.64,
    holistic: (narrow) => ({ halfW: narrow ? 5.2 : 6.4, minZ: 14.4, posY: narrow ? 5.2 : 4.5, targetY: narrow ? 2.85 : 2.55 }),
    orbitSweep: 0,
    caption: 'From <strong>H100 (2022)</strong> to <strong>Vera Rubin (2026)</strong>: 48U racks leaped from 32 air-cooled GPUs to <strong>72 liquid-cooled GPUs</strong> in one unified fabric.',
    caption_zh: '从 <strong>H100（2022）</strong>到 <strong>Vera Rubin（2026）</strong>：48U 机柜从 32 颗风冷 GPU 跃升至 <strong>72 颗全液冷统一互联超级机柜</strong>。'
  },
  {
    title: '2. Hopper Rack Anatomy (H100 & H200)',
    title_zh: '2. Hopper 机柜解剖（H100 & H200）',
    badge: 'Act II · Hopper Rack', badge_zh: '第二幕 · Hopper 机柜',
    duration: 8.0, flipAt: null,
    mode: 'focus', drill: 'rack', gen: 0, chart: 'none', explode: 0.24, xray: true, pins: true,
    cam: (narrow) => ({ pos: [narrow ? 3.5 : 4.2, 4.4, narrow ? 9.6 : 7.9], target: [0, narrow ? 2.48 : 2.38, 0] }),
    orbitSweep: 0.20,
    caption: '<strong>Hopper 48U:</strong> Four identical <strong>8U air-cooled servers</strong> (32 glowing green GPUs, ~45 kW air cap), forming 4 isolated <strong>8-GPU NVLink 4 islands</strong> (7.2 TB/s).',
    caption_zh: '<strong>Hopper 48U：</strong>4 台相同 <strong>8U 风冷服务器</strong>（32 颗绿色 GPU，~45 kW 风冷上限），内部为 4 组独立 <strong>8 卡 NVLink 4 孤岛</strong>（7.2 TB/s）。'
  },
  {
    title: '3. Hopper GPU Zoom-In: H100 → H200 (HBM3 → HBM3e)',
    title_zh: '3. 钻入 Hopper 芯片：H100 → H200（HBM3 → HBM3e）',
    badge: 'Act II · Hopper Silicon', badge_zh: '第二幕 · Hopper 芯片',
    duration: 11.2, flipAt: null, zoomFromRack: true, zoomSourceGen: 0, zoomEnd: 0.30,
    mode: 'focus', drill: 'package', gen: 1, chart: 'none', explode: 0.35, xray: false, pins: true,
    cam: (narrow) => narrow
      ? { pos: [0.0, 4.0, 5.8], target: [0.0, 1.88, 0.45] }
      : { pos: [0.2, 3.9, 5.4], target: [0.1, 1.92, 0.45] },
    panRange: (narrow) => narrow ? [-0.95, 1.15] : [-0.65, 0.75],
    panEnd: 0.70,
    holistic: (narrow) => ({ halfW: narrow ? 2.75 : 2.95, minZ: 6.4, posY: narrow ? 4.8 : 4.2, targetY: narrow ? 2.15 : 1.98 }),
    orbitSweep: 0,
    caption: '<strong>Zooming into the Hopper GPU (TSMC 4N · 80B):</strong> Monolithic GH100 die. H100 enabled 5/6 HBM3 sites (80 GB); <strong>H200 unlocked all 6 HBM3e stacks</strong> (141 GB, 4.8 TB/s).',
    caption_zh: '<strong>钻入 Hopper 芯片（台积电 4N · 800 亿）：</strong>单芯片 GH100。H100 启用 5/6 颗 HBM3（80 GB），<strong>H200 解锁全部 6 颗 HBM3e</strong>（141 GB / 4.8 TB/s）。'
  },
  {
    title: '4. Blackwell NVL72 Rack (Front → 180° Rear)',
    title_zh: '4. Blackwell NVL72 机柜（正面 → 180° 背面）',
    badge: 'Act III · Blackwell Rack', badge_zh: '第三幕 · Blackwell 机柜',
    duration: 11.0, flipAt: 0.36, unflipAt: 0.78, pullTrayAt: 0.84,
    mode: 'focus', drill: 'rack', gen: 3, chart: 'none', explode: 0.36, xray: true, pins: true,
    cam: (narrow) => ({ pos: [narrow ? -3.5 : -4.2, 4.4, narrow ? 9.6 : 7.9], target: [0, narrow ? 2.48 : 2.38, 0] }),
    orbitSweep: 0.14,
    caption: '<strong>GB200 / GB300 NVL72:</strong> <strong>10 upper + 8 lower 1U trays</strong> (72 GPUs) sandwich <strong>9 central NVLink 5 switches</strong>; <strong>180° spin</strong> reveals the 130 TB/s copper backplane &amp; liquid manifolds.',
    caption_zh: '<strong>GB200 / GB300 NVL72：</strong><strong>上 10 + 下 8 层 1U 液冷托盘</strong>（共 72 颗 GPU）夹住<strong>中部 9 层 NVLink 5 交换机</strong>；自动<strong>旋转 180°</strong>展现 130 TB/s 铜缆背板与液冷歧管。'
  },
  {
    title: '5. Blackwell GPU Zoom-In: B200 → B300 Dual-Die',
    title_zh: '5. 钻入 Blackwell 芯片：B200 → B300 双芯互连',
    badge: 'Act III · Blackwell Silicon', badge_zh: '第三幕 · Blackwell 芯片',
    duration: 11.2, flipAt: null, zoomFromRack: true, zoomFromTray: true, zoomSourceGen: 3, zoomEnd: 0.30,
    mode: 'focus', drill: 'package', gen: 3, chart: 'none', explode: 0.52, xray: false, pins: true,
    cam: (narrow) => narrow
      ? { pos: [-0.2, 4.1, 6.2], target: [0.0, 1.95, 0.45] }
      : { pos: [-0.5, 4.0, 5.8], target: [0.15, 1.98, 0.45] },
    panRange: (narrow) => narrow ? [-0.95, 1.35] : [-0.8, 0.9],
    panEnd: 0.70,
    holistic: (narrow) => ({ halfW: narrow ? 3.1 : 3.2, minZ: 6.8, posY: narrow ? 4.9 : 4.3, targetY: narrow ? 2.2 : 2.02 }),
    orbitSweep: 0,
    caption: '<strong>Zooming into the 1U Blackwell GPU (4NP · 208B):</strong> Dual dies fused by a <strong>10 TB/s NV-HBI bridge</strong> + taller <strong>8× 12-Hi HBM3e (288 GB)</strong> + coherent Grace CPU.',
    caption_zh: '<strong>钻入 1U Blackwell 芯片（台积电 4NP · 2080 亿）：</strong>双芯经 <strong>10 TB/s NV-HBI 互联桥</strong>融合 + <strong>8 颗 12-Hi HBM3e（288 GB）</strong> + 一致性直连 Grace CPU。'
  },
  {
    title: '6. Vera Rubin NVL72 Rack (Front → 180° Cable-Free)',
    title_zh: '6. Vera Rubin NVL72 机柜（正面 → 180° 无线缆背面）',
    badge: 'Act IV · Rubin Rack', badge_zh: '第四幕 · Rubin 机柜',
    duration: 10.5, flipAt: 0.38, unflipAt: 0.84,
    mode: 'focus', drill: 'rack', gen: 4, chart: 'none', explode: 0.42, xray: false, pins: true,
    cam: (narrow) => ({ pos: [narrow ? 3.5 : 4.2, 4.4, narrow ? 9.6 : 7.9], target: [0, narrow ? 2.48 : 2.38, 0] }),
    orbitSweep: -0.14,
    caption: '<strong>Vera Rubin NVL72 (MGX v3):</strong> <strong>18 cable-free 1U trays + 9 NVLink 6 switch trays</strong>; <strong>180° spin</strong> reveals the emerald blind-mate cartridge spine (<strong>260 TB/s</strong>).',
    caption_zh: '<strong>Vera Rubin NVL72（MGX v3）：</strong><strong>18 层无线缆 1U 托盘 + 9 层 NVLink 6 交换机</strong>；旋转 <strong>180°</strong>展现翠绿盲插背板（<strong>260 TB/s</strong>）。'
  },
  {
    title: '7. Vera Rubin 1U Tray Pull-Out (Liquid Blade)',
    title_zh: '7. 抽出 Vera Rubin 1U 液冷计算托盘',
    badge: 'Act IV · 1U Tray Level', badge_zh: '第四幕 · 1U 液冷托盘',
    duration: 7.5, flipAt: null,
    mode: 'focus', drill: 'tray', gen: 4, chart: 'none', explode: 0.15, xray: true, pins: true,
    cam: (narrow) => narrow
      ? { pos: [0.65, 6.55, 4.95], target: [0.0, 3.32, 1.72] }
      : { pos: [0.95, 6.20, 4.45], target: [0.0, 3.26, 1.75] },
    orbitSweep: 0.14,
    caption: '<strong>1U Compute Tray Pull-Out:</strong> Direct liquid cooling packs <strong>2 Vera CPUs + 4 Rubin GPUs</strong> + 1600G ConnectX-9 SuperNICs into one 1U blade (18 trays = 72 GPUs).',
    caption_zh: '<strong>1U 计算托盘抽出：</strong>直接液冷将 <strong>2 颗 Vera CPU + 4 颗 Rubin GPU</strong> 与 1600G ConnectX-9 SuperNIC 浓缩进超薄 1U 刀片（18 层 = 72 颗 GPU）。'
  },
  {
    title: '8. Rubin GPU Zoom-In: 3nm + HBM4 (22 TB/s)',
    title_zh: '8. 钻入 Rubin 芯片：3nm 工艺与 HBM4（22 TB/s）',
    badge: 'Act IV · Rubin Silicon', badge_zh: '第四幕 · Rubin 芯片',
    duration: 11.2, flipAt: null, zoomFromRack: true, zoomFromTray: true, zoomSourceGen: 4, zoomEnd: 0.30,
    mode: 'focus', drill: 'package', gen: 4, chart: 'none', explode: 0.72, xray: false, pins: true,
    cam: (narrow) => narrow
      ? { pos: [0.2, 4.2, 6.4], target: [0.0, 2.02, 0.45] }
      : { pos: [0.6, 4.0, 5.9], target: [0.15, 2.02, 0.45] },
    panRange: (narrow) => narrow ? [-0.95, 1.35] : [-0.8, 0.9],
    panEnd: 0.68,
    holistic: (narrow) => ({ halfW: narrow ? 3.15 : 3.25, minZ: 7.0, posY: narrow ? 5.0 : 4.4, targetY: narrow ? 2.25 : 2.08 }),
    orbitSweep: 0,
    caption: '<strong>Zooming into the Rubin GPU (TSMC N3P · 336B):</strong> Dual 3nm compute dies + I/O chiplets + <strong>8× wide-bus HBM4 (22 TB/s — 2.75× BW jump!)</strong> + 88-core Vera CPU.',
    caption_zh: '<strong>钻入 Rubin 芯片（台积电 N3P · 3360 亿）：</strong>双 3nm 计算芯粒 + I/O 芯粒 + <strong>8 颗宽总线 HBM4（单卡 22 TB/s，带宽暴增 2.75×）</strong> + 88 核 Vera CPU。'
  },
  {
    title: '9. Compute Explosion (FP8 & NVFP4)',
    title_zh: '9. 算力爆发（FP8 与 NVFP4）',
    badge: 'Act V · Compute', badge_zh: '第五幕 · 算力对比',
    duration: 10.0, flipAt: null,
    mode: 'lineup', drill: 'rack', gen: 4, chart: 'compute', explode: 0, xray: false, pins: false,
    cam: (narrow) => narrow
      ? { pos: [0, 4.35, 11.8], target: [0, 3.00, 0.0] }
      : { pos: [0, 4.55, 12.6], target: [0, 3.00, 0.0] },
    panRange: (narrow) => narrow ? [-4.2, 4.2] : [-3.2, 3.2],
    panEnd: 0.64,
    holistic: (narrow) => ({ halfW: narrow ? 5.25 : 6.6, minZ: 15.6, posY: narrow ? 5.8 : 5.0, targetY: narrow ? 3.35 : 3.10 }),
    orbitSweep: 0,
    caption: '<strong>Compute Leap:</strong> Rack dense FP8 climbs <strong>19.9×</strong> (63 → 1,260 PF); native FP4 shatters <strong>1.0 ExaFLOPS</strong> — hitting <strong>2.52 EF dense / 3.60 EF peak</strong>.',
    caption_zh: '<strong>算力跃迁：</strong>整柜稠密 FP8 暴增 <strong>19.9×</strong>（63 → 1,260 PF），原生 FP4 冲破 <strong>1.0 ExaFLOPS</strong> 达 <strong>2.52 EF 稠密 / 3.60 EF 峰值</strong>。'
  },
  {
    title: '10. Breaking the HBM Memory Wall',
    title_zh: '10. 突破 HBM 显存带宽墙',
    badge: 'Act V · HBM Memory', badge_zh: '第五幕 · 显存对比',
    duration: 9.5, flipAt: null,
    mode: 'lineup', drill: 'rack', gen: 4, chart: 'hbm', explode: 0, xray: false, pins: false,
    cam: (narrow) => narrow
      ? { pos: [0, 4.35, 11.8], target: [0, 3.00, 0.0] }
      : { pos: [0, 4.55, 12.6], target: [0, 3.00, 0.0] },
    panRange: (narrow) => narrow ? [-4.2, 4.2] : [-3.2, 3.2],
    panEnd: 0.64,
    holistic: (narrow) => ({ halfW: narrow ? 5.25 : 6.6, minZ: 15.6, posY: narrow ? 5.8 : 5.0, targetY: narrow ? 3.35 : 3.10 }),
    orbitSweep: 0,
    caption: '<strong>HBM Capacity &amp; BW:</strong> Rack HBM climbs <strong>8.1×</strong> (2.56 → 20.74 TB) while <strong>HBM4 rockets bandwidth 14.8×</strong> to <strong>1,584 TB/s</strong>.',
    caption_zh: '<strong>HBM 容量与带宽：</strong>整柜 HBM 容量扩大 <strong>8.1×</strong>（2.56 → 20.74 TB），<strong>HBM4 将整柜带宽拉升 14.8× 至 1,584 TB/s</strong>。'
  },
  {
    title: '11. 36.1× Unified NVLink Fabric',
    title_zh: '11. 36.1× 统一 NVLink 互联域',
    badge: 'Act V · NVLink & NIC', badge_zh: '第五幕 · 互联对比',
    duration: 9.5, flipAt: null,
    mode: 'lineup', drill: 'rack', gen: 4, chart: 'nvlink', explode: 0, xray: false, pins: false,
    cam: (narrow) => narrow
      ? { pos: [0, 4.35, 11.8], target: [0, 3.00, 0.0] }
      : { pos: [0, 4.55, 12.6], target: [0, 3.00, 0.0] },
    panRange: (narrow) => narrow ? [-4.2, 4.2] : [-3.2, 3.2],
    panEnd: 0.64,
    holistic: (narrow) => ({ halfW: narrow ? 5.25 : 6.6, minZ: 15.6, posY: narrow ? 5.8 : 5.0, targetY: narrow ? 3.35 : 3.10 }),
    orbitSweep: 0,
    caption: '<strong>Scale-Up &amp; Scale-Out:</strong> Unified 72-GPU NVLink multiplies domain bandwidth <strong>36.1×</strong> (7.2 → <strong>260 TB/s</strong>), while SuperNICs quadruple to <strong>1,600G ConnectX-9</strong>.',
    caption_zh: '<strong>纵向与横向互联：</strong>72 卡统一 NVLink 域带宽飙升 <strong>36.1×</strong>（7.2 → <strong>260 TB/s</strong>），横向网卡翻 4 倍至 <strong>1,600G ConnectX-9</strong>。'
  },
  {
    title: '12. Power Ceiling & 3.9× Efficiency',
    title_zh: '12. 液冷破局与 3.9× 能效跃升',
    badge: 'Act V · Power & Perf/kW', badge_zh: '第五幕 · 功耗与能效',
    duration: 10.0, flipAt: null,
    mode: 'lineup', drill: 'rack', gen: 4, chart: 'power', explode: 0, xray: false, pins: false,
    cam: (narrow) => narrow
      ? { pos: [0, 4.35, 11.8], target: [0, 3.00, 0.0] }
      : { pos: [0, 4.55, 12.6], target: [0, 3.00, 0.0] },
    panRange: (narrow) => narrow ? [-4.2, 4.2] : [-3.2, 3.2],
    panEnd: 0.64,
    holistic: (narrow) => ({ halfW: narrow ? 5.25 : 6.6, minZ: 15.6, posY: narrow ? 5.8 : 5.0, targetY: narrow ? 3.35 : 3.10 }),
    orbitSweep: 0,
    caption: '<strong>Energy Frontier:</strong> Liquid cooling smashes the coral <strong>50 kW air ceiling</strong> (45* → ~230 kW* est.), while dense FP8 efficiency climbs <strong>3.9×</strong> (1.41 → <strong>5.48 PF/kW</strong>).',
    caption_zh: '<strong>能效前沿：</strong>全液冷打破 <strong>50 kW 风冷极限</strong>（45* → ~230 kW* 估算），整柜单位千瓦 FP8 稠密算力大涨 <strong>3.9×</strong>（1.41 → <strong>5.48 PF/kW</strong>）。'
  },
];
