"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

export default function HeroTitle() {
  const containerRef = useRef<HTMLDivElement>(null);
  const line1Ref = useRef<HTMLHeadingElement>(null);
  const line2Ref = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const tl = gsap.timeline({ delay: 1.6 }); // Start after loading screen

    // Glitch-in the title line by line
    if (line1Ref.current) {
      // Initial state: invisible, shifted
      gsap.set(line1Ref.current, {
        opacity: 0,
        y: 30,
        skewX: -5,
      });

      tl.to(line1Ref.current, {
        opacity: 1,
        y: 0,
        skewX: 0,
        duration: 0.1,
        ease: "steps(3)",
      });

      // Quick glitch-flicker
      tl.to(line1Ref.current, {
        opacity: 0.3,
        x: -5,
        duration: 0.05,
      });
      tl.to(line1Ref.current, {
        opacity: 1,
        x: 3,
        duration: 0.05,
      });
      tl.to(line1Ref.current, {
        opacity: 0.7,
        x: -2,
        duration: 0.04,
      });
      tl.to(line1Ref.current, {
        opacity: 1,
        x: 0,
        duration: 0.04,
      });
    }

    if (line2Ref.current) {
      gsap.set(line2Ref.current, {
        opacity: 0,
        y: 30,
        skewX: 5,
      });

      tl.to(
        line2Ref.current,
        {
          opacity: 1,
          y: 0,
          skewX: 0,
          duration: 0.1,
          ease: "steps(3)",
        },
        "-=0.05"
      );

      // Glitch flicker for line 2
      tl.to(line2Ref.current, {
        opacity: 0.5,
        x: 4,
        duration: 0.04,
      });
      tl.to(line2Ref.current, {
        opacity: 1,
        x: -2,
        duration: 0.04,
      });
      tl.to(line2Ref.current, {
        opacity: 1,
        x: 0,
        duration: 0.04,
      });
    }

    if (subtitleRef.current) {
      gsap.set(subtitleRef.current, { opacity: 0, y: 20 });
      tl.to(subtitleRef.current, {
        opacity: 1,
        y: 0,
        duration: 0.5,
        ease: "power2.out",
      });
    }

    return () => {
      tl.kill();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative z-20 flex flex-col items-center justify-center text-center px-4"
      style={{ marginTop: "-5vh" }}
    >
      {/* Main title — two lines */}
      <h1
        ref={line1Ref}
        className="chromatic-text"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "clamp(3rem, 10vw, 9rem)",
          lineHeight: 0.95,
          letterSpacing: "0.02em",
          color: "var(--paper-white)",
          textTransform: "uppercase",
          opacity: 0,
        }}
      >
        Spider-Verse
      </h1>

      <h1
        ref={line2Ref}
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "clamp(2rem, 6vw, 5.5rem)",
          lineHeight: 1.1,
          letterSpacing: "0.15em",
          color: "var(--spider-red)",
          textTransform: "uppercase",
          opacity: 0,
          textShadow:
            "0 0 40px rgba(226, 54, 54, 0.4), 0 0 80px rgba(226, 54, 54, 0.2)",
        }}
      >
        Symposium
      </h1>

      {/* Subtitle */}
      <p
        ref={subtitleRef}
        className="mt-6 max-w-xl text-base md:text-lg tracking-wide opacity-0"
        style={{
          fontFamily: "var(--font-body)",
          color: "var(--paper-white)",
          opacity: 0,
          lineHeight: 1.7,
        }}
      >
        Where dimensions collide. A convergence of innovators,{" "}
        <span style={{ color: "var(--spider-red)" }}>creators</span>, and
        visionaries pushing the boundaries of what&apos;s possible.
      </p>

      {/* Date badge */}
      <div
        className="mt-5 inline-flex items-center gap-3 px-5 py-2 border-2 border-[var(--spider-red)] bg-[rgba(226,54,54,0.08)]"
        style={{
          fontFamily: "var(--font-display)",
          letterSpacing: "0.1em",
          fontSize: "0.9rem",
        }}
      >
        <span className="w-2 h-2 bg-[var(--spider-red)] rounded-full animate-pulse" />
        MARCH 15–17, 2026 • NEW YORK CITY
      </div>
    </div>
  );
}
