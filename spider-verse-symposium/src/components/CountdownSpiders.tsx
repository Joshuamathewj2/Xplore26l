"use client";

import { useEffect, useRef } from "react";
import { makeLegs, solveLegs, spiderMarkup, clamp, type Leg } from "./spiderGait";

/* ══════════════════════════════════════════════════════════════════
   Spiders that crawl the countdown.

   Same creature as the hero's hangers (see spiderGait.ts) with a
   different brain. These ones WALK: they pick a spot somewhere on the
   timer — usually a point on the rim of one of the four panels — turn
   toward it, cross to it, freeze for a beat, then pick another. Every
   choice is random, so no two visits produce the same route.

   Panel positions are measured from the DOM rather than hard-coded, so
   the walk survives the strip rewrapping to 2x2 on a phone, the digits
   changing width, or the panels being restyled later. Elements opt in
   by carrying `data-spider-surface`.

   The one piece of real machinery beyond the hero's version is heading:
   these spiders turn, and a turning body drags its planted feet around
   with it unless the feet counter-rotate. `solveLegs` takes `dTheta`
   for exactly that — it's what makes the spider pivot OVER its stance
   instead of spinning on the spot.
   ══════════════════════════════════════════════════════════════════ */

type Mode = "walk" | "pause" | "rappel" | "dangle" | "climb";

type Spider = {
  wrap: HTMLDivElement;
  thread: HTMLDivElement;
  root: SVGGElement;
  abdomen: SVGEllipseElement;
  legs: Leg[];
  scale: number;

  x: number;
  y: number;
  /** Heading in radians — 0 points the body's nose straight up the page. */
  theta: number;
  speed: number;
  topSpeed: number;

  mode: Mode;
  timer: number;
  targetX: number;
  targetY: number;

  /** Where the silk is pinned, and how far down it has paid out. */
  anchorX: number;
  anchorY: number;
  drop: number;
  dropTarget: number;

  sway: number;
};

const SPIDER_COUNT = 3;
const TURN_RATE = 3.4; // rad/s — how fast it can swing its nose around
const ACCEL = 190; // px/s^2
const ARRIVE = 9; // px — close enough to call it arrived

const rand = (a: number, b: number) => a + Math.random() * (b - a);

