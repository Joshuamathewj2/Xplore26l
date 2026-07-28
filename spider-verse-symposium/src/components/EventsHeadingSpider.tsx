"use client";

import { useEffect, useRef } from "react";
import {
  type Leg,
  clamp,
  headingAngle,
  makeLegs,
  spiderMarkup,
  stepLegs,
  toLocalVelocity,
} from "./spiderRig";

/* ══════════════════════════════════════════════════════════════════
   A handful of spiders that wander the events heading artwork at
   random — each picks a point inside the panel, steers toward it with
   a capped turn rate (so the path curves instead of snapping), loiters,
   then picks another.
   ══════════════════════════════════════════════════════════════════ */

const TURN_RATE = 210; // deg/sec cap, so turns arc instead of snapping
const MARGIN = 30; // keep the body this far from the panel edge

/* Per-spider variety, so a group doesn't read as one shape cloned three
   times — sizes and pace differ a little, like a real brood would. */
const SPIDERS: { scale: number; speed: number; startDelay: number }[] = [
  { scale: 0.6, speed: 24, startDelay: 0 },
  { scale: 0.46, speed: 30, startDelay: 0.9 },
  { scale: 0.52, speed: 20, startDelay: 1.8 },
];

type Unit = {
  cfg: (typeof SPIDERS)[number];
  wrap: HTMLDivElement;
  svgGroup: SVGGElement;
  legs: Leg[];
  pos: { x: number; y: number };
  target: { x: number; y: number };
  angle: number; // degrees; 0 = facing up (-Y)
  mode: "wait" | "walk" | "pause";
  timer: number;
  prevX: number;
  prevY: number;
  sway: number;
};

export default function EventsHeadingSpider() {
  const hostRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const units: Unit[] = SPIDERS.map((cfg) => {
      const wrap = document.createElement("div");
      Object.assign(wrap.style, {
        position: "absolute",
        top: "0px",
        left: "0px",
        width: "0px",
        height: "0px",
        opacity: "0",
        pointerEvents: "none",
      } as CSSStyleDeclaration);
      wrap.innerHTML = spiderMarkup();
      host.appendChild(wrap);

      const svgGroup = wrap.querySelector(".sp-root") as SVGGElement;
      const polys = Array.from(
        wrap.querySelectorAll(".sp-legs polyline")
      ) as SVGPolylineElement[];
      const legs = makeLegs();
      legs.forEach((l, k) => (l.el = polys[k]));

      return {
        cfg,
        wrap,
        svgGroup,
        legs,
        pos: { x: 0, y: 0 },
        target: { x: 0, y: 0 },
        angle: Math.random() * 360,
        mode: "wait",
        timer: cfg.startDelay,
        prevX: 0,
        prevY: 0,
        sway: Math.random() * Math.PI * 2,
      };
    });

    const pickTarget = (w: number, h: number) => ({
      x: MARGIN + Math.random() * Math.max(1, w - MARGIN * 2),
      y: MARGIN + Math.random() * Math.max(1, h - MARGIN * 2),
    });

    let last = performance.now();

    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      const W = host.clientWidth;
      const H = host.clientHeight;
      if (W < 1 || H < 1) {
        rafRef.current = requestAnimationFrame(frame);
        return;
      }

      for (const u of units) {
        u.timer -= dt;

        if (u.mode === "wait" && u.timer <= 0) {
          u.pos = pickTarget(W, H);
          u.prevX = u.pos.x;
          u.prevY = u.pos.y;
          u.target = pickTarget(W, H);
          u.mode = "walk";
          u.wrap.style.opacity = "1";
        } else if (u.mode === "pause" && u.timer <= 0) {
          u.target = pickTarget(W, H);
          u.mode = "walk";
        }

        if (u.mode === "walk") {
          const dx = u.target.x - u.pos.x;
          const dy = u.target.y - u.pos.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 5) {
            u.mode = "pause";
            u.timer = 0.8 + Math.random() * 2.6;
          } else {
            const desired = headingAngle(dx, dy);
            let diff = ((desired - u.angle + 540) % 360) - 180;
            diff = clamp(diff, -TURN_RATE * dt, TURN_RATE * dt);
            u.angle += diff;

            const rad = (u.angle * Math.PI) / 180;
            const step = Math.min(u.cfg.speed * dt, dist);
            u.pos.x = clamp(
              u.pos.x + Math.sin(rad) * step,
              MARGIN * 0.4,
              W - MARGIN * 0.4
            );
            u.pos.y = clamp(
              u.pos.y - Math.cos(rad) * step,
              MARGIN * 0.4,
              H - MARGIN * 0.4
            );
          }
        }

        if (u.mode === "wait") continue;

        u.sway += dt * 1.6;

        u.wrap.style.transform = `translate(${u.pos.x}px, ${u.pos.y}px)`;
        u.svgGroup.setAttribute(
          "transform",
          `rotate(${u.angle}) scale(${u.cfg.scale})`
        );

        const vx = u.pos.x - u.prevX;
        const vy = u.pos.y - u.prevY;
        u.prevX = u.pos.x;
        u.prevY = u.pos.y;
        const { lvx, lvy } = toLocalVelocity(vx, vy, u.angle);

        stepLegs(u.legs, u.sway, lvx, lvy, dt, now);
      }

      rafRef.current = requestAnimationFrame(frame);
    };

    rafRef.current = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafRef.current);
      units.forEach((u) => u.wrap.remove());
    };
  }, []);

  return (
    <div
      ref={hostRef}
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
      }}
    />
  );
}
