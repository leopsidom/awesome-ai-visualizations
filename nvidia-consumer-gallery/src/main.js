/**
 * GeForce Gallery: thirty years of NVIDIA consumer GPUs as a gallery walk.
 *
 * The camera walks a curved path. Nine milestone cards stand on spotlit plinths at their true
 * size; the other 79 consumer GPUs hang on the wall behind and scroll up the left of the stage as
 * a list. At each milestone the walk pauses and a see-through story card pops up out of the GPU,
 * anchored just above it like a pop-up menu, with an arrow pointing at the card.
 *
 * This module owns the state and everything that is not 3D: panel, story card, list, tooltip,
 * input, layout mode and the frame loop. It imports no Three.js; world.js is loaded with a dynamic
 * import, so if WebGL or the CDN fails the panel and story cards still work.
 */
import { ARCH, GPUS } from "./data.js";
import { LANGS, makeText, heroCopy, noteOf } from "./i18n.js";
import { HEROES, HERO_IDX, U_START, U_END, chapterOf, speedAt, timeAt } from "./layout.js";

const $ = (id) => document.getElementById(id);
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const LANG_KEY = "geforce-gallery-lang", OPACITY_KEY = "geforce-gallery-card-opacity";
const STATUS_COLOR = { verified: "#76b900", corrected: "#76b900", partial: "#d4ad32", unverified: "#e07a68" };
const shortName = (n) => n.replace(" / STG-2000", "");

// ---------------------------------------------------------------- state
const params = new URLSearchParams(location.search);
const state = {
  lang: LANGS.includes(params.get("lang")) ? params.get("lang") : LANGS.includes(localStorage.getItem(LANG_KEY)) ? localStorage.getItem(LANG_KEY) : "en",
  u: U_START, playing: true, speed: 1, pauseSec: 7,
  mode: "travel", k: -1, left: 0, shown: new Set(),
  narrow: false, short: false,
};
let text = makeText(state.lang);
let world = null;

const stage = $("stage"), panel = $("panel"), story = $("story"), caret = $("caret"), list = $("list"), jump = $("jump"), tip = $("tip");

// ---------------------------------------------------------------- layout mode
// narrow: portrait phones, tablets and small windows (panel below, card docked full-width at top).
// short: landscape phones (wide but under 500 px tall; story card as a column on the right).
function checkMode() {
  const aspect = innerWidth / innerHeight;
  const narrow = innerWidth < 760 || aspect < 0.9, short = !narrow && innerHeight < 500;
  if (narrow === state.narrow && short === state.short) return;
  state.narrow = narrow; state.short = short;
  document.body.classList.toggle("narrow", narrow);
  document.body.classList.toggle("short", short);
  syncList(true);
}

// ---------------------------------------------------------------- list of minor GPUs
let listed = -2;
function syncList(rebuild = false) {
  let idx = -1;
  for (let i = 0; i < GPUS.length; i++) if (!GPUS[i].hero && GPUS[i].u <= state.u + 1e-6) idx = i;
  if (idx === listed && !rebuild) return;
  listed = idx;
  // Centred under the wall: the newest line is the card being passed (the one in the spotlight), set larger;
  // the lines above it fade out. Fewer lines than before, so it reads at a glance.
  const max = state.narrow || state.short ? 2 : 4;
  const rows = GPUS.filter((g) => !g.hero && g.u <= state.u + 1e-6).slice(-max);
  list.innerHTML = rows.map((g, i) => `<div class="row${i === rows.length - 1 ? " now" : ""}" style="opacity:${i === rows.length - 1 ? 1 : (0.25 + (0.45 * (i + 1)) / rows.length).toFixed(2)}">
      <span class="sw" style="background:${ARCH[g.arch]}"></span><span class="d">${g.date.slice(0, 7)}</span><span class="n">${g.name}</span>
      <span class="t">${noteOf(g, state.lang) || `${g.chip} · ${g.arch}`}</span></div>`).join("");
}

