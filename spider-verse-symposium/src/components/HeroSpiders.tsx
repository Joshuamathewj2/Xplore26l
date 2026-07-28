"use client";

import { useEffect, useRef } from "react";

/* ══════════════════════════════════════════════════════════════════
   Procedurally animated spiders for the hero.

   The legs are not a canned animation — each is a two-bone IK chain
   solved every frame toward a foot target. Feet stay planted while the
   body moves over them and only take a step once they are stretched
   past a threshold, which is what makes the walk read as real rather
   than as a sliding sprite. Steps are grouped into an alternating
   tetrapod (the gait actual spiders use): legs 1+3 on one side move
   with 2+4 on the other, then the opposite set.
   ══════════════════════════════════════════════════════════════════ */

/* Local SVG units. Body sits at the origin, facing -Y ("forward"). */
const COXA = [
  { x: 3.4, y: -6.0 },
  { x: 4.2, y: -3.0 },
  { x: 4.2, y: 0.4 },
  { x: 3.6, y: 3.4 },
];
/* Rest stance — where each foot wants to sit relative to the body. */
const FOOT_REST = [
  { x: 15, y: -19 },
  { x: 20, y: -7 },
  { x: 20, y: 6 },
  { x: 16, y: 18 },
];
const FEMUR = [12, 14, 14, 13];
const TIBIA = [12, 14, 14, 13];

/* Alternating tetrapod: 0 = first group to swing, 1 = second. Index is
   [side 0=right,1=left][pair 0..3]. */
const GAIT_PHASE = [
  [0, 1, 0, 1],
  [1, 0, 1, 0],
];

const STEP_TRIGGER = 9; // how far a foot may drift before it re-plants
const STEP_TIME = 0.13; // seconds a swing takes
const LIFT = 5; // how high a foot arcs mid-swing

type Foot = {
  /* Planted position, in body-local space at the time it was placed. */
  x: number;
  y: number;
  /* Swing bookkeeping */
  swinging: boolean;
  t: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
};

type Leg = {
  side: number; // 0 right, 1 left
  pair: number; // 0 front .. 3 back
  coxaX: number;
  coxaY: number;
  restX: number;
  restY: number;
  femur: number;
  tibia: number;
  phase: number;
  foot: Foot;
  el: SVGPolylineElement | null;
};

