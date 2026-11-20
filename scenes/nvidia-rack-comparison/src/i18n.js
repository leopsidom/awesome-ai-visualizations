/**
 * Every string the page shows, in English and Simplified Chinese, and the number formats for
 * each. No DOM and no Three.js.
 *
 * Product and chip names (GB300 NVL72, Vera Rubin NVL72, B300, Grace, Rubin, Vera) and source
 * site names stay in English in both languages. Prices read "$7.8M" in English and "780 万美元"
 * in Chinese; transistor counts read "208 billion" and "2080 亿". The Chinese strings were written by
 * a model: a first audit round has been applied (see the README), but a native reader has not checked them.
 */

export const LANGS = ["en", "zh"];

const EN = {
  htmlLang: "en",
  docTitle: "Twin Racks — GB300 NVL72 vs Vera Rubin NVL72",
  title: "Twin Racks",
  vs: "vs",
  hint: "Drag to orbit · scroll or pinch to zoom · Space = play/pause · ←/→ = previous/next metric · R = replay",
  intro: "Both racks share the same size (~0.60 × 1.07 × 2.24 m); dimensions are marked directly on the racks. For each metric, the part of the rack it describes lights up.",
  barTitle: "Bar height is proportional to the value",
  introKicker: "Rack-scale comparison",
  introTitle: 'Nvidia <span class="nr">Rubin</span> <span class="vs">vs</span> <span class="nb">B300</span>',
  introSub: "Nvidia last two generation data center chips comparison",
  introHint: (n) => `${n} specs follow · press Space to play the tour, or → / swipe to step through`,
  sumKicker: "Overview",
  sumTitle: "Same rack, different chips",
  sumSize: "Each rack is 0.60 m wide, 1.07 m deep and 2.24 m high — the same for both, and drawn to true size here.",
  gpus: (n) => `72 × ${n} GPUs`,
  cpus: (n) => `36 × ${n} CPUs`,
  perGpu: (hbm) => `576 ${hbm} stacks`, // 72 GPUs × 8 stacks, per rack like the other lines
  hbmB: "HBM3e",
  hbmR: "HBM4",
  computeTrays: "18 compute trays",
  switchTrays: (gen) => `9 NVLink ${gen} switch trays`,
  introGroup: "Intro",
  frameNames: { intro: "Title", summary: "Overview: rack and chips" },
  compared: "Rubin vs B300",
  language: "Language",
  auto: "Auto-compare",
  prev: "‹ Prev",
  replay: "↺ Replay from the start",
  replayTitle: "Back to the title slide and play the tour (R)",
  next: "Next ›",
  play: "▶ Play tour",
  playTitle: "Play / pause the tour (Space)",
  pause: "❚❚ Pause",
  dwell: "Seconds per metric",
  camFollow: "Camera follows the highlighted part",
  loop: "Loop",
  cardH: "Spec card",
  floatCard: "Card over the scene, under the title (uncheck to dock it below)",
  notes: "Show note and source on the card",
  opacity: "Card opacity",
  titleOpacity: "Title slide opacity",
  ariaLanguage: "Language",
  ariaDwell: "Seconds per metric",
  ariaOpacity: "Card opacity",
  layers: "Layers",
  nvlink: "NVLink traffic (particle speed shows link bandwidth)",
  dims: "Rack dimensions (metres)",
  metrics: "Metrics",
  hide: "Hide panel ⟩",
  show: "⟨ Show panel",
  open: "☰ Controls",
  close: "✕ Close",
  dimH: "2.24 m",
  dimW: "0.60 m",
  dimD: "1.07 m",
  step: (g, i, n) => `${g} · metric ${i} / ${n}`,
  conf: (c) => `${c} confidence`,
  costChip: "cost (lower is better)",
  scope: { gpu: "GPU", cpu: "CPU", rack: "Rack" },
  more: (p) => `+${p}% more`,
  less: (p) => `${p}% less`,
  costUp: (p) => `+${p}% higher cost`,
  costDown: (p) => `${p}% lower cost`,
  source: "Source: ",
  perRack: (v) => `per rack: ${v}`,
  rackFast: (v) => `per rack (HBM + CPU): ${v}`,
  tray: (n) => `compute tray ${n}/18`,
  kinds: { GPU: "GPU", CPU: "CPU", SW: "NVLink switch tray", NIC: "NIC (scale-out)", PWR: "Power shelf" },
  parts: {
    GPU: { b300: "B300 · 15 PF FP4 · 288 GB HBM3e · 8 TB/s", rubin: "Rubin · 50 PF FP4 · 288 GB HBM4 · 22 TB/s" },
    CPU: { b300: "Grace · 72 cores · 480 GB LPDDR5X", rubin: "Vera · 88 cores / 176 threads · 1.5 TB LPDDR5X" },
    SW: { b300: "NVLink 5 · 1.8 TB/s per GPU · 130 TB/s per rack", rubin: "NVLink 6 · 3.6 TB/s per GPU · 260 TB/s per rack" },
    NIC: { b300: "ConnectX-8 · 800 Gb/s per GPU", rubin: "ConnectX-9 · 1.6 Tb/s per GPU" },
    PWR: { b300: "Rack up to ~142 kW", rubin: "Rack up to ~227 kW (Max-P) / 187 kW (Max-Q)" },
  },
  units: {},
  metricNames: {},
  groups: {},
};

