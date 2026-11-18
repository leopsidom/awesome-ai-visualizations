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
 *   about/aboutZh what the metric is, how it affects performance and useful context (shown under the title)
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
  { id: "Process node", group: "Silicon", part: "gpu", scope: "gpu", unit: "text", b300: "TSMC 4NP", rubin: "TSMC N3P", textZh: ["台积电 4NP", "台积电 N3P"], sub: ["4\u00a0nm", "3\u00a0nm"], subZh: ["4 纳米", "3 纳米"], about: "The manufacturing process used to make the GPU dies. A newer, smaller node fits more transistors in the same area and uses less power per operation — that is where most of each generation's gains come from.", aboutZh: "制造 GPU 芯片所用的工艺。更新、更小的工艺能在相同面积内放入更多晶体管，并降低每次运算的功耗——每一代性能提升大多由此而来。", confidence: "high", note: "4NP is NVIDIA's custom N4P, marketed as 4 nm (TSMC classes N4P in its 5 nm family). N3P is in TSMC's 3 nm family; Rubin's I/O dies are reported on N5B.", noteZh: "4NP 是 NVIDIA 定制的 N4P，对外宣传为 4 纳米（台积电将 N4P 归入 5 纳米家族）。N3P 属于台积电 3 纳米家族；据报道 Rubin 的 I/O 芯片采用 N5B。", source: "pr.tsmc.com / tweaktown.com / trendforce.com" },
  { id: "Transistors", group: "Silicon", part: "gpu", scope: "gpu", unit: "billion", b300: 208, rubin: 336, about: "The number of transistors across the GPU's two dies. More transistors buy more compute units, bigger caches and new features such as lower-precision math, at the cost of more power and a higher price.", aboutZh: "GPU 两颗裸片上的晶体管总数。晶体管越多，就能容纳更多计算单元、更大的缓存以及低精度运算等新功能，但功耗和价格也随之上升。", confidence: "high", note: "Both dual-reticle dies", noteZh: "两者均为双光罩尺寸芯片", source: "tweaktown.com / siliconangle.com" },
  { id: "NVFP4 inference", group: "GPU compute", part: "gpu", scope: "gpu", unit: "PFLOPS", b300: 15, rubin: 50, rack: { b300: 1.08, rubin: 3.6, unit: "EFLOPS" }, about: "Peak throughput in NVIDIA's 4-bit floating-point format, used to serve large language models. It caps prompt processing and batched throughput; generating tokens one by one is usually limited by memory bandwidth instead.", aboutZh: "NVIDIA 4 位浮点格式下的峰值算力，用于大语言模型推理。它决定提示处理和批量吞吐的上限；而逐个生成 token 时，瓶颈通常是显存带宽。", confidence: "high", note: "Rubin figure uses adaptive compression; B300 is dense (a GB300 rack is 1.44 EF sparse)", noteZh: "Rubin 数据采用自适应压缩；B300 为稠密算力（GB300 整柜稀疏算力为 1.44 EF）", source: "tomshardware.com / nvidia.com" },
  { id: "NVFP4 training", group: "GPU compute", part: "gpu", scope: "gpu", unit: "PFLOPS", b300: 15, rubin: 35, rack: { b300: 1.08, rubin: 2.5, unit: "EFLOPS" }, about: "Peak 4-bit throughput when training models. Training needs extra precision handling (scaling, higher-precision accumulation), so it runs below the inference figure; it sets how fast a given model can be trained.", aboutZh: "训练模型时的 4 位峰值算力。训练需要额外的精度处理（缩放、高精度累加），因此低于推理数值；它决定训练给定模型的速度。", confidence: "medium", note: "B300 has no separate training figure", noteZh: "B300 未单独公布训练算力", source: "vast.ai / cudocompute.com / storagereview.com" },
  { id: "FP64", group: "GPU compute", part: "gpu", scope: "gpu", unit: "TFLOPS", b300: 1.2, rubin: 33, about: "Double-precision (64-bit) throughput, used by scientific simulation — weather, physics, chemistry — rather than AI. B300 cut it sharply to spend its silicon on low-precision AI math; Rubin restores much of it.", aboutZh: "双精度（64 位）算力，主要用于天气、物理、化学等科学计算，而非 AI。B300 大幅削减 FP64，把芯片面积留给低精度 AI 运算；Rubin 恢复了其中大部分。", confidence: "medium", note: "B300 cut FP64 to make room for FP4", noteZh: "B300 削减 FP64 以让位于 FP4", source: "glennklockwood.com" },
  { id: "HBM capacity", group: "GPU memory", part: "gpu", scope: "gpu", unit: "GB", b300: 288, rubin: 288, rack: { b300: 20.7, rubin: 20.7, unit: "TB" }, about: "High-bandwidth memory stacked beside each GPU. It decides how large a model, and how long a context (the KV cache), fits on one GPU before the work has to be split across several.", aboutZh: "紧邻每颗 GPU 堆叠的高带宽显存。它决定单颗 GPU 能装下多大的模型、多长的上下文（KV 缓存），超出后就必须拆分到多颗 GPU 上。", confidence: "high", note: "HBM3e 12-high vs HBM4 (8 stacks each)", noteZh: "HBM3e 12 层堆叠 vs HBM4（各 8 堆栈）", source: "tomshardware.com / storagereview.com" },
  { id: "HBM bandwidth", group: "GPU memory", part: "gpu", scope: "gpu", unit: "TB/s", b300: 8, rubin: 22, rack: { b300: 0.576, rubin: 1.6, unit: "PB/s" }, about: "How fast the GPU can read its memory. Every new token means reading the model's weights again, so for LLM inference this, more than peak FLOPS, often sets the speed.", aboutZh: "GPU 读取显存的速度。每生成一个新 token 都要重新读取模型权重，因此在大模型推理中，它往往比峰值算力更能决定速度。", confidence: "high", note: null, source: "vast.ai / storagereview.com" },
  { id: "NVLink bandwidth per GPU", group: "Interconnect", part: "switch", scope: "gpu", unit: "TB/s", b300: 1.8, rubin: 3.6, rack: { b300: 130, rubin: 260, unit: "TB/s" }, about: "Each GPU's link into the rack's NVLink fabric, which lets all 72 GPUs share memory and act as one large accelerator. It matters whenever a model is split across GPUs, as in tensor or expert parallelism.", aboutZh: "每颗 GPU 接入机柜 NVLink 网络的带宽，使 72 颗 GPU 能共享显存、如同一台大型加速器。当模型拆分到多颗 GPU 上（如张量并行、专家并行）时尤为关键。", confidence: "high", note: "NVLink 5 vs NVLink 6", noteZh: "NVLink 5 与 NVLink 6", source: "tomshardware.com / bitdeer.ai / storagereview.com" },
  { id: "Scale-out NIC per GPU", group: "Interconnect", part: "nic", scope: "gpu", unit: "Gb/s", b300: 800, rubin: 1600, about: "Network bandwidth from each GPU to other racks, over InfiniBand or Ethernet. It limits training and inference jobs that span many racks, where data has to leave the NVLink domain.", aboutZh: "每颗 GPU 通过 InfiniBand 或以太网连接其他机柜的网络带宽。当任务跨越多个机柜、数据必须离开 NVLink 域时，它就成为限制因素。", confidence: "medium", note: "ConnectX-8 vs ConnectX-9", noteZh: "ConnectX-8 与 ConnectX-9", source: "server-parts.eu / nvidia.com" },
  { id: "GPU power (max)", group: "Power", part: "gpu", scope: "gpu", unit: "W", b300: 1400, rubin: 2300, cost: true, about: "Maximum power drawn by one GPU. More power usually buys more performance, but it drives the rack's cooling and electricity needs; performance per watt is the figure to watch.", aboutZh: "单颗 GPU 的最大功耗。功耗越高通常性能越强，但也决定了机柜的散热和供电需求；更值得关注的是每瓦性能。", confidence: "medium", note: "Rubin: Max-Q ~1800 W / Max-P ~2300 W", noteZh: "Rubin：Max-Q 约 1800 W / Max-P 约 2300 W", source: "introl.com / thundercompute.com" },
  { id: "CPU cores", group: "CPU", part: "cpu", scope: "cpu", unit: "cores", b300: 72, rubin: 88, about: "Arm cores on each CPU. The CPU feeds the GPUs — it schedules work, prepares data and runs everything that is not GPU code — so it can become the bottleneck in data-heavy or agent-style workloads.", aboutZh: "每颗 CPU 上的 Arm 核心数。CPU 负责为 GPU 供给数据：调度任务、准备数据并运行所有非 GPU 代码，在数据密集或智能体类负载中可能成为瓶颈。", confidence: "high", note: "Grace (Neoverse V2) vs Vera (Olympus; 176 threads)", noteZh: "Grace（Neoverse V2）与 Vera（Olympus，176 线程）", source: "cudocompute.com" },
  { id: "CPU memory per CPU", group: "CPU", part: "cpu", scope: "cpu", unit: "TB", b300: 0.48, rubin: 1.5, rack: { b300: 37, rubin: 75, unit: "TB", label: "fast" }, about: "LPDDR5X memory attached to each CPU, which the GPUs can reach over the NVLink-C2C link. It extends the rack's fast memory, for example to hold long-context KV caches that do not fit in HBM.", aboutZh: "每颗 CPU 配备的 LPDDR5X 内存，GPU 可通过 NVLink-C2C 访问。它扩展了机柜的高速内存，例如用于存放 HBM 装不下的长上下文 KV 缓存。", confidence: "high", note: "LPDDR5X (Vera uses SOCAMM)", noteZh: "LPDDR5X（Vera 采用 SOCAMM）", source: "cudocompute.com / bitdeer.ai / datacenterdynamics.com" },
  { id: "CPU memory bandwidth", group: "CPU", part: "cpu", scope: "cpu", unit: "TB/s", b300: 0.5, rubin: 1.2, about: "How fast the CPU's memory can be read. Higher bandwidth makes CPU memory more useful as overflow for the GPUs and speeds up data preparation.", aboutZh: "CPU 内存的读取速度。带宽越高，CPU 内存作为 GPU 的扩展存储就越实用，数据准备也更快。", confidence: "medium", note: null, source: "cudocompute.com" },
  { id: "Rack power (max)", group: "Rack", part: "power", scope: "rack", unit: "kW", b300: 142, rubin: 227, cost: true, about: "Total power for the whole rack — GPUs, CPUs, switches and network cards. It decides whether a data center can host the rack at all; both systems need liquid cooling.", aboutZh: "整个机柜的总功耗：GPU、CPU、交换机和网卡。它决定数据中心能否容纳该机柜；两套系统都需要液冷。", confidence: "medium", note: "Rubin datasheet: 227 Max-P / 187 Max-Q", noteZh: "Rubin 规格书：Max-P 227 / Max-Q 187", source: "enzu.com / introl.com" },
  { id: "Rack price (analyst est.)", group: "Rack", part: "rack", scope: "rack", unit: "USD M", b300: 4.0, rubin: 7.8, cost: true, about: "Estimated purchase price of one rack, from analysts — NVIDIA publishes no prices. Set against throughput, it gives the cost per unit of compute or per token.", aboutZh: "单个机柜的估算采购价，来自分析师——NVIDIA 不公布价格。与吞吐量相比，可得出单位算力或每个 token 的成本。", confidence: "low", note: "Morgan Stanley estimate; NVIDIA does not publish prices", noteZh: "摩根士丹利估算；NVIDIA 未公布价格", source: "enzu.com" },
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
