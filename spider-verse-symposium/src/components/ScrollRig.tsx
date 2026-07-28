"use client";

/* ════════════════════════════════════════════════════════════
   SCROLL RIG — the scroll→beat mapping that drives Miguel.

   Renders nothing. Responsibilities:
   1. Resolve every BEATS entry's `selector` against the DOM and measure a
      scroll "anchor" for it — the scrollY at which that section's centre
      sits at the viewport's centre. Beats whose selector doesn't resolve
      are dropped from `activeBeats` rather than silently shifting the
      indices of every later beat.
   2. On every scroll, convert scrollY into a continuous beat position
      (0 → N−1) and write it into the module-level `scrollState`. That store
      is what the 3D reads in useFrame; no React state is touched per frame.
   3. `prefers-reduced-motion`: flag the store so the 3D snaps between beats
      instead of gliding.

   DELIBERATELY NOT USED HERE:
   • Lenis — this page scrolls natively and adding smooth-scroll would
     change the feel of every existing section, not just the 3D.
   • GSAP ScrollTrigger — HeroSection's cleanup calls
     `ScrollTrigger.getAll().forEach(st => st.kill())`, which would tear down
     any trigger this file created. A plain passive scroll listener is
     immune to that, and the beat damping in Spider3D already does the
     smoothing a scrub would have provided.
   ════════════════════════════════════════════════════════════ */

import { useEffect } from "react";
import { scrollState } from "@/lib/scrollState";
import {
  BEATS,
  activeBeats,
  forViewport,
  MOBILE_BREAKPOINT,
  type Beat,
} from "@/lib/beats";

