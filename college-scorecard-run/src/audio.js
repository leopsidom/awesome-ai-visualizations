/**
 * Sound for Cohort: music, ambience and effects on the plain Web Audio API.
 *
 *   master ─ compressor ─ destination
 *     ├─ music  (lowpass + duck, for pause)  title loop | run loop + intense layer | stingers
 *     ├─ amb    (duck)                       campus dusk bed
 *     └─ sfx                                 one-shots, panned per lane
 *          └─ loops (muted while paused)     gown wind, lock-warning tick
 *
 * The generated files were never loudness-matched, so each buffer is measured
 * when it decodes (RMS of its loudest 50 ms windows) and given a gain that
 * lands it on a per-sound target level. Leading silence is skipped on
 * one-shots, and digital silence (MP3 encoder padding) is cut from the loop
 * points so loops wrap without a gap.
 *
 * Files are decoded up front on an OfflineAudioContext, which needs no user
 * gesture; the live AudioContext is only created on the first key or pointer
 * press (autoplay policy). Missing files, or no Web Audio at all, leave the
 * game silent but running.
 */

const BASE = new URL("../audio/", import.meta.url);

// name → [folder, target level (dBFS RMS of the loud part), loops?]
// Targets follow the brief's mix order: stingers > correct/wrong > lock and
// columns > multiplier/credit > question/fact > swish > footsteps/wind > ambience.
const SOUNDS = {
  music_title_loop: ["music", -20, true],
  music_run_loop: ["music", -20, true],
  music_run_intense_layer: ["music", -22, true],
  music_win_commencement: ["music", -17, false],
  music_lose_withdrawn: ["music", -18, false],

  amb_quad_dusk_loop: ["amb", -31, true],

  sfx_correct: ["sfx", -17, false],
  sfx_wrong: ["sfx", -17, false],
  sfx_undeclared: ["sfx", -18, false],
  sfx_lock_commit: ["sfx", -18, false],
  sfx_lock_undeclared: ["sfx", -18, false],
  sfx_columns_rise: ["sfx", -20, false],
  sfx_matriculate: ["sfx", -18, false],
  sfx_multiplier_up: ["sfx", -20, false],
  sfx_credit_lost: ["sfx", -20, false],
  sfx_last_credit_warning: ["sfx", -19, false],
  sfx_new_best: ["sfx", -18, false],
  sfx_confetti_pop_01: ["sfx", -22, false],
  sfx_confetti_pop_02: ["sfx", -22, false],
  sfx_cap_toss: ["sfx", -23, false],
  sfx_stumble: ["sfx", -21, false],
  sfx_veil_burst: ["sfx", -23, false],
  sfx_question_appear: ["sfx", -22, false],
  sfx_fact_card: ["sfx", -24, false],
  sfx_lane_swish_01: ["sfx", -23, false],
  sfx_lane_swish_02: ["sfx", -23, false],
  sfx_lane_swish_03: ["sfx", -23, false],
  sfx_lane_refused: ["sfx", -22, false],
  sfx_ui_click: ["sfx", -25, false],
  sfx_pause: ["sfx", -23, false],
  sfx_resume: ["sfx", -23, false],
  sfx_boot_whoosh: ["sfx", -24, false],
  sfx_footstep_brick_01: ["sfx", -29, false],
  sfx_footstep_brick_02: ["sfx", -29, false],
  sfx_footstep_brick_03: ["sfx", -29, false],
  sfx_footstep_brick_04: ["sfx", -29, false],
  sfx_gown_wind_loop: ["sfx", -30, true],
  sfx_lock_warning_loop: ["sfx", -25, true],
};

