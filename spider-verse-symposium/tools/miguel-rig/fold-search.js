const ROOT = require("path").resolve(__dirname, "../..");
/* ════════════════════════════════════════════════════════════
   Search for a real CROSSED-ARMS fold — forearms stacked in an X across
   the front of the torso, each hand landing past the centreline, the way a
   person actually folds their arms.

   ── THE GEOMETRY THAT MAKES THIS HARD ────────────────────────
   forearm 0.2768  vs  shoulder half-span 0.2840.
   The forearm is SHORTER than the distance from the shoulder ball to the
   centreline. So with the elbows parked at the sides, the fingertips do not
   even reach the sternum, let alone cross it. The only way across is to
   bring the elbows forward and inboard, which is exactly what a person
   does when they fold their arms — the shoulders round and the elbows
   swing in front of the ribs.

   ── WHAT "CLEARS THE BODY" ACTUALLY MEANS ────────────────────
   An earlier pass required the forearm axis to sit ≥ 0.055 in front of the
   skin and concluded a crossed fold was impossible. That threshold was
   wrong. Folded forearms REST on the chest — the arm compresses it. What
   matters for the render is that the limb's axis is in front of the skin,
   so the near half of the arm draws over the torso instead of inside it.
   Axis clearance of +0.02 is contact; +0.13 is floating in mid-air. The
   real failure mode was the shipped pose at −0.145, a hand 15 cm deep in
   the abdomen.

   So: bottom forearm rests on the belly, top forearm rests on the bottom
   one, and the two are required to separate in depth where they cross.
   ════════════════════════════════════════════════════════════ */
const B = require("./body.js");
const { len, sub, norm, dot } = require("./rig.js");

const L1 = 0.2492, L2 = 0.2768, REACH = L1 + L2;
const SR = B.toChest(B.SHOULDER_R); // (-0.284, 0.5052, 0)
const SL = B.toChest(B.SHOULDER_L); // (+0.284, 0.5052, 0)
const clear = B.clearFront;

/* ── CLEARANCES, MEASURED OFF THE SKIN (tools: see the radius pass below) ──
   Every number here used to be asserted in a comment and then contradicted
   by the constant next to it: the old header derived "two stacked forearms
   are ~0.09 apart axis-to-axis" and then set STACK = 0.06. The shipped fold
   inherited exactly that error — the two forearm axes ended up 0.0695 apart
   and the arms visibly ate each other.

   These are now taken from the mesh. Vertices are assigned to their nearest
   bone segment and sampled across the middle 50% of each bone (so elbow and
   wrist bulges don't inflate the cylinder):

     upper arm   r ≈ 0.078 (p50)      forearm  r ≈ 0.051 (p50), 0.058 (p75)
     hand        half-thickness ≈ 0.055

   Two limbs whose AXES are 2r apart have their surfaces just touching, which
   is what contact looks like; anything less is interpenetration. Flesh does
   compress, so p50 rather than p90 is the honest bar — but 0.06 was never
   defensible under any percentile. */
const R_FORE = 0.051;      // forearm radius, measured
const R_UPPER = 0.078;     // upper arm radius, measured
const R_HAND = 0.055;      // hand half-thickness, measured

/* ── THE ONE PLACE THIS RIG FORCES A COMPROMISE ──
   You cannot have all three of: elbows dropped to a natural angle, the
   forearm a full radius clear of the chest, and the hand reaching the
   centreline. The elbow is pinned exactly L1 = 0.2492 from the shoulder
   ball, so dropping it to y 0.33 leaves only sqrt(0.2492² − 0.175²) = 0.1775
   of horizontal radius — the elbow ends up BEHIND the chest surface (c ≈
   0.22 at that height), and a forearm crossing the body from there starts
   buried. Angling the hand far enough forward to lift it clear needs 0.538
   of reach against the 0.526 the arm has. Not a search artefact; arithmetic.

   So the forearm is allowed to COMPRESS into the torso by ~40% of its
   radius at its single worst point. That is what a folded arm does to a
   chest, and at this depth the limb's silhouette still reads as lying on
   the body. The shipped pose sat at 0.015 — 70% of the radius buried, the
   arm visibly eaten — which is the artefact this whole pass exists to fix.
   The forearm-to-forearm gap below is NOT compromised: there is no torso in
   the way there, so interpenetration is simply a bug. */
