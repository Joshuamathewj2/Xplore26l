"use client";

import { useEffect, useRef } from "react";
import { makeLegs, solveLegs, spiderMarkup, type Leg } from "./spiderGait";

/* ══════════════════════════════════════════════════════════════════
   Procedurally animated spiders for the hero.

   The creature itself — skeleton, two-bone IK legs, tetrapod gait —
   lives in spiderGait.ts, shared with the countdown crawler. What is
   local to this file is the BEHAVIOUR: drop in on a silk thread,
   dangle, climb back out, re-anchor somewhere new.
   ══════════════════════════════════════════════════════════════════ */

type Mode = "descend" | "dangle" | "ascend" | "idle";

type SpiderCfg = {
  /* Fraction of the hero width the thread hangs from. */
  anchor: number;
  /* Max drop, as a fraction of hero height. */
  depth: number;
  scale: number;
  /* Seconds to wait before the first drop. */
  delay: number;
};

const HANGERS: SpiderCfg[] = [
  { anchor: 0.13, depth: 0.42, scale: 1, delay: 1.2 },
  { anchor: 0.86, depth: 0.3, scale: 0.78, delay: 5.4 },
  { anchor: 0.62, depth: 0.2, scale: 0.6, delay: 10.5 },
];

export default function HeroSpiders({ active = true }: { active?: boolean }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    type Unit = {
      cfg: SpiderCfg;
      wrap: HTMLDivElement;
      thread: HTMLDivElement;
      svgGroup: SVGGElement;
      abdomen: SVGEllipseElement;
      legs: Leg[];
      mode: Mode;
      timer: number;
      drop: number; // current descent in px
      targetDrop: number;
      sway: number;
      /* Previous body position in page space, to derive motion for the gait. */
      prevX: number;
      prevY: number;
    };

    const units: Unit[] = [];

    for (let i = 0; i < HANGERS.length; i++) {
      const cfg = HANGERS[i];

      const thread = document.createElement("div");
      Object.assign(thread.style, {
        position: "absolute",
        top: "0px",
        width: "1px",
        height: "0px",
        background:
          "linear-gradient(to bottom, rgba(242,239,233,0), rgba(242,239,233,0.5))",
        transformOrigin: "top center",
        pointerEvents: "none",
      } as CSSStyleDeclaration);
      host.appendChild(thread);

      const wrap = document.createElement("div");
      Object.assign(wrap.style, {
        position: "absolute",
        top: "0px",
        left: "0px",
        width: "0px",
        height: "0px",
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

      units.push({
        cfg,
        wrap,
        thread,
        svgGroup,
        abdomen: wrap.querySelector(".sp-abdomen") as SVGEllipseElement,
        legs,
        mode: "idle",
        timer: cfg.delay,
        drop: 0,
        targetDrop: 0,
        sway: Math.random() * Math.PI * 2,
        prevX: 0,
        prevY: 0,
      });
    }

    let last = performance.now();

    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      const W = host.clientWidth;
      const H = host.clientHeight;

      for (const u of units) {
        u.timer -= dt;

        /* ── Behaviour: real spiders move in bursts, then freeze. The idle
              holds between drops are as important to realism as the motion. */
        if (u.timer <= 0) {
          if (u.mode === "idle") {
            u.mode = "descend";
            u.targetDrop = H * u.cfg.depth * (0.75 + Math.random() * 0.5);
            u.timer = 999;
          } else if (u.mode === "dangle") {
            u.mode = "ascend";
            u.timer = 999;
          }
        }

        if (u.mode === "descend") {
          /* Accelerating pay-out, easing as it nears the end of the silk. */
          const remaining = u.targetDrop - u.drop;
          u.drop += Math.min(remaining, 60 + remaining * 2.2) * dt;
          if (remaining < 1) {
            u.drop = u.targetDrop;
            u.mode = "dangle";
            u.timer = 2.2 + Math.random() * 3.2;
          }
        } else if (u.mode === "ascend") {
          u.drop -= (28 + u.drop * 1.4) * dt;
          if (u.drop <= 0) {
            u.drop = 0;
            u.mode = "idle";
            u.timer = 4 + Math.random() * 7;
            /* Re-anchor somewhere new for the next drop. */
            u.cfg.anchor = 0.08 + Math.random() * 0.84;
          }
        }

        /* Pendulum sway — faster and wider the longer the thread. */
        u.sway += dt * (1.1 + u.drop / 900);
        const swayAmp = Math.min(u.drop * 0.05, 16);
        const swayX = Math.sin(u.sway) * swayAmp;
        const tilt = Math.cos(u.sway) * Math.min(u.drop * 0.02, 7);

        const ax = u.cfg.anchor * W;
        const bx = ax + swayX;
        const by = u.drop;

        /* Thread follows the anchor down to the body. */
        const len = Math.max(0, Math.hypot(bx - ax, by));
        const ang = (Math.atan2(bx - ax, by) * 180) / Math.PI;
        u.thread.style.left = `${ax}px`;
        u.thread.style.height = `${len}px`;
        u.thread.style.transform = `rotate(${-ang}deg)`;
        u.thread.style.opacity = u.drop > 2 ? "1" : "0";

        u.wrap.style.transform = `translate(${bx}px, ${by}px)`;
        u.wrap.style.opacity = u.drop > 1 ? "1" : "0";
        u.svgGroup.setAttribute(
          "transform",
          `rotate(${tilt}) scale(${u.cfg.scale})`
        );

        /* Abdomen lags the body a touch — soft-body follow-through. */
        u.abdomen.setAttribute("cy", String(6.6 + Math.sin(u.sway) * 0.5));

        /* Body motion in its own local frame, used to drive the gait. */
        const vx = bx - u.prevX;
        const vy = by - u.prevY;
        u.prevX = bx;
        u.prevY = by;

        /* These hangers never change heading — they always face down the
           thread — so there is no rotation for the feet to compensate for. */
        solveLegs(u.legs, {
          dt,
          now,
          vx,
          vy,
          hanging: u.mode !== "idle",
          phase: u.sway,
        });
      }

      rafRef.current = requestAnimationFrame(frame);
    };

    rafRef.current = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafRef.current);
      units.forEach((u) => {
        u.wrap.remove();
        u.thread.remove();
      });
    };
  }, []);

  return (
    <div
      ref={hostRef}
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 24,
        pointerEvents: "none",
        overflow: "hidden",
        opacity: active ? 1 : 0,
        transition: "opacity 0.6s ease",
      }}
    />
  );
}
