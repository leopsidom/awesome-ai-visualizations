/**
 * The dataset: 16 specs for the GB300 NVL72 (B300 GPU, Grace CPU) and the Vera Rubin NVL72
 * (Rubin GPU, Vera CPU), gathered from public reporting in November 2026 and approved before
 * the build. Rubin figures are NVIDIA's launch specs, not measured results.
 *
 * Rows are in tour order. Each row:
 *   id          English metric name (the Chinese name lives in i18n.js)
 *   group       tour group, used for the step label and the panel list
 *   part        the part of the rack that lights up: gpu | cpu | switch | nic | rack | power
 *   scope       gpu | cpu | rack (shown as a chip on the card)
 *   unit        "text" for non-numeric rows; "USD M" is millions of US dollars
 *   b300, rubin values (numbers, or strings for text rows; textZh holds their Chinese forms)
 *   sub/subZh   optional small text after a text value (e.g. "4 nm class" after "TSMC 4NP")
 *   confidence  high | medium | low
 *   note/noteZh caveat shown on the card (noteZh machine-written, not reviewed by a native reader)
 *   rack        optional published rack total (72 GPUs / 36 CPUs) shown as a "per rack" line on the
 *               card; label "fast" marks the rack's fast memory (GPU HBM + CPU LPDDR) on the CPU card.
 *               Rack totals that are only the GPU figure × 72 live here instead of as their own cards.
 *   source      the sites the figure came from (full URLs in SOURCES below)
 *
 * Read the README's "The data" section before quoting a figure. In short: Rubin's 50 PFLOPS
 * NVFP4 uses adaptive compression while B300's 15 is dense; rack prices are analyst estimates
 * (NVIDIA publishes none). FP8 was dropped: Rubin has no published per-GPU figure.
 */

export const SPECS = [
  { id: "Process node", group: "Silicon", part: "gpu", scope: "gpu", unit: "text", b300: "TSMC 4NP", rubin: "TSMC N3P", textZh: ["台积电 4NP", "台积电 N3P"], sub: ["4\u00a0nm", "3\u00a0nm"], subZh: ["4 纳米", "3 纳米"], confidence: "high", note: "4NP is NVIDIA's custom N4P, marketed as 4 nm (TSMC classes N4P in its 5 nm family). N3P is in TSMC's 3 nm family; Rubin's I/O dies are reported on N5B.", noteZh: "4NP 是 NVIDIA 定制的 N4P，以 4 纳米宣传（台积电将 N4P 归入 5 纳米家族）。N3P 属于台积电 3 纳米家族；据报道 Rubin 的 I/O 芯片采用 N5B。", source: "pr.tsmc.com / tweaktown.com / trendforce.com" },
  { id: "Transistors", group: "Silicon", part: "gpu", scope: "gpu", unit: "billion", b300: 208, rubin: 336, confidence: "high", note: "Both dual-reticle dies", noteZh: "两者均为双光罩尺寸芯片", source: "tweaktown.com / siliconangle.com" },
  { id: "NVFP4 inference", group: "GPU compute", part: "gpu", scope: "gpu", unit: "PFLOPS", b300: 15, rubin: 50, rack: { b300: 1.08, rubin: 3.6, unit: "EFLOPS" }, confidence: "high", note: "Rubin figure uses adaptive compression; B300 is dense (a GB300 rack is 1.44 EF sparse)", noteZh: "Rubin 数据采用自适应压缩；B300 为稠密算力（GB300 整柜稀疏算力为 1.44 EF）", source: "tomshardware.com / nvidia.com" },
  { id: "NVFP4 training", group: "GPU compute", part: "gpu", scope: "gpu", unit: "PFLOPS", b300: 15, rubin: 35, rack: { b300: 1.08, rubin: 2.5, unit: "EFLOPS" }, confidence: "medium", note: "B300 has no separate training figure", noteZh: "B300 未单独公布训练算力", source: "vast.ai / cudocompute.com / storagereview.com" },
  { id: "FP64", group: "GPU compute", part: "gpu", scope: "gpu", unit: "TFLOPS", b300: 1.2, rubin: 33, confidence: "medium", note: "B300 cut FP64 to make room for FP4", noteZh: "B300 削减 FP64 以让位于 FP4", source: "glennklockwood.com" },
  { id: "HBM capacity", group: "GPU memory", part: "gpu", scope: "gpu", unit: "GB", b300: 288, rubin: 288, rack: { b300: 20.7, rubin: 20.7, unit: "TB" }, confidence: "high", note: "HBM3e 12-high vs HBM4 (8 stacks each)", noteZh: "HBM3e 12 层堆叠 vs HBM4（各 8 堆栈）", source: "tomshardware.com / storagereview.com" },
  { id: "HBM bandwidth", group: "GPU memory", part: "gpu", scope: "gpu", unit: "TB/s", b300: 8, rubin: 22, rack: { b300: 0.576, rubin: 1.6, unit: "PB/s" }, confidence: "high", note: null, source: "vast.ai / storagereview.com" },
  { id: "NVLink bandwidth per GPU", group: "Interconnect", part: "switch", scope: "gpu", unit: "TB/s", b300: 1.8, rubin: 3.6, rack: { b300: 130, rubin: 260, unit: "TB/s" }, confidence: "high", note: "NVLink 5 vs NVLink 6", noteZh: "NVLink 5 vs NVLink 6", source: "tomshardware.com / bitdeer.ai / storagereview.com" },
  { id: "Scale-out NIC per GPU", group: "Interconnect", part: "nic", scope: "gpu", unit: "Gb/s", b300: 800, rubin: 1600, confidence: "medium", note: "ConnectX-8 vs ConnectX-9", noteZh: "ConnectX-8 vs ConnectX-9", source: "server-parts.eu / nvidia.com" },
  { id: "GPU power (max)", group: "Power", part: "gpu", scope: "gpu", unit: "W", b300: 1400, rubin: 2300, cost: true, confidence: "medium", note: "Rubin: Max-Q ~1800 W / Max-P ~2300 W", noteZh: "Rubin：Max-Q 约 1800 W / Max-P 约 2300 W", source: "introl.com / thundercompute.com" },
  { id: "CPU cores", group: "CPU", part: "cpu", scope: "cpu", unit: "cores", b300: 72, rubin: 88, confidence: "high", note: "Grace (Neoverse V2) vs Vera (Olympus; 176 threads)", noteZh: "Grace（Neoverse V2）vs Vera（Olympus，176 线程）", source: "cudocompute.com" },
  { id: "CPU memory per CPU", group: "CPU", part: "cpu", scope: "cpu", unit: "TB", b300: 0.48, rubin: 1.5, rack: { b300: 37, rubin: 75, unit: "TB", label: "fast" }, confidence: "high", note: "LPDDR5X (Vera uses SOCAMM)", noteZh: "LPDDR5X（Vera 采用 SOCAMM）", source: "cudocompute.com / bitdeer.ai / datacenterdynamics.com" },
  { id: "CPU memory bandwidth", group: "CPU", part: "cpu", scope: "cpu", unit: "TB/s", b300: 0.5, rubin: 1.2, confidence: "medium", note: null, source: "cudocompute.com" },
  { id: "Rack power (max)", group: "Rack", part: "power", scope: "rack", unit: "kW", b300: 142, rubin: 227, cost: true, confidence: "medium", note: "Rubin datasheet: 227 Max-P / 187 Max-Q", noteZh: "Rubin 规格书：Max-P 227 / Max-Q 187", source: "enzu.com / introl.com" },
  { id: "Rack price (analyst est.)", group: "Rack", part: "rack", scope: "rack", unit: "USD M", b300: 4.0, rubin: 7.8, cost: true, confidence: "low", note: "Morgan Stanley estimate; NVIDIA does not publish prices", noteZh: "摩根士丹利估算；NVIDIA 未公布价格", source: "enzu.com" },
  { id: "Volume availability", group: "Timing", part: "rack", scope: "rack", unit: "text", b300: "H2 2025", rubin: "H2 2026", textZh: ["2025 下半年", "2026 下半年"], confidence: "medium", note: "Vera Rubin has been shipping since August 2026, according to NVIDIA.", noteZh: "据 NVIDIA 称，Vera Rubin 已于 2026 年 8 月开始出货。", source: "tomshardware.com / startupfortune.com" },
];