const REST_AXIS = 0.030;         // forearm pressing INTO the chest, not through it
/* The two forearms, surface to surface, at the p75 radius rather than the
   p50 — this is the pose's headline defect and it deserves margin, not a
   bare pass. Not the p90 (0.063): that is the forearm's FATTEST section, up
   near the elbow and wrist bulges, and the two arms cross near their
   MIDDLES where neither is anywhere close to it. Demanding it anyway is
   affordable but it buys the margin by pushing the fold 2 cm higher up the
   chest each time, and at p90 the top hand lands at y 0.48 — shoulder
   height, which reads as a tight self-hug rather than folded arms. */
const FOREARM_GAP = 2 * 0.058;
const HAND_GAP = R_HAND + R_FORE;// a hand lying against the other forearm
const HAND_AXIS = R_HAND;        // hands proud of the chest, not sunk into it

/* ── ELBOW HEIGHT — the "hunched shoulders" fix ──
   The old sweep allowed elbows up to y 0.46, which is only 0.045 below the
   shoulder ball at 0.505: an upper arm hanging barely 10–20° below
   horizontal, i.e. winged out to the side. That is what reads as a shrug —
   NOT the clavicle, which the solver pins to within 0.03 mm of bind and
   which already slopes 9.1° downward there.

   Folding your arms does not lift your elbows; it drops them to about the
   bottom of the ribcage and lets the forearms come up to meet each other.
   At this rig's L1 = 0.2492 that is:
     30° below horizontal -> elbow y 0.381
     40°                  -> elbow y 0.345
     50°                  -> elbow y 0.314                                   */
const ELBOW_Y_MAX = 0.38;  // no higher than ~30° below horizontal
const ELBOW_Y_MIN = 0.25;  // no lower than ~65°, or the fold pulls apart

function elbowFrom(anchor, hand, pole) {
  const d = sub(hand, anchor);
  const D = Math.min(len(d), REACH * 0.999);
  const dir = norm(d);
  const a = (L1 * L1 - L2 * L2 + D * D) / (2 * D);
  const r = Math.sqrt(Math.max(L1 * L1 - a * a, 0));
  const base = [anchor[0] + dir[0] * a, anchor[1] + dir[1] * a, anchor[2] + dir[2] * a];
  const k = dot(pole, dir);
  let perp = [pole[0] - k * dir[0], pole[1] - k * dir[1], pole[2] - k * dir[2]];
  if (len(perp) < 1e-6) perp = [0, -1, 0];
  perp = norm(perp);
  return [base[0] + perp[0] * r, base[1] + perp[1] * r, base[2] + perp[2] * r];
}
const elbowAngle = (D) => {
  const c = (L1 * L1 + L2 * L2 - Math.min(D, REACH * 0.999) ** 2) / (2 * L1 * L2);
  return (Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI;
};
const lerp3 = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t];

/** Worst axis clearance along the forearm. */
function forearmClear(elbow, hand) {
  let worst = Infinity;
  for (let i = 0; i <= 12; i++) {
    const cl = clear(lerp3(elbow, hand, i / 12));
    if (cl < worst) worst = cl;
  }
  return worst;
}
/** The point on a forearm at sideways position `a`, or null if it doesn't
    span that far. Forearms here are near-horizontal, so a is monotone. */
function forearmAt(elbow, hand, a) {
  const span = hand[0] - elbow[0];
  if (Math.abs(span) < 1e-6) return null;
  const t = (a - elbow[0]) / span;
  return t < 0 || t > 1 ? null : lerp3(elbow, hand, t);
}
const depthAtCentre = (elbow, hand) => forearmAt(elbow, hand, 0);

/* ── TRUE 3D CLEARANCE ──
   The old pairing compared only the c (depth) components of the two
   forearms, which measures how far apart they are along ONE axis and calls
   that the gap. Two limbs crossing at 40° with 0.06 of depth between them
   can still be 0.02 apart in space, and that is precisely the fold that
   shipped. These sample the real distance instead.

   Sampled rather than solved: the closed-form segment-segment routine has
   four degenerate cases and this runs on a grid where a wrong answer is
   silent. 24 samples is well under a millimetre on limbs this size. */
function ptSegDist(p, a, b) {
  const ab = sub(b, a);
  const e = dot(ab, ab);
  const t = e < 1e-12 ? 0 : Math.min(Math.max(dot(sub(p, a), ab) / e, 0), 1);
  return len(sub(p, lerp3(a, b, t)));
}
function segSegDist(p1, q1, p2, q2) {
  let m = Infinity;
  for (let i = 0; i <= 24; i++) {
    const d = ptSegDist(lerp3(p1, q1, i / 24), p2, q2);
    if (d < m) m = d;
  }
  return m;
}