export default function ScrollRig() {
  useEffect(() => {
    /* ── reduced-motion: live flag ── */
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    scrollState.reducedMotion = mq.matches;
    const onMotionChange = (e: MediaQueryListEvent) => {
      scrollState.reducedMotion = e.matches;
    };
    mq.addEventListener("change", onMotionChange);

    /* ── beat anchors: scrollY at which each beat's section is centred ── */
    let anchors: number[] = [0];

    /* Cached alongside the anchors, and for the same reason.
       writeState used to compute this per scroll event:
         document.documentElement.scrollHeight - window.innerHeight
       scrollHeight is a layout-triggering read, so every scroll event could
       force a synchronous reflow — on a page that has a full-screen WebGL
       canvas and DOM overlays being restyled every frame, that reflow is not
       cheap and it lands directly in the scroll path. The anchors were already
       measured once and reused; this value had simply been missed. */
    let maxScroll = 1;

    const measure = () => {
      const scrollY = window.scrollY;
      const vh = window.innerHeight;
      // Assigns the OUTER maxScroll (declared with the anchors), not a local:
      // writeState reads it on every scroll event and must not re-measure.
      maxScroll = Math.max(document.documentElement.scrollHeight - vh, 1);

      // Resolve selectors, keeping beat + element paired so a miss drops the
      // beat instead of renumbering the rest.
      const found: { beat: Beat; anchor: number }[] = [];
      const missing: string[] = [];
      for (const beat of BEATS) {
        const el = document.querySelector<HTMLElement>(beat.selector);
        if (!el) {
          missing.push(`${beat.id} ("${beat.selector}")`);
          continue;
        }
        const r = el.getBoundingClientRect();
        const centerY = r.top + scrollY + r.height / 2; // doc-space centre
        // scrollY that puts the section centre at the viewport centre,
        // clamped to what's actually reachable.
        found.push({
          beat,
          anchor: Math.min(Math.max(centerY - vh / 2, 0), maxScroll),
        });
      }

      if (missing.length) {
        console.warn(
          `[ScrollRig] beat section(s) not found, dropped: ${missing.join(", ")}`
        );
      }

      /* Phone or laptop? Resolved HERE, on every measure, so rotating the
         device or dragging a window across the breakpoint re-picks the beat
         set instead of keeping whichever one the page loaded at. */
      // `<`, matching FeaturedEventsSection's own check exactly — at 768px
      // the deck and the rig must not disagree about which layout is live.
      const isMobile = window.innerWidth < MOBILE_BREAKPOINT;

      // Nothing resolved (shouldn't happen) — keep the full list so the 3D
      // still renders at beat 0 rather than crashing on an empty array.
      if (!found.length) {
        activeBeats.list = forViewport(BEATS, isMobile);
        anchors = [0];
        scrollState.beatCount = 1;
        return;
      }

      activeBeats.list = forViewport(
        found.map((f) => f.beat),
        isMobile
      );
      anchors = found.map((f) => f.anchor);
      scrollState.beatCount = anchors.length;

      // Guarantee strictly increasing anchors so the segment lerp below can
      // never divide by zero. Sections near the page bottom all clamp to
      // maxScroll, which is exactly the degenerate case this handles.
      for (let i = 1; i < anchors.length; i++) {
        if (anchors[i] <= anchors[i - 1]) anchors[i] = anchors[i - 1] + 1;
      }
    };

    /* ── BEAT HOLD BAND ────────────────────────────────────────────────
       Fraction of each anchor-to-anchor gap where the beat HOLDS at its
       integer instead of interpolating: the first `HOLD` of the gap stays on
       beat i, the last `HOLD` is already on beat i+1, and the transition
       happens across the middle.

       Without this the mapping is a pure linear ramp, so a beat is only ever
       fully "on" at one exact scroll position. That is what put the hero
       character half-way into the arms-folded pose while the hero section
       was still the thing filling the screen — #hero anchors at scrollY 0
       and #events at 100vh, so scrolling 50vh (hero still on screen) already
       meant beatPos 0.5. Scrolling back up landed mid-ramp and he never
       returned to his opening stance.

       0.3 keeps the top ~30% of each gap on the pose the section was
       designed around, which is what makes each section read as having a
       pose rather than being a point you pass through. */
    const HOLD = 0.3;

    /* ── scrollY → scrollState (progress + continuous beatPos) ── */
    let lastY = window.scrollY;
    const writeState = (y: number) => {
      scrollState.progress = Math.min(Math.max(y / maxScroll, 0), 1);
      scrollState.velocity = y - lastY;
      lastY = y;

      const n = anchors.length;
      if (n <= 1) {
        scrollState.beatPos = 0;
        return;
      }
      if (y <= anchors[0]) {
        scrollState.beatPos = 0;
      } else if (y >= anchors[n - 1]) {
        scrollState.beatPos = n - 1;
      } else {
        let i = 0;
        while (i < n - 2 && y >= anchors[i + 1]) i++;
        const f = (y - anchors[i]) / (anchors[i + 1] - anchors[i]);
        // Squeeze the 0→1 travel into the middle of the gap, holding the beat
        // at each end (see HOLD). clamp keeps the ends exactly integral, which
        // is what lets "at the hero" mean armPose 0 and nothing blended in.
        const t = Math.min(Math.max((f - HOLD) / (1 - 2 * HOLD), 0), 1);
        scrollState.beatPos = i + t;
      }
    };

    measure();
    writeState(window.scrollY);

    const onScroll = () => writeState(window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });

    /* ── re-measure on layout changes ──
       This page starts locked at 100vh behind the portal overlay and only
       grows to its full height once the user enters, so the very first
       measurement is guaranteed to be wrong. A ResizeObserver on the
       document element catches that reveal (and any later reflow) without
       needing to know anything about the portal's state machine. */
    const onResize = () => {
      measure();
      writeState(window.scrollY);
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("load", onResize);

    const ro = new ResizeObserver(onResize);
    ro.observe(document.documentElement);

    // Fonts, images and the events carousel settling after hydration can
    // still shift section heights after the observer's first callback.
    const settleTimers = [
      window.setTimeout(onResize, 300),
      window.setTimeout(onResize, 1200),
    ];

    return () => {
      mq.removeEventListener("change", onMotionChange);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("load", onResize);
      ro.disconnect();
      settleTimers.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  return null;
}
