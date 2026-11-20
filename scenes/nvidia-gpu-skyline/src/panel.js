import { YEAR_END } from "./scales.js";

/**
 * The side panel. It builds the market and architecture lists, writes every string in
 * the current language, and mirrors the state it is given. It holds no state of its
 * own: every control calls back into main.js through `on`.
 */

const $ = (id) => document.getElementById(id);
const all = (selector) => document.querySelectorAll(selector);

export function createPanel({ model, on }) {
  // Markets, back lane first, so the list reads top to bottom as the scene does.
  const markets = [...model.lanes].reverse().map((lane) => {
    const row = document.createElement("label");
    row.className = "check market";
    const box = document.createElement("input");
    box.type = "checkbox";
    box.checked = true;
    box.addEventListener("change", () => on.market(lane.id, box.checked));
    const name = document.createElement("span");
    const count = document.createElement("small");
    count.textContent = lane.count;
    row.append(box, name, count);
    $("marketList").append(row);
    return { lane, box, name };
  });

  // Architectures in order of first release.
  const archs = model.eras.map((era) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "arch";
    button.style.setProperty("--c", era.color);
    const swatch = document.createElement("i");
    const name = document.createElement("span");
    name.textContent = era.id;
    const count = document.createElement("small");
    count.textContent = era.count;
    button.append(swatch, name, count);
    button.addEventListener("click", () => on.arch(era.id));
    $("archList").append(button);
    return { era, button };
  });

  $("playBtn").addEventListener("click", on.play);
  $("allBtn").addEventListener("click", on.showAll);
  $("homeBtn").addEventListener("click", on.home);
  $("yearRange").addEventListener("input", (ev) => on.year(Number(ev.target.value)));
  $("speed").addEventListener("input", (ev) => on.speed(Number(ev.target.value)));
  $("follow").addEventListener("change", (ev) => on.follow(ev.target.checked));
  for (const radio of all('input[name="metric"]')) {
    radio.addEventListener("change", () => radio.checked && on.metric(radio.value));
  }
  for (const b of all("#tscaleSeg button")) b.addEventListener("click", () => on.tscale(b.dataset.tscale));
  for (const b of all("#langSeg button")) b.addEventListener("click", () => on.lang(b.dataset.lang));
  $("clearArch").addEventListener("click", () => on.arch(null));
  $("milestones").addEventListener("change", (ev) => on.milestones(ev.target.checked));
  $("panelClose").addEventListener("click", () => on.panel(false));
  $("panelOpen").addEventListener("click", () => on.panel(true));

  /** Writes every fixed string in the panel and on the stage in the language of `tx`. */
  function setText(tx) {
    const s = tx.s;
    for (const el of all("[data-i18n]")) {
      const v = s[el.dataset.i18n];
      if (typeof v === "string") el.textContent = v;
    }
    for (const el of all("[data-measure]")) el.textContent = s.measures[el.dataset.measure];
    for (const el of all("[data-key]")) el.textContent = s.key[el.dataset.key];
    for (const m of markets) m.name.textContent = s.marketNames[m.lane.id];
    $("milestonesLabel").textContent = s.milestones(model.milestoneCount);
    $("tscaleRow").title = s.scaleTitle;
    $("panelClose").title = s.hide;
    $("panelClose").setAttribute("aria-label", s.hide);
    $("panelOpen").title = s.show;
    $("keys").replaceChildren(
      ...s.keys.map(([key, text]) => {
        const row = document.createElement("div");
        const kbd = document.createElement("kbd");
        kbd.textContent = key;
        row.append(kbd, text);
        return row;
      }),
    );
  }

  /** The year slider and its caption; called every frame during playback. */
  function syncYear(st, tx) {
    $("yearRange").value = String(st.year);
    $("yearOut").textContent = st.year >= YEAR_END ? tx.s.all : tx.s.upTo(Math.floor(st.year));
  }

  /** Mirrors the whole state. */
  function sync(st, tx) {
    const s = tx.s;
    $("playBtn").textContent = st.playing ? s.pause : s.play;
    syncYear(st, tx);
    $("speedOut").textContent = `${st.speed}x`;
    $("follow").checked = st.followOn;
    for (const radio of all('input[name="metric"]')) radio.checked = radio.value === st.metric;
    for (const el of all("[data-unit]")) el.textContent = tx.paren(tx.unit(el.dataset.unit, st.tscale));
    for (const b of all("#tscaleSeg button")) {
      const on = b.dataset.tscale === st.tscale;
      b.classList.toggle("on", on);
      b.setAttribute("aria-pressed", String(on));
    }
    $("tscaleRow").classList.toggle("muted", st.metric !== "transistors");
    $("scaleHint").textContent = st.tscale === "linear" ? s.hintLinear : s.hintLog;
    for (const b of all("#langSeg button")) {
      const on = b.dataset.lang === tx.lang;
      b.classList.toggle("on", on);
      b.setAttribute("aria-pressed", String(on));
    }
    for (const a of archs) {
      const on = st.arch === a.era.id;
      a.button.classList.toggle("on", on);
      a.button.classList.toggle("off", Boolean(st.arch) && !on);
      a.button.setAttribute("aria-pressed", String(on));
    }
    for (const m of markets) m.box.checked = st.markets.has(m.lane.id);
    $("milestones").checked = st.milestones;
  }

  return { setText, sync, syncYear };
}