// ---------------------------------------------------------------- story card
function fillStory(k) {
  const g = HEROES[k], h = g.hero, c = heroCopy(h, state.lang), s = text.specs;
  $("sKicker").textContent = `${text.of(k + 1, HEROES.length)} · ${c.kicker}`;
  $("sName").textContent = shortName(g.name);
  $("sWhen").textContent = `${text.fmtDate(g.date)} · ${g.chip} · ${g.arch}`;
  $("sStat").textContent = c.stat;
  $("sStatLabel").textContent = c.label;
  $("sStory").textContent = c.story;
  $("sSpecs").innerHTML = [
    [s.transistors, text.fmtT(g.transistors)], [s.memory, text.fmtMem(g.memory)], [s.power, text.fmtW(g.watts)],
    [s.price, text.fmtPrice(g.price)], [s.card, text.fmtCard(h.length, h.height)], [s.slots, text.fmtSlots(h.slots)],
  ].map(([a, b]) => `<div><span>${a}</span>${b}</div>`).join("");
}
function openStory(k) {
  state.mode = "story"; state.k = k; state.left = state.pauseSec; state.shown.add(k);
  fillStory(k);
  story.hidden = false; caret.hidden = !world; story.scrollTop = 0;
  document.body.classList.add("story-open");
  markJump();
  if (world) {
    placeStory();
    if (!reduced) {   // pop up out of the arrow's tip, then settle
      const opts = { duration: 600, easing: "cubic-bezier(.2,.8,.2,1)" };
      story.animate([{ transform: "scale(.06)", opacity: 0.2 }, { transform: "scale(1.02)", opacity: 1, offset: 0.8 }, { transform: "scale(1)", opacity: 1 }], opts);
      caret.animate([{ opacity: 0 }, { opacity: 0, offset: 0.5 }, { opacity: 1 }], opts);
    }
  }
}

// The story card is a pop-up anchored to the focused GPU's on-screen box, re-placed every frame so it
// follows the card while the camera moves. Above the GPU (arrow pointing down) on desktop and portrait
// screens; to its right (arrow pointing left) on landscape phones, which have no room above. It is kept
// 8 px inside the stage; if there is not enough room it overlaps the GPU rather than leave the stage.
const GAP = 14, EDGE = 8, BTN_ROOM = 52;
function placeStory() {
  const a = world.heroBox(state.k), W = stage.clientWidth, H = stage.clientHeight;
  const w = story.offsetWidth, h = story.offsetHeight;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  let left, top, cx, cy, side;
  if (state.short) {
    left = clamp(a.right + GAP, EDGE, W - w - EDGE);
    top = clamp(a.cy - h / 2, BTN_ROOM, H - h - EDGE);   // keep clear of the play / Controls buttons
    cx = left; cy = clamp(a.cy, top + 18, top + h - 18); side = "left";
  } else {
    left = clamp(a.cx - w / 2, EDGE, W - w - EDGE);
    top = clamp(a.top - GAP - h, EDGE, H - h - EDGE);
    cx = clamp(a.cx, left + 18, left + w - 18); cy = top + h; side = "down";
  }
  story.style.left = `${left}px`; story.style.top = `${top}px`;
  story.style.transformOrigin = side === "left" ? `0 ${cy - top}px` : `${cx - left}px 100%`;
  caret.className = side;
  caret.style.left = `${cx}px`; caret.style.top = `${cy}px`;
}
function closeStory() {
  story.hidden = true; caret.hidden = true; state.mode = "travel";
  document.body.classList.remove("story-open");
  markJump();
}
function goto(k) {
  k = Math.max(0, Math.min(HEROES.length - 1, k));
  state.u = HEROES[k].u; syncList(true); openStory(k);
}
const position = () => { const c = chapterOf(state.u); return state.mode === "story" ? state.k : c + (state.u > HEROES[c].u ? 0.5 : 0); };
const prev = () => goto(Math.ceil(position()) - 1);
const next = () => goto(Math.floor(position()) + 1);
function restart() { closeStory(); state.u = U_START; state.shown.clear(); syncList(true); setPlaying(true); }

