"use client";

import { useEffect, useRef, useCallback } from "react";
import Image, { type StaticImageData } from "next/image";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import HeroSpiders from "./HeroSpiders";
import licetLogo from "../../images/Logo/licet-logo-transparent.png";
import deptLogo from "../../images/Logo/dept-logo-transparent.png";

gsap.registerPlugin(ScrollTrigger);

/* ── INSTITUTION MARKS ───────────────────────────────────────────────────
   Both sources were flat white-background exports (the department mark a
   JPEG, so no alpha at all; LICET a non-alpha PNG). tools/make-logo-
   transparent.js floods the white out from each edge inward, so only
   background actually connected to the border goes transparent — leaving
   any white *inside* the artwork (crest highlights, etc.) intact — and
   feathers the anti-aliased rim so the cutout isn't a hard jagged edge.
   Re-run that script if either logo is ever replaced.

   With real transparency there's no plate needed: the marks sit directly
   on the hero.

   Sized by HEIGHT with width:auto because the two marks have very different
   aspect ratios (LICET is 176x148, near-square; EICON is portrait). Matching
   their heights is what makes them read as a pair. Both are set with clamp()
   so they shrink with the viewport instead of crowding the nav links. */
function LogoMark({
  src,
  alt,
  height,
}: {
  src: StaticImageData;
  alt: string;
  height: string;
}) {
  return (
    <Image
      src={src}
      alt={alt}
      priority
      // Both dimensions touched (one explicit, one auto) — Next warns if
      // CSS changes only one of them.
      style={{ height, width: "auto" }}
      sizes="140px"
    />
  );
}

/* A title layer, rendered as two halves clipped down the middle. Each half
   holds the full wordmark and is clipped visually, so when both land at x=0
   they reassemble into one seamless piece of type. Negative insets keep the
   glow/stroke from being cut off vertically. */
const HALF_CLIP = {
  left: "inset(-40% 50% -40% -40%)",
  right: "inset(-40% -40% -40% 50%)",
} as const;

