/**
 * Every string the page shows, in English and Simplified Chinese, and the date, number and unit
 * formats for each. No DOM and no Three.js.
 *
 * GPU names, chip codenames and architecture names stay in English in both languages, as Chinese
 * tech media writes them. Transistor counts use 万 and 亿 in Chinese (57 M is 5700 万, 681 M is
 * 6.81 亿, 76.3 B is 763 亿). The Chinese strings were machine-written and have not been reviewed
 * by a native reader.
 */

export const LANGS = ["en", "zh"];

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const EN = {
  htmlLang: "en",
  docTitle: "GeForce Gallery — thirty years of NVIDIA consumer GPUs",
  fallback: "The 3D scene could not start (WebGL or the three.js CDN is unavailable). The story cards still work from the panel.",
  title: "GeForce Gallery",
  subtitle: "NVIDIA consumer GPUs, 1995–2025",
  language: "Language",
  playback: "Playback",
  play: "Play",
  pause: "Pause",
  restart: "Restart",
  prev: "Previous milestone",
  next: "Next milestone",
  hold: "Hold / continue",
  speed: "Speed",
  storyPause: "Story pause",
  card: "Story card",
  opacity: "Opacity",
  milestones: "Milestones",
  controls: "Controls",
  hidePanel: "Hide panel (H)",
  about: "Eight milestone cards stand on plinths at their true size (1 unit = 10 cm). The other 80 consumer GPUs hang on the wall at 55% scale, in an era-typical size. Hover or tap any card for its specs.",
  keys: "<kbd>space</kbd> play / pause · <kbd>←</kbd> <kbd>→</kbd> milestones · <kbd>R</kbd> restart · <kbd>H</kbd> panel",
  hint: "<kbd>space</kbd> hold · <kbd>←</kbd> <kbd>→</kbd> step",
  chapter: (k, kicker) => `Chapter ${k} · ${kicker}`,
  of: (k, n) => `${k} / ${n}`,
  dimsEstimated: "Card size estimated from the era's standard form factor.",
  specs: { transistors: "Transistors", memory: "Memory", power: "Power", price: "Price", card: "Card", slots: "Slots" },
  transistorsWord: "transistors",
  fmtSlots: (s) => (s == null ? "—" : s === 1 ? "1 slot" : `${s} slots`),
  heroStatus: "verified · Nov 2026 check",
  sizeEstimated: " · size estimated",
  sizeEra: " · size era-typical",
  status: { verified: "verified", corrected: "corrected", partial: "partial", unverified: "unverified" },
  seconds: (s) => `${s} s`,
  fmtT: (m) => (m == null ? "—" : m >= 1000 ? `${trim((m / 1000).toFixed(m >= 10000 ? 1 : 2))} B` : `${m} M`),
  fmtDate: (d) => {
    const p = d.split("-");
    return p.length === 3 ? `${MONTHS[+p[1] - 1]} ${+p[2]}, ${p[0]}` : `${MONTHS[+p[1] - 1]} ${p[0]}`;
  },
  fmtMonth: (m) => MONTHS[m],
};

const ZH = {
  htmlLang: "zh-CN",
  docTitle: "GeForce 陈列馆 — NVIDIA 消费级 GPU 三十年",
  fallback: "3D 场景无法启动（WebGL 或 three.js CDN 不可用）。面板中的故事卡片仍可使用。",
  title: "GeForce 陈列馆",
  subtitle: "NVIDIA 消费级 GPU，1995–2025",
  language: "语言",
  playback: "播放",
  play: "播放",
  pause: "暂停",
  restart: "重新开始",
  prev: "上一个里程碑",
  next: "下一个里程碑",
  hold: "暂停 / 继续",
  speed: "速度",
  storyPause: "故事停留",
  card: "故事卡片",
  opacity: "不透明度",
  milestones: "里程碑",
  controls: "控制",
  hidePanel: "隐藏面板（H）",
  about: "八款里程碑显卡按真实尺寸立在展台上（1 单位 = 10 厘米）。其余 80 款消费级 GPU 以 55% 比例、按所属年代的典型尺寸挂在墙上。悬停或点按任意显卡可查看规格。",
  keys: "<kbd>空格</kbd> 播放 / 暂停 · <kbd>←</kbd> <kbd>→</kbd> 里程碑 · <kbd>R</kbd> 重新开始 · <kbd>H</kbd> 面板",
  hint: "<kbd>空格</kbd> 暂停 · <kbd>←</kbd> <kbd>→</kbd> 切换",
  chapter: (k, kicker) => `第 ${k} 章 · ${kicker}`,
  of: (k, n) => `${k} / ${n}`,
  dimsEstimated: "显卡尺寸按当时的标准规格估算。",
  specs: { transistors: "晶体管", memory: "显存", power: "功耗", price: "价格", card: "尺寸", slots: "槽位" },
  transistorsWord: "晶体管",
  fmtSlots: (s) => (s == null ? "—" : { 1: "单槽", 2: "双槽", 3: "三槽", 4: "四槽" }[s] || `${s} 槽`),
  heroStatus: "已核实 · 2026 年 11 月复核",
  sizeEstimated: " · 尺寸为估算",
  sizeEra: " · 尺寸为年代典型值",
  status: { verified: "已核实", corrected: "已更正", partial: "部分核实", unverified: "未核实" },
  seconds: (s) => `${s} 秒`,
  fmtT: (m) =>
    m == null ? "—" : m < 100 ? `${Math.round(m * 100)} 万` : `${trim((m / 100).toFixed(m < 1000 ? 2 : m < 10000 ? 1 : 0))} 亿`,
  fmtDate: (d) => {
    const p = d.split("-");
    return p.length === 3 ? `${p[0]}年${+p[1]}月${+p[2]}日` : `${p[0]}年${+p[1]}月`;
  },
  fmtMonth: (m) => `${m + 1}月`,
};

function trim(s) {
  return s.includes(".") ? s.replace(/\.?0+$/, "") : s;
}

/** Units that read the same in both languages. */
const shared = {
  fmtMem: (gb) => (gb == null ? "—" : gb < 1 ? `${Math.round(gb * 1024)} MB` : `${gb} GB`),
  fmtW: (w) => (w == null ? "—" : `${w} W`),
  fmtPrice: (p) => (p == null ? "—" : "$" + p.toLocaleString("en-US")),
  fmtCard: (l, h) => `${Math.round(l)}×${Math.round(h)} mm`,
};

export function makeText(lang) {
  const t = { ...shared, ...(lang === "zh" ? ZH : EN) };
  // Chinese sets the numeral and its noun together ("763 亿晶体管"); English separates them.
  t.trLine = (m) =>
    m == null ? `— ${t.transistorsWord}` : lang === "zh" ? `${t.fmtT(m)}${t.transistorsWord}` : `${t.fmtT(m)} ${t.transistorsWord}`;
  return t;
}

/** Story-card copy for a hero row, in the given language. */
export function heroCopy(hero, lang) {
  return lang === "zh"
    ? { kicker: hero.kickerZh, stat: hero.statZh, label: hero.labelZh, story: hero.storyZh }
    : { kicker: hero.kicker, stat: hero.stat, label: hero.label, story: hero.story };
}

/** A GPU's note in the given language, falling back to English. */
export const noteOf = (g, lang) => (lang === "zh" ? g.noteZh || g.note : g.note) || "";