function makeLegs(): Leg[] {
  const legs: Leg[] = [];
  for (let side = 0; side < 2; side++) {
    const s = side === 0 ? 1 : -1;
    for (let pair = 0; pair < 4; pair++) {
      const restX = FOOT_REST[pair].x * s;
      const restY = FOOT_REST[pair].y;
      legs.push({
        side,
        pair,
        coxaX: COXA[pair].x * s,
        coxaY: COXA[pair].y,
        restX,
        restY,
        femur: FEMUR[pair],
        tibia: TIBIA[pair],
        phase: GAIT_PHASE[side][pair],
        foot: {
          x: restX,
          y: restY,
          swinging: false,
          t: 0,
          fromX: restX,
          fromY: restY,
          toX: restX,
          toY: restY,
        },
        el: null,
      });
    }
  }
  return legs;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/**
 * Two-bone IK. Returns the knee position for a chain rooted at (ax, ay)
 * reaching (tx, ty). `bend` flips which way the joint folds so the knees
 * break outward, away from the body, like a real spider's.
 */
function knee(
  ax: number,
  ay: number,
  tx: number,
  ty: number,
  l1: number,
  l2: number,
  bend: number
) {
  const dx = tx - ax;
  const dy = ty - ay;
  const d = clamp(Math.hypot(dx, dy), Math.abs(l1 - l2) + 0.01, l1 + l2 - 0.01);
  const base = Math.atan2(dy, dx);
  const cos = clamp((d * d + l1 * l1 - l2 * l2) / (2 * d * l1), -1, 1);
  const a = Math.acos(cos);
  const ang = base + bend * a;
  return { x: ax + Math.cos(ang) * l1, y: ay + Math.sin(ang) * l1 };
}

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
      wrap.innerHTML = `
        <svg width="120" height="120" viewBox="-45 -45 90 90"
             style="position:absolute;left:-60px;top:-60px;overflow:visible">
          <g class="sp-root">
            <g class="sp-legs" fill="none" stroke="#2b2b34"
               stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
              ${Array.from({ length: 8 }, () => `<polyline points="" />`).join("")}
            </g>
            <g class="sp-legs-hi" fill="none" stroke="rgba(226,54,54,0.55)"
               stroke-width="0.7" stroke-linecap="round" stroke-linejoin="round"></g>
            <!-- pedipalps -->
            <path class="sp-palp" d="M -2.6 -6.4 L -5.4 -11 M 2.6 -6.4 L 5.4 -11"
                  stroke="#2b2b34" stroke-width="1.8" stroke-linecap="round" fill="none" />
            <!-- abdomen, cephalothorax, eyes -->
            <ellipse class="sp-abdomen" cx="0" cy="6.6" rx="6.2" ry="8.4" fill="#191920" stroke="#33333d" stroke-width="0.6" />
            <ellipse cx="0" cy="6.2" rx="3.2" ry="5" fill="rgba(226,54,54,0.35)" />
            <ellipse cx="0" cy="-3.4" rx="4.4" ry="5.2" fill="#20202a" stroke="#3a3a45" stroke-width="0.5" />
            <circle cx="-1.7" cy="-7.2" r="0.85" fill="rgba(242,239,233,0.85)" />
            <circle cx="1.7" cy="-7.2" r="0.85" fill="rgba(242,239,233,0.85)" />
            <circle cx="-3.1" cy="-6.1" r="0.5" fill="rgba(242,239,233,0.55)" />
            <circle cx="3.1" cy="-6.1" r="0.5" fill="rgba(242,239,233,0.55)" />
          </g>
        </svg>`;
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

        const hanging = u.mode !== "idle";

        for (const leg of u.legs) {
          const f = leg.foot;

          /* Hanging legs curl in toward the body and twitch; walking legs
             reach for their rest stance and re-plant when overstretched. */
          const mirror = leg.side === 0 ? 1 : -1;
          const curl = hanging ? 0.72 : 1;
          const twitch =
            Math.sin(u.sway * 2.3 + leg.pair * 1.4 + leg.side * 2.1) * 1.9;
          /* Twitch must be mirrored, otherwise a shared offset drags every
             leg the same way and the stance goes lopsided. */
          const wantX = leg.restX * curl + twitch * mirror;
          const wantY = leg.restY * curl + twitch * 0.5;

          /* Feet live in body-local space, so body movement drags them. */
          f.x -= vx;
          f.y -= vy;

          if (!f.swinging) {
            const stretch = Math.hypot(f.x - wantX, f.y - wantY);
            const groupTurn =
              Math.floor(now / (STEP_TIME * 1000 * 2)) % 2 === leg.phase;
            if (stretch > STEP_TRIGGER && groupTurn) {
              f.swinging = true;
              f.t = 0;
              f.fromX = f.x;
              f.fromY = f.y;
              /* Overshoot slightly past rest so the next stance lasts. */
              f.toX = wantX + (wantX - f.x) * 0.18;
              f.toY = wantY + (wantY - f.y) * 0.18;
            }
          }

          if (f.swinging) {
            f.t += dt / STEP_TIME;
            const t = clamp(f.t, 0, 1);
            const e = t * t * (3 - 2 * t); // smoothstep
            f.x = f.fromX + (f.toX - f.fromX) * e;
            f.y = f.fromY + (f.toY - f.fromY) * e;
            /* Arc the foot up off the surface mid-swing. */
            const lift = Math.sin(t * Math.PI) * LIFT;
            f.x += (leg.side === 0 ? 1 : -1) * lift * 0.25;
            f.y -= lift * 0.5;
            if (t >= 1) f.swinging = false;
          }

          /* Ease the resting foot toward its target so hanging curls settle. */
          if (!f.swinging && hanging) {
            f.x += (wantX - f.x) * Math.min(1, dt * 6);
            f.y += (wantY - f.y) * Math.min(1, dt * 6);
          }

          const bend = leg.side === 0 ? -1 : 1;
          const k = knee(
            leg.coxaX,
            leg.coxaY,
            f.x,
            f.y,
            leg.femur,
            leg.tibia,
            bend
          );
          /* A short tarsus past the knee->foot line gives the leg its
             characteristic downward hook at the tip. */
          const tipX = f.x + (f.x - k.x) * 0.16;
          const tipY = f.y + (f.y - k.y) * 0.16;
          leg.el?.setAttribute(
            "points",
            `${leg.coxaX.toFixed(2)},${leg.coxaY.toFixed(2)} ` +
              `${k.x.toFixed(2)},${k.y.toFixed(2)} ` +
              `${f.x.toFixed(2)},${f.y.toFixed(2)} ` +
              `${tipX.toFixed(2)},${tipY.toFixed(2)}`
          );
        }
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
