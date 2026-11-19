# Twin Racks

NVIDIA's GB300 NVL72 and Vera Rubin NVL72 side by side, in Three.js, at true physical size. Both systems use
the same NVL72 rack (about 0.60 × 1.07 × 2.24 m), so the racks themselves carry no data. The difference is on a
spec card under the title, one metric at a time: 16 specs across the GPU, the CPU and the whole rack, each with
two bars whose height is proportional to the value. The part of the rack a metric describes (GPUs, CPUs, NVLink
switch trays, network cards or power shelves) lights up, and the camera glides to it. The page reads in English
or Chinese (简体中文); the Chinese title is 双机柜对比.

Rubin's figures are NVIDIA's launch specs, not measurements. Read [The data](#the-data) before quoting from it.

![preview](docs/preview.jpg)

_The preview is a screenshot in Chrome at 1280×720 with the panel hidden, on the NVFP4 inference metric._

## Run it

Needs a static server (ES modules and the import map won't load over `file://`). From the repository root:

```bash
python3 -m http.server 8777
# then open http://localhost:8777/nvidia-rack-comparison/
# or      http://localhost:8777/nvidia-rack-comparison/?lang=zh   for Chinese
```

Three.js r185 is pulled from unpkg via an import map. There is no build step and no `node_modules`. The page
opens on a title frame with the tour paused. **Play tour** steps through two text frames and then all 16 metrics, 5 s
each by default. `?m=N` opens metric N (0-based) directly.

## Controls

| Key / input         | Action                                                                   |
| ------------------- | ------------------------------------------------------------------------ |
| drag                | Orbit; right-drag pans, scroll or pinch zooms                            |
| hover a part        | A tooltip naming the part (GPU, CPU, switch tray, NIC, power shelf) and its main figures |
| tap a part (touch)  | The same tooltip, for about 3 s                                          |
| swipe the card      | Previous or next metric                                                  |
| `←` / `→`           | Previous or next metric                                                  |
| `space`             | Play / pause the tour; on the title slide it moves on to the overview at once |
| `R`                 | Replay: back to the title slide and play the tour from the start         |
| `F`                 | Camera follows the highlighted part: on / off                            |
| `H`                 | Hide or show the side panel                                              |

Every control is in the side panel; the card carries none. The panel holds the language switch (`English` /
`中文`, kept in `localStorage` as `twin-racks-lang` and written to the URL as `?lang=`), **Prev / Play tour /
Next** and **↺ Replay from the start** (the same as `R`), seconds per metric (2–12, default 5), camera follow, loop, whether the card floats over the scene or
docks as a strip below it, whether the card shows the note and source (on by default on a desktop, off on a
phone), the card opacity (0–100%, default 55%, 70% on phones, kept in `localStorage` as `twin-racks-card-opacity`), the title-slide
opacity, set separately (0–100%, default 90%, kept as `twin-racks-title-opacity`), the
NVLink-traffic and rack-dimension layers, and the list: the two frames, then all 16 metrics with Rubin's ratio to B300.

### The opening frames

Before the spec cards, the same card shows two text frames, which slide like the rest and are in the tour and
the panel's list (under "Intro"):

1. **Title slide:** "Nvidia Rubin vs B300" (英伟达 Rubin 与 B300), subtitled "Nvidia last two generation data center chips comparison" (英伟达新旧两代数据中心芯片对比), with a two-colour rule and how to begin. Like a deck's opening slide, the
   card grows to fill the stage under the header and covers the racks (90% opaque by default, with its own slider in the panel); the dimension labels and the hint are hidden behind it, and the camera frames the racks as
   if it weren't there, so they are ready when it shrinks back. Nothing on the racks is lit.
2. **Overview, "Same rack, different chips":** the rack size (0.60 × 1.07 × 2.24 m, the same for both and drawn
   to true size), then a 2-column grid with the system names as its header row and one line per part: 72 GPUs
   (B300 / Rubin); 576 HBM stacks per rack (72 GPUs × 8; HBM3e / HBM4 — the generation is the difference: same count, same 36 GB per stack); 36 CPUs (Grace / Vera); 18 compute
   trays; and 9 NVLink switch trays, naming the generation (NVLink 5 / NVLink 6). The frame walks through the
   five lines in turn: the line is emphasised in both columns, tinted in the system's colour, while the same part
   lights up on both racks (the GPU packages for the GPU and HBM lines; the CPUs, with the tray covers made
   see-through; the compute-tray bodies; the switch trays). One full walk takes one tour step (1 s per line at the
   default 5 s, never under 0.9 s) and repeats while the frame is shown. The HBM and NVLink details come from the
   HBM-capacity and NVLink notes in `src/data.js`; the 8 HBM4 stacks are 36 GB each (288 GB ÷ 8).

This replaces the subtitle and the per-card "72 × B300 · 36 × Grace" lines of earlier versions, so the counts
are said once instead of on every card. Going back from the title wraps to the last metric.

### The spec card

- **What it shows:** the metric's group and position; the metric name with its confidence chip right after it
  (and, for power and price, "cost (lower is better)"); a short explanation of the metric; the comparison; and the
  note and source.
- **The explanation** (2–3 sentences, in English and Chinese, from `about` / `aboutZh` in `src/data.js`) says what
  the metric measures, how it affects performance, and any useful context, e.g. that LLM token generation is
  usually limited by HBM bandwidth rather than peak FLOPS, or that B300 cut FP64 to make room for FP4. On a wide
  screen it sits on the left beside the comparison; on a phone it sits under the title; phone landscape hides it.
- **The comparison** is a three-column, two-row grid. The first row is the headers: GB300 NVL72 (blue), Vera Rubin
  NVL72 (orange) and "Rubin vs B300" (差异 in Chinese). The second row is the values: each system's bar, number
  and unit (and, on six cards, the rack total under it), and in the third column Rubin's ratio to B300 (e.g.
  27.50×) with the change in per cent. Text metrics (process node, availability) use the first two columns only.
- **Rack totals:** where a rack figure is only the GPU figure × 72 (FP4 inference and training, HBM capacity and
  bandwidth, NVLink), it is a "per rack" line on the GPU card, e.g. "per rack: 1.08 EFLOPS" under 15 PFLOPS,
  rather than a card of its own; the rack's fast memory (72 GPUs' HBM plus 36 CPUs' LPDDR5X) sits on the CPU
  memory card as "per rack (HBM + CPU)". The line shows the published rack figure, which is sometimes rounded (Rubin's 2.5 EFLOPS
  training against 35 × 72 = 2.52). Only rack power, price and availability, which are not a multiple of a
  chip figure, keep their own cards. Phone landscape hides the line.
- **The bars:** one per system, sharing a zero baseline. The larger value fills the bar; the other is drawn to
  scale, so FP4 inference reads 15 : 50 and FP64 1.2 : 33. Text metrics (process node, availability) hide them.
- **Where it sits:** centred under the title, over the scene, see-through with a light blur. The system names
  live only here and in the title, which colours them blue and orange to match the racks.
- **On a wide screen** the metric and chips sit on the left with the comparison and note beside them; on a phone
  they stack; in phone landscape the metric and the comparison sit side by side without the chips and notes.
- **Changing metric:** the card's frame stays put while its contents zoom: going forward (Next, →, the tour, a
  swipe left) the old contents zoom in to 108% and fade (170 ms) while the next metric's grow from 92% into place
  (300 ms), the title first and the rest a beat after it; going back runs the other way; picking from the list
  zooms in the direction of the jump. A newer change cancels a slide part-way, so quick presses never queue. The
  numbers then count up from the previous metric's.

