"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/* ══════════════════════════════════════════════════════════════════
   A character cutout that peeks up from the bottom-left corner of the
   Sponsors panel as it scrolls to centre, then settles into a slow idle
   sway — the same "mostly off-panel art that enters on cue" trick the
   Events heading already uses, just applied to a character instead of
   the section's own artwork. Reuses the flat Spider-Man cutout that was
   the Hero's art before the 3D rig replaced it (public/spiderman-hero.webp,
   otherwise unused) rather than asking for new art.
   ══════════════════════════════════════════════════════════════════ */

export default function SponsorsPeekCharacter() {
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (reduced) {
      gsap.set(el, { y: 0, x: 0, opacity: 1, rotate: 0 });
      return;
    }

    gsap.set(el, { y: 90, x: -24, opacity: 0, rotate: -4 });

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: el.closest("section") ?? el,
        start: "top 75%",
        toggleActions: "play none none reverse",
      },
    });
    tl.to(el, {
      y: 0,
      x: 0,
      opacity: 1,
      rotate: 0,
      duration: 0.9,
      ease: "power3.out",
    });

    // Idle sway once settled — same idle-loop family as the rest of the
    // page, just slower since this is a big, heavy shape.
    const idle = gsap.to(el, {
      y: "-=10",
      rotate: 1.2,
      duration: 3.4,
      ease: "sine.inOut",
      repeat: -1,
      yoyo: true,
      delay: 1,
    });

    return () => {
      tl.scrollTrigger?.kill();
      tl.kill();
      idle.kill();
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      aria-hidden="true"
      style={{
        position: "absolute",
        left: "clamp(-40px, -3vw, 0px)",
        bottom: 0,
        width: "clamp(160px, 20vw, 300px)",
        pointerEvents: "none",
        zIndex: 2,
      }}
    >
      <Image
        src="/spiderman-hero.webp"
        alt=""
        width={2200}
        height={1238}
        style={{
          width: "100%",
          height: "auto",
          display: "block",
          filter:
            "drop-shadow(0 14px 30px rgba(0,0,0,0.55)) drop-shadow(-2px 0 0 rgba(226,54,54,0.25)) drop-shadow(2px 0 0 rgba(0,229,255,0.2))",
          maskImage: "linear-gradient(to bottom, black 78%, transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(to bottom, black 78%, transparent 100%)",
        }}
      />
    </div>
  );
}
