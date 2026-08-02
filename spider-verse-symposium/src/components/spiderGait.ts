/* ══════════════════════════════════════════════════════════════════
   PROCEDURAL SPIDER — skeleton, two-bone IK, and the walk cycle.

   Extracted from HeroSpiders so the countdown crawler can reuse the
   exact same creature rather than growing a second, subtly-different
   one. HeroSpiders owns the *behaviour* (drop on silk, dangle, climb);
   CountdownSpiders owns a different one (wander the panels). Both share
   everything below the neck.

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

export type Foot = {
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

export type Leg = {
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

export function makeLegs(): Leg[] {
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

export const clamp = (v: number, a: number, b: number) =>
  Math.max(a, Math.min(b, v));

/**
 * Two-bone IK. Returns the knee position for a chain rooted at (ax, ay)
 * reaching (tx, ty). `bend` flips which way the joint folds so the knees
 * break outward, away from the body, like a real spider's.
 */
export function knee(
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

export type GaitInput = {
  dt: number;
  /** A monotonic clock in ms (performance.now) — sequences the tetrapod. */
  now: number;
  /** Body movement since the last frame, in BODY-LOCAL axes (not page axes). */
  vx: number;
  vy: number;
  /**
   * Body rotation since the last frame, in radians. Planted feet are stored
   * in body-local space, so when the body turns under them they have to
   * counter-rotate — otherwise the whole stance swings around with the body
   * and the spider pirouettes on the spot instead of pivoting over its feet.
   * Zero for anything that never changes heading (the hero's hangers).
   */
  dTheta?: number;
  /** true = hanging on silk (legs curl in), false = walking a surface. */
  hanging: boolean;
  /** Drives the idle twitch — any smoothly increasing number. */
  phase: number;
};

/**
 * Advances every leg one frame and writes the resulting polyline points.
 * Mutates `legs` in place; the caller owns body position and rotation.
 */
export function solveLegs(legs: Leg[], input: GaitInput) {
  const { dt, now, vx, vy, hanging, phase } = input;
  const dTheta = input.dTheta ?? 0;
  const cosT = Math.cos(-dTheta);
  const sinT = Math.sin(-dTheta);

  for (const leg of legs) {
    const f = leg.foot;

    /* Hanging legs curl in toward the body and twitch; walking legs
       reach for their rest stance and re-plant when overstretched. */
    const mirror = leg.side === 0 ? 1 : -1;
    const curl = hanging ? 0.72 : 1;
    const twitch = Math.sin(phase * 2.3 + leg.pair * 1.4 + leg.side * 2.1) * 1.9;
    /* Twitch must be mirrored, otherwise a shared offset drags every
       leg the same way and the stance goes lopsided. */
    const wantX = leg.restX * curl + twitch * mirror;
    const wantY = leg.restY * curl + twitch * 0.5;

    /* Feet live in body-local space, so body movement drags them. Rotation
       first, then translation — the same order the body's own transform
       applies them. */
    if (dTheta) {
      const rx = f.x * cosT - f.y * sinT;
      const ry = f.x * sinT + f.y * cosT;
      f.x = rx;
      f.y = ry;
    }
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
    const k = knee(leg.coxaX, leg.coxaY, f.x, f.y, leg.femur, leg.tibia, bend);
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

/**
 * The body markup. Returned as a string because both callers build their
 * spiders imperatively (they're spawned into a host div and driven by raf,
 * never re-rendered by React) — `innerHTML` once at setup is cheaper and
 * simpler than a component that would only ever mount.
 *
 * `accent` tints the abdomen marking and the leg highlight, so a crawler
 * can be keyed to whatever section it's walking across. `legStroke` exists
 * because the default near-black legs read fine over the hero's video but
 * vanish on a flat ink-black section.
 */
export function spiderMarkup({
  accent = "226,54,54",
  legStroke = "#2b2b34",
}: { accent?: string; legStroke?: string } = {}) {
  return `
    <svg width="120" height="120" viewBox="-45 -45 90 90"
         style="position:absolute;left:-60px;top:-60px;overflow:visible">
      <g class="sp-root">
        <g class="sp-legs" fill="none" stroke="${legStroke}"
           stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
          ${Array.from({ length: 8 }, () => `<polyline points="" />`).join("")}
        </g>
        <g class="sp-legs-hi" fill="none" stroke="rgba(${accent},0.55)"
           stroke-width="0.7" stroke-linecap="round" stroke-linejoin="round"></g>
        <!-- pedipalps -->
        <path class="sp-palp" d="M -2.6 -6.4 L -5.4 -11 M 2.6 -6.4 L 5.4 -11"
              stroke="${legStroke}" stroke-width="1.8" stroke-linecap="round" fill="none" />
        <!-- abdomen, cephalothorax, eyes -->
        <ellipse class="sp-abdomen" cx="0" cy="6.6" rx="6.2" ry="8.4" fill="#191920" stroke="#33333d" stroke-width="0.6" />
        <ellipse cx="0" cy="6.2" rx="3.2" ry="5" fill="rgba(${accent},0.35)" />
        <ellipse cx="0" cy="-3.4" rx="4.4" ry="5.2" fill="#20202a" stroke="#3a3a45" stroke-width="0.5" />
        <circle cx="-1.7" cy="-7.2" r="0.85" fill="rgba(242,239,233,0.85)" />
        <circle cx="1.7" cy="-7.2" r="0.85" fill="rgba(242,239,233,0.85)" />
        <circle cx="-3.1" cy="-6.1" r="0.5" fill="rgba(242,239,233,0.55)" />
        <circle cx="3.1" cy="-6.1" r="0.5" fill="rgba(242,239,233,0.55)" />
      </g>
    </svg>`;
}
