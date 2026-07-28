"use client";

import { useEffect, useRef } from "react";
import {
  type Leg,
  headingAngle,
  makeLegs,
  spiderMarkup,
  stepLegs,
  toLocalVelocity,
} from "./spiderRig";

/* ══════════════════════════════════════════════════════════════════
   A spider that spins an orb web anchored in the section's top-right
   corner, then re-spins it on a loop: lay each spoke (walking out from
   the hub and back for every one), spiral out from the hub laying the
   capture thread, walk back to the hub and hold, then let the whole
   web fade and start over — same beat as the sway/print/glint idle
   loops already used across this section, just longer and scripted
   rather than a CSS keyframe, since the path itself has to be walked.

   Geometry lives in a fixed 0..REF reference square; the SVG's own
   viewBox does the visual scaling to whatever size the corner box
   renders at, and the spider (a plain HTML overlay, not part of the
   SVG) is scaled by the same ratio each frame so the two stay in sync.
   ══════════════════════════════════════════════════════════════════ */

const REF = 200;
const ANCHOR = { x: 184, y: 14 };
const N_SPOKES = 7;
const ANGLE_START = 100; // deg, screen convention: 0=+x, 90=+y (down)
const ANGLE_END = 225;
const RINGS = [0.32, 0.52, 0.72, 0.92];

const SPIDER_SCALE = 0.5;
const SPOKE_DRAW = 0.85;
const SPOKE_BACK = 0.42;
const SPIRAL_DRAW = 3.4;
const SPIRAL_RETURN = 0.9;
const HOLD = 6;
const RETRACT = 1.1;
const RESET_PAUSE = 0.7;

type Phase =
  | "spokeOut"
  | "spokeBack"
  | "spiralOut"
  | "spiralReturn"
  | "hold"
  | "retract"
  | "reset";

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeInOut = (t: number) => t * t * (3 - 2 * t);