export default function HeroSection({ start = true }: { start?: boolean }) {
  const sectionRef = useRef<HTMLElement>(null);
  const imageWrapRef = useRef<HTMLDivElement>(null);
  const ambientOrbRef = useRef<HTMLDivElement>(null);
  const sweepRef = useRef<HTMLDivElement>(null);
  const webLeftRef = useRef<SVGSVGElement>(null);
  const webRightRef = useRef<SVGSVGElement>(null);
  const titleSolidWrapRef = useRef<HTMLDivElement>(null);
  // Every title layer is rendered as two clipped halves so the wordmark can
  // fly together from opposite sides. Collected as arrays so one tween drives
  // all the left pieces and another all the right ones.
  const leftHalves = useRef<(HTMLDivElement | null)[]>([]);
  const rightHalves = useRef<(HTMLDivElement | null)[]>([]);
  const entranceRef = useRef<gsap.core.Timeline | null>(null);
  const titleStrokeWrapRef = useRef<HTMLDivElement>(null);
  const taglineCtaRef = useRef<HTMLDivElement>(null);
  const chromRedRef = useRef<HTMLDivElement>(null);
  const chromCyanRef = useRef<HTMLDivElement>(null);
  const bottomCardsRef = useRef<HTMLDivElement>(null);
  const cornerTopRef = useRef<HTMLDivElement>(null);
  const cornerBottomRef = useRef<HTMLDivElement>(null);
  const particleRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Track whether reduced-motion is preferred
  const prefersReducedMotion = useRef(false);

  const particles = [
    { left: "10%", top: "22%", size: 6, opacity: 0.45, driftX: 14, driftY: -18, delay: 0 },
    { left: "22%", top: "68%", size: 4, opacity: 0.35, driftX: -18, driftY: -14, delay: 0.3 },
    { left: "34%", top: "16%", size: 5, opacity: 0.4, driftX: 18, driftY: 16, delay: 0.6 },
    { left: "49%", top: "12%", size: 7, opacity: 0.28, driftX: -10, driftY: 22, delay: 0.9 },
    { left: "61%", top: "24%", size: 4, opacity: 0.36, driftX: 20, driftY: -12, delay: 0.2 },
    { left: "73%", top: "58%", size: 6, opacity: 0.33, driftX: -16, driftY: 18, delay: 0.5 },
    { left: "84%", top: "18%", size: 4, opacity: 0.42, driftX: 12, driftY: 24, delay: 0.8 },
    { left: "90%", top: "72%", size: 5, opacity: 0.3, driftX: -14, driftY: -20, delay: 1.1 },
  ];

  // gsap.quickTo setters for smooth parallax — initialized in useEffect
  const parallaxSetters = useRef<{
    titleSolidX: gsap.QuickToFunc | null;
    titleSolidY: gsap.QuickToFunc | null;
    titleStrokeX: gsap.QuickToFunc | null;
    titleStrokeY: gsap.QuickToFunc | null;
    webLX: gsap.QuickToFunc | null;
    webLY: gsap.QuickToFunc | null;
    webRX: gsap.QuickToFunc | null;
    webRY: gsap.QuickToFunc | null;
  }>({
    titleSolidX: null, titleSolidY: null,
    titleStrokeX: null, titleStrokeY: null,
    webLX: null, webLY: null,
    webRX: null, webRY: null,
  });

  // ──────────────────────────────────────────────
  //  MULTI-LAYER PARALLAX (mouse-move via gsap.quickTo)
  // ──────────────────────────────────────────────
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (prefersReducedMotion.current) return;
    if (!sectionRef.current) return;

    const rect = sectionRef.current.getBoundingClientRect();
    const nx = (e.clientX - rect.left - rect.width / 2) / (rect.width / 2);
    const ny = (e.clientY - rect.top - rect.height / 2) / (rect.height / 2);

    const s = parallaxSetters.current;

    // Title containers — opposite direction, smaller (±4px)
    s.titleSolidX?.(nx * 4);
    s.titleSolidY?.(ny * 3);
    s.titleStrokeX?.(nx * 4);
    s.titleStrokeY?.(ny * 3);

    // Web-line SVGs — smallest travel (±3px)
    s.webLX?.(nx * -3);
    s.webLY?.(ny * -2);
    s.webRX?.(nx * 3);
    s.webRY?.(ny * -2);
  }, []);

  useEffect(() => {
    // ──────────────────────────────────────────────
    //  REDUCED MOTION CHECK
    // ──────────────────────────────────────────────
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    prefersReducedMotion.current = mq.matches;

    const onMotionChange = (e: MediaQueryListEvent) => {
      prefersReducedMotion.current = e.matches;
    };
    mq.addEventListener("change", onMotionChange);

    // ──────────────────────────────────────────────
    //  MOUSE-MOVE LISTENER + quickTo INITIALIZATION
    // ──────────────────────────────────────────────
    const isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    if (!isTouch && !prefersReducedMotion.current) {
      const dur = 0.6;
      const ease = "power3.out";

      if (titleSolidWrapRef.current) {
        parallaxSetters.current.titleSolidX = gsap.quickTo(titleSolidWrapRef.current, "x", { duration: dur, ease });
        parallaxSetters.current.titleSolidY = gsap.quickTo(titleSolidWrapRef.current, "y", { duration: dur, ease });
      }
      if (titleStrokeWrapRef.current) {
        parallaxSetters.current.titleStrokeX = gsap.quickTo(titleStrokeWrapRef.current, "x", { duration: dur, ease });
        parallaxSetters.current.titleStrokeY = gsap.quickTo(titleStrokeWrapRef.current, "y", { duration: dur, ease });
      }
        if (ambientOrbRef.current) {
          gsap.quickTo(ambientOrbRef.current, "x", { duration: dur, ease });
          gsap.quickTo(ambientOrbRef.current, "y", { duration: dur, ease });
        }
      if (webLeftRef.current) {
        parallaxSetters.current.webLX = gsap.quickTo(webLeftRef.current, "x", { duration: dur, ease });
        parallaxSetters.current.webLY = gsap.quickTo(webLeftRef.current, "y", { duration: dur, ease });
      }
      if (webRightRef.current) {
        parallaxSetters.current.webRX = gsap.quickTo(webRightRef.current, "x", { duration: dur, ease });
        parallaxSetters.current.webRY = gsap.quickTo(webRightRef.current, "y", { duration: dur, ease });
      }

      window.addEventListener("mousemove", handleMouseMove);
    }

    // ──────────────────────────────────────────────
    //  REFERENCES FOR GSAP
    // ──────────────────────────────────────────────
    const section = sectionRef.current;
    const webL = webLeftRef.current;
    const webR = webRightRef.current;
    const titleSolid = titleSolidWrapRef.current;
    const titleStroke = titleStrokeWrapRef.current;
    const taglineCta = taglineCtaRef.current;
    const chromRed = chromRedRef.current;
    const chromCyan = chromCyanRef.current;
    const character = imageWrapRef.current;
    const bottomCards = bottomCardsRef.current;
    const cornerTop = cornerTopRef.current;
    const cornerBot = cornerBottomRef.current;

    // Collect all SVG lines/paths inside both web SVGs for stroke-dashoffset entrance
    const webLLines: SVGGeometryElement[] = webL
      ? Array.from(webL.querySelectorAll("line, path"))
      : [];
    const webRLines: SVGGeometryElement[] = webR
      ? Array.from(webR.querySelectorAll("line, path"))
      : [];

    // Compute and set stroke-dasharray to total length so dashoffset can reveal
    const prepareStroke = (el: SVGGeometryElement) => {
      try {
        const len = el.getTotalLength();
        el.style.strokeDasharray = `${len}`;
        el.style.strokeDashoffset = `${len}`;
      } catch {
        // Some paths might fail getTotalLength — safe to ignore
      }
    };

    // ──────────────────────────────────────────────
    //  1. ENTRANCE TIMELINE
    // ──────────────────────────────────────────────
    if (prefersReducedMotion.current) {
      // REDUCED MOTION — simple fade-in, no movement
      const simpleFade = gsap.timeline();

      // Make everything visible in place
      [webL, webR].forEach((svg) => {
        if (svg) gsap.set(svg, { opacity: 0 });
      });
      if (titleSolid) gsap.set(titleSolid, { opacity: 0 });
      if (titleStroke) gsap.set(titleStroke, { opacity: 0 });
      if (character) gsap.set(character, { opacity: 0 });
      if (bottomCards) gsap.set(bottomCards, { opacity: 0 });
      if (cornerTop) gsap.set(cornerTop, { opacity: 0 });
      if (cornerBot) gsap.set(cornerBot, { opacity: 0 });
      if (taglineCta) gsap.set(taglineCta, { opacity: 0 });

      simpleFade
        .to([webL, webR, titleSolid, titleStroke, character].filter(Boolean), {
          opacity: (i, target) => {
            // Character keeps its original 0.88 opacity
            if (target === character) return 0.88;
            if (target === webL) return 0.4;
            if (target === webR) return 0.35;
            return 1;
          },
          duration: 0.8,
          ease: "power1.out",
        })
        .to(
          [taglineCta, bottomCards, cornerTop, cornerBot].filter(Boolean),
          { opacity: (i, target) => (target === bottomCards ? 1 : target === taglineCta ? 1 : 0.5), duration: 0.6 },
          "-=0.4"
        );

      return () => {
        simpleFade.kill();
        window.removeEventListener("mousemove", handleMouseMove);
        mq.removeEventListener("change", onMotionChange);
      };
    }

    // ── FULL MOTION PATH ──

    // Prep: hide elements for entrance
    if (webL) gsap.set(webL, { opacity: 0 });
    if (webR) gsap.set(webR, { opacity: 0 });
    webLLines.forEach(prepareStroke);
    webRLines.forEach(prepareStroke);
    // Layer wrappers just fade; the split halves carry the movement.
    if (titleSolid) gsap.set(titleSolid, { opacity: 0 });
    if (titleStroke) gsap.set(titleStroke, { opacity: 0 });
    if (chromRed) gsap.set(chromRed, { opacity: 0 });
    if (chromCyan) gsap.set(chromCyan, { opacity: 0 });
    if (taglineCta) gsap.set(taglineCta, { opacity: 0, y: 18 });

    // Halves start off-screen on their own side, so the wordmark arrives as
    // two pieces converging rather than one block sliding.
    const lefts = leftHalves.current.filter(Boolean) as HTMLDivElement[];
    const rights = rightHalves.current.filter(Boolean) as HTMLDivElement[];
    const travel = Math.max(window.innerWidth * 0.55, 520);
    if (lefts.length) gsap.set(lefts, { x: -travel });
    if (rights.length) gsap.set(rights, { x: travel });

    // Character enters on a real 3D push: rotated off-axis and set back in Z
    // behind the title, then swinging square to camera as it comes forward.
    if (character)
      gsap.set(character, {
        xPercent: -50,
        opacity: 0,
        transformPerspective: 1100,
        transformOrigin: "50% 65%",
        z: -520,
        rotationY: 16,
        rotationX: 5,
        scale: 1.14,
        y: 40,
      });
    if (ambientOrbRef.current) gsap.set(ambientOrbRef.current, { opacity: 0, scale: 0.7 });
    if (sweepRef.current) gsap.set(sweepRef.current, { opacity: 0, x: -220, rotate: -14 });
    particleRefs.current.forEach((particle) => {
      if (particle) gsap.set(particle, { opacity: 0, scale: 0 });
    });
    if (bottomCards) gsap.set(bottomCards, { opacity: 0, y: 20 });
    if (cornerTop) gsap.set(cornerTop, { opacity: 0, y: -15 });
    if (cornerBot) gsap.set(cornerBot, { opacity: 0, y: 15 });

    // Built paused: the pre-state above is applied immediately so nothing
    // flashes un-animated while the splash is still covering the screen, but
    // the sequence itself only plays once `start` flips true.
    const entrance = gsap.timeline({ paused: true, delay: 0.1 });
    entranceRef.current = entrance;

    // Step 1: Web SVGs — fade in + stroke-dashoffset draw (~0.8s)
    entrance.to(webL, { opacity: 0.4, duration: 0.3, ease: "power2.out" }, 0);
    entrance.to(webR, { opacity: 0.35, duration: 0.3, ease: "power2.out" }, 0.15);
    if (webLLines.length) {
      entrance.to(webLLines, {
        strokeDashoffset: 0,
        duration: 0.8,
        ease: "power3.out",
        stagger: 0.02,
      }, 0);
    }
    if (webRLines.length) {
      entrance.to(webRLines, {
        strokeDashoffset: 0,
        duration: 0.8,
        ease: "power3.out",
        stagger: 0.02,
      }, 0.1);
    }

    // Step 2: Title — layers become visible, then the halves fly together.
    entrance.to(
      [titleSolid, titleStroke].filter(Boolean),
      { opacity: 1, duration: 0.25, ease: "none" },
      0.3
    );
    if (lefts.length) {
      entrance.to(
        lefts,
        { x: 0, duration: 1.15, ease: "power4.out" },
        0.3
      );
    }
    if (rights.length) {
      entrance.to(
        rights,
        { x: 0, duration: 1.15, ease: "power4.out" },
        0.3
      );
    }

    // Step 2b: Chromatic layers — fade in after title starts
    entrance.to(
      [chromRed, chromCyan].filter(Boolean),
      { opacity: 0.35, duration: 0.6, ease: "power2.out" },
      0.6
    );

    // Step 3: Character — translateY from +40 to 0 while fading in (starts at t=0.55)
    entrance.to(character, {
      opacity: 0.88,
      z: 0,
      rotationY: 0,
      rotationX: 0,
      scale: 1,
      y: 0,
      duration: 1.5,
      ease: "power3.out",
    }, 0.55);

    if (ambientOrbRef.current) {
      entrance.to(ambientOrbRef.current, {
        opacity: 1,
        scale: 1,
        duration: 1,
        ease: "power2.out",
      }, 0.2);
    }

    if (sweepRef.current) {
      entrance.to(sweepRef.current, {
        opacity: 1,
        x: 220,
        duration: 1.8,
        ease: "power3.out",
      }, 0.75);
    }

    particleRefs.current.forEach((particle, index) => {
      if (!particle) return;
      entrance.to(particle, {
        opacity: particles[index].opacity,
        scale: 1,
        duration: 0.5,
        ease: "power2.out",
      }, 0.55 + index * 0.04);
    });

    // Step 3b: Tagline + CTA — settles just under the title
    if (taglineCta) {
      entrance.to(
        taglineCta,
        { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" },
        0.85
      );
    }

    // Step 4: Bottom info cards + corner lines — fade/slide in last, staggered
    entrance.to(
      bottomCards,
      { opacity: 1, y: 0, duration: 0.5, ease: "power3.out" },
      1.1
    );
    entrance.to(
      cornerTop,
      { opacity: 0.5, y: 0, duration: 0.4, ease: "power3.out" },
      1.25
    );
    entrance.to(
      cornerBot,
      { opacity: 0.5, y: 0, duration: 0.4, ease: "power3.out" },
      1.4
    );

    // ──────────────────────────────────────────────
    //  2. CHROMATIC ABERRATION BREATHING (infinite loop)
    // ──────────────────────────────────────────────
    const chromBreathing = gsap.timeline({ repeat: -1, yoyo: true });
    if (chromRed) {
      chromBreathing.fromTo(chromRed, { x: -1.5 }, { x: -3, duration: 2.2, ease: "sine.inOut" }, 0);
    }
    if (chromCyan) {
      chromBreathing.fromTo(chromCyan, { x: 1.5 }, { x: 3, duration: 2.2, ease: "sine.inOut" }, 0);
    }

    const titleFloat = gsap.timeline({ repeat: -1, yoyo: true, defaults: { ease: "sine.inOut" } });
    if (titleSolid) {
      titleFloat.to(titleSolid, { y: -10, duration: 2.6 }, 0);
    }
    if (titleStroke) {
      titleFloat.to(titleStroke, { y: -10, duration: 2.6 }, 0);
    }

    const characterFloat = gsap.to(imageWrapRef.current, {
      y: -16,
      scale: 1.03,
      duration: 3.2,
      ease: "sine.inOut",
      repeat: -1,
      yoyo: true,
      delay: 1.8,
    });

    const orbFloat = gsap.to(ambientOrbRef.current, {
      x: 28,
      y: -18,
      scale: 1.08,
      duration: 4.2,
      ease: "sine.inOut",
      repeat: -1,
      yoyo: true,
    });

    const sweepLoop = gsap.to(sweepRef.current, {
      x: 260,
      opacity: 0.35,
      duration: 5.5,
      ease: "sine.inOut",
      repeat: -1,
      yoyo: true,
    });

    const particleLoops = particleRefs.current
      .map((particle, index) => {
        if (!particle) return null;
        const particleData = particles[index];
        return gsap.to(particle, {
          x: particleData.driftX,
          y: particleData.driftY,
          duration: 3.5 + index * 0.35,
          ease: "sine.inOut",
          repeat: -1,
          yoyo: true,
          delay: particleData.delay,
        });
      })
      .filter(Boolean) as gsap.core.Tween[];

    // ──────────────────────────────────────────────
    //  4. IDLE AMBIENT MOTION — slow vertical bob
    // ──────────────────────────────────────────────
    // ──────────────────────────────────────────────
    //  5. SCROLL-TRIGGERED EXIT
    // ──────────────────────────────────────────────
    const exitTl = gsap.timeline({
      scrollTrigger: {
        trigger: section,
        start: "bottom 90%",
        end: "bottom 10%",
        scrub: true,
      },
    });

    // Title & character fade + scale down
    exitTl
      .to(
        [titleSolid, titleStroke].filter(Boolean),
        { opacity: 0, scale: 0.96, duration: 1, ease: "none" },
        0
      )
      .to(
        character,
        { opacity: 0, scale: 0.97, duration: 1, ease: "none" },
        0
      )
      // Intensify web-line pulse (boost opacity of the energy pulse <g> elements)
      .to(
        webL,
        { opacity: 0.8, duration: 0.4, ease: "none" },
        0
      )
      .to(
        webR,
        { opacity: 0.7, duration: 0.4, ease: "none" },
        0
      )
      // Then fade entire hero out
      .to(
        section,
        { opacity: 0, duration: 0.6, ease: "none" },
        0.5
      );

    // ──────────────────────────────────────────────
    //  CLEANUP
    // ──────────────────────────────────────────────
    return () => {
      entrance.kill();
      chromBreathing.kill();
      titleFloat.kill();
      characterFloat.kill();
      orbFloat.kill();
      sweepLoop.kill();
      particleLoops.forEach((loop) => loop.kill());
      exitTl.kill();
      ScrollTrigger.getAll().forEach((st) => st.kill());
      window.removeEventListener("mousemove", handleMouseMove);
      mq.removeEventListener("change", onMotionChange);
    };
  }, [handleMouseMove]);

  /* ──────────────────────────────────────────────
     Hold the entrance until the splash hands over.
     The timeline is built paused, so the hero sits
     in its pre-state behind the splash and only
     animates once the reveal is done.
     ────────────────────────────────────────────── */
  useEffect(() => {
    if (start) entranceRef.current?.play();
  }, [start]);

  // ── Shared title text styles ──
  const titleFontStyle: React.CSSProperties = {
    fontFamily: "var(--font-title)",
    fontSize: "clamp(3.2rem, 16vw, 18rem)",
    lineHeight: 1,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    whiteSpace: "nowrap",
    userSelect: "none",
    margin: 0,
    padding: 0,
  };

  const titleWrapStyle: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: "none",
    willChange: "transform, opacity",
  };

  // Each half fills its layer and centres the same full wordmark; the clip is
  // what makes it a half, so both pieces stay in perfect register at rest.
  const titleHalfStyle: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    willChange: "transform, opacity",
  };

  return (
    <>
      {/* ── Site-wide red border frame ── */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          border: "5px solid #E23636",
          pointerEvents: "none",
          zIndex: 9999,
        }}
      />

      <section
        ref={sectionRef}
        id="hero"
                style={{
          position: "relative",
          width: "100%",
          height: "100vh",
          minHeight: 600,
          overflow: "hidden",
          background: "#0A0A0A",
        }}
      >
        <div
          ref={ambientOrbRef}
          className="hero-ambient-orb"
          style={{
            position: "absolute",
            top: "18%",
            left: "50%",
            width: "42vw",
            height: "42vw",
            maxWidth: 760,
            maxHeight: 760,
            transform: "translate(-50%, -50%)",
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(0,229,255,0.18) 0%, rgba(226,54,54,0.12) 35%, rgba(10,10,10,0) 70%)",
            filter: "blur(40px)",
            zIndex: 1,
            pointerEvents: "none",
            mixBlendMode: "screen",
            opacity: 0,
          }}
        />

        {/* ── Background video layer ── */}
        <video
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden="true"
          tabIndex={-1}
          className="hero-video-motion"
          src="/360p-watermark.mp4"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center center",
            opacity: 0.30,
            filter: "grayscale(0.15) brightness(0.78) contrast(1.08) saturate(0.9)",
            zIndex: 1,
            pointerEvents: "none",
            mixBlendMode: "normal",
          }}
        />

        {/* ── Animated sweep light ── */}
        <div
          ref={sweepRef}
                    style={{
            position: "absolute",
            top: "8%",
            left: "-20%",
            width: "35vw",
            height: "84vh",
            background:
              "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.05) 46%, rgba(0,229,255,0.08) 50%, rgba(255,255,255,0.04) 54%, transparent 100%)",
            filter: "blur(18px)",
            zIndex: 4,
            pointerEvents: "none",
            opacity: 0,
            mixBlendMode: "screen",
          }}
        />

        {/* ── Floating particles ── */}
        {particles.map((particle, index) => (
          <div
            key={index}
            ref={(node) => {
              particleRefs.current[index] = node;
            }}
                        style={{
              position: "absolute",
              left: particle.left,
              top: particle.top,
              width: particle.size,
              height: particle.size,
              borderRadius: "50%",
              background: index % 2 === 0 ? "rgba(0,229,255,0.85)" : "rgba(226,54,54,0.9)",
              boxShadow: index % 2 === 0
                ? "0 0 18px rgba(0,229,255,0.5)"
                : "0 0 18px rgba(226,54,54,0.45)",
              zIndex: 6,
              pointerEvents: "none",
              opacity: 0,
            }}
          />
        ))}

        {/* ── Web pattern SVG — LEFT ── */}
        <svg
          ref={webLeftRef}
                    style={{
            position: "absolute",
            top: 0,
            left: 0,
            height: "100%",
            width: 480,
            opacity: 0.4,
            zIndex: 2,
            pointerEvents: "none",
            willChange: "transform, opacity",
          }}
          viewBox="0 0 400 900"
          preserveAspectRatio="none"
        >
          {/* Base Web Structure */}
          <g stroke="#F2EFE9" strokeWidth="0.8" opacity="0.4" fill="none">
            <line x1="0" y1="0" x2="380" y2="450" />
            <line x1="0" y1="0" x2="280" y2="560" />
            <line x1="0" y1="0" x2="140" y2="680" />
            <line x1="0" y1="0" x2="60" y2="800" />
            <line x1="0" y1="0" x2="400" y2="330" />
            <line x1="0" y1="0" x2="300" y2="220" />
            <line x1="0" y1="0" x2="180" y2="170" />
            <line x1="0" y1="0" x2="400" y2="560" />
            <line x1="0" y1="0" x2="0" y2="900" />
            <line x1="0" y1="0" x2="400" y2="120" />
            <path d="M 35,85 Q 60,55 85,35" />
            <path d="M 60,170 Q 115,115 170,60" />
            <path d="M 85,260 Q 175,175 260,80" />
            <path d="M 110,350 Q 230,230 350,110" />
            <path d="M 40,460 Q 210,300 390,175" />
            <path d="M 25,570 Q 175,410 345,270" />
            <path d="M 20,680 Q 145,510 320,375" />
            <path d="M 15,790 Q 120,615 285,465" />
          </g>

          {/* Animated Red Energy Pulses */}
          <g
            stroke="#E23636"
            strokeWidth="1.8"
            fill="none"
            strokeLinecap="round"
            style={{
              strokeDasharray: "70 200",
              animation: "webPulseRed 3.5s linear infinite",
            }}
          >
            <line x1="0" y1="0" x2="380" y2="450" />
            <line x1="0" y1="0" x2="280" y2="560" />
            <line x1="0" y1="0" x2="400" y2="330" />
            <line x1="0" y1="0" x2="180" y2="170" />
            <line x1="0" y1="0" x2="400" y2="560" />
            <path d="M 60,170 Q 115,115 170,60" />
            <path d="M 110,350 Q 230,230 350,110" />
            <path d="M 25,570 Q 175,410 345,270" />
          </g>

          {/* Animated Cyan Glitch Energy Pulses */}
          <g
            stroke="#00E5FF"
            strokeWidth="1.2"
            fill="none"
            strokeLinecap="round"
            style={{
              strokeDasharray: "40 240",
              animation: "webPulseCyan 4.5s 1.5s linear infinite",
            }}
          >
            <line x1="0" y1="0" x2="140" y2="680" />
            <line x1="0" y1="0" x2="300" y2="220" />
            <line x1="0" y1="0" x2="400" y2="120" />
            <path d="M 85,260 Q 175,175 260,80" />
            <path d="M 40,460 Q 210,300 390,175" />
            <path d="M 20,680 Q 145,510 320,375" />
          </g>
        </svg>

        {/* ── Mirrored Right Corner Energy Web ── */}
        <svg
          ref={webRightRef}
                    style={{
            position: "absolute",
            top: 0,
            right: 0,
            height: "100%",
            width: 320,
            opacity: 0.35,
            zIndex: 2,
            pointerEvents: "none",
            transform: "scaleX(-1)",
            willChange: "transform, opacity",
          }}
          viewBox="0 0 400 900"
          preserveAspectRatio="none"
        >
          <g stroke="#F2EFE9" strokeWidth="0.7" opacity="0.3" fill="none">
            <line x1="0" y1="0" x2="380" y2="450" />
            <line x1="0" y1="0" x2="280" y2="560" />
            <line x1="0" y1="0" x2="140" y2="680" />
            <line x1="0" y1="0" x2="400" y2="330" />
            <path d="M 85,260 Q 175,175 260,80" />
            <path d="M 110,350 Q 230,230 350,110" />
          </g>
          <g
            stroke="#E23636"
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
            style={{
              strokeDasharray: "50 220",
              animation: "webPulseRed 4s 0.8s linear infinite",
            }}
          >
            <line x1="0" y1="0" x2="380" y2="450" />
            <line x1="0" y1="0" x2="400" y2="330" />
            <path d="M 110,350 Q 230,230 350,110" />
          </g>
        </svg>

        {/* ── Halftone dot texture ── */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 3,
            pointerEvents: "none",
            backgroundImage:
              "radial-gradient(circle, rgba(242,239,233,0.06) 1px, transparent 1px)",
            backgroundSize: "8px 8px",
          }}
        />

        {/* ── CHROMATIC RED LAYER (behind solid title) ── */}
        <div
          ref={chromRedRef}
          style={{
            ...titleWrapStyle,
            zIndex: 7,
          }}
        >
          <div
            ref={(n) => { leftHalves.current[0] = n; }}
            style={{ ...titleHalfStyle, clipPath: HALF_CLIP.left }}
          >
            <h1 style={{ ...titleFontStyle,
                color: "#E23636",
                transform: "translateX(-1.5px)", }} aria-hidden="true">
              XPLORE&apos;26
            </h1>
          </div>
          <div
            ref={(n) => { rightHalves.current[0] = n; }}
            style={{ ...titleHalfStyle, clipPath: HALF_CLIP.right }}
          >
            <h1 style={{ ...titleFontStyle,
                color: "#E23636",
                transform: "translateX(-1.5px)", }} aria-hidden="true">
              XPLORE&apos;26
            </h1>
          </div>
        </div>

        {/* ── CHROMATIC CYAN LAYER (behind solid title) ── */}
        <div
          ref={chromCyanRef}
          style={{
            ...titleWrapStyle,
            zIndex: 7,
          }}
        >
          <div
            ref={(n) => { leftHalves.current[1] = n; }}
            style={{ ...titleHalfStyle, clipPath: HALF_CLIP.left }}
          >
            <h1 style={{ ...titleFontStyle,
                color: "#00E5FF",
                transform: "translateX(1.5px)", }} aria-hidden="true">
              XPLORE&apos;26
            </h1>
          </div>
          <div
            ref={(n) => { rightHalves.current[1] = n; }}
            style={{ ...titleHalfStyle, clipPath: HALF_CLIP.right }}
          >
            <h1 style={{ ...titleFontStyle,
                color: "#00E5FF",
                transform: "translateX(1.5px)", }} aria-hidden="true">
              XPLORE&apos;26
            </h1>
          </div>
        </div>

        {/* ── Title text — z-index 8, BEHIND character (solid fill) ── */}
        <div
          ref={titleSolidWrapRef}
          style={{
            ...titleWrapStyle,
            zIndex: 8,
          }}
        >
          <div
            ref={(n) => { leftHalves.current[2] = n; }}
            style={{ ...titleHalfStyle, clipPath: HALF_CLIP.left }}
          >
            <h1 className="hero-title-solid" style={{ ...titleFontStyle,
                color: "#F2EFE9",
                textShadow:
                  "0 4px 40px rgba(0,0,0,0.8), 0 2px 8px rgba(0,0,0,0.9), 0 0 90px rgba(226,54,54,0.3)", }}>
              XPLORE&apos;26
            </h1>
          </div>
          <div
            ref={(n) => { rightHalves.current[2] = n; }}
            style={{ ...titleHalfStyle, clipPath: HALF_CLIP.right }}
          >
            <h1 className="hero-title-solid" style={{ ...titleFontStyle,
                color: "#F2EFE9",
                textShadow:
                  "0 4px 40px rgba(0,0,0,0.8), 0 2px 8px rgba(0,0,0,0.9), 0 0 90px rgba(226,54,54,0.3)", }} aria-hidden="true">
              XPLORE&apos;26
            </h1>
          </div>
        </div>

        {/* ── Character slot — z-index 15, ABOVE title ──
            The flat spiderman-hero.webp that used to live here has been
            replaced by the rigged Miguel O'Hara model. He is NOT rendered
            inside this section: he lives in one persistent fixed canvas
            (see MiguelStage) that every section scrolls past, so he can
            travel from here into the events deck and on to the punch
            without remounting — and so this section's `overflow: hidden`
            never clips him.

            The wrapper below is intentionally kept and left empty. The
            entrance / float / scroll-exit timelines above still target
            `imageWrapRef`, and gutting it would mean rewriting three
            unrelated GSAP timelines. The canvas sits at this exact z15
            slot instead, so the title sandwich (solid z8 behind, outline
            z16 in front) reads exactly as it did with the PNG. ── */}
        <div
          ref={imageWrapRef}
          style={{
            position: "absolute",
            bottom: 0,
            left: "50%",
            transform: "translateX(-50%)",
            width: "min(1400px, 125vw)",
            height: "130vh",
            zIndex: 15,
            opacity: 0.88,
            willChange: "transform, opacity",
            pointerEvents: "none",
          }}
        />

        {/* ── Title text — z-index 16, ABOVE character (outlined/stroke only) ── */}
        <div
          ref={titleStrokeWrapRef}
          style={{
            ...titleWrapStyle,
            zIndex: 16,
          }}
        >
          <div
            ref={(n) => { leftHalves.current[3] = n; }}
            style={{ ...titleHalfStyle, clipPath: HALF_CLIP.left }}
          >
            <h1 className="hero-title-stroke" style={{ ...titleFontStyle,
                color: "transparent",
                WebkitTextStroke: "3px #F2EFE9",
                textShadow: "0 0 50px rgba(0,229,255,0.35)", }} aria-hidden="true">
              XPLORE&apos;26
            </h1>
          </div>
          <div
            ref={(n) => { rightHalves.current[3] = n; }}
            style={{ ...titleHalfStyle, clipPath: HALF_CLIP.right }}
          >
            <h1 className="hero-title-stroke" style={{ ...titleFontStyle,
                color: "transparent",
                WebkitTextStroke: "3px #F2EFE9",
                textShadow: "0 0 50px rgba(0,229,255,0.35)", }} aria-hidden="true">
              XPLORE&apos;26
            </h1>
          </div>
        </div>

        {/* ── Live spiders: drop in on silk, dangle, climb back out ── */}
        <HeroSpiders active={start} />

        {/* ── Vignette overlay ── */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 20,
            pointerEvents: "none",
            background:
              "radial-gradient(ellipse at center, transparent 30%, rgba(10,10,10,0.6) 100%)",
          }}
        />

        {/* ── Top nav ── */}
        <nav
                    style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            // Horizontal padding shrinks with the viewport: the bar now
            // carries two logo marks as well as the links, so a fixed 40px
            // gutter is what would push them into each other on a laptop.
            padding: "20px clamp(14px, 3vw, 40px)",
            gap: 16,
          }}
        >
          {/* ── LEFT CORNER: the college mark, then the site's own spider ── */}
          <div style={{ display: "flex", alignItems: "center", gap: "clamp(10px, 1.6vw, 18px)" }}>
            <LogoMark
              src={licetLogo}
              alt="Loyola-ICAM College of Engineering and Technology"
              height="clamp(32px, 4vw, 48px)"
            />

          {/* Spider logo */}
          <svg width="28" height="28" viewBox="0 0 100 100" fill="#F2EFE9">
            <ellipse cx="50" cy="56" rx="12" ry="18" />
            <circle cx="50" cy="32" r="9" />
            <path
              d="M38,46 Q20,30 5,20 M62,46 Q80,30 95,20
                 M38,52 Q15,46 2,52 M62,52 Q85,46 98,52
                 M38,62 Q20,72 5,82 M62,62 Q80,72 95,82
                 M42,70 Q30,82 20,96 M58,70 Q70,82 80,96"
              stroke="#F2EFE9"
              strokeWidth="2.5"
              fill="none"
              strokeLinecap="round"
            />
          </svg>
          </div>

          {/* ── RIGHT CORNER: the links, then the department mark ── */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "clamp(14px, 2.2vw, 26px)",
            }}
          >
          {/* Nav links */}
          <div style={{ display: "flex", alignItems: "center", gap: "clamp(16px, 2.4vw, 32px)" }}>
            {[
              { label: "Events", href: "#events" },
              { label: "Sponsors", href: "#sponsors" },
            ].map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="hero-nav-link"
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 13,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: "#F2EFE9",
                  textDecoration: "none",
                }}
              >
                {link.label}
              </a>
            ))}
          </div>

            {/* Taller than the college mark on purpose: this one is portrait,
                so matching their HEIGHTS exactly would leave it a narrow
                sliver beside a near-square badge. */}
            <LogoMark
              src={deptLogo}
              alt="EICON — Engineers Integrated for Computing Needs"
              height="clamp(38px, 4.8vw, 56px)"
            />
          </div>
        </nav>

        {/* ── Bottom scrim ── */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 220,
            zIndex: 22,
            pointerEvents: "none",
            background:
              "linear-gradient(to top, rgba(10,10,10,0.95) 0%, rgba(10,10,10,0.5) 60%, transparent 100%)",
          }}
        />

        {/* ── Bottom info cards ──
            `hero-bottom-cards` is a hook for the phone block in globals.css,
            which hides these: at 390px they collapse into two unreadable
            155px columns either side of the character. */}
        <div
          ref={bottomCardsRef}
          className="hero-bottom-cards"
                    style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 30,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            padding: "0 40px 28px",
          }}
        >
          {/* Left */}
          <div style={{ maxWidth: 210 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "#E23636",
                  flexShrink: 0,
                }}
              />
              <h3
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 13,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: "#F2EFE9",
                  margin: 0,
                }}
              >
                Innovate
              </h3>
            </div>
            <p
              style={{
                fontFamily: "Inter, sans-serif",
                fontSize: 12,
                lineHeight: 1.6,
                fontStyle: "italic",
                color: "rgba(242, 239, 233, 0.72)",
                margin: 0,
              }}
            >
              Lightning-fast ideas that turn every challenge into an opportunity
              for breakthrough innovation.
            </p>
          </div>

          {/* Right */}
          <div style={{ maxWidth: 210, textAlign: "right" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 8,
                justifyContent: "flex-end",
              }}
            >
              <h3
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 13,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: "#F2EFE9",
                  margin: 0,
                }}
              >
                Collaborate
              </h3>
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "#E23636",
                  flexShrink: 0,
                }}
              />
            </div>
            <p
              style={{
                fontFamily: "Inter, sans-serif",
                fontSize: 12,
                lineHeight: 1.6,
                fontStyle: "italic",
                color: "rgba(242, 239, 233, 0.72)",
                margin: 0,
              }}
            >
              The collective strength and determination that push creators to
              rise again and again.
            </p>
          </div>
        </div>


        {/* ── Red accent corner lines ── */}
        <div
          ref={cornerTopRef}
                    style={{
            position: "absolute",
            top: 72,
            left: 48,
            width: 1,
            height: 90,
            background: "linear-gradient(to bottom, #E23636, transparent)",
            opacity: 0.5,
            zIndex: 29,
            pointerEvents: "none",
          }}
        />
        <div
          ref={cornerBottomRef}
                    style={{
            position: "absolute",
            bottom: 80,
            right: 48,
            width: 1,
            height: 90,
            background: "linear-gradient(to top, #E23636, transparent)",
            opacity: 0.5,
            zIndex: 29,
            pointerEvents: "none",
          }}
        />
        {/* ── Web pulse animation keyframes ── */}
        <style>{`
          @keyframes webPulseRed {
            0% {
              stroke-dashoffset: 540;
              opacity: 0.2;
            }
            50% {
              opacity: 0.95;
            }
            100% {
              stroke-dashoffset: 0;
              opacity: 0.2;
            }
          }
          @keyframes webPulseCyan {
            0% {
              stroke-dashoffset: 560;
              opacity: 0.15;
            }
            50% {
              opacity: 0.85;
            }
            100% {
              stroke-dashoffset: 0;
              opacity: 0.15;
            }
          }
          .hero-cta-btn {
            display: inline-flex;
            align-items: center;
            gap: 10px;
            padding: 0.85rem 2.1rem;
            font-family: var(--font-body);
            font-weight: 600;
            font-size: 0.9rem;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: #0A0A0A;
            background: #F2EFE9;
            border: 3px solid #0A0A0A;
            border-radius: 2px;
            cursor: pointer;
            text-decoration: none;
            box-shadow: 4px 4px 0 #E23636;
            transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease, color 0.15s ease;
          }
          .hero-cta-btn:hover {
            transform: translate(2px, 2px);
            box-shadow: 2px 2px 0 #E23636;
            background: #E23636;
            color: #F2EFE9;
          }
          .hero-cta-btn:active {
            transform: translate(4px, 4px);
            box-shadow: 0 0 0 #E23636;
          }
          .hero-cta-btn span {
            transition: transform 0.15s ease;
          }
          .hero-cta-btn:hover span {
            transform: translateX(3px);
          }
          .hero-nav-link {
            position: relative;
            padding-bottom: 4px;
          }
          .hero-nav-link::after {
            content: "";
            position: absolute;
            left: 0;
            bottom: 0;
            width: 100%;
            height: 2px;
            background: #E23636;
            transform: scaleX(0);
            transform-origin: right;
            transition: transform 0.25s ease;
          }
          .hero-nav-link:hover {
            color: #E23636;
          }
          .hero-nav-link:hover::after {
            transform: scaleX(1);
            transform-origin: left;
          }
        `}</style>
      </section>
    </>
  );
}
