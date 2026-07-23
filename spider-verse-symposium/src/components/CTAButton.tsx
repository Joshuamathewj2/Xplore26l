"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

interface CTAButtonProps {
  text: string;
  href?: string;
  onClick?: () => void;
  delay?: number;
}

export default function CTAButton({
  text,
  href = "#events",
  delay = 2.6,
}: CTAButtonProps) {
  const btnRef = useRef<HTMLAnchorElement>(null);
  const glitchRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!btnRef.current) return;

    // Initial hidden state
    gsap.set(btnRef.current, { opacity: 0, y: 20, scale: 0.95 });

    // Entrance animation
    const tl = gsap.timeline({ delay });

    tl.to(btnRef.current, {
      opacity: 1,
      y: 0,
      scale: 1,
      duration: 0.4,
      ease: "back.out(1.7)",
    });

    // Quick glitch flash on entrance
    tl.to(btnRef.current, {
      x: -3,
      duration: 0.04,
    });
    tl.to(btnRef.current, {
      x: 2,
      duration: 0.04,
    });
    tl.to(btnRef.current, {
      x: 0,
      duration: 0.04,
    });

    return () => {
      tl.kill();
    };
  }, [delay]);

  const handleMouseEnter = () => {
    if (!glitchRef.current || !btnRef.current) return;

    // Rapid glitch on hover
    const tl = gsap.timeline();
    tl.to(btnRef.current, { x: -2, duration: 0.03 });
    tl.to(btnRef.current, { x: 3, duration: 0.03 });
    tl.to(btnRef.current, { x: -1, duration: 0.03 });
    tl.to(btnRef.current, { x: 0, duration: 0.03 });
  };

  return (
    <a
      ref={btnRef}
      href={href}
      className="comic-btn group relative z-20 mt-8"
      onMouseEnter={handleMouseEnter}
      id="cta-register"
      style={{ opacity: 0 }}
    >
      <span ref={glitchRef} className="relative z-10">
        {text}
      </span>

      {/* Corner accents — comic panel detail */}
      <span className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-[var(--spider-red)] opacity-0 group-hover:opacity-100 transition-opacity -translate-x-1 -translate-y-1" />
      <span className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-[var(--spider-red)] opacity-0 group-hover:opacity-100 transition-opacity translate-x-1 -translate-y-1" />
      <span className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-[var(--spider-red)] opacity-0 group-hover:opacity-100 transition-opacity -translate-x-1 translate-y-1" />
      <span className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-[var(--spider-red)] opacity-0 group-hover:opacity-100 transition-opacity translate-x-1 translate-y-1" />
    </a>
  );
}
