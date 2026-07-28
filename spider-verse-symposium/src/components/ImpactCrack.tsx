"use client";

import { useEffect, useMemo, useRef } from "react";
import { scrollState } from "@/lib/scrollState";
import { punchPos, punchWindow } from "@/lib/beats";
import { playShatterSound, primeShatterSound } from "@/lib/impactAudio";

/* ════════════════════════════════════════════════════════════
   IMPACT CRACK — the viewport "glass" cracking under the final punch.

   Driven ENTIRELY by scrollState.beatPos (never a timer), so it stays
   frame-locked to the punch pose: cracks GROW as the fist reaches full
   extension and REVERSE/clear if the user scrolls back up. Only the
   one-shot garnishes (white flash, screen shake, and the chromatic-
   aberration spike in Spider3D) fire on the upward crossing of the impact —
   and they re-arm on the way back down.

   • Radiating jagged rays + two web rings from the impact point (roughly
     where the fist meets the screen), grown via pathLength/dashoffset so
     each crack extends OUTWARD from the hit.
   • Spider-Verse misprint: red/cyan ghost copies of the crack layer,
     offset a hair, mix-blend-mode screen.
   • Shake: transform-only, applied to this overlay + every
     [data-impact-shake] element (the 3D canvas wrapper) — decaying ~350ms.
   • prefers-reduced-motion: cracks appear as a static fade (no growth
     pop), NO shake, NO flash.
   • pointer-events: none everywhere — nothing underneath is ever blocked.
   ════════════════════════════════════════════════════════════ */

const CRACK = {
  // Above the rig canvas (max z20) and every section's own content (z10),
  // but below the hero's fixed red border frame (z9999).
  zIndex: 45,
  /* Edge length of the crack box in CSS px. The geometry is authored in a
     viewBox centred on (0,0) spanning ±50, so a ray of length L reaches
     L/100 · size pixels from the fist. */
  size: 560,
  rays: 13,
  seed: 20990101,
  stroke: "rgba(238,244,255,0.92)",
  strokeW: 2.2, // px (non-scaling-stroke)
  ghostW: 2.6,
  red: "rgba(255,45,63,0.5)",
  cyan: "rgba(0,229,255,0.5)",
  ghostOff: 0.45, // viewBox units of RGB mis-registration
  /* SHAKE — a heavy THUD, not an earthquake. `dur` is the hard wall: the
     envelope is an exponential normalised to reach EXACTLY 0 at that time
     (not merely "small"), so the shake cannot smear past 300ms and the
     transforms are cleared once instead of drifting toward zero forever.
     `k` is the sharpness of the exponential ease-out — bigger = more of the
     amplitude spent in the first few frames. */
  shake: { amp: 10.5, dur: 0.3, k: 5.2, fx: 84, fy: 67 }, // px, s, –, rad/s
  flash: { peak: 0.5, decay: 6.5 }, // opacity, 1/s
  /* GLITCH — the Spider-Verse misprint SPIKE. The red/cyan ghost layers below
     are the permanent, subtle mis-registration; this is the violent one-frame
     version of it, layered as a CSS drop-shadow pair on the whole crack and
     cut back to normal (no fade — the snap IS the effect) after `ms`. */
  glitch: { ms: 150, px: 3, red: "rgb(255,45,63)", cyan: "rgb(0,229,255)" },
  /* LIFECYCLE (real milliseconds, the ONE part of this overlay that is not
     scroll-driven): hold the finished crack, then fade it out and take it out
     of the layout entirely. Resets the moment the punch is no longer fully
     landed, so scrolling back up and re-throwing gives a fresh crack. */
  life: { hold: 2000, fade: 1500 },
};

/** Normalised exponential ease-out: 1 at u=0, exactly 0 at u=1. */
const SHAKE_E = Math.exp(-CRACK.shake.k);
const shakeEnv = (u: number) =>
  u >= 1 ? 0 : (Math.exp(-CRACK.shake.k * u) - SHAKE_E) / (1 - SHAKE_E);