const ZH = {
  htmlLang: "zh-CN",
  docTitle: "双机柜对比 —— GB300 NVL72 对比 Vera Rubin NVL72",
  title: "双机柜对比",
  vs: "对比",
  hint: "拖动旋转 · 滚轮或双指缩放 · 空格 = 播放/暂停 · ←/→ = 上一项/下一项 · R = 重新播放",
  intro: "两个机柜尺寸相同（约 0.60 × 1.07 × 2.24 米），尺寸直接标注在机柜上。每个指标对应的机柜部件会高亮显示。",
  barTitle: "柱高与数值成正比",
  introKicker: "机柜级对比",
  introTitle: '英伟达 <span class="nr">Rubin</span> <span class="vs">与</span> <span class="nb">B300</span>',
  introSub: "英伟达新旧两代数据中心芯片对比",
  introHint: (n) => `接下来共 ${n} 项规格 · 按空格键自动播放，或按 → / 滑动卡片逐项浏览`,
  sumKicker: "概览",
  sumTitle: "机柜相同，芯片不同",
  sumSize: "每个机柜宽 0.60 米、深 1.07 米、高 2.24 米——两者相同，此处按实际尺寸绘制。",
  gpus: (n) => `72 颗 ${n} GPU`,
  cpus: (n) => `36 颗 ${n} CPU`,
  perGpu: (hbm) => `576 个 ${hbm} 堆栈`,
  hbmB: "HBM3e",
  hbmR: "HBM4",
  computeTrays: "18 个计算托盘",
  switchTrays: (gen) => `9 个 NVLink ${gen} 交换托盘`,
  introGroup: "开场",
  frameNames: { intro: "标题", summary: "概览：机柜与芯片" },
  compared: "差异",
  language: "语言",
  auto: "自动对比",
  prev: "‹ 上一项",
  replay: "↺ 从头重新播放",
  replayTitle: "回到标题页并自动播放（R）",
  next: "下一项 ›",
  play: "▶ 自动播放",
  playTitle: "播放 / 暂停（空格键）",
  pause: "❚❚ 暂停",
  dwell: "每项停留秒数",
  camFollow: "镜头跟随高亮部件",
  loop: "循环播放",
  cardH: "规格卡片",
  floatCard: "卡片悬浮在场景上、标题下方（取消勾选则停靠在底部）",
  notes: "在卡片上显示备注与来源",
  opacity: "卡片不透明度",
  titleOpacity: "标题页不透明度",
  ariaLanguage: "语言",
  ariaDwell: "每项停留秒数",
  ariaOpacity: "卡片不透明度",
  layers: "图层",
  nvlink: "NVLink 流量（粒子速度表示链路带宽）",
  dims: "机柜尺寸标注（米）",
  metrics: "指标",
  hide: "隐藏面板 ⟩",
  show: "⟨ 显示面板",
  open: "☰ 控制",
  close: "✕ 关闭",
  dimH: "2.24 米",
  dimW: "0.60 米",
  dimD: "1.07 米",
  step: (g, i, n) => `${g} · ${i} / ${n}`,
  conf: (c) => `可信度${{ high: "高", medium: "中", low: "低" }[c]}`,
  costChip: "成本项（越低越好）",
  scope: { gpu: "GPU", cpu: "CPU", rack: "整机柜" },
  more: (p) => `高出 ${p}%`,
  less: (p) => `低 ${Math.abs(p)}%`,
  costUp: (p) => `成本高 ${p}%`,
  costDown: (p) => `成本低 ${Math.abs(p)}%`,
  source: "来源：",
  perRack: (v) => `整柜：${v}`,
  rackFast: (v) => `整柜（HBM + CPU）：${v}`,
  tray: (n) => `计算托盘 ${n}/18`,
  kinds: { GPU: "GPU", CPU: "CPU", SW: "NVLink 交换托盘", NIC: "网卡（横向扩展）", PWR: "电源架" },
  parts: {
    GPU: { b300: "B300 · FP4 15 PF · 288 GB HBM3e · 8 TB/s", rubin: "Rubin · FP4 50 PF · 288 GB HBM4 · 22 TB/s" },
    CPU: { b300: "Grace · 72 核 · 480 GB LPDDR5X", rubin: "Vera · 88 核 / 176 线程 · 1.5 TB LPDDR5X" },
    SW: { b300: "NVLink 5 · 每 GPU 1.8 TB/s · 整柜 130 TB/s", rubin: "NVLink 6 · 每 GPU 3.6 TB/s · 整柜 260 TB/s" },
    NIC: { b300: "ConnectX-8 · 每 GPU 800 Gb/s", rubin: "ConnectX-9 · 每 GPU 1.6 Tb/s" },
    PWR: { b300: "整柜最高约 142 kW", rubin: "整柜最高约 227 kW（Max-P）/ 187 kW（Max-Q）" },
  },
  units: { cores: "核" },
  metricNames: {
    "Process node": "制程工艺", Transistors: "晶体管数量", "NVFP4 inference": "NVFP4 推理算力", "NVFP4 training": "NVFP4 训练算力",
    FP64: "FP64 算力", "HBM capacity": "HBM 容量", "HBM bandwidth": "HBM 带宽",
    "NVLink bandwidth per GPU": "每 GPU NVLink 带宽", "Scale-out NIC per GPU": "每 GPU 横向扩展网卡带宽", "GPU power (max)": "GPU 功耗（最大）",
    "CPU cores": "CPU 核心数", "CPU memory per CPU": "每颗 CPU 内存容量", "CPU memory bandwidth": "CPU 内存带宽",
    "Rack power (max)": "整柜功耗（最大）", "Rack price (analyst est.)": "整柜价格（分析师估算）", "Volume availability": "量产供货时间",
  },
  groups: { Silicon: "芯片工艺", "GPU compute": "GPU 算力", "GPU memory": "GPU 显存", Interconnect: "互连", Power: "功耗", CPU: "CPU", Rack: "整机柜", Timing: "供货时间" },
};