export default function CountdownSpiders({ active = true }: { active?: boolean }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    /* ── Surfaces ──
       Panel rectangles in host-local pixels. Re-measured on resize because
       the strip reflows; a stale rect would send spiders walking to where a
       panel used to be. */
    type Rect = { x: number; y: number; w: number; h: number };
    let surfaces: Rect[] = [];

    const measure = () => {
      const hostBox = host.getBoundingClientRect();
      surfaces = Array.from(
        host.parentElement?.querySelectorAll<HTMLElement>(
          "[data-spider-surface]"
        ) ?? []
      ).map((el) => {
        const r = el.getBoundingClientRect();
        return {
          x: r.left - hostBox.left,
          y: r.top - hostBox.top,
          w: r.width,
          h: r.height,
        };
      });
    };
    measure();

    /* A destination: usually a point ON the outline of a panel, because a
       spider tracing the rim of a box reads as deliberate in a way that
       wandering open space does not. The rest of the time it's anywhere in
       the section, which keeps the routes from looking like a circuit. */
    const pickTarget = () => {
      const W = host.clientWidth;
      const H = host.clientHeight;

      if (surfaces.length && Math.random() < 0.78) {
        const r = surfaces[(Math.random() * surfaces.length) | 0];
        const edge = (Math.random() * 4) | 0;
        const t = Math.random();
        /* Sit slightly proud of the border so the body straddles the edge
           rather than hiding its legs inside the panel. */
        const off = 3;
        if (edge === 0) return { x: r.x + r.w * t, y: r.y - off };
        if (edge === 1) return { x: r.x + r.w + off, y: r.y + r.h * t };
        if (edge === 2) return { x: r.x + r.w * t, y: r.y + r.h + off };
        return { x: r.x - off, y: r.y + r.h * t };
      }

      return { x: rand(24, W - 24), y: rand(24, H - 24) };
    };

    const spiders: Spider[] = [];

    for (let i = 0; i < SPIDER_COUNT; i++) {
      const thread = document.createElement("div");
      Object.assign(thread.style, {
        position: "absolute",
        top: "0px",
        left: "0px",
        width: "1px",
        height: "0px",
        background:
          "linear-gradient(to bottom, rgba(242,239,233,0), rgba(242,239,233,0.45))",
        transformOrigin: "top center",
        opacity: "0",
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
      /* Lighter legs than the hero's: those sit over a video, these over
         flat black, where near-black legs disappear entirely. */
      wrap.innerHTML = spiderMarkup({ accent: "226,54,54", legStroke: "#5a5a6b" });
      host.appendChild(wrap);

      const polys = Array.from(
        wrap.querySelectorAll(".sp-legs polyline")
      ) as SVGPolylineElement[];
      const legs = makeLegs();
      legs.forEach((l, k) => (l.el = polys[k]));

      const s: Spider = {
        wrap,
        thread,
        root: wrap.querySelector(".sp-root") as SVGGElement,
        abdomen: wrap.querySelector(".sp-abdomen") as SVGEllipseElement,
        legs,
        scale: rand(0.5, 0.82),
        x: rand(40, Math.max(80, host.clientWidth - 40)),
        y: rand(30, Math.max(60, host.clientHeight - 30)),
        theta: rand(0, Math.PI * 2),
        speed: 0,
        topSpeed: rand(46, 96),
        mode: "pause",
        /* Staggered so they don't all set off on the same frame. */
        timer: rand(0.2, 2.6) + i * 0.5,
        targetX: 0,
        targetY: 0,
        anchorX: 0,
        anchorY: 0,
        drop: 0,
        dropTarget: 0,
        sway: Math.random() * Math.PI * 2,
      };
      s.targetX = s.x;
      s.targetY = s.y;
      spiders.push(s);
    }

    /* Only burn frames while the section is actually on screen. */
    let visible = false;
    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
      },
      { rootMargin: "120px 0px" }
    );
    io.observe(host);

    let last = performance.now();
    let lastMeasure = last;

    const frame = (now: number) => {
      rafRef.current = requestAnimationFrame(frame);

      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      if (!visible) return;

      /* Re-measured on a slow poll rather than a resize listener, because
         the strip also reflows for reasons no resize event reports — the
         panels rewrapping, or being swapped out for the LIVE card at T-0.
         Done at the TOP of the frame, before any transforms are written,
         so these reads hit a layout the browser has already computed
         instead of forcing a fresh one. */
      if (now - lastMeasure > 2000) {
        measure();
        lastMeasure = now;
      }

      const W = host.clientWidth;
      const H = host.clientHeight;

      for (const s of spiders) {
        s.timer -= dt;
        s.sway += dt * 1.35;

        const prevX = s.x;
        const prevY = s.y;
        const prevTheta = s.theta;

        switch (s.mode) {
          case "pause": {
            s.speed = Math.max(0, s.speed - ACCEL * 1.6 * dt);
            if (s.timer <= 0) {
              /* Now and then it doesn't walk off — it steps off the edge and
                 lowers itself on silk instead. */
              if (Math.random() < 0.14) {
                s.mode = "rappel";
                s.anchorX = s.x;
                s.anchorY = s.y;
                s.drop = 0;
                s.dropTarget = rand(38, Math.min(150, Math.max(60, H - s.y - 20)));
              } else {
                const t = pickTarget();
                s.targetX = t.x;
                s.targetY = t.y;
                s.mode = "walk";
              }
            }
            break;
          }

          case "walk": {
            const dx = s.targetX - s.x;
            const dy = s.targetY - s.y;
            const dist = Math.hypot(dx, dy);

            if (dist < ARRIVE) {
              s.mode = "pause";
              s.timer = rand(0.5, 3.4);
              break;
            }

            /* Turn toward the target at a limited rate, so the body arcs
               into the new direction and the legs have time to re-plant.
               The body's nose is local -Y, hence atan2(ux, -uy). */
            const want = Math.atan2(dx / dist, -dy / dist);
            let diff = want - s.theta;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            const step = clamp(diff, -TURN_RATE * dt, TURN_RATE * dt);
            s.theta += step;

            /* Ease off on the approach, and don't sprint sideways while
               still swinging around — it walks where it's looking. */
            const facing = Math.max(0, 1 - Math.abs(diff) / 1.5);
            const arriving = Math.min(1, dist / 70);
            const goal = s.topSpeed * facing * arriving;
            s.speed += clamp(goal - s.speed, -ACCEL * dt, ACCEL * dt);

            s.x += Math.sin(s.theta) * s.speed * dt;
            s.y += -Math.cos(s.theta) * s.speed * dt;

            /* Never leave the section; a wall just ends the trip early. */
            const cx = clamp(s.x, 14, Math.max(15, W - 14));
            const cy = clamp(s.y, 14, Math.max(15, H - 14));
            if (cx !== s.x || cy !== s.y) {
              s.x = cx;
              s.y = cy;
              s.mode = "pause";
              s.timer = rand(0.3, 1.2);
            }
            break;
          }

          case "rappel": {
            s.speed = 0;
            const remaining = s.dropTarget - s.drop;
            s.drop += Math.min(remaining, 46 + remaining * 2.1) * dt;
            if (remaining < 1) {
              s.drop = s.dropTarget;
              s.mode = "dangle";
              s.timer = rand(1.6, 4);
            }
            break;
          }

          case "dangle": {
            if (s.timer <= 0) s.mode = "climb";
            break;
          }

          case "climb": {
            s.drop -= (26 + s.drop * 1.3) * dt;
            if (s.drop <= 0) {
              s.drop = 0;
              s.mode = "pause";
              s.timer = rand(0.4, 2.2);
            }
            break;
          }
        }

        const onSilk =
          s.mode === "rappel" || s.mode === "dangle" || s.mode === "climb";

        /* ── Silk ── */
        if (onSilk) {
          const swayX = Math.sin(s.sway) * Math.min(s.drop * 0.06, 12);
          s.x = s.anchorX + swayX;
          s.y = s.anchorY + s.drop;
          /* Hanging, it faces straight down the thread and rolls with it. */
          s.theta = Math.PI + Math.cos(s.sway) * 0.16;

          const len = Math.hypot(s.x - s.anchorX, s.drop);
          const ang = (Math.atan2(s.x - s.anchorX, s.drop) * 180) / Math.PI;
          s.thread.style.left = `${s.anchorX}px`;
          s.thread.style.top = `${s.anchorY}px`;
          s.thread.style.height = `${len}px`;
          s.thread.style.transform = `rotate(${-ang}deg)`;
          s.thread.style.opacity = s.drop > 2 ? "1" : "0";
        } else if (s.thread.style.opacity !== "0") {
          s.thread.style.opacity = "0";
        }

        s.wrap.style.transform = `translate(${s.x.toFixed(2)}px, ${s.y.toFixed(2)}px)`;
        s.root.setAttribute(
          "transform",
          `rotate(${((s.theta * 180) / Math.PI).toFixed(2)}) scale(${s.scale})`
        );
        /* Abdomen lags the body a touch — soft-body follow-through. */
        s.abdomen.setAttribute("cy", String(6.6 + Math.sin(s.sway) * 0.5));

        /* World movement has to be expressed in the body's own axes before
           the feet see it, or a spider walking east would drag its stance
           east no matter which way it was pointing. */
        const wdx = s.x - prevX;
        const wdy = s.y - prevY;
        const c = Math.cos(s.theta);
        const sn = Math.sin(s.theta);
        const localX = (wdx * c + wdy * sn) / s.scale;
        const localY = (-wdx * sn + wdy * c) / s.scale;

        let dTheta = s.theta - prevTheta;
        while (dTheta > Math.PI) dTheta -= Math.PI * 2;
        while (dTheta < -Math.PI) dTheta += Math.PI * 2;

        solveLegs(s.legs, {
          dt,
          now,
          vx: localX,
          vy: localY,
          dTheta,
          hanging: onSilk,
          phase: s.sway,
        });
      }
    };

    rafRef.current = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafRef.current);
      io.disconnect();
      spiders.forEach((s) => {
        s.wrap.remove();
        s.thread.remove();
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
        zIndex: 6,
        pointerEvents: "none",
        overflow: "hidden",
        opacity: active ? 1 : 0,
        transition: "opacity 0.8s ease",
      }}
    />
  );
}
