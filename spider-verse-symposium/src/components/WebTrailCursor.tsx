"use client";

import { useEffect, useRef } from "react";

/* ══════════════════════════════════════════════════════════════════
   A thin silk-thread trail that follows the mouse — the spider motif
   carried into direct interaction instead of only background decoration.
   Fixed full-viewport canvas, pointer-events:none throughout so it never
   intercepts a click, mouse-only (no point drawing a "web trail" behind a
   touch that never hovers), and off under prefers-reduced-motion.
   ══════════════════════════════════════════════════════════════════ */

type Point = { x: number; y: number; age: number };

const MAX_AGE = 0.35; // seconds a segment survives before fading out
const MAX_POINTS = 26;

export default function WebTrailCursor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const points: Point[] = [];
    let lastX = -1;
    let lastY = -1;

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const dx = lastX < 0 ? 999 : e.clientX - lastX;
      const dy = lastY < 0 ? 999 : e.clientY - lastY;
      // Skip near-duplicate points so a still cursor doesn't pile up a dot.
      if (dx * dx + dy * dy < 9) return;
      lastX = e.clientX;
      lastY = e.clientY;
      points.push({ x: e.clientX, y: e.clientY, age: 0 });
      if (points.length > MAX_POINTS) points.shift();
    };
    window.addEventListener("pointermove", onMove);

    let last = performance.now();
    let raf = 0;

    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      for (const p of points) p.age += dt;
      while (points.length && points[0].age > MAX_AGE) points.shift();

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1];
        const b = points[i];
        const life = 1 - b.age / MAX_AGE;
        if (life <= 0) continue;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = `rgba(242,239,233,${0.32 * life})`;
        ctx.lineWidth = 1.4 * life + 0.2;
        ctx.lineCap = "round";
        ctx.stroke();
      }

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 9999,
      }}
    />
  );
}
