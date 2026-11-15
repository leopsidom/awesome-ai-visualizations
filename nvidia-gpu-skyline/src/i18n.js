/**
 * Every string the page shows, in English and Simplified Chinese, and the date, number
 * and unit formats for each. No DOM and no Three.js.
 *
 * GPU names, chip codenames and architecture names stay in English in both languages,
 * as Chinese tech media writes them. Transistor counts use 万 and 亿 in Chinese
 * (3.1 B is 31 亿; 57 M is 5700 万). The Chinese strings were machine-written and
 * have not been reviewed by a native reader.
 */

export const LANGS = ["en", "zh"];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const EN = {
  htmlLang: "en",
  docTitle: "Tapeout — thirty years of NVIDIA GPUs as a skyline",
  boot: "laying out the wafer",
  fallback: "The 3D scene could not start (WebGL or the three.js CDN is unavailable).",
  title: "Tapeout",
  subtitle: "NVIDIA GPUs, 1995–2025",
  language: "Language",
  eyebrow: "NVIDIA GPUs",
  hud: (n, measure) => `${n} GPUs released · height = ${measure}`,
  timeline: "Timeline",
  play: "Play",
  pause: "Pause",
  showAll: "Show all",
  resetView: "Reset view",
  speed: "Speed",
  follow: "Camera follows the year",
  followHint: "On by default on narrow screens such as phones, where 1995–2025 doesn't fit at once.",
  upTo: (y) => `Releases up to ${y}`,
  all: "All releases, May 1995 to Oct 2025",
  height: "Tower height",
  measures: { transistors: "Transistors", process: "Process node", power: "Power draw" },
  units: { log: "log scale", linear: "linear scale", smaller: "smaller = taller" },
  tscale: "Transistor scale",
  log: "Log",
  linear: "Linear",
  scaleTitle: "Applies to the transistor height. Clicking also switches the height to transistors.",
  hintLog: "Log: each step on the scale is 10×, so growth in every era stays visible.",
  hintLinear: "Linear: true proportions. Most chips before 2016 shrink to stubs beside the B200 (208 B).",
  markets: "Markets",
  marketNames: {
    console: "Console & embedded",
    consumer: "Consumer (GeForce / Titan)",
    workstation: "Workstation (Quadro / RTX Pro)",
    datacenter: "Data center / AI",
  },
  // One line each: the lanes are close together on screen at the left end of the scene.
  laneNames: {
    console: "Console & embedded",
    consumer: "Consumer",
    workstation: "Workstation",
    datacenter: "Data center / AI",
  },
  arch: "Architecture",
  clear: "clear",
  archHint: "Click a family, a tower or a bar to spotlight it.",
  display: "Display",
  milestones: (n) => `Milestone labels (${n})`,
  key: {
    solid: "Verified or corrected",
    partial: "Partially verified",
    hollow: "Not yet verified (hollow)",
    stub: "No figure for this measure",
  },
  keys: [
    ["space", "play / pause"],
    ["L", "log / linear transistors"],
    ["R", "reset the view"],
    ["F", "camera follows the year"],
    ["Esc", "clear the spotlight"],
    ["H", "hide this panel"],
    ["drag", "orbit; right-drag pans, scroll zooms"],
  ],
  note:
    "135 GPUs. The 50 not yet checked against a source are drawn hollow. Data-center and workstation products are dated by announcement. See the README.",
  panelOpen: "Controls",
  hide: "Hide this panel (H)",
  show: "Show the panel (H)",
  tip: {
    market: "Market",
    process: "Process",
    transistors: "Transistors",
    die: "Die size",
    cores: "Cores",
    memory: "Memory",
    power: "Power",
    price: "Launch price",
  },
  status: {
    verified: "Verified",
    corrected: "Corrected after the check",
    partial: "Partially verified",
    unverified: "Not yet verified",
  },
  era: (n, from, to) => `${from === to ? from : `${from}–${to}`} · ${n} GPU${n === 1 ? "" : "s"}`,
};