// Load order: what the title screen and the first seconds of a run need first.
const ORDER = [
  "sfx_ui_click",
  "sfx_matriculate",
  "amb_quad_dusk_loop",
  "music_title_loop",
  "sfx_lane_swish_01",
  "sfx_lane_swish_02",
  "sfx_lane_swish_03",
  "sfx_question_appear",
  "sfx_footstep_brick_01",
  "sfx_footstep_brick_02",
  "sfx_footstep_brick_03",
  "sfx_footstep_brick_04",
  "sfx_gown_wind_loop",
  "sfx_lock_warning_loop",
  "music_run_loop",
  "music_run_intense_layer",
];
for (const n of Object.keys(SOUNDS)) if (!ORDER.includes(n)) ORDER.push(n);

// Base names with round-robin variants: play("sfx_lane_swish") picks one.
const VARIANTS = {};
for (const n of Object.keys(SOUNDS)) {
  const m = n.match(/^(.*)_0\d$/);
  if (m) (VARIANTS[m[1]] ??= []).push(n);
}

const PREFS_KEY = "cohort-audio";
const MAX_VOICES = 28;
const DECODE_RATE = 48000;

const dbToGain = (db) => 10 ** (db / 20);

/** Edges and loudness of a decoded buffer. */
function analyse(buf, isLoop) {
  const chans = [];
  for (let c = 0; c < Math.min(2, buf.numberOfChannels); c++) chans.push(buf.getChannelData(c));
  const n = buf.length;
  const sr = buf.sampleRate;
  const thr = isLoop ? 1e-4 : 0.003; // loops: only true padding; one-shots: anything inaudible
  const quiet = (i) => chans.every((ch) => Math.abs(ch[i]) < thr);

  let a = 0;
  while (a < n - 1 && quiet(a)) a++;
  let z = n - 1;
  while (z > a && quiet(z)) z--;

  const w = Math.max(64, Math.round(sr * 0.05));
  const windows = [];
  let peak = 0;
  for (let i = a; i <= z; i += w) {
    const end = Math.min(z + 1, i + w);
    let s = 0;
    for (const ch of chans) {
      for (let j = i; j < end; j++) {
        const v = ch[j];
        s += v * v;
        const av = v < 0 ? -v : v;
        if (av > peak) peak = av;
      }
    }
    windows.push(s / ((end - i) * chans.length));
  }
  windows.sort((x, y) => y - x);
  const top = windows.slice(0, Math.max(1, Math.ceil(windows.length * 0.3)));
  const ms = top.reduce((acc, v) => acc + v, 0) / top.length;
  const db = ms > 0 ? 10 * Math.log10(ms) : -120;

  return {
    offset: Math.max(0, (a - Math.round(sr * 0.002)) / sr), // keep 2 ms of lead-in
    loopStart: a / sr,
    loopEnd: (z + 1) / sr,
    db,
    peak,
  };
}

