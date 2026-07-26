"use client";

import { useEffect, useMemo, useRef } from "react";
import { scrollState } from "@/lib/scrollState";
import { PUNCH } from "@/lib/beats";

/* ════════════════════════════════════════════════════════════
   IMPACT CRACK — the viewport "glass" cracking under the final punch.

   Driven ENTIRELY by scrollState.beatPos (never a timer), so it stays
   frame-locked to the punch pose: cracks GROW as the fist reaches full
   extension (beatPos PUNCH.impactStart → impactEnd) and REVERSE/clear if
   the user scrolls back up. Only the one-shot garnishes (white flash,
   screen shake, and the chromatic-aberration spike in Spider3D) fire on
   the upward crossing of impactEnd — and they re-arm on the way back down.

   • Radiating jagged rays + two web rings from the impact point (roughly
     where the fist meets the screen), grown via pathLength/dashoffset so
     each crack extends OUTWARD from the hit.
   • Spider-Verse misprint: red/cyan ghost copies of the crack layer,
     offset a hair, mix-blend-mode screen.
   • Shake: transform-only, applied to this overlay + every
     [data-impact-shake] element (the 3D canvas wrapper) — decaying ~350ms.
   • prefers-reduced-motion: cracks appear as a static fade (no growth
     pop), NO shake, NO flash.
   • pointer-events: none everywhere — the REGISTER CTA stays clickable.
   ════════════════════════════════════════════════════════════ */

const CRACK = {
  zIndex: 45, // above section content (z-30) and the hero outline (z16)
  // Impact point in viewBox coords (0-100 both axes, preserveAspectRatio
  // "none"). Matches the fist in the register beat-camera render: a touch
  // left of centre, upper third.
  cx: 41,
  cy: 33,
  rays: 13,
  seed: 20990101,
  stroke: "rgba(238,244,255,0.92)",
  strokeW: 2.2, // px (non-scaling-stroke)
  ghostW: 2.6,
  red: "rgba(255,45,63,0.5)",
  cyan: "rgba(0,229,255,0.5)",
  ghostOff: 0.45, // viewBox units of RGB mis-registration
  shake: { amp: 7, decay: 8.5, fx: 71, fy: 57 }, // px, 1/s, Hz-ish
  flash: { peak: 0.5, decay: 6.5 }, // opacity, 1/s
};

type Ray = { d: string; stagger: number };

/* Deterministic LCG so SSR and client generate identical cracks. */
function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function buildCracks() {
  const rnd = makeRng(CRACK.seed);
  const rays: Ray[] = [];
  const { cx, cy } = CRACK;
  for (let i = 0; i < CRACK.rays; i++) {
    const baseA = (i / CRACK.rays) * Math.PI * 2 + (rnd() - 0.5) * 0.5;
    const len = 16 + rnd() * 42; // some die early, some run to the edges
    const segs = 4 + Math.floor(rnd() * 3);
    let a = baseA;
    let x = cx;
    let y = cy;
    let d = `M ${x.toFixed(1)} ${y.toFixed(1)}`;
    const pts: [number, number][] = [];
    for (let s = 0; s < segs; s++) {
      a += (rnd() - 0.5) * 0.55; // jagged kinks
      const step = (len / segs) * (0.7 + rnd() * 0.6);
      x += Math.cos(a) * step;
      y += Math.sin(a) * step * 0.9; // slightly squashed vertically
      d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
      pts.push([x, y]);
    }
    rays.push({ d, stagger: rnd() * 0.3 });
    // Glass-style side branch off a mid point for roughly half the rays.
    if (rnd() > 0.5 && pts.length > 2) {
      const [bx, by] = pts[1 + Math.floor(rnd() * (pts.length - 2))];
      const ba = baseA + (rnd() > 0.5 ? 1 : -1) * (0.5 + rnd() * 0.5);
      const bl = 4 + rnd() * 9;
      const mx = bx + Math.cos(ba) * bl * 0.6;
      const my = by + Math.sin(ba) * bl * 0.55;
      const ex = bx + Math.cos(ba + (rnd() - 0.5) * 0.4) * bl;
      const ey = by + Math.sin(ba + (rnd() - 0.5) * 0.4) * bl;
      rays.push({
        d: `M ${bx.toFixed(1)} ${by.toFixed(1)} L ${mx.toFixed(1)} ${my.toFixed(1)} L ${ex.toFixed(1)} ${ey.toFixed(1)}`,
        stagger: 0.35 + rnd() * 0.3,
      });
    }
  }
  // Two jagged concentric web rings around the impact point.
  for (const r of [5.5, 11]) {
    const n = 10;
    let d = "";
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      const rr = r * (0.85 + rnd() * 0.35);
      const x = cx + Math.cos(a) * rr;
      const y = cy + Math.sin(a) * rr * 0.8;
      d += (i === 0 ? "M " : "L ") + `${x.toFixed(1)} ${y.toFixed(1)} `;
    }
    rays.push({ d: d + "Z", stagger: r > 6 ? 0.3 : 0.12 });
  }
  return rays;
}

