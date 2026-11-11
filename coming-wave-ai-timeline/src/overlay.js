import { clamp, label, longDate } from "./timeline.js";

/**
 * Everything drawn in HTML: the lyric-style event list, the story card, the time axis
 * and the lists in the side panel. It owns no playback state; main.js tells it what
 * to show and it reports clicks back through the callbacks.
 */

const CLICK_SLOP = 4; // px of travel before a press on the axis counts as a scrub
const DOT_REACH = 9; // px: a click this close to a dot jumps to that event

const $ = (id) => document.getElementById(id);
const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ESCAPES[c]);

export function createOverlay({ model, majors, today, onJump, onScrub, onThread }) {
  const stage = $("stage");
  const lyrics = $("lyrics");
  const track = $("lyricsTrack");
  const card = $("card");
  const axis = $("axis");
  const bar = $("axisBar");
  const head = $("axisHead");
  const fill = $("axisFill");
  const yearEl = $("year");
  const timerFill = $("cardTimerFill");

  const rows = new Map(); // event id -> { li, dot, mli }
  let active = [];
  let current = -1;
  let shownYear = "";

  $("span").textContent = `AI events, 1950 to ${label(today)}`;

  // ---- one list line and one axis dot per event
  for (const e of model.events) {
    const major = e.tier === "major";

    const li = document.createElement("li");
    li.className = major ? "ly major" : "ly";
    li.style.setProperty("--c", e.color);
    li.innerHTML =
      `<div class="d">${esc(e.label)} · ${esc(e.threadName)}</div>` +
      `<div class="t">${esc(e.title)}</div><div class="s">${esc(e.line)}</div>`;
    li.addEventListener("click", () => onJump(e.id));
    track.appendChild(li);

    const dot = document.createElement("i");
    dot.className = major ? "dot major" : "dot";
    dot.style.setProperty("--c", e.color);
    dot.style.left = `${(e.u * 100).toFixed(3)}%`;
    dot.title = `${e.label}: ${e.title}`;
    $("axisDots").appendChild(dot);

    rows.set(e.id, { li, dot, mli: null });
  }

  // ---- axis ticks: sparse where the axis is compressed, yearly where it is stretched
  const lastYear = Math.floor(model.axis.knots.at(-1)[0]);
  const ticks = [1950, 1970, 1990];
  for (let y = 2010; y < 2020; y += 2) ticks.push(y);
  for (let y = 2020; y <= lastYear; y++) ticks.push(y);
  for (const y of ticks) {
    const tick = document.createElement("span");
    tick.textContent = y;
    tick.style.left = `${(model.axis.toU(y) * 100).toFixed(3)}%`;
    if (y < 2010) tick.className = "brk";
    $("axisTicks").appendChild(tick);
  }
  const todayTick = document.createElement("span");
  todayTick.className = "today";
  todayTick.textContent = "Today";
  todayTick.title = longDate(today);
  todayTick.style.left = "100%";
  $("axisTicks").appendChild(todayTick);

  // ---- side panel lists
  for (const t of model.threads) {
    const count = model.events.filter((e) => e.thread === t.id).length;
    const row = document.createElement("label");
    row.className = "thread";
    row.style.setProperty("--c", t.color);
    row.innerHTML = `<input type="checkbox" checked /><i></i><span>${esc(t.name)}</span><small>${count}</small>`;
    row.querySelector("input").addEventListener("change", (ev) => onThread(t.id, ev.target.checked));
    $("threadList").appendChild(row);
  }
  for (const e of majors) {
    const mli = document.createElement("li");
    mli.style.setProperty("--c", e.color);
    mli.innerHTML = `<small>${e.date.slice(0, 4)}</small><span>${esc(e.title)}</span>`;
    mli.addEventListener("click", () => onJump(e.id));
    $("majorList").appendChild(mli);
    rows.get(e.id).mli = mli;
  }

  // ---- event list
  function centre() {
    const e = active[Math.max(current, 0)];
    if (!e) return;
    const { li } = rows.get(e.id);
    // Before the first event the list sits a little low, so line one reads as "up next".
    const y = lyrics.clientHeight * 0.42 - (li.offsetTop + li.offsetHeight / 2) + (current < 0 ? 70 : 0);
    track.style.transform = `translateY(${y.toFixed(1)}px)`;
  }

  /** `list` is the events on the enabled threads, in date order. */
  function setActive(list) {
    active = list;
    const on = new Set(list.map((e) => e.id));
    for (const [id, r] of rows) {
      const off = !on.has(id);
      r.li.classList.toggle("off", off);
      r.dot.classList.toggle("off", off);
      r.mli?.classList.toggle("off", off);
      if (off) r.li.classList.remove("on", "past");
    }
  }

  /** `i` indexes the active list; -1 means the first event has not been reached. */
  function setCurrent(i) {
    current = i;
    active.forEach((e, k) => {
      const { li } = rows.get(e.id);
      li.classList.toggle("on", k === i);
      li.classList.toggle("past", k < i);
    });
    centre();
  }

  // ---- story card
  /** `origin` is the event's marker in stage pixels, or null to grow from its axis dot. */
  function openCard(e, origin) {
    let ox;
    let oy;
    if (origin) {
      ox = origin.x;
      oy = origin.y;
    } else {
      const d = rows.get(e.id).dot.getBoundingClientRect();
      const s = stage.getBoundingClientRect();
      ox = d.left + d.width / 2 - s.left;
      oy = d.top + d.height / 2 - s.top;
    }

    $("cardDate").textContent = e.label;
    $("cardThread").textContent = e.threadName;
    $("cardN").textContent = `Major event ${majors.indexOf(e) + 1} of ${majors.length}`;
    $("cardTitle").textContent = e.title;
    $("cardKicker").textContent = e.kicker || "";
    $("cardStory").textContent = e.story || e.line;
    $("cardStat").textContent = e.stat || "";
    $("cardStatLabel").textContent = e.statLabel || "";
    $("cardBookLabel").textContent = e.bookLabel || "In the book";
    $("cardBook").textContent = e.book || "";
    card.style.setProperty("--c", e.color);

    // Start as a speck on the marker, then grow to the centre and unfold the story.
    card.classList.remove("open");
    card.style.transition = "none";
    const cx = card.offsetLeft + card.offsetWidth / 2;
    const cy = card.offsetTop + card.offsetHeight / 2;
    card.style.setProperty("--fx", `${(ox - cx).toFixed(1)}px`);
    card.style.setProperty("--fy", `${(oy - cy).toFixed(1)}px`);
    void card.offsetWidth; // commit the start pose before the transition comes back
    card.style.transition = "";
    card.classList.add("open");
    stage.classList.add("holding");
    setHold(1);
  }

  function closeCard() {
    card.classList.remove("open");
    stage.classList.remove("holding");
  }

  /** Fraction of the story pause still to run, 1..0. */
  function setHold(f) {
    timerFill.style.width = `${(clamp(f, 0, 1) * 100).toFixed(1)}%`;
  }

  // ---- time axis
  function setProgress(u, year) {
    const pct = `${(u * 100).toFixed(2)}%`;
    head.style.left = pct;
    fill.style.width = pct;
    const text = String(year);
    if (text !== shownYear) {
      shownYear = text;
      yearEl.textContent = text;
    }
  }

  // Drag to scrub; a click lands on the nearest dot if one is in reach.
  let drag = null;
  const uAt = (x) => {
    const r = bar.getBoundingClientRect();
    return (x - r.left) / r.width;
  };
  axis.addEventListener("pointerdown", (ev) => {
    drag = { x: ev.clientX, moved: false };
    try {
      axis.setPointerCapture(ev.pointerId);
    } catch {
      /* a synthetic pointer has nothing to capture */
    }
  });
  axis.addEventListener("pointermove", (ev) => {
    if (!drag) return;
    if (Math.abs(ev.clientX - drag.x) > CLICK_SLOP) drag.moved = true;
    if (drag.moved) onScrub(uAt(ev.clientX));
  });
  axis.addEventListener("pointerup", (ev) => {
    if (!drag) return;
    const moved = drag.moved;
    drag = null;
    if (moved) return;
    const u = uAt(ev.clientX);
    const width = bar.getBoundingClientRect().width;
    let best = null;
    let reach = DOT_REACH;
    for (const e of active) {
      const d = Math.abs(e.u - u) * width;
      if (d < reach) {
        reach = d;
        best = e;
      }
    }
    if (best) onJump(best.id);
    else onScrub(u);
  });
  axis.addEventListener("pointercancel", () => {
    drag = null;
  });

  return { setActive, setCurrent, centre, openCard, closeCard, setHold, setProgress };
}
