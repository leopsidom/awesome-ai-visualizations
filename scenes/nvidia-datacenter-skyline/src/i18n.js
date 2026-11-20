/**
 * Every string the page shows, in English and Simplified Chinese, and the number, date and
 * unit formats for each. No DOM and no Three.js.
 *
 * GPU, chip and architecture names stay in English in both languages, as Chinese tech media
 * writes them. Transistor counts use 万 and 亿 in Chinese (3.1 B is 31 亿; 681 M is 6.81 亿).
 * The Chinese strings were machine-written and have not been reviewed by a native reader.
 */

export const LANGS = ["en", "zh"];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const EN = {
  htmlLang: "en",
  docTitle: "The AI Factory — NVIDIA data-center GPUs as a data hall",
  fallback: "The 3D scene could not start (WebGL or the three.js CDN is unavailable).",
  title: "The AI Factory",
  subtitle: "NVIDIA data-center GPUs, 2007–2025. Click a rack to focus; ← → to step.",
  language: "Language",
  timeline: "Timeline",
  play: "▶ Play",
  pause: "❚❚ Pause",
  showAll: "Show all",
  resetView: "Reset view",
  speed: "Speed",
  cardOpacity: "Card",
  follow: "Camera follows the focused GPU",
  labels: "Labels",
  height: "Rack height",
  measures: { transistors: "Transistors", memory: "Memory", watts: "Board power", cores: "CUDA cores" },
  scale: "Scale",
  scaleNames: { linear: "Linear", log: "Log" },
  scaleWords: { linear: "linear", log: "log" },
  colour: "Colour",
  rampSmall: "smaller",
  rampLarge: "larger",
  opacityHint: "Card opacity",
  hud: (m, sc) => `Height: ${m.toLowerCase()} (${sc})`,
  encoding: "Encoding",
  encodingHtml:
    "<b>Height</b> and <b>colour</b> measure · <b>Depth</b> memory · <b>Glow</b> power<br><b>Solid</b> verified or corrected · <b>see-through</b> partly checked",
  controls: "☰ Controls",
  hidePanel: "Hide panel (H)",
  // detail card
  prev: "Previous GPU (←)",
  next: "Next GPU (→)",
  close: "Close (Esc)",
  announced: (d) => `announced ${d}`,
  status: { verified: "verified", corrected: "corrected", partial: "partial" },
  statusNote: {
    verified: "Checked against NVIDIA, TechPowerUp or Wikipedia.",
    corrected: "Checked; at least one value was corrected.",
    partial: "Partly checked; some figures could not be confirmed.",
  },
  fields: {
    process: "Process",
    transistors: "Transistors",
    die: "Die size",
    cores: "CUDA cores",
    memory: "Memory",
    watts: "Board power",
    price: "Launch price",
    perWatt: "Transistors / W",
  },
  change: "Generational change",
  cols: ["transistors", "memory", "power"],
  vs: (n) => `vs ${n}`,
  vsFirst: (n) => `vs ${n} (2007)`,
  first: "The first data-center GPU in the set.",
  na: "n/a",
  tipHint: "click to focus",
  prototype: "",
};

const ZH = {
  htmlLang: "zh-CN",
  docTitle: "AI 工厂 —— NVIDIA 数据中心 GPU 机房",
  fallback: "3D 场景无法启动（WebGL 或 three.js CDN 不可用）。",
  title: "AI 工厂",
  subtitle: "NVIDIA 数据中心 GPU，2007–2025。点击机柜聚焦；← → 逐个浏览。",
  language: "语言",
  timeline: "时间线",
  play: "▶ 播放",
  pause: "❚❚ 暂停",
  showAll: "全部显示",
  resetView: "重置视角",
  speed: "速度",
  cardOpacity: "卡片",
  follow: "镜头跟随聚焦的 GPU",
  labels: "标签",
  height: "机柜高度",
  measures: { transistors: "晶体管数", memory: "显存", watts: "板卡功耗", cores: "CUDA 核心" },
  scale: "刻度",
  scaleNames: { linear: "线性", log: "对数" },
  scaleWords: { linear: "线性", log: "对数" },
  colour: "颜色",
  rampSmall: "较小",
  rampLarge: "较大",
  opacityHint: "卡片不透明度",
  hud: (m, sc) => `高度：${m}（${sc}）`,
  encoding: "图例",
  encodingHtml:
    "<b>高度</b>与<b>颜色</b> 所选指标 · <b>进深</b> 显存 · <b>辉光</b> 功耗<br><b>实心</b> 已核实或已更正 · <b>半透明</b> 部分核实",
  controls: "☰ 控制面板",
  hidePanel: "隐藏面板（H）",
  prev: "上一个 GPU（←）",
  next: "下一个 GPU（→）",
  close: "关闭（Esc）",
  announced: (d) => `发布于 ${d}`,
  status: { verified: "已核实", corrected: "已更正", partial: "部分核实" },
  statusNote: {
    verified: "已对照 NVIDIA、TechPowerUp 或维基百科核实。",
    corrected: "已核实；至少一项数值经过更正。",
    partial: "部分核实；部分数值未能确认。",
  },
  fields: {
    process: "制程",
    transistors: "晶体管数",
    die: "核心面积",
    cores: "CUDA 核心",
    memory: "显存",
    watts: "板卡功耗",
    price: "首发价格",
    perWatt: "每瓦晶体管",
  },
  change: "代际变化",
  cols: ["晶体管", "显存", "功耗"],
  vs: (n) => `对比 ${n}`,
  vsFirst: (n) => `对比 ${n}（2007）`,
  first: "本数据集中的第一款数据中心 GPU。",
  na: "暂无",
  tipHint: "点击聚焦",
  prototype: "",
};

/** Three significant figures, without trailing zeros. */
const sig = (v) => Number(v.toPrecision(3));

/** The strings and formatters for one language. */
export function makeText(lang) {
  const zh = lang === "zh";
  const s = zh ? ZH : EN;
  const locale = zh ? "zh-CN" : "en-US";
  const number = (n) => Number(n).toLocaleString(locale);

  /** `m` is in millions. */
  const transistors = (m) => {
    if (m == null) return null;
    if (zh) return m < 100 ? `${Math.round(m * 100)} 万` : `${sig(m / 100)} 亿`;
    return m < 1000 ? `${sig(m)} M` : `${sig(m / 1000)} B`;
  };
  const date = (iso) => {
    const [y, m, d] = iso.split("-").map(Number);
    if (zh) return d ? `${y}年${m}月${d}日` : `${y}年${m}月`;
    return d ? `${d} ${MONTHS[m - 1]} ${y}` : `${MONTHS[m - 1]} ${y}`;
  };
  const price = (usd) => (usd == null ? null : zh ? `${number(usd)} 美元` : `$${number(usd)}`);

  return {
    lang: zh ? "zh" : "en",
    s,
    number,
    transistors,
    date,
    price,
    note: (g) => (zh ? g.noteZh : g.note) || "",
    milestone: (g) => (zh ? g.milestoneZh : g.milestone) || "",
  };
}