/** NVL72 rack, Oberon-class, approximate outer size in metres (both systems use the same rack). 1U = 44.45 mm. */
export const RACK = { w: 0.6, d: 1.068, h: 2.236, u: 0.04445 };

/** Per-GPU NVLink bandwidth (TB/s): sets the particle speed. */
export const NVLINK = { b300: 1.8, rubin: 3.6 };

/** Pages used to gather the figures (November 2026). Most are secondary sources. */
export const SOURCES = [
  "https://pr.tsmc.com/english/news/2874",
  "https://www.tomshardware.com/pc-components/gpus/nvidia-announces-blackwell-ultra-b300-1-5x-faster-than-b200-with-288gb-hbm3e-and-15-pflops-dense-fp4",
  "https://tomshardware.com/pc-components/gpus/nvidia-launches-vera-rubin-nvl72-ai-supercomputer-at-ces-promises-up-to-5x-greater-inference-performance-and-10x-lower-cost-per-token-than-blackwell-coming-2h-2026",
  "https://www.storagereview.com/news/nvidia-launches-vera-rubin-architecture-at-ces-2026-the-vr-nvl72-rack",
  "https://siliconangle.com/2026/01/05/nvidia-debuts-rubin-chip-336b-transistors-50-petaflops-ai-performance/",
  "https://www.tweaktown.com/news/107373/nvidia-details-blackwell-ultra-gb300-dual-die-design-208b-transistors-up-to-288gb-hbm3e/index.html",
  "https://vast.ai/article/everything-you-need-to-know-about-the-nvidia-blackwell-ultra-b300",
  "https://vast.ai/article/nvidia-rubin-platform-everything-we-know-so-far",
  "https://www.cudocompute.com/products/nvidia-vera-rubin",
  "https://www.thundercompute.com/blog/nvidia-rubin-architecture",
  "https://glennklockwood.com/garden/processors/B300",
  "https://glennklockwood.com/garden/processors/r200",
  "https://introl.com/blog/nvidia-blackwell-ultra-b300-infrastructure-requirements-2025",
  "https://www.bitdeer.ai/en/services/bare-metal/gb300",
  "https://datacenterdynamics.com/en/news/nvidia-announces-vera-rubin-superchip-for-late-2026",
  "https://enzu.com/nvidia-vera-rubin.php",
  "https://enzu.com/nvidia-gb300-nvl72.php",
  "https://startupfortune.com/nvidia-confirms-vera-rubin-is-shipping-but-not-the-630-billion-number/",
  "https://www.server-parts.eu/post/nvidia-b300-gpu-blackwell-ultra-architecture",
  "https://www.nvidia.com/en-in/data-center/gb300-nvl72/",
  "https://www.trendforce.com/news/2026/04/01/news-nvidias-rubin-ultra-seen-sticking-to-dual-die-design-on-packaging-constraints-tsmc-3nm-demand-intact/",
  "https://www.tweaktown.com/news/105660/nvidias-next-gen-rubin-gpu-vera-cpu-rumors-no-delays-new-chips-are-being-moved-up/index.html",
];
