"use client";

import { useEffect, useRef, useCallback } from "react";
import gsap from "gsap";

export default function CityParallax() {
  const bgLayerRef = useRef<HTMLDivElement>(null);
  const midLayerRef = useRef<HTMLDivElement>(null);
  const fgLayerRef = useRef<HTMLDivElement>(null);
  const particlesRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const mouseX = e.clientX - rect.left - centerX;
    const mouseY = e.clientY - rect.top - centerY;

    // Normalize to -1..1
    const normX = mouseX / centerX;
    const normY = mouseY / centerY;

    // Different parallax intensities per layer
    gsap.to(bgLayerRef.current, {
      x: normX * -8,
      y: normY * -5,
      duration: 1.2,
      ease: "power2.out",
    });
    gsap.to(midLayerRef.current, {
      x: normX * -18,
      y: normY * -10,
      duration: 1,
      ease: "power2.out",
    });
    gsap.to(fgLayerRef.current, {
      x: normX * -30,
      y: normY * -15,
      duration: 0.8,
      ease: "power2.out",
    });
  }, []);

  useEffect(() => {
    // Check if touch device
    const isTouchDevice =
      "ontouchstart" in window || navigator.maxTouchPoints > 0;

    if (!isTouchDevice) {
      window.addEventListener("mousemove", handleMouseMove);
    } else {
      // Gentle auto-parallax loop for mobile
      const tl = gsap.timeline({ repeat: -1, yoyo: true });
      tl.to(bgLayerRef.current, { x: 5, y: 3, duration: 6, ease: "sine.inOut" });
      tl.to(midLayerRef.current, { x: 10, y: 5, duration: 6, ease: "sine.inOut" }, 0);
      tl.to(fgLayerRef.current, { x: 18, y: 8, duration: 6, ease: "sine.inOut" }, 0);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, [handleMouseMove]);

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden">
      {/* ═══ BACKGROUND LAYER: Sky gradient + far skyline ═══ */}
      <div ref={bgLayerRef} className="parallax-layer" style={{ zIndex: 1 }}>
        {/* Sky gradient */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, #062654 0%, #0D47A1 25%, #1565C0 45%, #0A0A0A 100%)",
          }}
        />

        {/* Stars / distant lights */}
        <div className="absolute inset-0">
          {Array.from({ length: 30 }).map((_, i) => (
            <div
              key={`star-${i}`}
              className="absolute rounded-full bg-[#F2EFE9]"
              style={{
                width: `${1 + Math.random() * 2}px`,
                height: `${1 + Math.random() * 2}px`,
                top: `${Math.random() * 50}%`,
                left: `${Math.random() * 100}%`,
                opacity: 0.3 + Math.random() * 0.5,
                animation: `glitch-flicker ${3 + Math.random() * 4}s ease-in-out infinite`,
                animationDelay: `${Math.random() * 3}s`,
              }}
            />
          ))}
        </div>

        {/* Far skyline silhouette */}
        <svg
          className="absolute bottom-0 left-0 w-[110%] -ml-[5%]"
          viewBox="0 0 1600 400"
          preserveAspectRatio="none"
          style={{ height: "55%" }}
        >
          <defs>
            <linearGradient id="skylineFarGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0D2847" />
              <stop offset="100%" stopColor="#0A0A0A" />
            </linearGradient>
          </defs>
          <path
            d="M0,400 L0,280 L40,280 L40,200 L60,200 L60,180 L80,180 L80,200 L100,200 L100,160 L110,160 L110,140 L120,140 L120,160 L140,160 L140,200 L180,200 L180,220 L200,220 L200,180 L210,180 L210,120 L220,120 L220,100 L230,100 L230,80 L240,80 L240,100 L250,100 L250,120 L260,120 L260,180 L280,180 L280,240 L320,240 L320,200 L340,200 L340,160 L350,160 L350,130 L360,130 L360,110 L370,90 L380,90 L380,110 L390,130 L400,130 L400,200 L430,200 L430,220 L460,220 L460,180 L470,180 L470,140 L480,140 L480,100 L490,100 L490,70 L500,70 L500,50 L510,50 L510,70 L520,70 L520,100 L530,100 L530,140 L540,140 L540,180 L560,180 L560,230 L600,230 L600,200 L620,200 L620,160 L640,160 L640,120 L650,120 L650,90 L660,90 L660,60 L670,60 L670,40 L680,40 L680,60 L690,60 L690,90 L700,90 L700,120 L720,120 L720,160 L740,160 L740,200 L780,200 L780,240 L820,240 L820,190 L840,190 L840,150 L850,150 L850,110 L860,110 L860,80 L870,80 L870,60 L880,60 L880,80 L890,80 L890,110 L900,110 L900,150 L920,150 L920,190 L940,190 L940,230 L980,230 L980,200 L1000,200 L1000,170 L1010,170 L1010,140 L1020,140 L1020,110 L1030,110 L1030,90 L1040,90 L1040,70 L1050,70 L1050,90 L1060,90 L1060,110 L1070,110 L1070,140 L1080,140 L1080,170 L1100,170 L1100,200 L1140,200 L1140,230 L1180,230 L1180,210 L1200,210 L1200,180 L1210,180 L1210,150 L1220,150 L1220,130 L1230,130 L1230,120 L1240,120 L1240,130 L1250,130 L1250,150 L1260,150 L1260,180 L1280,180 L1280,210 L1320,210 L1320,240 L1360,240 L1360,220 L1380,220 L1380,190 L1400,190 L1400,160 L1420,160 L1420,190 L1440,190 L1440,220 L1480,220 L1480,250 L1520,250 L1520,270 L1560,270 L1560,290 L1600,290 L1600,400 Z"
            fill="url(#skylineFarGrad)"
          />
          {/* Building windows — tiny lit rectangles */}
          {Array.from({ length: 60 }).map((_, i) => {
            const bx = 100 + Math.random() * 1400;
            const by = 120 + Math.random() * 200;
            return (
              <rect
                key={`win-far-${i}`}
                x={bx}
                y={by}
                width="3"
                height="4"
                fill="#F2EFE9"
                opacity={0.15 + Math.random() * 0.35}
              />
            );
          })}
        </svg>
      </div>

      {/* ═══ MID LAYER: Closer buildings with halftone shadows ═══ */}
      <div ref={midLayerRef} className="parallax-layer" style={{ zIndex: 2 }}>
        <svg
          className="absolute bottom-0 left-0 w-[115%] -ml-[7%]"
          viewBox="0 0 1600 500"
          preserveAspectRatio="none"
          style={{ height: "50%" }}
        >
          <defs>
            <pattern
              id="halftone"
              width="6"
              height="6"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="3" cy="3" r="1.2" fill="#F2EFE9" opacity="0.12" />
            </pattern>
            <linearGradient id="midBuildingGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0F1A2E" />
              <stop offset="100%" stopColor="#0A0A0A" />
            </linearGradient>
          </defs>

          {/* Building group */}
          <path
            d="M0,500 L0,350 L80,350 L80,250 L100,250 L100,200 L120,200 L120,180 L150,180 L150,200 L170,200 L170,250 L200,250 L200,300 L240,300 L240,220 L260,220 L260,160 L270,160 L270,130 L280,130 L280,100 L300,100 L300,80 L320,80 L320,100 L340,100 L340,130 L350,130 L350,160 L360,160 L360,220 L400,220 L400,280 L440,280 L440,320 L500,320 L500,260 L520,260 L520,200 L530,200 L530,150 L540,150 L540,110 L550,110 L550,80 L560,80 L560,50 L580,50 L580,30 L600,30 L600,50 L620,50 L620,80 L630,80 L630,110 L640,110 L640,150 L650,150 L650,200 L680,200 L680,260 L720,260 L720,300 L780,300 L780,250 L800,250 L800,200 L820,200 L820,160 L830,160 L830,130 L840,130 L840,160 L850,160 L850,200 L870,200 L870,250 L920,250 L920,300 L960,300 L960,260 L980,260 L980,200 L990,200 L990,160 L1000,160 L1000,120 L1010,120 L1010,90 L1020,90 L1020,60 L1040,60 L1040,40 L1060,40 L1060,60 L1080,60 L1080,90 L1090,90 L1090,120 L1100,120 L1100,160 L1120,160 L1120,200 L1160,200 L1160,260 L1200,260 L1200,300 L1240,300 L1240,280 L1260,280 L1260,220 L1280,220 L1280,180 L1300,180 L1300,220 L1320,220 L1320,280 L1360,280 L1360,320 L1400,320 L1400,280 L1420,280 L1420,240 L1440,240 L1440,280 L1480,280 L1480,320 L1520,320 L1520,350 L1560,350 L1560,370 L1600,370 L1600,500 Z"
            fill="url(#midBuildingGrad)"
          />
          {/* Halftone shadow overlay */}
          <path
            d="M0,500 L0,350 L80,350 L80,250 L100,250 L100,200 L120,200 L120,180 L150,180 L150,200 L170,200 L170,250 L200,250 L200,300 L240,300 L240,220 L260,220 L260,160 L270,160 L270,130 L280,130 L280,100 L300,100 L300,80 L320,80 L320,100 L340,100 L340,130 L350,130 L350,160 L360,160 L360,220 L400,220 L400,280 L440,280 L440,320 L500,320 L500,260 L520,260 L520,200 L530,200 L530,150 L540,150 L540,110 L550,110 L550,80 L560,80 L560,50 L580,50 L580,30 L600,30 L600,50 L620,50 L620,80 L630,80 L630,110 L640,110 L640,150 L650,150 L650,200 L680,200 L680,260 L720,260 L720,300 L780,300 L780,250 L800,250 L800,200 L820,200 L820,160 L830,160 L830,130 L840,130 L840,160 L850,160 L850,200 L870,200 L870,250 L920,250 L920,300 L960,300 L960,260 L980,260 L980,200 L990,200 L990,160 L1000,160 L1000,120 L1010,120 L1010,90 L1020,90 L1020,60 L1040,60 L1040,40 L1060,40 L1060,60 L1080,60 L1080,90 L1090,90 L1090,120 L1100,120 L1100,160 L1120,160 L1120,200 L1160,200 L1160,260 L1200,260 L1200,300 L1240,300 L1240,280 L1260,280 L1260,220 L1280,220 L1280,180 L1300,180 L1300,220 L1320,220 L1320,280 L1360,280 L1360,320 L1400,320 L1400,280 L1420,280 L1420,240 L1440,240 L1440,280 L1480,280 L1480,320 L1520,320 L1520,350 L1560,350 L1560,370 L1600,370 L1600,500 Z"
            fill="url(#halftone)"
          />
          {/* Building windows — lit rectangles */}
          {Array.from({ length: 80 }).map((_, i) => {
            const wx = 80 + Math.random() * 1440;
            const wy = 100 + Math.random() * 300;
            const lit = Math.random() > 0.4;
            return (
              <rect
                key={`win-mid-${i}`}
                x={wx}
                y={wy}
                width="4"
                height="6"
                fill={lit ? "#F2EFE9" : "#1A2030"}
                opacity={lit ? 0.2 + Math.random() * 0.5 : 0.3}
              />
            );
          })}
        </svg>
      </div>

      {/* ═══ FOREGROUND LAYER: Spider silhouette ═══ */}
      <div ref={fgLayerRef} className="parallax-layer" style={{ zIndex: 3 }}>
        {/* Foreground building edge silhouettes */}
        <svg
          className="absolute bottom-0 left-0 w-[120%] -ml-[10%]"
          viewBox="0 0 1600 300"
          preserveAspectRatio="none"
          style={{ height: "25%" }}
        >
          <path
            d="M0,300 L0,200 L60,200 L60,140 L80,140 L80,100 L120,100 L120,140 L160,140 L160,180 L200,180 L200,220 L300,220 L300,180 L340,180 L340,140 L360,140 L360,180 L400,180 L400,220 L500,220 L500,240 L700,240 L700,200 L720,200 L720,160 L740,160 L740,200 L760,200 L760,240 L900,240 L900,220 L940,220 L940,180 L960,180 L960,140 L980,140 L980,180 L1020,180 L1020,220 L1100,220 L1100,250 L1200,250 L1200,220 L1240,220 L1240,200 L1260,200 L1260,220 L1300,220 L1300,250 L1400,250 L1400,260 L1500,260 L1500,280 L1600,280 L1600,300 Z"
            fill="#0A0A0A"
          />
        </svg>

        {/* Swinging spider silhouette */}
        <div
          className="absolute"
          style={{
            bottom: "30%",
            left: "15%",
            width: "60px",
            height: "60px",
            zIndex: 4,
          }}
        >
          {/* Web line */}
          <div
            className="absolute w-[1px] bg-[#F2EFE9] opacity-30"
            style={{
              height: "200px",
              top: "-200px",
              left: "50%",
              transformOrigin: "top center",
              transform: "rotate(-15deg)",
            }}
          />
          {/* Spider figure silhouette */}
          <svg viewBox="0 0 60 60" className="w-full h-full opacity-80">
            <g fill="#0A0A0A" stroke="#1A1A2A" strokeWidth="0.5">
              {/* Body */}
              <ellipse cx="30" cy="32" rx="8" ry="12" />
              {/* Head */}
              <circle cx="30" cy="18" r="6" />
              {/* Arms spread */}
              <line
                x1="22"
                y1="25"
                x2="5"
                y2="15"
                stroke="#0A0A0A"
                strokeWidth="2"
              />
              <line
                x1="38"
                y1="25"
                x2="55"
                y2="15"
                stroke="#0A0A0A"
                strokeWidth="2"
              />
              {/* Legs */}
              <line
                x1="25"
                y1="40"
                x2="15"
                y2="55"
                stroke="#0A0A0A"
                strokeWidth="2"
              />
              <line
                x1="35"
                y1="40"
                x2="45"
                y2="55"
                stroke="#0A0A0A"
                strokeWidth="2"
              />
            </g>
          </svg>
        </div>
      </div>

      {/* ═══ AMBIENT HALFTONE PARTICLES ═══ */}
      <div
        ref={particlesRef}
        className="absolute inset-0 pointer-events-none overflow-hidden"
        style={{ zIndex: 4 }}
      >
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={`particle-${i}`}
            className="particle"
            style={{
              width: `${2 + Math.random() * 4}px`,
              height: `${2 + Math.random() * 4}px`,
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              opacity: 0.1 + Math.random() * 0.2,
              ["--drift-x" as string]: `${-50 + Math.random() * 100}px`,
              ["--drift-y" as string]: `${-80 + Math.random() * 160}px`,
              animation: `float-particle ${8 + Math.random() * 12}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 8}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
