/* ════════════════════════════════════════════════════════════
   PERF PROBE — instrumentation for the choppy scroll transition.

   Off unless the page is loaded with ?debug=perf. When off, `enabled` is
   false and every entry point returns immediately, so this costs a boolean
   test per frame in production and nothing else.

   It exists because three rounds of removing plausible costs did not fix the
   stutter, and a fourth guess is worth less than one measurement. The point is
   to answer ONE question: when a frame is late, what was the page doing?

     · frame interval        — what the user actually sees
     · draw calls / triangles — how much we are asking the GPU for
     · long tasks            — main-thread blocks over 50ms, with attribution
     · scroll correlation    — late frames while scrolling vs while still

   Deliberately NOT React state: a probe that re-renders the tree every frame
   would be measuring itself.
   ════════════════════════════════════════════════════════════ */

const CAP = 600; // ~10s at 60fps

export type FrameSample = {
  /** ms since the previous frame — 16.7 at 60fps. */
  interval: number;
  /** three.js draw calls for the frame. */
  calls: number;
  /** Triangles submitted. */
  tris: number;
  /** Was the page scrolling within 100ms of this frame? */
  scrolling: boolean;
  /** Within the first 3s — model parse, shader compile, texture upload. */
  startup: boolean;
};

class PerfProbe {
  enabled = false;

  private samples: FrameSample[] = [];
  private lastFrameAt = 0;
  private lastScrollAt = -Infinity;

  /** Long tasks (>50ms) seen since the last report. */
  longTasks: { start: number; duration: number; name: string }[] = [];

  /* Per-subsystem timings, so "the main thread is blocked" becomes "blocked by
     this". The long-task observer says a block happened; it does not say whose
     code it was, and guessing that from a list of candidates is how the last
     three rounds went wrong. */
  private marks = new Map<string, { total: number; n: number; worst: number }>();

  /**
   * Time a block of work. Costs one performance.now() pair when the probe is
   * on, and a single boolean test when it is off.
   *
   *   perfProbe.time("crack", () => { ...per-frame work... });
   */
  time<T>(label: string, fn: () => T): T {
    if (!this.enabled) return fn();
    const t0 = performance.now();
    try {
      return fn();
    } finally {
      const ms = performance.now() - t0;
      const m = this.marks.get(label) ?? { total: 0, n: 0, worst: 0 };
      m.total += ms;
      m.n += 1;
      if (ms > m.worst) m.worst = ms;
      this.marks.set(label, m);
    }
  }