export default function ImpactCrack() {
  const rays = useMemo(buildCracks, []);
  const rootRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const svg = svgRef.current;
    const flash = flashRef.current;
    if (!root || !svg || !flash) return;

    const paths = Array.from(
      svg.querySelectorAll<SVGPathElement>("[data-crack]")
    ).map((el) => ({ el, stagger: Number(el.dataset.stagger || 0) }));
    const shakeEls = Array.from(
      document.querySelectorAll<HTMLElement>("[data-impact-shake]")
    );

    const fx = { landed: false, shakeT: 99, flashO: 0, lastP: -1, lastRM: false };
    let raf = 0;
    let prev = performance.now();

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min((now - prev) / 1000, 0.1);
      prev = now;

      const span = PUNCH.impactEnd - PUNCH.impactStart;
      const p = Math.min(
        Math.max((scrollState.beatPos - PUNCH.impactStart) / span, 0),
        1
      );
      const rm = scrollState.reducedMotion;

      // One-shots: fire on the upward crossing only; re-arm scrolling back.
      if (p >= 1 && !fx.landed) {
        fx.landed = true;
        if (!rm) {
          fx.shakeT = 0;
          fx.flashO = CRACK.flash.peak;
        }
      } else if (p < 0.85 && fx.landed) {
        fx.landed = false;
      }

      // ── Crack growth (scroll IS the timeline; reversal clears them) ──
      if (p !== fx.lastP || rm !== fx.lastRM) {
        fx.lastP = p;
        fx.lastRM = rm;
        svg.style.opacity = p === 0 ? "0" : String(0.35 + 0.65 * p);
        for (const { el, stagger } of paths) {
          const pr = rm
            ? p >= 1 ? 1 : 0 // reduced motion: static, no growth animation
            : Math.min(Math.max((p - stagger) / (1 - stagger * 0.8), 0), 1);
          el.style.strokeDashoffset = String(1 - pr);
        }
      }

      // ── Flash (one-shot, decays fast) ──
      if (fx.flashO > 0.003) {
        fx.flashO = Math.max(0, fx.flashO - fx.flashO * CRACK.flash.decay * dt);
        flash.style.opacity = fx.flashO.toFixed(3);
      } else if (flash.style.opacity !== "0") {
        flash.style.opacity = "0";
      }

      // ── Shake (transform-only, ~350ms decaying) ──
      fx.shakeT += dt;
      const amp = rm ? 0 : CRACK.shake.amp * Math.exp(-fx.shakeT * CRACK.shake.decay);
      if (amp > 0.05) {
        const dx = amp * Math.sin(fx.shakeT * CRACK.shake.fx);
        const dy = amp * Math.cos(fx.shakeT * CRACK.shake.fy) * 0.7;
        const t = `translate3d(${dx.toFixed(2)}px, ${dy.toFixed(2)}px, 0)`;
        svg.style.transform = t;
        for (const el of shakeEls) el.style.transform = t;
      } else if (svg.style.transform) {
        svg.style.transform = "";
        for (const el of shakeEls) el.style.transform = "";
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      svg.style.transform = "";
      for (const el of shakeEls) el.style.transform = "";
    };
  }, []);

  const layer = (
    stroke: string,
    w: number,
    dx: number,
    key: string,
    blend?: boolean
  ) => (
    <g
      key={key}
      transform={dx ? `translate(${dx} 0)` : undefined}
      style={blend ? { mixBlendMode: "screen" } : undefined}
      stroke={stroke}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {rays.map((r, i) => (
        <path
          key={i}
          d={r.d}
          data-crack
          data-stagger={r.stagger}
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1}
          strokeWidth={w}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </g>
  );

  return (
    <div
      ref={rootRef}
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        zIndex: CRACK.zIndex,
        pointerEvents: "none", // NEVER blocks the CTA underneath
        overflow: "hidden",
      }}
    >
      {/* White impact flash, centred on the hit point */}
      <div
        ref={flashRef}
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0,
          background: `radial-gradient(circle at ${CRACK.cx}% ${CRACK.cy}%, rgba(255,255,255,0.95) 0%, rgba(210,235,255,0.5) 22%, transparent 55%)`,
          mixBlendMode: "screen",
        }}
      />
      <svg
        ref={svgRef}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0 }}
      >
        {/* misprint ghosts first (under), then the main white cracks */}
        {layer(CRACK.red, CRACK.ghostW, CRACK.ghostOff, "r", true)}
        {layer(CRACK.cyan, CRACK.ghostW, -CRACK.ghostOff, "c", true)}
        {layer(CRACK.stroke, CRACK.strokeW, 0, "w")}
      </svg>
    </div>
  );
}