export default function EventsCornerWeb() {
  const hostRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    /* ── Web geometry, in the fixed REF square ── */
    const spokeAngles: number[] = [];
    const spokeTips: { x: number; y: number }[] = [];
    for (let i = 0; i < N_SPOKES; i++) {
      const deg =
        ANGLE_START + ((ANGLE_END - ANGLE_START) * i) / (N_SPOKES - 1);
      const rad = (deg * Math.PI) / 180;
      const r = 130 + Math.random() * 46;
      spokeAngles.push(deg);
      spokeTips.push({
        x: ANCHOR.x + Math.cos(rad) * r,
        y: ANCHOR.y + Math.sin(rad) * r,
      });
    }

    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    svg.setAttribute("viewBox", `0 0 ${REF} ${REF}`);
    svg.style.position = "absolute";
    svg.style.inset = "0";
    svg.style.overflow = "visible";
    host.appendChild(svg);

    const webGroup = document.createElementNS(svgNS, "g");
    svg.appendChild(webGroup);

    const spokePaths: SVGPathElement[] = spokeTips.map((tip) => {
      const p = document.createElementNS(svgNS, "path");
      p.setAttribute(
        "d",
        `M ${ANCHOR.x} ${ANCHOR.y} L ${tip.x.toFixed(2)} ${tip.y.toFixed(2)}`
      );
      p.setAttribute("fill", "none");
      p.setAttribute("stroke", "rgba(242,239,233,0.55)");
      p.setAttribute("stroke-width", "1");
      p.setAttribute("stroke-linecap", "round");
      webGroup.appendChild(p);
      return p;
    });

    /* Boustrophedon spiral: each ring alternates direction, so the ring
       above starts where the last one ended instead of jumping clean
       across the hub. */
    const spiralPts: { x: number; y: number }[] = [];
    RINGS.forEach((frac, ri) => {
      const order =
        ri % 2 === 0
          ? spokeTips.map((_, i) => i)
          : spokeTips.map((_, i) => i).reverse();
      for (const i of order) {
        spiralPts.push({
          x: ANCHOR.x + (spokeTips[i].x - ANCHOR.x) * frac,
          y: ANCHOR.y + (spokeTips[i].y - ANCHOR.y) * frac,
        });
      }
    });
    const spiralPath = document.createElementNS(svgNS, "path");
    spiralPath.setAttribute(
      "d",
      spiralPts
        .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
        .join(" ")
    );
    spiralPath.setAttribute("fill", "none");
    spiralPath.setAttribute("stroke", "rgba(242,239,233,0.4)");
    spiralPath.setAttribute("stroke-width", "0.7");
    spiralPath.setAttribute("stroke-linecap", "round");
    webGroup.appendChild(spiralPath);

    const spokeLens = spokePaths.map((p) => p.getTotalLength());
    spokePaths.forEach((p, i) => {
      p.style.strokeDasharray = String(spokeLens[i]);
      p.style.strokeDashoffset = String(spokeLens[i]);
    });
    const spiralLen = spiralPath.getTotalLength();
    spiralPath.style.strokeDasharray = String(spiralLen);
    spiralPath.style.strokeDashoffset = String(spiralLen);

    /* ── Spider ── */
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
    const legs: Leg[] = makeLegs();
    legs.forEach((l, k) => (l.el = polys[k]));

    let last = performance.now();
    let phase: Phase = "spokeOut";
    let spokeIndex = 0;
    let t = 0;
    let pos = { x: ANCHOR.x, y: ANCHOR.y };
    let angle = 180;
    let prevX = pos.x;
    let prevY = pos.y;
    let sway = Math.random() * Math.PI * 2;
    let returnFrom = { x: ANCHOR.x, y: ANCHOR.y };

    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      const scale = host.clientWidth > 0 ? host.clientWidth / REF : 0;

      switch (phase) {
        case "spokeOut": {
          t = Math.min(1, t + dt / SPOKE_DRAW);
          const len = spokeLens[spokeIndex];
          spokePaths[spokeIndex].style.strokeDashoffset = String(len * (1 - t));
          const p = spokePaths[spokeIndex].getPointAtLength(len * t);
          pos = { x: p.x, y: p.y };
          angle = spokeAngles[spokeIndex] - 90;
          if (t >= 1) {
            phase = "spokeBack";
            t = 0;
          }
          break;
        }
        case "spokeBack": {
          t = Math.min(1, t + dt / SPOKE_BACK);
          const len = spokeLens[spokeIndex];
          const p = spokePaths[spokeIndex].getPointAtLength(len * (1 - t));
          pos = { x: p.x, y: p.y };
          angle = spokeAngles[spokeIndex] + 90;
          if (t >= 1) {
            spokeIndex++;
            t = 0;
            phase = spokeIndex >= N_SPOKES ? "spiralOut" : "spokeOut";
          }
          break;
        }
        case "spiralOut": {
          t = Math.min(1, t + dt / SPIRAL_DRAW);
          const drawn = spiralLen * t;
          spiralPath.style.strokeDashoffset = String(spiralLen - drawn);
          const p = spiralPath.getPointAtLength(drawn);
          const behind = spiralPath.getPointAtLength(Math.max(0, drawn - 1.2));
          angle = headingAngle(p.x - behind.x, p.y - behind.y);
          pos = { x: p.x, y: p.y };
          if (t >= 1) {
            returnFrom = { ...pos };
            phase = "spiralReturn";
            t = 0;
          }
          break;
        }
        case "spiralReturn": {
          t = Math.min(1, t + dt / SPIRAL_RETURN);
          const e = easeInOut(t);
          pos = {
            x: lerp(returnFrom.x, ANCHOR.x, e),
            y: lerp(returnFrom.y, ANCHOR.y, e),
          };
          angle = headingAngle(ANCHOR.x - returnFrom.x, ANCHOR.y - returnFrom.y);
          if (t >= 1) {
            phase = "hold";
            t = 0;
          }
          break;
        }
        case "hold": {
          t += dt;
          pos = { x: ANCHOR.x, y: ANCHOR.y };
          if (t >= HOLD) {
            phase = "retract";
            t = 0;
          }
          break;
        }
        case "retract": {
          t = Math.min(1, t + dt / RETRACT);
          host.style.opacity = String(1 - t);
          if (t >= 1) {
            phase = "reset";
            t = 0;
          }
          break;
        }
        case "reset": {
          t += dt;
          if (t >= RESET_PAUSE) {
            spokePaths.forEach((p, i) => {
              p.style.strokeDashoffset = String(spokeLens[i]);
            });
            spiralPath.style.strokeDashoffset = String(spiralLen);
            spokeIndex = 0;
            pos = { x: ANCHOR.x, y: ANCHOR.y };
            host.style.opacity = "1";
            phase = "spokeOut";
            t = 0;
          }
          break;
        }
      }

      sway += dt * 1.6;

      wrap.style.transform = `translate(${pos.x * scale}px, ${pos.y * scale}px)`;
      svgGroup.setAttribute(
        "transform",
        `rotate(${angle}) scale(${SPIDER_SCALE * scale})`
      );

      const vx = (pos.x - prevX) * scale;
      const vy = (pos.y - prevY) * scale;
      prevX = pos.x;
      prevY = pos.y;
      const { lvx, lvy } = toLocalVelocity(vx, vy, angle);
      stepLegs(legs, sway, lvx, lvy, dt, now);

      rafRef.current = requestAnimationFrame(frame);
    };

    rafRef.current = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafRef.current);
      svg.remove();
      wrap.remove();
    };
  }, []);

  return (
    <div
      ref={hostRef}
      aria-hidden="true"
      style={{
        position: "absolute",
        top: 0,
        right: 0,
        width: "clamp(120px, 20vw, 190px)",
        aspectRatio: "1 / 1",
        zIndex: 6,
        pointerEvents: "none",
      }}
    />
  );
}