  init() {
    if (typeof window === "undefined") return;
    this.enabled = new URLSearchParams(window.location.search).get("debug") === "perf";
    if (!this.enabled) return;

    window.addEventListener(
      "scroll",
      () => {
        this.lastScrollAt = performance.now();
      },
      { passive: true }
    );

    /* Long tasks tell us whether a dropped frame was the main thread being
       blocked (our JS, style, layout) rather than the GPU falling behind —
       which is the single most useful distinction here, and the one static
       reading of the code could not settle. */
    try {
      const po = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.longTasks.push({
            start: Math.round(entry.startTime),
            duration: Math.round(entry.duration),
            name: entry.name,
          });
          if (this.longTasks.length > 100) this.longTasks.shift();
        }
      });
      po.observe({ entryTypes: ["longtask"] });
    } catch {
      /* Safari has no longtask observer. The rest still works. */
    }

    console.info(
      "%c[perf] probe on. window.__perf.report() for a summary, .reset() to clear.",
      "color:#e63946;font-weight:bold"
    );
    (window as unknown as { __perf: PerfProbe }).__perf = this;
  }

  /**
   * One call per frame, from a useFrame at a NEGATIVE priority so it runs
   * before the scene's own callbacks.
   *
   * Interval is measured between consecutive calls, so it covers the whole
   * frame — our JS, the render, and the compositing — which is what the user
   * actually experiences.
   *
   * There is no separate "our JS" timing on purpose. Capturing it would need a
   * callback after the render, and in R3F a positive-priority useFrame takes
   * over rendering entirely — instrumentation that changes how the page draws
   * is not instrumentation. The long-task observer answers the same question
   * more reliably anyway: late frames WITH long tasks means the main thread is
   * blocked; late frames WITHOUT them means the GPU is behind.
   */
  frame(calls: number, tris: number) {
    if (!this.enabled) return;
    const now = performance.now();
    const interval = this.lastFrameAt ? now - this.lastFrameAt : 0;
    this.lastFrameAt = now;

    if (interval > 0 && interval < 2000) {
      this.samples.push({
        interval,
        calls,
        tris,
        scrolling: now - this.lastScrollAt < 100,
        /* Startup is a different problem from steady state — model parse,
           shader compile and texture upload all land in the first second or
           two and would otherwise drag the percentiles for the whole run. The
           first recording's 513ms worst frame was almost certainly the GLTF
           landing, which says nothing about why scrolling feels rough. */
        startup: now < 3000,
      });
      if (this.samples.length > CAP) this.samples.shift();
    }
  }

  private pct(sorted: number[], p: number) {
    if (!sorted.length) return 0;
    return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
  }

  /** Live numbers for the HUD. Cheap enough to call a few times a second. */
  snapshot() {
    const s = this.samples;
    if (!s.length) return null;

    // Percentiles are STEADY STATE only. Startup frames are a separate
    // problem and would otherwise dominate every number here.
    const steady = s.filter((x) => !x.startup);
    const base = steady.length > 30 ? steady : s;
    const intervals = base.map((x) => x.interval).sort((a, b) => a - b);
    const scrolling = base.filter((x) => x.scrolling);
    const still = base.filter((x) => !x.scrolling);
    const lateOf = (arr: FrameSample[]) =>
      arr.length ? (arr.filter((x) => x.interval > 20).length / arr.length) * 100 : 0;

    return {
      fps: 1000 / (intervals.reduce((a, b) => a + b, 0) / intervals.length),
      p50: this.pct(intervals, 0.5),
      p95: this.pct(intervals, 0.95),
      worst: intervals[intervals.length - 1],
      calls: base[base.length - 1].calls,
      tris: base[base.length - 1].tris,
      nStartup: s.filter((x) => x.startup).length,
      worstStartup: s.filter((x) => x.startup).reduce((m, x) => Math.max(m, x.interval), 0),
      /* The comparison that matters: if late frames cluster while scrolling,
         the cost is in the scroll path. If they are the same either way, it is
         the render itself and scrolling is innocent. */
      lateScrolling: lateOf(scrolling),
      lateStill: lateOf(still),
      nScrolling: scrolling.length,
      nStill: still.length,
      longTasks: this.longTasks.length,
      worstLongTask: this.longTasks.reduce((m, t) => Math.max(m, t.duration), 0),
    };
  }

  /** Dump everything to the console. This is the thing to paste back. */
  report() {
    const snap = this.snapshot();
    if (!snap) {
      console.warn("[perf] no samples yet — scroll the page first.");
      return;
    }

    console.group("%c[perf] frame report", "color:#e63946;font-weight:bold");
    console.log(`samples          ${this.samples.length}  (steady state, excl. first 3s)`);
    console.log(
      `startup          ${snap.nStartup} frames, worst ${snap.worstStartup.toFixed(0)}ms ` +
        `— model parse / shader compile, a separate problem from the stutter`
    );
    console.log(`fps (mean)       ${snap.fps.toFixed(1)}`);
    console.log(`frame p50 / p95  ${snap.p50.toFixed(1)}ms / ${snap.p95.toFixed(1)}ms`);
    console.log(`worst frame      ${snap.worst.toFixed(1)}ms`);
    console.log(`draw calls       ${snap.calls}`);
    console.log(`triangles        ${snap.tris.toLocaleString()}`);
    console.log(
      `late >20ms       scrolling ${snap.lateScrolling.toFixed(1)}% (n=${snap.nScrolling})  ` +
        `still ${snap.lateStill.toFixed(1)}% (n=${snap.nStill})`
    );
    console.log(`long tasks       ${snap.longTasks} (worst ${snap.worstLongTask}ms)`);

    /* The interpretation, written down so the numbers do not need a second
       conversation to mean something. */
    console.log("%c— reading —", "color:#888");

    /* Checked BEFORE anything else: the scrolling-vs-still split is the whole
       point of the recording, and a run with no scroll samples cannot answer
       it. The first recording had n=0 here, and the conclusion drawn from it
       would have been about a symptom nobody reported. */
    if (snap.nScrolling < 30) {
      console.log(
        `%cONLY ${snap.nScrolling} SCROLLING SAMPLES — this recording cannot say ` +
          "anything about scroll-related stutter. Enter the portal so the page " +
          "can scroll, scroll the hero for a few seconds, then run this again.",
        "color:#e63946;font-weight:bold"
      );
    }

    if (snap.p95 < 20) {
      console.log(
        "frames are on time HERE. If it still felt choppy, the stutter is " +
          "either device-specific or happens in a section this recording missed."
      );
    } else if (snap.worstLongTask > 50) {
      console.log(
        `MAIN THREAD BLOCKED — worst long task ${snap.worstLongTask}ms. Late frames ` +
          "are our JS, style recalc, layout or media decode, not the GPU. " +
          "See the table below for when they landed."
      );
    } else {
      console.log(
        "Frames are late with NO long tasks — GPU-bound. The main thread is " +
          "keeping up and the card is not. Lower PERF.maxDpr (currently 1.5) " +
          "or drop post-processing passes; draw calls and triangles above say " +
          "whether the scene or the composer is the weight."
      );
    }
    if (snap.lateScrolling > snap.lateStill * 2 && snap.nScrolling > 30) {
      console.log("late frames cluster WHILE SCROLLING — cost is in the scroll path");
    }

    /* Whose code was it. Sorted by total time, because a cheap thing called
       every frame outranks an expensive thing called once. */
    if (this.marks.size) {
      const rows = [...this.marks.entries()]
        .map(([label, m]) => ({
          label,
          "avg ms": +(m.total / m.n).toFixed(3),
          "worst ms": +m.worst.toFixed(1),
          calls: m.n,
          "total ms": +m.total.toFixed(0),
        }))
        .sort((a, b) => b["total ms"] - a["total ms"]);
      console.log("%c— where the main thread went —", "color:#888");
      console.table(rows);
    }

    if (this.longTasks.length) {
      console.log("%c— long tasks (>50ms) —", "color:#888");
      console.table(this.longTasks.slice(-15));
    }
    console.groupEnd();
  }

  reset() {
    this.samples = [];
    this.marks.clear();
    this.longTasks = [];
    this.lastFrameAt = 0;
    console.info("[perf] cleared");
  }
}

export const perfProbe = new PerfProbe();