/** The strings and formatters for one language. */
export function makeText(lang) {
  const zh = lang === "zh";
  const s = zh ? ZH : EN;
  const locale = zh ? "zh-CN" : "en-US";
  /** A spec value: 3 decimals under 1, 2 under 10, 1 under 100, none above; prices in $M / 万美元;
   *  billions in 亿, where the value carries the scale (208 billion -> 2080 亿). */
  const value = (v, unit) => {
    if (unit === "USD M") return zh ? Math.round(v * 100).toLocaleString(locale) : `$${v.toFixed(1)}M`; // zh: "万美元" goes in the unit text
    if (zh && unit === "billion") { // 208 billion reads 2080 亿: 亿 is the unit, the "-illion" scale is not
      const n = v * 10, a = Math.abs(n), d = a >= 100 ? 0 : a >= 10 ? 1 : 2;
      return `${+n.toFixed(d)} 亿`;
    }
    const a = Math.abs(v), d = a >= 100 ? 0 : a >= 10 ? 1 : a >= 1 ? 2 : 3;
    return (+v.toFixed(d)).toLocaleString(locale, { maximumFractionDigits: d });
  };
  return {
    lang: zh ? "zh" : "en",
    s,
    value,
    metric: (row) => s.metricNames[row.id] || row.id,
    group: (g) => s.groups[g] || g,
    note: (row) => (zh ? row.noteZh : row.note) || "",
    about: (row) => (zh ? row.aboutZh : row.about) || "",
    text: (row, i) => (zh && row.textZh ? row.textZh[i] : i ? row.rubin : row.b300),
    unit: (u) => (u === "USD M" ? (zh ? "万美元" : "") : u === "text" || (zh && u === "billion") ? "" : s.units[u] || u),
    sub: (row, i) => ((zh ? row.subZh : row.sub) || [])[i] || "",
  };
}