// ---------------------------------------------------------------- panel
function setPlaying(p) {
  state.playing = p;
  $("bPlay").textContent = p ? text.pause : text.play;
  $("miniPlay").textContent = p ? "❚❚" : "▶";
  $("miniPlay").title = text.hold;
}
function markJump() { [...jump.children].forEach((li, i) => li.classList.toggle("active", state.mode === "story" && state.k === i)); }
function buildJump() {
  jump.innerHTML = "";
  HEROES.forEach((g, k) => {
    const li = document.createElement("li");
    li.innerHTML = `<span class="y">${g.date.slice(0, 4)}</span><span>${shortName(g.name)}<span class="k">${heroCopy(g.hero, state.lang).kicker}</span></span>`;
    li.onclick = () => goto(k);
    jump.appendChild(li);
  });
  markJump();
}
function setOpacity(v) {
  document.documentElement.style.setProperty("--card-a", (v / 100).toFixed(2));
  $("opacity").value = v; $("vOpacity").textContent = `${v}%`;
}
function applyLang(lang, persist = true) {
  state.lang = lang; text = makeText(lang);
  document.documentElement.lang = text.htmlLang;
  document.title = text.docTitle;
  document.querySelectorAll("[data-t]").forEach((el) => { el.innerHTML = text[el.dataset.t]; });
  $("lang-en").classList.toggle("on", lang === "en");
  $("lang-zh").classList.toggle("on", lang === "zh");
  $("bPrev").title = text.prev;
  $("bNext").title = text.next;
  $("closePanel").title = text.hidePanel;
  $("vPause").textContent = text.seconds(state.pauseSec);
  setPlaying(state.playing); buildJump(); syncList(true);
  if (state.mode === "story") fillStory(state.k);
  tip.hidden = true;
  if (persist) {
    localStorage.setItem(LANG_KEY, lang);
    params.set("lang", lang);
    history.replaceState(null, "", `${location.pathname}?${params}`);
  }
}
function togglePanel() {
  panel.classList.toggle("hidden");
  document.body.classList.toggle("panel-hidden", panel.classList.contains("hidden"));
}

$("bPlay").onclick = $("miniPlay").onclick = () => setPlaying(!state.playing);
$("bPrev").onclick = prev;
$("bNext").onclick = next;
$("bRestart").onclick = restart;
$("speed").oninput = (e) => { state.speed = +e.target.value; $("vSpeed").textContent = `${state.speed}×`; };
$("pause").oninput = (e) => { state.pauseSec = +e.target.value; $("vPause").textContent = text.seconds(state.pauseSec); };
$("opacity").oninput = (e) => { setOpacity(+e.target.value); localStorage.setItem(OPACITY_KEY, e.target.value); };
$("lang-en").onclick = () => applyLang("en");
$("lang-zh").onclick = () => applyLang("zh");
$("closePanel").onclick = $("openPanel").onclick = togglePanel;
addEventListener("keydown", (e) => {
  if (e.target.closest?.("input, textarea, select, [contenteditable]") || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.code === "Space") { e.preventDefault(); setPlaying(!state.playing); }
  else if (e.key === "ArrowRight") { e.preventDefault(); next(); }
  else if (e.key === "ArrowLeft") { e.preventDefault(); prev(); }
  else if (e.key === "r" || e.key === "R") restart();
  else if (e.key === "h" || e.key === "H") togglePanel();
});

