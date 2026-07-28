"use client";

import { useEffect, useRef } from "react";
import { perfProbe } from "@/lib/perfProbe";
import { scrollState } from "@/lib/scrollState";

/* ════════════════════════════════════════════════════════════
   PERF HUD — live frame numbers, on screen, while you scroll.

   Renders nothing unless the page is loaded with ?debug=perf.

   Updates at 5Hz through direct textContent writes rather than React state:
   a HUD that re-rendered the tree every frame would be adding exactly the kind
   of cost it is here to find. For the same reason it reads a snapshot rather
   than recomputing percentiles per frame.

   The live panel is for spotting WHEN it stutters — scroll and watch which
   number moves. `window.__perf.report()` in the console is the thing to
   actually paste back, because it includes the scrolling-vs-still split and
   the long task table.
   ════════════════════════════════════════════════════════════ */
export default function PerfHUD() {
  const ref = useRef<HTMLPreElement>(null);

  useEffect(() => {
    perfProbe.init();
    if (!perfProbe.enabled) return;

    const el = ref.current;
    if (!el) return;
    el.style.display = "block";

    const fmt = (n: number, d = 1) => n.toFixed(d).padStart(6);

    const id = window.setInterval(() => {
      const s = perfProbe.snapshot();
      if (!s) {
        el.textContent = "[perf] waiting for frames…";
        return;
      }

      /* Flag the numbers that indicate a problem, so the panel can be read at
         a glance while scrolling rather than studied afterwards. */
      const late = s.p95 > 20 ? " ←LATE" : "";
      const blocked = s.worstLongTask > 50 ? " ←MAIN THREAD" : "";
      // Late frames with no long tasks is the GPU falling behind, not us.
      const gpu = s.p95 > 20 && s.worstLongTask < 50 ? " ←GPU" : "";
      const scrollFlag =
        s.lateScrolling > s.lateStill * 2 && s.nScrolling > 30 ? " ←SCROLL PATH" : "";

      el.textContent = [
        `fps        ${fmt(s.fps)}`,
        `frame p50  ${fmt(s.p50)}ms`,
        `frame p95  ${fmt(s.p95)}ms${late}${gpu}`,
        `worst      ${fmt(s.worst)}ms`,
        `draws      ${String(s.calls).padStart(6)}`,
        `tris       ${s.tris.toLocaleString().padStart(6)}`,
        `longtask   ${String(s.worstLongTask).padStart(6)}ms${blocked}`,
        `late scrl  ${fmt(s.lateScrolling)}%${scrollFlag}`,
        `late still ${fmt(s.lateStill)}%`,
        `beatPos    ${fmt(scrollState.beatPos, 3)}`,
        `progress   ${fmt(scrollState.progress, 3)}`,
        `velocity   ${fmt(scrollState.velocity)}`,
        ``,
        `__perf.report() in console`,
      ].join("\n");
    }, 200);

    return () => window.clearInterval(id);
  }, []);

  return (
    <pre
      ref={ref}
      style={{
        display: "none",
        position: "fixed",
        top: 8,
        right: 8,
        zIndex: 99999,
        margin: 0,
        padding: "8px 10px",
        font: "11px/1.35 ui-monospace, Menlo, Consolas, monospace",
        color: "#d8e2dc",
        background: "rgba(0,0,0,0.82)",
        border: "1px solid rgba(255,255,255,0.18)",
        borderRadius: 4,
        pointerEvents: "none",
        whiteSpace: "pre",
      }}
    />
  );
}
