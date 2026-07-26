"use client";

/* ════════════════════════════════════════════════════════════
   SCROLL RIG — Lenis smooth scroll + the scroll→beat mapping.

   Renders nothing. Responsibilities:
   1. Instantiate Lenis (wheel-smoothing only; touch stays native so mobile
      scrolling is never hijacked) and drive it from GSAP's ticker so Lenis,
      ScrollTrigger and the R3F frame loop all share one clock.
   2. Measure a scroll "anchor" for every `[data-beat]` section — the scrollY
      at which that section's centre sits at the viewport's centre — and on
      every scroll convert scrollY into a continuous beat position
      (0 → N−1), written into the module-level `scrollState`. That store is
      what the 3D reads in useFrame; no React state is touched per frame.
   3. `prefers-reduced-motion`: skip Lenis entirely (native scrolling) and
      flag the store so the 3D snaps between beats instead of gliding.
   4. Small scroll-triggered reveals for any `[data-reveal]` content.
   ════════════════════════════════════════════════════════════ */

import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "@studio-freight/lenis";
import { scrollState } from "@/lib/scrollState";

gsap.registerPlugin(ScrollTrigger);

export default function ScrollRig() {
  useEffect(() => {
    /* ── reduced-motion: live flag ── */
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    scrollState.reducedMotion = mq.matches;
    const onMotionChange = (e: MediaQueryListEvent) => {
      scrollState.reducedMotion = e.matches;
    };
    mq.addEventListener("change", onMotionChange);

    /* ── beat anchors: scrollY at which each [data-beat] section is centred ── */
    let anchors: number[] = [0];
    const measure = () => {
      const sections = Array.from(
        document.querySelectorAll<HTMLElement>("[data-beat]")
      );
      scrollState.beatCount = Math.max(sections.length, 1);
      const scrollY = window.scrollY;
      const vh = window.innerHeight;
      const maxScroll = Math.max(
        document.documentElement.scrollHeight - vh,
        1
      );
      anchors = sections.map((el) => {
        const r = el.getBoundingClientRect();
        const centerY = r.top + scrollY + r.height / 2; // doc-space centre
        // scrollY that puts the section centre at the viewport centre,
        // clamped to what's actually reachable.
        return Math.min(Math.max(centerY - vh / 2, 0), maxScroll);
      });
      // Guarantee strictly increasing anchors (degenerate layouts) so the
      // segment lerp below never divides by zero.
      for (let i = 1; i < anchors.length; i++) {
        if (anchors[i] <= anchors[i - 1]) anchors[i] = anchors[i - 1] + 1;
      }
    };

    /* ── scrollY → scrollState (progress + continuous beatPos) ── */
    let lastY = window.scrollY;
    const writeState = (y: number) => {
      const maxScroll = Math.max(
        document.documentElement.scrollHeight - window.innerHeight,
        1
      );
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
        scrollState.beatPos = i + f;
      }
    };

    measure();
    writeState(window.scrollY);

    /* ── Lenis (full-motion path only) ── */
    let lenis: Lenis | null = null;
    let tickerFn: ((time: number) => void) | null = null;
    const onNativeScroll = () => writeState(window.scrollY);

    if (!mq.matches) {
      lenis = new Lenis({
        duration: 1.1, // glide length; raise for floatier, lower for snappier
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
        syncTouch: false, // touch stays native — never hijack mobile scroll
        wheelMultiplier: 1,
        touchMultiplier: 1.5,
      });
      lenis.on("scroll", (l: { scroll: number }) => {
        writeState(l.scroll);
        ScrollTrigger.update();
      });
      // One clock for everything: GSAP's ticker drives Lenis' raf.
      tickerFn = (time: number) => lenis?.raf(time * 1000);
      gsap.ticker.add(tickerFn);
      gsap.ticker.lagSmoothing(0);
    } else {
      // Reduced motion: plain native scroll feeds the same store.
      window.addEventListener("scroll", onNativeScroll, { passive: true });
    }

    /* ── re-measure anchors on layout changes ── */
    const onResize = () => {
      measure();
      writeState(window.scrollY);
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("load", onResize);
    // Fonts/images settling after hydration can shift section heights.
    const settleTimer = window.setTimeout(onResize, 600);

    /* ── content reveals: any [data-reveal] rises+fades in as it enters ── */
    const reveals: ScrollTrigger[] = [];
    if (!mq.matches) {
      document.querySelectorAll<HTMLElement>("[data-reveal]").forEach((el) => {
        const tween = gsap.fromTo(
          el,
          { opacity: 0, y: 36 },
          {
            opacity: 1,
            y: 0,
            duration: 0.8,
            ease: "power3.out",
            scrollTrigger: {
              trigger: el,
              start: "top 85%",
              toggleActions: "play none none reverse",
            },
          }
        );
        if (tween.scrollTrigger) reveals.push(tween.scrollTrigger);
      });
    }

    return () => {
      mq.removeEventListener("change", onMotionChange);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("load", onResize);
      window.removeEventListener("scroll", onNativeScroll);
      window.clearTimeout(settleTimer);
      if (tickerFn) gsap.ticker.remove(tickerFn);
      lenis?.destroy();
      reveals.forEach((st) => st.kill());
    };
  }, []);

  return null;
}