const ZH = {
  htmlLang: "zh-CN",
  docTitle: "流片 — NVIDIA GPU 三十年天际线",
  boot: "正在铺设晶圆",
  fallback: "三维场景无法启动（WebGL 或 three.js CDN 不可用）。",
  title: "流片",
  subtitle: "NVIDIA GPU，1995–2025",
  language: "语言",
  eyebrow: "NVIDIA GPU",
  hud: (n, measure) => `已发布 ${n} 款 GPU · 柱高 = ${measure}`,
  timeline: "时间线",
  play: "播放",
  pause: "暂停",
  showAll: "显示全部",
  resetView: "重置视角",
  speed: "速度",
  follow: "镜头跟随年份",
  followHint: "在手机等窄屏上默认开启，因为无法一次显示 1995–2025 全程。",
  upTo: (y) => `显示截至 ${y} 年的发布`,
  all: "全部发布：1995年5月 至 2025年10月",
  height: "柱高指标",
  measures: { transistors: "晶体管数量", process: "制程工艺", power: "功耗" },
  units: { log: "对数刻度", linear: "线性刻度", smaller: "越小越高" },
  tscale: "晶体管刻度",
  log: "对数",
  linear: "线性",
  scaleTitle: "作用于晶体管柱高；点击后柱高也会切换为晶体管数量。",
  hintLog: "对数刻度：刻度每格相差 10 倍，各时代的增长都清晰可见。",
  hintLinear: "线性刻度：真实比例。与 B200（2080 亿）相比，2016 年前的大多数芯片几乎贴地。",
  markets: "市场",
  marketNames: {
    console: "主机与嵌入式",
    consumer: "消费级（GeForce / Titan）",
    workstation: "工作站（Quadro / RTX Pro）",
    datacenter: "数据中心 / AI",
  },
  laneNames: {
    console: "主机与嵌入式",
    consumer: "消费级",
    workstation: "工作站",
    datacenter: "数据中心 / AI",
  },
  arch: "架构",
  clear: "清除",
  archHint: "点击架构、任意柱体或色带即可高亮。",
  display: "显示",
  milestones: (n) => `里程碑标签（${n}）`,
  key: {
    solid: "已核实或已更正",
    partial: "部分核实",
    hollow: "尚未核实（空心）",
    stub: "该指标无数据",
  },
  keys: [
    ["space", "播放 / 暂停"],
    ["L", "晶体管对数 / 线性"],
    ["R", "重置视角"],
    ["F", "镜头跟随年份"],
    ["Esc", "取消高亮"],
    ["H", "隐藏此面板"],
    ["拖动", "旋转；右键拖动平移，滚轮缩放"],
  ],
  note: "共 135 款 GPU。其中 50 款尚未与来源核对，以空心柱显示；数据中心与工作站产品按发布公告日期计。详见 README。",
  panelOpen: "控制面板",
  hide: "隐藏此面板（H）",
  show: "显示面板（H）",
  tip: {
    market: "市场",
    process: "制程",
    transistors: "晶体管",
    die: "核心面积",
    cores: "核心数",
    memory: "显存",
    power: "功耗",
    price: "首发价格",
  },
  status: {
    verified: "已核实",
    corrected: "核查后已更正",
    partial: "部分核实",
    unverified: "尚未核实",
  },
  era: (n, from, to) => `${from === to ? from : `${from}–${to}`} · ${n} 款 GPU`,
};

/** Three significant figures, without trailing zeros. */
const sig = (v) => Number(v.toPrecision(3));

/** The strings and formatters for one language. */
export function makeText(lang) {
  const zh = lang === "zh";
  const s = zh ? ZH : EN;
  const locale = zh ? "zh-CN" : "en-US";

  const number = (n) => Number(n).toLocaleString(locale);
  const paren = (text) => (zh ? `（${text}）` : `(${text})`);

  /** `m` is in millions. */
  const transistors = (m) => {
    if (m == null) return "—";
    if (zh) return m < 100 ? `${Math.round(m * 100)} 万` : `${sig(m / 100)} 亿`;
    return m < 1000 ? `${sig(m)} M` : `${sig(m / 1000)} B`;
  };

  const date = (iso) => {
    const [y, m, d] = iso.split("-").map(Number);
    if (zh) return d ? `${y}年${m}月${d}日` : `${y}年${m}月`;
    return d ? `${d} ${MONTHS[m - 1]} ${y}` : `${MONTHS[m - 1]} ${y}`;
  };

  const memory = (gb, type) => {
    let kind = type || "";
    if (zh) kind = kind.replace(" (shared)", "（共享）").replace(" (unified)", "（统一内存）");
    if (gb == null) return kind || "—";
    const size = gb < 1 ? `${Math.round(gb * 1024)} MB` : `${gb} GB`;
    return kind ? `${size} ${kind}` : size;
  };

  const price = (usd) => (zh ? `${number(usd)} 美元` : `$${number(usd)}`);

  const unit = (metric, scale) =>
    metric === "transistors" ? s.units[scale] : metric === "process" ? s.units.smaller : s.units.log;

  const measure = (metric, scale) => `${s.measures[metric]} ${paren(unit(metric, scale))}`;

  const tick = (metric, v) => {
    if (metric === "transistors") return transistors(v);
    if (metric === "process") return `${v} nm`;
    return v >= 1000 ? `${v / 1000} kW` : `${v} W`;
  };

  return {
    lang: zh ? "zh" : "en",
    s,
    number,
    paren,
    transistors,
    date,
    memory,
    price,
    unit,
    measure,
    tick,
    note: (g) => (zh ? g.noteZh : g.note) || "",
    milestone: (g) => (zh ? g.milestoneZh : g.milestone) || "",
  };
}