// ---------------------------------------------------------------- tooltip (hover with a mouse, tap on touch)
function showTip(g, x, y) {
  if (!g) { tip.hidden = true; return; }
  const status = g.hero ? text.heroStatus + (g.hero.dimsEstimated ? text.sizeEstimated : "") : text.status[g.status] + text.sizeEra;
  const note = noteOf(g, state.lang);
  tip.innerHTML = `<b>${shortName(g.name)}</b><div class="m">${text.fmtDate(g.date)} · ${g.chip} · ${g.arch} · ${g.nm} nm</div>
    <div>${text.trLine(g.transistors)} · ${text.fmtMem(g.memory)} · ${text.fmtW(g.watts)} · ${text.fmtPrice(g.price)}</div>
    ${note ? `<div class="m">${note}</div>` : ""}<div class="st" style="color:${STATUS_COLOR[g.status] || "#999"}">${status}</div>`;
  tip.hidden = false;
  const s = stage.getBoundingClientRect();
  const left = Math.max(8, Math.min(x - s.left + 14, s.width - tip.offsetWidth - 8));
  const top = Math.max(8, Math.min(y - s.top + 14, s.height - tip.offsetHeight - 8));
  tip.style.left = `${left}px`; tip.style.top = `${top}px`;
}
let tipTimer = 0;
stage.addEventListener("pointermove", (e) => {
  if (!world || e.pointerType !== "mouse" || e.target.closest("#story, button")) return;
  const g = world.pick(e.clientX, e.clientY);
  stage.style.cursor = g ? "pointer" : "";
  showTip(g, e.clientX, e.clientY);
});
stage.addEventListener("pointerleave", () => { tip.hidden = true; });
stage.addEventListener("click", (e) => {
  if (!world || e.target.closest("#story, button")) return;
  const g = world.pick(e.clientX, e.clientY);
  if (g?.hero) { tip.hidden = true; goto(HERO_IDX.indexOf(g.i)); return; }
  showTip(g, e.clientX, e.clientY);
  clearTimeout(tipTimer);
  if (g) tipTimer = setTimeout(() => { tip.hidden = true; }, 3500);
});

// ---------------------------------------------------------------- boot
checkMode();
addEventListener("resize", checkMode);
if (state.narrow || state.short) togglePanel();
setOpacity(Math.max(40, Math.min(100, +(localStorage.getItem(OPACITY_KEY) || 80))));
applyLang(state.lang, params.has("lang"));
syncList(true);

try {
  const { createWorld } = await import("./world.js");
  world = createWorld(stage, { reduced });
} catch (err) {
  console.error(err);
  $("fallback").hidden = false;
  setPlaying(false);
}
document.body.classList.remove("booting");

// ---------------------------------------------------------------- frame loop
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (state.mode === "story") {
    if (state.playing) state.left -= dt * Math.max(1, state.speed * 0.6);
    $("sBar").style.transform = `scaleX(${Math.max(0, state.left / state.pauseSec)})`;
    if (state.left <= 0) { closeStory(); state.u += 0.02; }
  } else if (state.playing && world) {
    const nu = Math.min(U_END, state.u + speedAt(state.u) * state.speed * dt);
    const k = HEROES.findIndex((g, i) => !state.shown.has(i) && g.u > state.u - 1e-6 && g.u <= nu);
    if (k >= 0) { state.u = HEROES[k].u; syncList(); openStory(k); }
    else state.u = nu;
    if (state.u >= U_END) setPlaying(false);
  }
  syncList();
  const d = new Date(timeAt(state.u));
  $("year").textContent = d.getFullYear();
  $("month").textContent = text.fmtMonth(d.getMonth());
  const c = chapterOf(state.u);
  $("chapter").textContent = state.u < 0 ? "" : text.chapter(c + 1, heroCopy(HEROES[c].hero, state.lang).kicker);
  if (world) {
    // room the pop-up needs above the GPU, as a fraction of the stage height (none on landscape phones)
    const cardRoom = state.mode === "story" && !state.short ? (story.offsetHeight + GAP + 2 * EDGE) / stage.clientHeight : 0;
    world.render(dt, { u: state.u, narrow: state.narrow, short: state.short, cardRoom });
    if (state.mode === "story") placeStory();
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