### Phones and narrow screens

"Narrow" means a stage under 760 px wide.

- The floating card sits lower on a phone, about 17% of the way down the stage, and overlaps the racks: the camera
  frames them as if they ended at the top power shelf, so the shelves sit just below the card and only the empty
  top of each rack frame runs up behind it. The card is 70% opaque by default there (55% on wider
  screens); the opacity slider still sets it. The title slide keeps its usual place under the heading.

- The stage sits on top and the panel below it. The panel starts closed; **☰ Controls** opens it, and while it
  is open the floating card is hidden so it doesn't cover the smaller scene.
- A preview frame can report a phone width while it loads. If the panel was closed for that reason, it opens
  again once the stage is wide.

## The data

`src/data.js` holds the 16 rows, in tour order, six of them with a rack total, with a confidence for each and the sites each figure came from.
They were gathered from public reporting in November 2026 and approved before the build.

| Confidence | Rows |
| ---------- | ---: |
| High       |    8 |
| Medium     |    7 |
| Low        |    1 |

What to know before relying on it:

- **Rubin's 50 PFLOPS NVFP4 inference uses NVIDIA's adaptive compression; B300's 15 PFLOPS is dense.** The
  3.33× on the card is the launch-spec ratio; a like-for-like inference gain is likely smaller.
