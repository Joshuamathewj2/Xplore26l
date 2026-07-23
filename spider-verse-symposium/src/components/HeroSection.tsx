"use client";

import { useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export default function HeroSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const imageWrapRef = useRef<HTMLDivElement>(null);
  const webLeftRef = useRef<SVGSVGElement>(null);
  const webRightRef = useRef<SVGSVGElement>(null);
  const titleSolidWrapRef = useRef<HTMLDivElement>(null);
  const titleStrokeWrapRef = useRef<HTMLDivElement>(null);
  const chromRedRef = useRef<HTMLDivElement>(null);
  const chromCyanRef = useRef<HTMLDivElement>(null);
  const bottomCardsRef = useRef<HTMLDivElement>(null);
  const cornerTopRef = useRef<HTMLDivElement>(null);
  const cornerBottomRef = useRef<HTMLDivElement>(null);

  // Track whether reduced-motion is preferred
  const prefersReducedMotion = useRef(false);

  // gsap.quickTo setters for smooth parallax — initialized in useEffect
  const parallaxSetters = useRef<{
    charX: gsap.QuickToFunc | null;
    charY: gsap.QuickToFunc | null;
    titleSolidX: gsap.QuickToFunc | null;
    titleSolidY: gsap.QuickToFunc | null;
    titleStrokeX: gsap.QuickToFunc | null;
    titleStrokeY: gsap.QuickToFunc | null;
    webLX: gsap.QuickToFunc | null;
    webLY: gsap.QuickToFunc | null;
    webRX: gsap.QuickToFunc | null;
    webRY: gsap.QuickToFunc | null;
  }>({
    charX: null, charY: null,
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

    // Character — largest travel (±10px x, ±6px y)
    s.charX?.(nx * -10);
    s.charY?.(ny * -6);

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

      // Character uses xPercent=-50 as its base centering, so we
      // animate x/y around that. The initial translateX(-50%) is
      // kept via the xPercent GSAP property set once below.
      if (imageWrapRef.current) {
        gsap.set(imageWrapRef.current, { xPercent: -50 });
        parallaxSetters.current.charX = gsap.quickTo(imageWrapRef.current, "x", { duration: dur, ease });
        parallaxSetters.current.charY = gsap.quickTo(imageWrapRef.current, "y", { duration: dur, ease });
      }
      if (titleSolidWrapRef.current) {
        parallaxSetters.current.titleSolidX = gsap.quickTo(titleSolidWrapRef.current, "x", { duration: dur, ease });
        parallaxSetters.current.titleSolidY = gsap.quickTo(titleSolidWrapRef.current, "y", { duration: dur, ease });
      }
      if (titleStrokeWrapRef.current) {
        parallaxSetters.current.titleStrokeX = gsap.quickTo(titleStrokeWrapRef.current, "x", { duration: dur, ease });
        parallaxSetters.current.titleStrokeY = gsap.quickTo(titleStrokeWrapRef.current, "y", { duration: dur, ease });
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
          [bottomCards, cornerTop, cornerBot].filter(Boolean),
          { opacity: (i, target) => (target === bottomCards ? 1 : 0.5), duration: 0.6 },
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
    if (titleSolid) gsap.set(titleSolid, { opacity: 0, scale: 0.92 });
    if (titleStroke) gsap.set(titleStroke, { opacity: 0, scale: 0.92 });
    if (chromRed) gsap.set(chromRed, { opacity: 0 });
    if (chromCyan) gsap.set(chromCyan, { opacity: 0 });
    if (character) gsap.set(character, { opacity: 0, y: 40 });
    if (bottomCards) gsap.set(bottomCards, { opacity: 0, y: 20 });
    if (cornerTop) gsap.set(cornerTop, { opacity: 0, y: -15 });
    if (cornerBot) gsap.set(cornerBot, { opacity: 0, y: 15 });

    const entrance = gsap.timeline({ delay: 0.1 });

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

    // Step 2: Title — fade + scale from 0.92 → 1 (starts at t=0.3)
    entrance.to(
      [titleSolid, titleStroke].filter(Boolean),
      { opacity: 1, scale: 1, duration: 0.7, ease: "power3.out", stagger: 0.05 },
      0.3
    );

    // Step 2b: Chromatic layers — fade in after title starts
    entrance.to(
      [chromRed, chromCyan].filter(Boolean),
      { opacity: 0.35, duration: 0.5, ease: "power2.out" },
      0.6
    );

    // Step 3: Character — translateY from +40 to 0 while fading in (starts at t=0.55)
    entrance.to(character, {
      opacity: 0.88,
      y: 0,
      duration: 0.8,
      ease: "power3.out",
    }, 0.55);

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

    // ──────────────────────────────────────────────
    //  4. IDLE AMBIENT MOTION — slow vertical bob
    // ──────────────────────────────────────────────
    const idleBob = gsap.to(imageWrapRef.current, {
      y: -5,
      duration: 2.5,
      ease: "sine.inOut",
      repeat: -1,
      yoyo: true,
      delay: 1.8, // start after entrance settles
    });

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
      idleBob.kill();
      exitTl.kill();
      ScrollTrigger.getAll().forEach((st) => st.kill());
      window.removeEventListener("mousemove", handleMouseMove);
      mq.removeEventListener("change", onMotionChange);
    };
  }, [handleMouseMove]);

  // ── Shared title text styles ──
  const titleFontStyle: React.CSSProperties = {
    fontFamily: "'Bebas Neue', 'Anton', sans-serif",
    fontSize: "clamp(8rem, 18vw, 18rem)",
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
            opacity: 0,
          }}
        >
          <h1
            aria-hidden="true"
            style={{
              ...titleFontStyle,
              color: "#E23636",
              transform: "translateX(-1.5px)",
            }}
          >
            XPLORE&apos;26
          </h1>
        </div>

        {/* ── CHROMATIC CYAN LAYER (behind solid title) ── */}
        <div
          ref={chromCyanRef}
          style={{
            ...titleWrapStyle,
            zIndex: 7,
            opacity: 0,
          }}
        >
          <h1
            aria-hidden="true"
            style={{
              ...titleFontStyle,
              color: "#00E5FF",
              transform: "translateX(1.5px)",
            }}
          >
            XPLORE&apos;26
          </h1>
        </div>

        {/* ── Title text — z-index 8, BEHIND character (solid fill) ── */}
        <div
          ref={titleSolidWrapRef}
          style={{
            ...titleWrapStyle,
            zIndex: 8,
          }}
        >
          <h1
            style={{
              ...titleFontStyle,
              color: "#F2EFE9",
              textShadow: "0 4px 40px rgba(0,0,0,0.8), 0 2px 8px rgba(0,0,0,0.9)",
            }}
          >
            XPLORE&apos;26
          </h1>
        </div>

        {/* ── Character image — z-index 15, ABOVE title ── */}
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
          }}
        >
          <Image
            src="/spiderman-hero.png"
            alt="Miles Morales Spider-Man"
            fill
            priority
            style={{
              objectFit: "contain",
              objectPosition: "bottom",
              filter: "contrast(1.1) brightness(1.02)",
            }}
            sizes="(max-width: 768px) 140vw, 1400px"
          />
        </div>

        {/* ── Title text — z-index 16, ABOVE character (outlined/stroke only) ── */}
        <div
          ref={titleStrokeWrapRef}
          style={{
            ...titleWrapStyle,
            zIndex: 16,
          }}
        >
          <h1
            style={{
              ...titleFontStyle,
              color: "transparent",
              WebkitTextStroke: "3px #F2EFE9",
              textShadow: "none",
            }}
          >
            XPLORE&apos;26
          </h1>
        </div>

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
            padding: "20px 40px",
          }}
        >
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

          {/* Menu button */}
          <button
            id="nav-menu"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
            }}
          >
            <span
              style={{
                fontFamily: "'Anton', sans-serif",
                fontSize: 14,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: "#E23636",
              }}
            >
              Menu
            </span>
            <div
              style={{ display: "flex", flexDirection: "column", gap: 5 }}
            >
              <span
                style={{
                  display: "block",
                  width: 24,
                  height: 2,
                  background: "#F2EFE9",
                }}
              />
              <span
                style={{
                  display: "block",
                  width: 32,
                  height: 2,
                  background: "#F2EFE9",
                }}
              />
              <span
                style={{
                  display: "block",
                  width: 20,
                  height: 2,
                  background: "#F2EFE9",
                }}
              />
            </div>
          </button>
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

        {/* ── Bottom info cards ── */}
        <div
          ref={bottomCardsRef}
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
                  fontFamily: "'Anton', sans-serif",
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
                  fontFamily: "'Anton', sans-serif",
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
        `}</style>
      </section>
    </>
  );
}
