/* ══════════════════════════════════════════════════════════════════
   Shared two-bone IK leg rig for the procedurally-animated spiders in
   the Events section. The walking-body markup and the per-frame leg
   solve are identical whether a spider is wandering freely (see
   EventsHeadingSpider) or following a scripted path (see
   EventsCornerWeb) — only how its body's (x, y, heading) get produced
   each frame differs, so both draw from here instead of duplicating
   the rig.
   ══════════════════════════════════════════════════════════════════ */

const COXA = [
  { x: 3.4, y: -6.0 },
  { x: 4.2, y: -3.0 },
  { x: 4.2, y: 0.4 },
  { x: 3.6, y: 3.4 },
];
const FOOT_REST = [
  { x: 15, y: -19 },
  { x: 20, y: -7 },
  { x: 20, y: 6 },
  { x: 16, y: 18 },
];
const FEMUR = [12, 14, 14, 13];
const TIBIA = [12, 14, 14, 13];
const GAIT_PHASE = [
  [0, 1, 0, 1],
  [1, 0, 1, 0],
];

export const STEP_TRIGGER = 9;
export const STEP_TIME = 0.13;
export const LIFT = 5;

export type Foot = {
  x: number;
  y: number;
  swinging: boolean;
  t: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
};

export type Leg = {
  side: number;
  pair: number;
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

/** Body markup: legs (solved every frame), pedipalps, abdomen, eyes. */
export function spiderMarkup(): string {
  return `
    <svg width="120" height="120" viewBox="-45 -45 90 90"
         style="position:absolute;left:-60px;top:-60px;overflow:visible">
      <g class="sp-root">
        <g class="sp-legs" fill="none" stroke="#2b2b34"
           stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
          ${Array.from({ length: 8 }, () => `<polyline points="" />`).join("")}
        </g>
        <path class="sp-palp" d="M -2.6 -6.4 L -5.4 -11 M 2.6 -6.4 L 5.4 -11"
              stroke="#2b2b34" stroke-width="1.8" stroke-linecap="round" fill="none" />
        <ellipse class="sp-abdomen" cx="0" cy="6.6" rx="6.2" ry="8.4" fill="#191920" stroke="#33333d" stroke-width="0.6" />
        <ellipse cx="0" cy="6.2" rx="3.2" ry="5" fill="rgba(226,54,54,0.35)" />
        <ellipse cx="0" cy="-3.4" rx="4.4" ry="5.2" fill="#20202a" stroke="#3a3a45" stroke-width="0.5" />
        <circle cx="-1.7" cy="-7.2" r="0.85" fill="rgba(242,239,233,0.85)" />
        <circle cx="1.7" cy="-7.2" r="0.85" fill="rgba(242,239,233,0.85)" />
        <circle cx="-3.1" cy="-6.1" r="0.5" fill="rgba(242,239,233,0.55)" />
        <circle cx="3.1" cy="-6.1" r="0.5" fill="rgba(242,239,233,0.55)" />
      </g>
    </svg>`;
}

/**
 * Solves one frame of the walk cycle for every leg in place. `lvx`/`lvy`
 * is the body's velocity for this frame, already rotated into the body's
 * own local frame (so a spider facing sideways drags its feet backward
 * relative to where it's actually pointed, not relative to the screen).
 */
export function stepLegs(
  legs: Leg[],
  sway: number,
  lvx: number,
  lvy: number,
  dt: number,
  now: number
) {
  for (const leg of legs) {
    const f = leg.foot;
    const mirror = leg.side === 0 ? 1 : -1;
    const twitch =
      Math.sin(sway * 2.3 + leg.pair * 1.4 + leg.side * 2.1) * 1.9;
    const wantX = leg.restX + twitch * mirror;
    const wantY = leg.restY + twitch * 0.5;

    f.x -= lvx;
    f.y -= lvy;

    if (!f.swinging) {
      const stretch = Math.hypot(f.x - wantX, f.y - wantY);
      const groupTurn =
        Math.floor(now / (STEP_TIME * 1000 * 2)) % 2 === leg.phase;
      if (stretch > STEP_TRIGGER && groupTurn) {
        f.swinging = true;
        f.t = 0;
        f.fromX = f.x;
        f.fromY = f.y;
        f.toX = wantX + (wantX - f.x) * 0.18;
        f.toY = wantY + (wantY - f.y) * 0.18;
      }
    }

    if (f.swinging) {
      f.t += dt / STEP_TIME;
      const t = clamp(f.t, 0, 1);
      const e = t * t * (3 - 2 * t);
      f.x = f.fromX + (f.toX - f.fromX) * e;
      f.y = f.fromY + (f.toY - f.fromY) * e;
      const lift = Math.sin(t * Math.PI) * LIFT;
      f.x += (leg.side === 0 ? 1 : -1) * lift * 0.25;
      f.y -= lift * 0.5;
      if (t >= 1) f.swinging = false;
    }

    const bend = leg.side === 0 ? -1 : 1;
    const k = knee(leg.coxaX, leg.coxaY, f.x, f.y, leg.femur, leg.tibia, bend);
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
 * Rotates a world-space velocity into a body's local frame given its
 * facing angle in degrees (0 = facing up / -Y, matching spiderMarkup's
 * rest pose). Shared so every spider derives leg-drag the same way.
 */
export function toLocalVelocity(vx: number, vy: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return { lvx: vx * cos + vy * sin, lvy: -vx * sin + vy * cos };
}

/** Facing angle (degrees, 0 = up) that points along (dx, dy). */
export function headingAngle(dx: number, dy: number) {
  return (Math.atan2(dy, dx) * 180) / Math.PI + 90;
}