/* Poles sweep the elbow around the shoulder→hand axis. For a fold the elbow
   has to come FORWARD as well as down, hence the +c entries. */
const POLES = [];
for (let dy = -1; dy <= -0.2; dy += 0.4)
  for (let da = -1.4; da <= 0.2; da += 0.4)
    for (let dc = -0.6; dc <= 1.0; dc += 0.4)
      POLES.push(norm([da, dy, dc]));

/** All feasible arms for one side. `sign` = +1 for the right arm (shoulder at
    a<0, hand crosses to a>0), −1 mirrored. `step` and the ranges are passed
    in so the same routine does the coarse sweep and the local refinement. */
function candidates(shoulder, sign, axisMin, yLo, yHi, step = 0.02, aLoIn = -0.10, aHiIn = 0.24, cLo = 0.20, cHi = 0.44, poles = POLES) {
  const out = [];
  /* ah is how far past the sternum the hand lands. It is allowed to go
     NEGATIVE: what makes a fold read is the two forearms crossing EACH
     OTHER, not each one individually passing the centreline, and insisting
     on the latter forces one arm out to 95% extension. */
  for (let ah = aLoIn; ah <= aHiIn + 1e-9; ah += step)
    for (let y = yLo; y <= yHi + 1e-9; y += step)
      for (let c = cLo; c <= cHi + 1e-9; c += step) {
        const hand = [ah * sign, y, c];
        const D = len(sub(hand, shoulder));
        if (D > REACH * 0.96) continue;
        if (clear(hand) < HAND_AXIS) continue;
        for (const pole of poles) {
          const p = [pole[0] * sign, pole[1], pole[2]];
          const el = elbowFrom(shoulder, hand, p);
          // elbow stays on its own side and WELL below the shoulder — not
          // winged up (see ELBOW_Y_MAX), not dragged across the chest
          if (el[0] * sign > -0.06) continue;
          if (el[1] > ELBOW_Y_MAX || el[1] < ELBOW_Y_MIN) continue;
          // forearm roughly horizontal, like the reference
          if (Math.abs(el[1] - hand[1]) > 0.18) continue;
          if (forearmClear(el, hand) < axisMin) continue;
          out.push({
            hand, pole: p, el, D, ang: elbowAngle(D), cross: ah,
            mid: depthAtCentre(el, hand),
          });
        }
      }
  return out;
}

console.log("forearm 0.2768 vs shoulder half-span 0.2840 — the forearm alone");
console.log("cannot span to the centreline, so the elbows must come forward.\n");

/* ── envelope: how far past the sternum can a hand get, per depth budget? ── */
console.log("how far each hand can cross the centreline, by depth budget:");
console.log("  axis clear   max cross   at y     reach   elbow");
for (const axis of [0.00, 0.02, 0.04, 0.06, 0.08, 0.10]) {
  const cs = candidates(SR, +1, axis, 0.20, 0.46);
  let b = null;
  for (const c of cs) if (!b || c.cross > b.cross || (c.cross === b.cross && c.ang < b.ang)) b = c;
  console.log(
    `     ${axis.toFixed(2)}      ` +
    (b ? `${b.cross.toFixed(2)}       ${b.hand[1].toFixed(2)}    ${((b.D / REACH) * 100).toFixed(0)}%    ${b.ang.toFixed(0)}°`
       : "none")
  );
}

/* TOP arm = the character's RIGHT, matching the reference photo: right hand
   visible on top over the left arm, left hand tucked underneath. */
/* The TOP arm searches HIGHER than the bottom one. With the elbows dropped,
   height is what buys reach: a hand nearer shoulder level spends less of the
   arm's length getting down to the fold and more of it crossing the body.
   The top arm also has no chest to clear — it rides on the bottom forearm —
   so it is free to use that height. */
const top = candidates(SR, +1, REST_AXIS, 0.30, 0.50);
const bot = candidates(SL, -1, REST_AXIS, 0.22, 0.42);
console.log(`\nfeasible right(top) arms: ${top.length}   left(bottom) arms: ${bot.length}`);
if (!top.length || !bot.length) {
  console.log("\nno crossed fold exists under these constraints.");
  process.exit(0);
}