export function createAudio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;

  const prefs = { on: true, vol: 0.8, music: 0.7 };
  try {
    Object.assign(prefs, JSON.parse(localStorage.getItem(PREFS_KEY) || "{}"));
  } catch {
    /* ignore a bad stored value */
  }

  const bufs = new Map(); // name → { buf, norm, offset, loopStart, loopEnd }
  let loaded = 0;
  let failed = 0;
  const total = Object.keys(SOUNDS).length;
  const listeners = new Set();

  let ctx = null;
  let bus = null;
  let voices = 0;
  let ducked = false;
  let hidden = false;
  const lastPlayed = new Map();
  const lastVariant = new Map();

  // Wanted state, applied whenever the context or a buffer becomes available.
  let musicWant = "none"; // none | title | run | stinger
  let intensity = 0;
  const music = { title: null, run: null, intense: null, stinger: null };
  let stingerTimer = 0;
  let ambOn = false;
  let amb = null;
  const loopWant = new Map(); // name → { gain, rate }
  const loopVoices = new Map(); // name → voice

  const emit = () => listeners.forEach((fn) => fn(api.status));

  // ------------------------------------------------------------ loading --

  async function decode(ab) {
    if (OAC) {
      try {
        const off = new OAC(1, 1, DECODE_RATE);
        return await new Promise((res, rej) => {
          const p = off.decodeAudioData(ab, res, rej);
          if (p && p.then) p.then(res, rej);
        });
      } catch {
        /* fall through to the live context, if there is one yet */
      }
    }
    while (!ctx) await new Promise((r) => setTimeout(r, 100));
    return await new Promise((res, rej) => {
      const p = ctx.decodeAudioData(ab, res, rej);
      if (p && p.then) p.then(res, rej);
    });
  }

  async function loadOne(name) {
    const [folder, target, isLoop] = SOUNDS[name];
    try {
      const res = await fetch(new URL(`${folder}/${name}.mp3`, BASE));
      if (!res.ok) throw new Error(res.status);
      const buf = await decode(await res.arrayBuffer());
      const info = analyse(buf, isLoop);
      let gainDb = Math.max(-24, Math.min(15, target - info.db));
      let norm = dbToGain(gainDb);
      if (info.peak > 0) norm = Math.min(norm, 0.95 / info.peak);
      bufs.set(name, { buf, norm, ...info });
      loaded++;
    } catch {
      failed++;
    }
    emit();
    refresh();
  }

  async function loadAll() {
    if (!AC) return;
    const queue = ORDER.slice();
    const worker = async () => {
      while (queue.length) await loadOne(queue.shift());
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
  }

  // ------------------------------------------------------------- graph --

  function build() {
    ctx = new AC({ latencyHint: "interactive" });
    const master = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -10;
    comp.knee.value = 6;
    comp.ratio.value = 4;
    comp.attack.value = 0.003;
    comp.release.value = 0.25;
    master.connect(comp).connect(ctx.destination);

    const musicVol = ctx.createGain();
    const musicLp = ctx.createBiquadFilter();
    musicLp.type = "lowpass";
    musicLp.frequency.value = 20000;
    musicLp.Q.value = 0.5;
    const musicDuck = ctx.createGain();
    musicVol.connect(musicLp).connect(musicDuck).connect(master);

    const ambBus = ctx.createGain();
    const ambDuck = ctx.createGain();
    ambBus.connect(ambDuck).connect(master);

    const sfx = ctx.createGain();
    sfx.connect(master);
    const loops = ctx.createGain();
    loops.connect(sfx);

    bus = { master, musicVol, musicLp, musicDuck, amb: ambBus, ambDuck, sfx, loops };
    applyVolume(true);
    applyDuck(true);
  }

  function applyVolume(now) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const m = prefs.on ? prefs.vol : 0;
    if (now) {
      bus.master.gain.value = m;
      bus.musicVol.gain.value = prefs.music;
    } else {
      bus.master.gain.setTargetAtTime(m, t, 0.05);
      bus.musicVol.gain.setTargetAtTime(prefs.music, t, 0.05);
    }
  }

  function applyDuck(now) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const set = (param, v, tc) => (now ? (param.value = v) : param.setTargetAtTime(v, t, tc));
    set(bus.musicLp.frequency, ducked ? 600 : 20000, 0.12);
    set(bus.musicDuck.gain, ducked ? dbToGain(-8) : 1, 0.12);
    set(bus.ambDuck.gain, ducked ? dbToGain(-6) : 1, 0.2);
    set(bus.loops.gain, ducked ? 0 : 1, 0.08);
  }

  /** A looping voice: source → norm gain → fader → destination bus. */
  function loopVoice(name, dest, { gain = 1, rate = 1, fadeIn = 0.15, when = 0, at = null } = {}) {
    const b = bufs.get(name);
    if (!b || !ctx) return null;
    const src = ctx.createBufferSource();
    src.buffer = b.buf;
    src.loop = true;
    src.loopStart = b.loopStart;
    src.loopEnd = b.loopEnd;
    src.playbackRate.value = rate;
    const norm = ctx.createGain();
    norm.gain.value = b.norm;
    const fader = ctx.createGain();
    const t = when || ctx.currentTime;
    // Set the resting value too: a later cancelScheduledValues() before `t`
    // must read 0 here, not the GainNode default of 1.
    fader.gain.value = fadeIn > 0 ? 0 : gain;
    fader.gain.setValueAtTime(fadeIn > 0 ? 0 : gain, t);
    if (fadeIn > 0) fader.gain.setTargetAtTime(gain, t, fadeIn / 3);
    src.connect(norm).connect(fader).connect(dest);
    src.start(t, at ?? b.loopStart);
    return { name, src, fader, gain, rate, startedAt: t, loopStart: b.loopStart, loopEnd: b.loopEnd };
  }

  function fadeOut(v, secs = 0.6) {
    if (!v || !ctx) return;
    const t = ctx.currentTime;
    v.fader.gain.cancelScheduledValues(t);
    v.fader.gain.setValueAtTime(v.fader.gain.value, t);
    v.fader.gain.setTargetAtTime(0, t, Math.max(0.01, secs / 4));
    try {
      v.src.stop(t + secs + 0.1);
    } catch {
      /* already stopped */
    }
  }

  // ------------------------------------------------------------- music --

  function stopMusic(which, secs) {
    for (const k of which) {
      fadeOut(music[k], secs);
      music[k] = null;
    }
  }

  function applyMusic(fade = 1) {
    if (!ctx) return;
    if (musicWant === "title") {
      stopMusic(["run", "intense", "stinger"], fade);
      if (!music.title) music.title = loopVoice("music_title_loop", bus.musicVol, { fadeIn: fade });
    } else if (musicWant === "run") {
      stopMusic(["title", "stinger"], fade);
      // Start the run loop and its intense layer on the same sample so they stay in step.
      if (!music.run && bufs.has("music_run_loop")) {
        stopMusic(["intense"], 0.1);
        const when = ctx.currentTime + 0.05;
        music.run = loopVoice("music_run_loop", bus.musicVol, { fadeIn: fade, when });
        music.intense = loopVoice("music_run_intense_layer", bus.musicVol, { gain: 0, fadeIn: 0, when });
        if (music.intense) music.intense.gain = 0;
        applyIntensity(true);
      } else if (music.run && !music.intense && bufs.has("music_run_intense_layer")) {
        // The layer decoded after the run loop started: join it at the same point in the bar.
        const r = music.run;
        const b = bufs.get("music_run_intense_layer");
        const when = ctx.currentTime + 0.05;
        const runLen = r.loopEnd - r.loopStart;
        const pos = (((when - r.startedAt) % runLen) + runLen) % runLen;
        const v = loopVoice("music_run_intense_layer", bus.musicVol, { gain: 0, fadeIn: 0, when, at: b.loopStart + Math.min(pos, b.loopEnd - b.loopStart - 0.01) });
        if (v) {
          v.gain = 0;
          music.intense = v;
          applyIntensity(true);
        }
      }
    } else if (musicWant === "none") {
      stopMusic(["title", "run", "intense"], fade);
    }
  }

  function applyIntensity(now) {
    const v = music.intense;
    if (!v || !ctx) return;
    if (Math.abs(v.gain - intensity) < 0.01 && !now) return;
    const up = intensity > v.gain;
    v.gain = intensity;
    const t = ctx.currentTime;
    v.fader.gain.cancelScheduledValues(t);
    v.fader.gain.setValueAtTime(v.fader.gain.value, t);
    // In over 2 bars, out over 4 bars, at 120 BPM.
    v.fader.gain.setTargetAtTime(intensity, t, up ? 4 / 3 : 8 / 3);
  }

  // -------------------------------------------------------------- loops --

  function applyLoops() {
    if (!ctx) return;
    for (const [name, want] of loopWant) {
      let v = loopVoices.get(name);
      if (!v) {
        v = loopVoice(name, bus.loops, want);
        if (v) loopVoices.set(name, v);
        continue;
      }
      const t = ctx.currentTime;
      if (Math.abs(v.gain - want.gain) > 0.01) {
        v.gain = want.gain;
        v.fader.gain.setTargetAtTime(want.gain, t, 0.08);
      }
      if (Math.abs(v.rate - want.rate) > 0.005) {
        v.rate = want.rate;
        v.src.playbackRate.setTargetAtTime(want.rate, t, 0.05);
      }
    }
  }

  function applyAmb() {
    if (!ctx || !ambOn || amb) return;
    amb = loopVoice("amb_quad_dusk_loop", bus.amb, { fadeIn: 3 });
  }

  /** Re-apply wanted state; called on unlock and every time a buffer lands. */
  function refresh() {
    if (!ctx) return;
    applyAmb();
    applyMusic(1);
    applyLoops();
  }

  // ---------------------------------------------------------------- api --

  function unlock() {
    if (!AC) return;
    if (!ctx) {
      try {
        build();
      } catch {
        return;
      }
      ambOn = true;
      refresh();
      emit();
    }
    if (ctx.state !== "running" && !hidden) ctx.resume().catch(() => {});
  }

  function pickVariant(name) {
    const list = VARIANTS[name];
    if (!list) return name;
    const avail = list.filter((n) => bufs.has(n));
    if (!avail.length) return name;
    const prev = lastVariant.get(name);
    const pool = avail.length > 1 ? avail.filter((n) => n !== prev) : avail;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    lastVariant.set(name, pick);
    return pick;
  }

  const api = {
    /** Create / resume the live context. Safe to call from any user gesture. */
    unlock,

    get status() {
      if (!AC) return "not supported";
      if (!prefs.on) return "muted";
      if (!ctx) return loaded < total - failed ? `tap or press a key to enable · ${loaded}/${total}` : "tap or press a key to enable";
      if (loaded + failed < total) return `loading ${loaded}/${total}`;
      if (failed === total) return "files missing";
      return failed ? `on · ${failed} files missing` : "on";
    },
    get prefs() {
      return { ...prefs };
    },
    get ready() {
      return !!ctx && ctx.state === "running";
    },
    onStatus(fn) {
      listeners.add(fn);
      fn(api.status);
    },

    /**
     * One-shot. name may be a base with variants (e.g. "sfx_lane_swish").
     * opts: pan −1..1, rate, gain (linear, on top of the level match), delay (s).
     */
    play(name, { pan = 0, rate = 1, gain = 1, delay = 0 } = {}) {
      if (!ctx || ctx.state === "closed" || hidden || !prefs.on) return;
      const real = pickVariant(name);
      const b = bufs.get(real);
      if (!b || voices >= MAX_VOICES) return;
      // Guard against the same sound stacking on itself within a frame or two.
      const now = ctx.currentTime;
      const key = real + "@" + delay.toFixed(2);
      if (now - (lastPlayed.get(key) ?? -1) < 0.03) return;
      lastPlayed.set(key, now);

      const src = ctx.createBufferSource();
      src.buffer = b.buf;
      src.playbackRate.value = rate;
      const g = ctx.createGain();
      g.gain.value = b.norm * gain;
      let tail = g;
      if (pan && ctx.createStereoPanner) {
        const p = ctx.createStereoPanner();
        p.pan.value = Math.max(-1, Math.min(1, pan));
        g.connect(p);
        tail = p;
      }
      const dest = SOUNDS[real][0] === "music" ? bus.musicVol : bus.sfx;
      src.connect(g);
      tail.connect(dest);
      voices++;
      src.onended = () => {
        voices--;
        try {
          tail.disconnect();
          g.disconnect();
        } catch {
          /* already gone */
        }
      };
      src.start(now + Math.max(0, delay), b.offset);
    },

    /** Start (or update) a looping effect. Idempotent: call it every frame if you like. */
    loop(name, { gain = 1, rate = 1 } = {}) {
      const w = loopWant.get(name);
      if (w && Math.abs(w.gain - gain) < 0.01 && Math.abs(w.rate - rate) < 0.005 && loopVoices.has(name)) return;
      loopWant.set(name, { gain, rate });
      applyLoops();
    },

    stop(name, secs = 0.15) {
      loopWant.delete(name);
      const v = loopVoices.get(name);
      if (v) {
        fadeOut(v, secs);
        loopVoices.delete(name);
      }
    },

    isLooping(name) {
      return loopWant.has(name);
    },

    /** "title" | "run" | "none". Crossfades over `fade` seconds. */
    setMusic(mode, fade = 1) {
      clearTimeout(stingerTimer);
      if (mode === musicWant && mode !== "stinger") return;
      musicWant = mode;
      if (mode !== "run") intensity = 0;
      applyMusic(fade);
    },

    /** Fade the intense layer toward 0..1 (it rides on the run loop). */
    setIntensity(v) {
      intensity = Math.max(0, Math.min(1.5, v));
      applyIntensity(false);
    },

    /** Fade all music out (before an end stinger). */
    fadeMusic(secs = 0.6) {
      clearTimeout(stingerTimer);
      musicWant = "none";
      intensity = 0;
      stopMusic(["title", "run", "intense"], secs);
    },

    /** Play an end stinger, then crossfade into `after` (default the title loop). */
    stinger(name, after = "title") {
      clearTimeout(stingerTimer);
      musicWant = "stinger";
      stopMusic(["title", "run", "intense", "stinger"], 0.4);
      const b = bufs.get(name);
      if (!ctx || !b) {
        musicWant = after;
        applyMusic(2);
        return 0;
      }
      music.stinger = loopVoice(name, bus.musicVol, { fadeIn: 0 });
      if (music.stinger) {
        music.stinger.src.loop = false;
      }
      const dur = (b.loopEnd - b.loopStart) || b.buf.duration;
      stingerTimer = setTimeout(() => {
        if (musicWant !== "stinger") return;
        musicWant = after;
        music.stinger = null; // let it ring out under the crossfade
        applyMusic(2);
      }, Math.max(0, dur - 1) * 1000);
      return dur;
    },

    /** Pause: muffle music, lower the ambience, silence running loops. */
    duck(on) {
      ducked = !!on;
      applyDuck(false);
    },

    mute(on) {
      prefs.on = !on;
      save();
      applyVolume(false);
      if (prefs.on) unlock();
      emit();
    },

    toggleMute() {
      api.mute(prefs.on);
    },

    setVolume(v) {
      prefs.vol = Math.max(0, Math.min(1, v));
      save();
      applyVolume(false);
    },

    setMusicVolume(v) {
      prefs.music = Math.max(0, Math.min(1, v));
      save();
      applyVolume(false);
    },

    /** Tab hidden / shown. */
    suspend() {
      hidden = true;
      ctx?.suspend().catch(() => {});
    },
    resume() {
      hidden = false;
      if (ctx && ctx.state !== "running") ctx.resume().catch(() => {});
    },

    dispose() {
      clearTimeout(stingerTimer);
      removeGestures();
      ctx?.close().catch(() => {});
      ctx = null;
    },
  };

  function save() {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {
      /* private mode */
    }
  }

  // Unlock on the first gesture. Capture phase, so the context exists before
  // the game's own handlers start the run and ask for music.
  const gesture = () => {
    unlock();
    if (ctx && ctx.state === "running") removeGestures();
  };
  const gestureEvents = ["pointerdown", "keydown", "touchend", "click"];
  function removeGestures() {
    for (const e of gestureEvents) window.removeEventListener(e, gesture, true);
  }
  for (const e of gestureEvents) window.addEventListener(e, gesture, true);

  loadAll();
  return api;
}
