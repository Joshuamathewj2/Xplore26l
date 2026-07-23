"use client";

import { useEffect, useRef } from "react";

export default function ScrollCue() {
  const cueRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (!cueRef.current) return;
      const scrollY = window.scrollY;
      cueRef.current.style.opacity = scrollY > 100 ? "0" : "1";
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div
      ref={cueRef}
      className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2 animate-[fadeIn_0.6s_ease-out_1s_both]"
      style={{ transition: "opacity 0.3s ease" }}
      id="scroll-cue"
    >
      {/* Web line extending down */}
      <div className="w-[1px] h-10 bg-gradient-to-b from-transparent via-[var(--paper-white)] to-[var(--paper-white)] opacity-40" />

      {/* Thwip arrow */}
      <div className="scroll-cue flex flex-col items-center">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          className="opacity-60"
        >
          <path
            d="M12 4 L12 18 M6 14 L12 20 L18 14"
            stroke="var(--spider-red)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M8 8 L12 12 L16 8"
            stroke="var(--paper-white)"
            strokeWidth="0.5"
            opacity="0.3"
          />
        </svg>

        <span
          className="mt-2 text-xs tracking-[0.3em] uppercase opacity-40"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Scroll
        </span>
      </div>
    </div>
  );
}
