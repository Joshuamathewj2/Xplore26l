"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";

// Jagged clip-path polygon states for the tear effect
const TEAR_STATES = [
  // State 1: thin horizontal crack
  "polygon(0% 48%, 15% 49%, 30% 47%, 45% 50%, 55% 48%, 70% 51%, 85% 49%, 100% 48%, 100% 52%, 85% 51%, 70% 49%, 55% 52%, 45% 50%, 30% 53%, 15% 51%, 0% 52%)",
  // State 2: wider jagged tear
  "polygon(0% 35%, 10% 38%, 18% 32%, 28% 40%, 38% 30%, 48% 42%, 55% 28%, 65% 38%, 75% 32%, 85% 40%, 92% 35%, 100% 38%, 100% 62%, 92% 65%, 85% 60%, 75% 68%, 65% 62%, 55% 72%, 48% 58%, 38% 70%, 28% 60%, 18% 68%, 10% 62%, 0% 65%)",
  // State 3: nearly full rip
  "polygon(0% 15%, 8% 20%, 16% 10%, 25% 22%, 33% 8%, 42% 18%, 50% 5%, 58% 18%, 67% 8%, 75% 22%, 83% 10%, 92% 20%, 100% 15%, 100% 85%, 92% 80%, 83% 90%, 75% 78%, 67% 92%, 58% 82%, 50% 95%, 42% 82%, 33% 92%, 25% 78%, 16% 90%, 8% 80%, 0% 85%)",
];

// Full open state
const TEAR_FULL =
  "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)";

export default function LoadingScreen({
  onComplete,
}: {
  onComplete: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const crackRef = useRef<HTMLDivElement>(null);
  const tearRef = useRef<HTMLDivElement>(null);
  const webCracksRef = useRef<SVGSVGElement>(null);
  const flickerOverlayRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (!containerRef.current) return;

    let isDone = false;
    const finish = () => {
      if (isDone) return;
      isDone = true;
      setIsVisible(false);
      onComplete();
    };

    // Safety fallback: guaranteed finish after 1.8 seconds
    const fallbackTimer = setTimeout(finish, 1800);

    const tl = gsap.timeline({
      onComplete: () => {
        clearTimeout(fallbackTimer);
        finish();
      },
    });

    // Phase 1: Black screen with faint static (200ms)
    tl.to({}, { duration: 0.2 });

    // Phase 2: Crack appears
    if (crackRef.current) {
      tl.fromTo(
        crackRef.current,
        { scaleX: 0, opacity: 1 },
        { scaleX: 1, duration: 0.25, ease: "power4.out" }
      );
    }

    // Phase 3: Web cracks pattern
    if (webCracksRef.current) {
      tl.fromTo(
        webCracksRef.current,
        { scale: 0.2, opacity: 0 },
        { scale: 1.2, opacity: 0.6, duration: 0.3, ease: "power2.out" },
        "-=0.1"
      );
    }

    // Phase 4: Tear opens & crack fades
    if (crackRef.current) {
      tl.to(crackRef.current, { opacity: 0, duration: 0.1 });
    }

    // Phase 5: Fade out loading container to reveal hero
    if (containerRef.current) {
      tl.to(containerRef.current, {
        opacity: 0,
        duration: 0.3,
        ease: "power2.inOut",
      });
    }

    return () => {
      clearTimeout(fallbackTimer);
      tl.kill();
    };
  }, [onComplete]);

  if (!isVisible) return null;

  return (
    <div ref={containerRef} className="loading-screen" aria-hidden="true">
      {/* Static noise texture */}
      <div className="loading-noise" />

      {/* Horizontal crack with RGB split */}
      <div ref={crackRef} className="loading-crack" />

      {/* Jagged tear revealing hero behind */}
      <div ref={tearRef} className="loading-tear">
        {/* Halftone fringe border effect */}
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(circle, var(--paper-white) 1.5px, transparent 1.5px)`,
              backgroundSize: "6px 6px",
              opacity: 0.15,
              maskImage:
                "linear-gradient(to right, black 0%, transparent 5%, transparent 95%, black 100%), linear-gradient(to bottom, black 0%, transparent 5%, transparent 95%, black 100%)",
              maskComposite: "intersect",
              WebkitMaskImage:
                "linear-gradient(to right, black 0%, transparent 5%, transparent 95%, black 100%), linear-gradient(to bottom, black 0%, transparent 5%, transparent 95%, black 100%)",
              WebkitMaskComposite: "source-in",
            }}
          />
        </div>
      </div>

      {/* Web crack pattern radiating from center */}
      <svg
        ref={webCracksRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 1000 1000"
        style={{ opacity: 0, transformOrigin: "center center" }}
      >
        {/* Radial web cracks */}
        <g
          stroke="var(--paper-white)"
          strokeWidth="1.5"
          fill="none"
          opacity="0.6"
        >
          {/* Main radial lines */}
          <line x1="500" y1="500" x2="500" y2="200" />
          <line x1="500" y1="500" x2="500" y2="800" />
          <line x1="500" y1="500" x2="200" y2="500" />
          <line x1="500" y1="500" x2="800" y2="500" />
          <line x1="500" y1="500" x2="300" y2="300" />
          <line x1="500" y1="500" x2="700" y2="300" />
          <line x1="500" y1="500" x2="300" y2="700" />
          <line x1="500" y1="500" x2="700" y2="700" />
          {/* Branch cracks */}
          <polyline points="500,350 480,280 460,200" />
          <polyline points="500,350 520,290 550,220" />
          <polyline points="650,500 720,480 800,470" />
          <polyline points="650,500 710,530 790,540" />
          <polyline points="350,500 280,480 200,460" />
          <polyline points="350,500 290,530 210,550" />
          <polyline points="500,650 480,720 460,800" />
          <polyline points="500,650 530,710 550,790" />
          {/* Diagonal branches */}
          <polyline points="600,400 660,360 720,300" />
          <polyline points="400,400 340,360 280,300" />
          <polyline points="600,600 660,640 720,700" />
          <polyline points="400,600 340,640 280,700" />
        </g>
        {/* Concentric web rings */}
        <g
          stroke="var(--paper-white)"
          strokeWidth="0.8"
          fill="none"
          opacity="0.3"
        >
          <circle cx="500" cy="500" r="80" />
          <circle cx="500" cy="500" r="160" />
          <circle cx="500" cy="500" r="250" />
        </g>
      </svg>

      {/* Glitch flicker overlay */}
      <div
        ref={flickerOverlayRef}
        className="absolute inset-0 pointer-events-none"
        style={{
          opacity: 0,
          background:
            "linear-gradient(180deg, rgba(0,229,255,0.3) 0%, rgba(226,54,54,0.2) 50%, rgba(0,229,255,0.3) 100%)",
          mixBlendMode: "screen",
        }}
      />

      {/* Scan line for extra glitch feel */}
      <div
        className="absolute left-0 w-full h-[2px] pointer-events-none"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(0,229,255,0.4), transparent)",
          animation: "scan-line 0.8s linear infinite",
          top: 0,
        }}
      />
    </div>
  );
}