/** The one-frame RGB split. Two hard-offset coloured copies of the cracks. */
const GLITCH_FILTER =
  `drop-shadow(${CRACK.glitch.px}px 0 0 ${CRACK.glitch.red})` +
  ` drop-shadow(-${CRACK.glitch.px}px 0 0 ${CRACK.glitch.cyan})`;

type Ray = { d: string; stagger: number };

/* Deterministic LCG so SSR and client generate identical cracks. */
function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function buildCracks() {
  const rnd = makeRng(CRACK.seed);
  const rays: Ray[] = [];
  // Built around (0, 0); the group is translated to the fist at runtime.
  const cx = 0;
  const cy = 0;
  for (let i = 0; i < CRACK.rays; i++) {
    const baseA = (i / CRACK.rays) * Math.PI * 2 + (rnd() - 0.5) * 0.5;
    /* viewBox units, where the box spans ±50 around the fist. Reaching ~40
       fills most of the box without touching its edge, so the shatter is a
       contained break AT the impact rather than a full-screen web that
       happens to originate near it. */
    const len = 15 + rnd() * 26;
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
      const bl = 5 + rnd() * 10;
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
  for (const r of [7, 15]) {
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
  const rays = useMemo(() => buildCracks(), []);
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

    // Build the audio voices NOW, not at the moment of impact — a first-play
    // fetch/decode would land the sound after the glass is already broken.
    primeShatterSound();

    const fx = {
      landed: false, shakeT: 99, flashO: 0, lastP: -1, lastRM: false,
      // Quantised to whole pixels so we only touch the DOM when it moves.
      lastX: -9999, lastY: -9999, shakeX: 0, shakeY: 0,
      /** ms since the glitch fired; < 0 = not glitching. */
      glitchT: -1,
      /** Lifecycle: 0 not landed · 1 holding · 2 fading · 3 gone. */
      phase: 0,
      /** ms since the crack finished landing (drives phases 1→3). */
      lifeT: 0,
    };
    /** Put the overlay back in its "freshly cracked" state (also un-hides). */
    const revive = () => {
      root.style.transition = "none";
      root.style.opacity = "1";
      root.style.display = "";
      fx.lifeT = 0;
    };
    /* Writes left/top + the centring transform, composed with any shake.
       Skips writes that would set the value it already holds.

       This runs from its own requestAnimationFrame loop, which ticks for the
       whole life of the page — including the long stretches where the crack is
       display:none and the fist is not moving. Assigning an identical string to
       .style still invalidates style for that element, so the loop was asking
       the browser to re-resolve styles every frame alongside the WebGL canvas,
       for a result that had not changed. The character's scroll transition was
       sharing its frame budget with that.

       Compared against the last WRITTEN value rather than reading .style back,
       which would itself force a style recalculation. */
    let lastLeft = "";
    let lastTop = "";
    let lastTransform = "";
    const place = (x: number, y: number) => {
      const left = `${x}px`;
      const top = `${y}px`;
      const transform =
        `translate(-50%, -50%) translate3d(${fx.shakeX.toFixed(2)}px, ${fx.shakeY.toFixed(2)}px, 0)`;

      if (left !== lastLeft) {
        svg.style.left = left;
        lastLeft = left;
      }
      if (top !== lastTop) {
        svg.style.top = top;
        lastTop = top;
      }
      if (transform !== lastTransform) {
        svg.style.transform = transform;
        lastTransform = transform;
      }
    };
    let raf = 0;
    let prev = performance.now();

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min((now - prev) / 1000, 0.1);
      prev = now;

      // Recomputed each frame: the beat count can change if ScrollRig drops a
      // beat whose section wasn't found.
      const { start, end } = punchWindow();
      const span = Math.max(end - start, 1e-4);
      const rm = scrollState.reducedMotion;
      /* The RATE-LIMITED playhead, not scrollState.beatPos — the same signal
         the arm is posed from, so the glass can never break at a different
         moment than the fist arrives. Advancing it here as well as in
         BeatDriver is safe and deliberate: whichever loop runs first in a
         frame moves it, the other reads the same value back. It also means
         the crack still works if the WebGL canvas never comes up. */
      const pPos = punchPos(scrollState.beatPos, now, rm);
      /* UNCLAMPED: `p` is the crack's growth (0→1 across the window), but the
         one-shots need to know how far BEFORE contact the playhead has fallen
         back, which the clamp destroys. See the arming block below. */
      const pRaw = (pPos - start) / span;
      const p = Math.min(Math.max(pRaw, 0), 1);

      /* ── Follow the fist, EVERY FRAME ──
         Two earlier versions froze this — first at p >= 1, then at contact —
         on the reasoning that broken glass does not move. Both left the crack
         ~130px up the forearm, and the diagnostic said why: the punch lands
         at 96% of the final beat, but that beat's own char.x/camera
         interpolation only completes at 100% and is exponentially damped on
         top, so the character keeps arriving for about a second AFTER
         contact. Freeze at any single instant and the fist walks off the
         frozen point.

         Tracking continuously is also the more correct model for the part
         that matters most: the crack marks a spot the CAMERA is looking at,
         and when the camera moves that spot's screen position genuinely
         changes. The residual — the fist's own recoil dragging the break a
         little — is bounded by RECOIL_DEPTH and the 0.10 follow-through, and
         is far smaller than the misalignment it replaces. */
      if (scrollState.fistValid) {
        const x = Math.round(scrollState.fistX);
        const y = Math.round(scrollState.fistY);
        if (x !== fx.lastX || y !== fx.lastY) {
          fx.lastX = x;
          fx.lastY = y;
          place(x, y);
          flash.style.background =
            `radial-gradient(circle at ${x}px ${y}px, rgba(255,255,255,0.95) 0%,` +
            ` rgba(210,235,255,0.5) 18%, transparent 48%)`;
        }
      }

      /* ── One-shots: fire AT CONTACT (pRaw crossing 0), not when the cracks
         finish growing.

         This fired at p >= 1 before, which was invisible while the whole
         punch happened in a single frame — but with PUNCH_TEMPO pacing it,
         "p = 1" is a real 100 ms after the fist actually arrives, and the
         cracks would visibly spread BEFORE the flash, shake and sound went
         off. Contact is pRaw = 0: the frame the fist stops.

         The −0.5 re-arm (half the crack window BEFORE contact, i.e. back
         inside the strike) is the hysteresis. It has to be a real band, not
         an epsilon: scrubbing slowly across the contact point otherwise
         machine-guns the flash and — much worse — the sound. ── */
      if (pRaw >= 0 && !fx.landed) {
        fx.landed = true;
        // Audio is NOT gated on reduced motion: that preference is about
        // movement, and muting the hit would just remove information.
        playShatterSound();
        if (!rm) {
          fx.shakeT = 0;
          fx.flashO = CRACK.flash.peak;
          // RGB SPLIT — on for one beat, then hard-cut back (see GLITCH_FILTER).
          fx.glitchT = 0;
          svg.style.filter = GLITCH_FILTER;
        }
      } else if (pRaw < -0.5 && fx.landed) {
        fx.landed = false;
      }

      /* ── Glitch: 150ms, then SNAP back. No decay ramp on purpose — an eased
         fade reads as a glow, and the whole point is the misprint blinking. ── */
      if (fx.glitchT >= 0) {
        fx.glitchT += dt * 1000;
        if (fx.glitchT >= CRACK.glitch.ms) {
          fx.glitchT = -1;
          svg.style.filter = "none";
        }
      }

      /* ── CRACK LIFECYCLE — hold 2s, fade 1.5s, then out of the way ──
         Gated on p, not on `landed`: the clock only runs while the punch is
         FULLY landed, so easing back off the impact restarts the lifetime
         rather than letting a crack that's growing again fade out underneath
         the user. Phase 3 sets display:none, which (on top of the layer's
         pointer-events:none) guarantees it can never sit over the UI. */
      if (p >= 1) {
        if (fx.phase === 0) {
          fx.phase = 1;
          revive();
        } else if (fx.phase === 1 && fx.lifeT >= CRACK.life.hold) {
          fx.phase = 2;
          // Setting transition + target in the same frame is enough for the
          // browser to animate it (both are seen by one style recalculation).
          root.style.transition = `opacity ${CRACK.life.fade}ms linear`;
          root.style.opacity = "0";
        } else if (fx.phase === 2 && fx.lifeT >= CRACK.life.hold + CRACK.life.fade) {
          fx.phase = 3;
          root.style.display = "none";
        }
        if (fx.phase < 3) fx.lifeT += dt * 1000;
      } else if (fx.phase !== 0) {
        fx.phase = 0;
        revive(); // scrolled back off the impact — the glass is whole again
      }

      // ── Crack growth (scroll IS the timeline; reversal clears them) ──
      if (p !== fx.lastP || rm !== fx.lastRM) {
        fx.lastP = p;
        fx.lastRM = rm;
        svg.style.opacity = p === 0 ? "0" : String(0.35 + 0.65 * p);
        for (const { el, stagger } of paths) {
          const pr = rm
            ? p >= 1
              ? 1
              : 0 // reduced motion: static, no growth animation
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

      /* ── Shake (transform-only, a 300ms THUD) ──
         Harder peak than a plain decay would give, but the envelope is
         normalised to hit exactly 0 at CRACK.shake.dur — so it is a heavy hit
         that is genuinely OVER in 300ms, rather than a big amplitude quietly
         ringing on for a second.

         The crack's own transform ALSO carries translate(-50%,-50%), which is
         what centres it on the fist, so the shake has to be composed with it
         rather than replacing it — overwriting the transform here is what
         would knock the crack half a box off the impact point. */
      fx.shakeT += dt;
      const amp = rm ? 0 : CRACK.shake.amp * shakeEnv(fx.shakeT / CRACK.shake.dur);
      const live = amp > 0.02;
      if (live || fx.shakeX !== 0 || fx.shakeY !== 0) {
        fx.shakeX = live ? amp * Math.sin(fx.shakeT * CRACK.shake.fx) : 0;
        fx.shakeY = live ? amp * Math.cos(fx.shakeT * CRACK.shake.fy) * 0.7 : 0;
        place(fx.lastX, fx.lastY);
        const tr = live
          ? `translate3d(${fx.shakeX.toFixed(2)}px, ${fx.shakeY.toFixed(2)}px, 0)`
          : "";
        for (const el of shakeEls) el.style.transform = tr;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      for (const el of shakeEls) el.style.transform = "";
    };
  }, []);

  /* The paths are authored around (0,0) and the viewBox is centred on it, so
     the SVG needs no internal offset at all — the DOM element itself is what
     gets positioned. `dx` is only this layer's RGB mis-registration. */
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
        pointerEvents: "none", // NEVER blocks anything underneath
        overflow: "hidden",
      }}
    >
      {/* White impact flash. Re-centred on the fist by the frame loop; this
          is just the pre-first-frame placeholder. */}
      <div
        ref={flashRef}
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0,
          background:
            "radial-gradient(circle at 50% 40%, rgba(255,255,255,0.95) 0%," +
            " rgba(210,235,255,0.5) 22%, transparent 55%)",
          mixBlendMode: "screen",
        }}
      />
      {/* The crack is a FIXED-SIZE box pinned to the fist, not a full-screen
          layer. left/top are the projected pixel coordinates and
          translate(-50%,-50%) centres the box on them, so the impact point
          is the middle of the shatter at any viewport size. The viewBox is
          centred on (0,0) to match how the geometry is authored, and keeps
          its default preserveAspectRatio so the break stays round instead of
          being stretched to the screen's aspect. */}
      <svg
        ref={svgRef}
        viewBox="-50 -50 100 100"
        width={CRACK.size}
        height={CRACK.size}
        style={{
          position: "fixed",
          left: 0,
          top: 0,
          transform: "translate(-50%, -50%)",
          opacity: 0,
          overflow: "visible",
        }}
      >
        {/* misprint ghosts first (under), then the main white cracks */}
        {layer(CRACK.red, CRACK.ghostW, CRACK.ghostOff, "r", true)}
        {layer(CRACK.cyan, CRACK.ghostW, -CRACK.ghostOff, "c", true)}
        {layer(CRACK.stroke, CRACK.strokeW, 0, "w")}
      </svg>
    </div>
  );
}
