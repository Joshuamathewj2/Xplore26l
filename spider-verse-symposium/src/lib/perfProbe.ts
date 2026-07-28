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
};

class PerfProbe {
  enabled = false;

  private samples: FrameSample[] = [];
  private lastFrameAt = 0;
  private lastScrollAt = -Infinity;

  /** Long tasks (>50ms) seen since the last report. */
  longTasks: { start: number; duration: number; name: string }[] = [];

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

    const intervals = s.map((x) => x.interval).sort((a, b) => a - b);
    const scrolling = s.filter((x) => x.scrolling);
    const still = s.filter((x) => !x.scrolling);
    const lateOf = (arr: FrameSample[]) =>
      arr.length ? (arr.filter((x) => x.interval > 20).length / arr.length) * 100 : 0;

    return {
      fps: 1000 / (intervals.reduce((a, b) => a + b, 0) / intervals.length),
      p50: this.pct(intervals, 0.5),
      p95: this.pct(intervals, 0.95),
      worst: intervals[intervals.length - 1],
      calls: s[s.length - 1].calls,
      tris: s[s.length - 1].tris,
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
    console.log(`samples          ${this.samples.length}`);
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

    if (this.longTasks.length) {
      console.table(this.longTasks.slice(-15));
    }
    console.groupEnd();
  }

  reset() {
    this.samples = [];
    this.longTasks = [];
    this.lastFrameAt = 0;
    console.info("[perf] cleared");
  }
}

export const perfProbe = new PerfProbe();