/* Pair them: the top forearm must pass in front of the bottom one where they
   cross, and the hands must not land on top of each other. */
function pair(top, bot) {
const ranked = [];
const rej = { overlap: 0, handsClose: 0, stack: 0, lift: 0, tuck: 0, bicep: 0, ok: 0 };
for (const t of top)
  for (const b of bot) {
    /* The forearms have to OVERLAP in a, or they read as two bars meeting
       end-to-end rather than as a fold.

       This was 0.06 and it is now the token 0.03, because it was a crude
       proxy for a thing that is checked properly below: what makes a fold
       read is each HAND landing on/under the opposite FOREARM, which the
       lift and tuck tests enforce directly and which cannot happen without
       real overlap. Holding 0.06 here on top of the dropped elbows left the
       search with an empty feasible set — and of the two, the elbow height
       is the one the eye actually reads. Folds where the hands meet near the
       centreline and tuck into the elbow crooks are entirely normal; folds
       where the shoulders are hiked up to the ears are not. */
    const aLo = Math.max(t.el[0], b.hand[0]);
    const aHi = Math.min(t.hand[0], b.el[0]);
    const overlap = aHi - aLo;
    if (overlap < 0.03) { rej.overlap++; continue; }
    // Hands must not occupy the same space. Two hand half-thicknesses — the
    // old flat 0.13 assumed they land far apart, which is only true of a
    // fold whose hands cross much further than this rig can reach.
    if (len(sub(t.hand, b.hand)) < 2 * R_HAND) { rej.handsClose++; continue; }

    /* ── THE STACK, IN 3D ──
       The two forearms must be genuinely separated in space, and the top one
       must be OUTWARD (up and/or forward) of the bottom one the whole way
       across so the X reads unambiguously.

       "Outward", not "in front": the old test demanded the separation be
       purely in depth, which is why the shipped fold pushed the right hand
       out to c 0.36 and burned 95% of the arm's reach getting there. A real
       fold stacks the top forearm up-and-forward — the vertical component is
       free, and spending it buys back all the reach the hand needs to cross
       the centreline without the elbow winging up. */
    const gap = segSegDist(t.el, t.hand, b.el, b.hand);
    if (gap < FOREARM_GAP) { rej.stack++; continue; }
    // …but not so far apart that they read as two bars at different levels
    // rather than one arm resting on the other.
    if (gap > FOREARM_GAP + 0.07) { rej.stack++; continue; }

    let ok = true;
    for (let i = 0; i <= 4; i++) {
      const a = aLo + ((aHi - aLo) * i) / 4;
      const pt = forearmAt(t.el, t.hand, a);
      const pb = forearmAt(b.el, b.hand, a);
      if (!pt || !pb) { ok = false; break; }
      // top arm never dips behind OR below the bottom one
      if (pt[2] < pb[2] - 0.02 || pt[1] < pb[1] - 0.02) { ok = false; break; }
    }
    if (!ok) { rej.stack++; continue; }

    /* The top hand must REST on the bottom forearm — a hand hovering proud
       of the arm it is supposed to be lying on reads as broken. Distance to
       the forearm AXIS, so the bar is "hand surface touching forearm
       surface" (HAND_GAP) plus a little slack. */
    const lift = ptSegDist(t.hand, b.el, b.hand);
    if (lift < HAND_GAP || lift > HAND_GAP + 0.05) { rej.lift++; continue; }

    /* And the bottom hand must tuck UNDER the top forearm, not poke through
       it — that is what hides it in the reference. */
    const tuck = ptSegDist(b.hand, t.el, t.hand);
    if (tuck < HAND_GAP) { rej.tuck++; continue; }

    /* NEITHER HAND MAY BE INSIDE THE OPPOSITE BICEP. Never tested before:
       the old search checked each forearm against the torso and the two
       forearms against each other, and simply never looked at the upper
       arms, which are the thickest part of the limb (r ≈ 0.078). */
    if (ptSegDist(t.hand, SL, b.el) < R_HAND + R_UPPER) { rej.bicep++; continue; }
    if (ptSegDist(b.hand, SR, t.el) < R_HAND + R_UPPER) { rej.bicep++; continue; }
    // …and neither forearm may pass through the opposite upper arm.
    if (segSegDist(t.el, t.hand, SL, b.el) < R_FORE + R_UPPER) { rej.bicep++; continue; }
    if (segSegDist(b.el, b.hand, SR, t.el) < R_FORE + R_UPPER) { rej.bicep++; continue; }
    rej.ok++;
    const minSep = gap;

    /* Reward crossing far and overlapping well; penalise straight elbows, a
       fold riding up under the chin, arms floating apart, and a crossing
       point sitting off to one side of the sternum.

       THE ELBOW TERM IS THE ANTI-SHRUG. Everything else being equal the
       search now prefers the pair with the lowest elbows, which is the
       difference between "arms folded" and "shoulders hiked up". */
    const offCentre = Math.abs((t.hand[0] + b.hand[0]) / 2);
    const score =
      2.5 * (t.cross + b.cross) +
      2.0 * overlap -
      0.025 * (t.ang + b.ang) -
      1.0 * (t.hand[1] + b.hand[1]) -
      2.0 * (t.el[1] + b.el[1]) - // ELBOWS DOWN
      1.4 * Math.max(0, minSep - (FOREARM_GAP + 0.03)) -
      6.0 * Math.max(0, lift - (HAND_GAP + 0.03)) - // hand snug on the forearm
      3.0 * offCentre;
    ranked.push({ score, t, b, sep: minSep, overlap, lift });
  }
  ranked.sort((x, y) => y.score - x.score);
  return { ranked, rej };
}