- **FP8 is left out.** NVIDIA gives no per-GPU FP8 figure for Rubin; the approved dataset worked one out (rack
  ~1.8 EFLOPS ÷ 72 ≈ 25 PFLOPS, against B300's 5 dense) at low confidence, and it was dropped from the scene.
- **Rack prices are analyst estimates** (Morgan Stanley: ~$4.0M GB300, ~$7.8M Vera Rubin). NVIDIA publishes no
  prices; other estimates range from $5M to $9M for Vera Rubin. Low confidence.
- **Rubin's power has two modes.** The card uses Max-P (~2.3 kW per GPU, 227 kW per rack); Max-Q is ~1.8 kW and
  187 kW.
- **Shipping dates disagree:** reports put the first Vera Rubin racks at June 2026 (Dell to CoreWeave), while
  NVIDIA said production shipments began in August 2026.
- **Process node:** the card keeps NVIDIA's and TSMC's names (TSMC 4NP, TSMC N3P) and adds the node size most
  readers know after them: "4 nm" and "3 nm". 4NP is NVIDIA's custom version of N4P and is marketed as 4 nm,
  which is also how _The AI Factory_ and _Tapeout_ list Hopper and Blackwell. Strictly,
  [TSMC classes N4P](https://pr.tsmc.com/english/news/2874) as "the third major enhancement of TSMC's 5nm
  family"; the card's note says so. Rubin's I/O dies are reported on N5B; the card describes the compute dies.
- **Most sources are secondary** (Tom's Hardware, StorageReview, SiliconANGLE, vendor and cloud blogs). The full
  list of pages is `SOURCES` in `src/data.js`.
- **The rack geometry is schematic.** The outer size follows the Oberon-class NVL72 rack; the tray layout
  (power shelves, 18 compute trays with 4 GPUs and 2 CPUs each, 9 NVLink switch trays) is accurate in count but
  not in exact position.
- **The Chinese strings and notes were machine-written.** A model-run audit fixed the one clear error it
  found (billions printed as "208 十亿", now "2080 亿"), renamed the Timing group 上市时间 → 供货时间, replaced
  English "vs" with 与 in three notes, and tightened four labels (step, confidence, ratio text, screen-reader
  names). A native reader should still review them.

To change the dataset, edit `src/data.js`. A row needs `id`, `group`, `part` (which part lights up), `scope`,
`unit`, `b300`, `rubin` and `confidence`. Numeric values are numbers; text rows use `unit: "text"` and give
their Chinese forms in `textZh`. Add the Chinese metric name to `metricNames` in `src/i18n.js`.

## What's in the scene

| File          | Contents                                                                                     |
| ------------- | -------------------------------------------------------------------------------------------- |
| `index.html`  | Layout and styles, the panel and the card's markup; loads `main.js` with a dynamic import    |
| `src/main.js` | Scene, racks, dimension lines, particles, fitted camera, spec card, panel, input, frame loop  |
| `src/data.js` | The 16 specs (and 6 rack totals), the rack size, the NVLink speeds and the source list                           |
| `src/i18n.js` | Every string in English and Chinese, and the number formats                                  |

### Design notes

- **True size, not data size.** An early version drew each GPU's spec as a bar sticking out of the rack. It
  made Rubin look like a bigger machine, which it isn't, so the racks are now drawn to their real size and the
  comparison moved to the card. A person-height figure and then a ruler were tried for scale; dimension lines
  drawn on the racks themselves (2.24 m high, 0.60 m wide, 1.07 m deep) read most directly.
- **Light the part, not the rack.** Each metric names the part it describes: compute and memory light the GPUs,
  CPU metrics make the tray covers see-through and light the CPUs inside, NVLink lights the switch trays, the
  scale-out network the NICs at the back (the camera turns round to them), and rack power raises a column
  above each rack in proportion to its kilowatts.
- **The framing is fitted, not guessed.** Each view is only a direction. The distance and target are solved so
  the racks, their dimension labels and (for power) the columns fill the stage below the card, with a 24 px top margin
  above the heading, 26 px from the heading to the card, a tight 6 px from the card to the racks and 6 px below
  the racks (above the hint). It re-fits on every
  metric, resize, language switch and card-size change.
- **Two colours, one meaning.** Blue is GB300 NVL72 and orange is Vera Rubin NVL72 everywhere: the title, the
  card's bars, the rack frames, the GPUs and the NVLink particles. The particles' speed is the per-GPU NVLink
  bandwidth, so Rubin's run twice as fast.
- **The backdrop is a silicon wafer on dark grey.** The wafer is _The AI Factory_'s, so the NVIDIA scenes in the
  gallery match: a procedurally drawn disc of dies with faint circuit blocks, a green rim and a rainbow sheen (its
  drawing code is copied unchanged). Around it is a neutral dark-grey radial gradient (#3a3d43 to #18191c); the
  wafer's NVIDIA-green rim and dies carry the brand colour, and the racks' blue and orange stand clear of it. It
  sits behind the transparent WebGL canvas, so the whole disc stays in view at any camera angle and stage size;
  it is sized to the stage, shown at 60% opacity and turns once every ten minutes (reduced motion stops it).
  The floor is glass: a clear 12 × 12 m panel with a faint
  sheen, a thin light edge and a semi-transparent green grid, so the backdrop and the wafer show through it. The racks keep their blue and orange, which stand clear of the green.
- **The panel never covers the stage**, on a desktop or a phone. The card is drawn over the scene on purpose:
  it is the visualization, not a control.
- **The page works without the 3D scene.** If `main.js` fails to load (no WebGL, or the CDN is unreachable)
  the page shows a notice in both languages. `localStorage` is read and written inside `try`, so a sandboxed
  preview that blocks it still runs.
- `prefers-reduced-motion` stops the wafer turning and drops the card zoom, the camera glide, the count-up and the pulsing highlight.

### Verified

- **Data:** the 16 rows and the 6 rack totals in `src/data.js` hold 22 of the 23 rows of the approved dataset
  (`b300_vs_rubin_specs.csv`), value for value; the 23rd, FP8, was removed on purpose.
- **Static checks:** all three modules pass `node --check`; the English and Chinese string tables have the same
  keys; every `data-i18n` attribute names a string; every metric, group and note has a Chinese form.
- **In Chrome**, against the real Three.js r185 from unpkg, with the repository served over HTTP:
  - Desktop 1440×900 in English and Chinese, iPhone 13 portrait and landscape, and a 500 px-wide frame: no
    console errors, no horizontal overflow, no controls on the card.
  - Switching to Chinese updates the page, the URL (`?lang=zh`), the document title and `localStorage`.
  - The tour, driven with a simulated clock at 2 s per metric, moves on at 2.0 s, 4.0 s and 6.0 s.
  - With the CDN blocked, the notice appears.
  - The overview walk, stepped through with a test hook: each step emphasises the matching line in both columns
    and lights exactly 144 GPUs (for the GPU and HBM lines), 72 CPUs, 36 compute trays or 18 switch trays across
    the two racks (twice the per-rack counts); leaving the frame restores the next metric's highlight.
  - The card slide, with its animations paused at fixed times: at 85 ms into Next the old contents sit 9 px
    left at 68% opacity; at 120 ms the new ones come in from the right; Prev mirrors both. Four quick → presses
    settle on the fourth metric with no animation left running; with reduced motion the card swaps at once.
  - In the visual review, the card's bars matched the value ratios (e.g. 18.6 px against 62 px for 15 : 50 PFLOPS).
- **Not yet checked:** a real phone (touch, pinch and the address bar), browsers other than Chrome, and frame
  rate on slower GPUs.