const coarse = pair(top, bot);
console.log("pairing rejections:", coarse.rej);
if (!coarse.ranked.length) {
  console.log("\ncandidates exist per arm, but none can be stacked into an X.");
  process.exit(0);
}

/* Out of ~540 M candidate pairs only ~106 survive, and every one of them
   reports the same metrics — a hard plateau, not a grid artefact. A finer
   sweep and a denser pole fan around the winner produced nothing better, so
   this is the rig's limit, not the search's. */
const ranked = coarse.ranked;

const show = (label, x) =>
  console.log(
    `  ${label}  hand [${x.hand.map((v) => v.toFixed(3)).join(", ")}]` +
    `  elbow [${x.el.map((v) => v.toFixed(3)).join(", ")}]` +
    `  reach ${((x.D / REACH) * 100).toFixed(0)}%  elbow ${x.ang.toFixed(0)}°` +
    `  forearm clear ${forearmClear(x.el, x.hand).toFixed(3)}` +
    `  pole [${x.pole.map((v) => v.toFixed(2)).join(", ")}]`
  );

console.log("\ntop candidates:");
for (const r of ranked.slice(0, 6)) {
  console.log(
    `  score ${r.score.toFixed(3)}  fold height ${((r.t.hand[1] + r.b.hand[1]) / 2).toFixed(2)}` +
    `  cross R ${r.t.cross.toFixed(2)} / L ${r.b.cross.toFixed(2)}` +
    `  elbows ${r.t.ang.toFixed(0)}°/${r.b.ang.toFixed(0)}°` +
    `  overlap ${r.overlap.toFixed(2)}  gap ${r.sep.toFixed(3)}  lift ${r.lift.toFixed(3)}`
  );
}

const best = ranked[0];
console.log("\nbest crossed fold:");
show("R (top)   ", best.t);
show("L (bottom)", best.b);
console.log(
  `  stacked over ${best.overlap.toFixed(3)} of a, right arm ${best.sep.toFixed(3)} in front,` +
  ` right hand rests ${best.lift.toFixed(3)} from the left forearm axis`);

console.log("\nsolve.js targets:");
const dirOf = (x) => norm(sub(x.hand, x.el));
for (const [side, x, palmSign] of [["r", best.t, -1], ["l", best.b, +1]]) {
  const f = dirOf(x);
  // palm: perpendicular to the fingers, facing the body for the top hand and
  // up for the bottom one — the two directions a fold actually uses
  const up = palmSign < 0 ? [0, -1, 0] : [0, 1, 0];
  const k = dot(up, f);
  const palm = norm([up[0] - k * f[0], up[1] - k * f[1], up[2] - k * f[2]]);
  console.log(`    ${side}: {`);
  console.log(`      hand: [${x.hand.map((v) => v.toFixed(3)).join(", ")}],`);
  console.log(`      pole: [${x.pole.map((v) => v.toFixed(2)).join(", ")}],`);
  console.log(`      fingers: [${f.map((v) => v.toFixed(3)).join(", ")}],`);
  console.log(`      palm: [${palm.map((v) => v.toFixed(3)).join(", ")}],`);
  console.log(`    },`);
}
