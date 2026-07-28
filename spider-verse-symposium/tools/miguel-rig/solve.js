const ROOT = require("path").resolve(__dirname, "../..");
/* ════════════════════════════════════════════════════════════
   Solve absolute-local arm quaternions for authored poses.

   ── THE ONE THING THAT MATTERS MOST ──────────────────────────
   TARGETS ARE AUTHORED IN **CHEST SPACE**, NOT ROOT SPACE.
   scene.gltf's bind pose has the torso YAWED 30.2° about Y: the shoulder
   balls sit at (0.2905, ., 0.0652) and (−0.2004, ., −0.2203), which are not
   mirror images. Authoring "cross the hands at the centreline" in root space
   therefore lands both hands on the SAME side of the sternum and the fold
   comes out as a mangled tangle. Everything below is specified as
     a = along the chest's LEFT axis   (±0.2839 = the shoulder balls)
     y = absolute world height          (0.5052 = shoulder height)
     c = forward out of the chest
   and converted with toRoot(). Do not "simplify" this back to raw XYZ.

   Other geometry facts read out of the assets:
   • Bone aim axis is local +Y for every arm bone.
   • Hand frame: fingers = local +Y, palm = local −Z, thumb/radial side =
     local +X (left) / −X (right). Verified from the thumb bone offset and
     cross-checked against the bind pose, where both palms face inward.
   • Bone offsets are IDENTICAL between scene.gltf and arm_poses.glb but the
     arm bind ROTATIONS are not, so poses must be absolute local quats.
     The two files are also uniformly scaled 81.35× apart; all numbers here
     are in the small (arm_poses) space. Rotations are scale-invariant.
   • upper arm 0.2492, forearm 0.2768, reach 0.5260 vs a 0.5679 shoulder
     span — the arms are SHORTER than the shoulders are wide, so a hand
     physically cannot reach the opposite bicep. See fold notes.
   ════════════════════════════════════════════════════════════ */
const fs = require("fs");
const R = require("./rig.js");
const B = require("./body.js"); // measured skin surface, for the clearance check
const { byName, N, chainOf, qmul, qrot, qaxis, sub, len, norm, dot, cross } = R;

const SCENE = JSON.parse(
  fs.readFileSync(ROOT + "/public/models/miguel2099/scene.gltf", "utf8")
);
const sIdx = {};
SCENE.nodes.forEach((n, i) => (sIdx[n.name] = i));
const sceneRest = (name) => SCENE.nodes[sIdx[name]].rotation || [0, 0, 0, 1];

/* World transform using scene.gltf bind rotations, `ov` overriding bones.
   Mirrors the RUNTIME exactly. */
function worldScene(name, ov) {
  let q = [0, 0, 0, 1], p = [0, 0, 0], s = 1;
  for (const j of chainOf(byName[name])) {
    const n = N[j];
    const lq = (ov && ov[n.name]) || sceneRest(n.name);
    const lt = n.translation || [0, 0, 0];
    const rp = qrot(q, [lt[0] * s, lt[1] * s, lt[2] * s]);
    p = [p[0] + rp[0], p[1] + rp[1], p[2] + rp[2]];
    q = qmul(q, lq);
    s *= n.scale ? n.scale[0] : 1;
  }
  return { p, q };
}

/* ── CHEST FRAME (from the bind shoulder balls) ── */
const A_L = worldScene("arm_stretch.l_37", null).p;
const A_R = worldScene("arm_stretch.r_68", null).p;
const U = norm(sub(A_L, A_R));            // chest LEFT
const F = norm(cross(U, [0, 1, 0]));      // chest FORWARD (sign fixed below)
// Disambiguate forward with the head, which leans slightly ahead of the neck.
const headLean = sub(worldScene("head.x_5", null).p, worldScene("neck.x_6", null).p);
const FWD = dot(headLean, F) >= 0 ? F : [-F[0], -F[1], -F[2]];
const O = [(A_L[0] + A_R[0]) / 2, (A_L[1] + A_R[1]) / 2, (A_L[2] + A_R[2]) / 2];
const HALF_SPAN = len(sub(A_L, A_R)) / 2;

/** chest (a, y, c) -> root xyz */
const toRoot = ([a, y, c]) => [
  O[0] + U[0] * a + FWD[0] * c,
  y,
  O[2] + U[2] * a + FWD[2] * c,
];
/** chest direction -> root direction */
const dirToRoot = ([a, y, c]) =>
  norm([U[0] * a + FWD[0] * c, y, U[2] * a + FWD[2] * c]);

console.log("chest frame: U", U.map((v) => v.toFixed(3)).join(","),
  " FWD", FWD.map((v) => v.toFixed(3)).join(","),
  " shoulder half-span", HALF_SPAN.toFixed(4));

const SIDES = {
  r: { sh: "shoulder.r_69", up: "arm_stretch.r_68", fo: "forearm_stretch.r_67", hd: "hand.r_65" },
  l: { sh: "shoulder.l_38", up: "arm_stretch.l_37", fo: "forearm_stretch.l_36", hd: "hand.l_34" },
};

/* Limb radii measured off the skinned mesh — vertices bucketed to their
   nearest bone, sampled across the middle 50% so joint bulges don't inflate
   the cylinder. Two limbs whose axes are (r1 + r2) apart are just touching;
   anything closer is interpenetration. See fold-search.js. */
const R_FORE = 0.051, R_UPPER = 0.078, R_HAND = 0.055;

/** Distance from a point to a segment, and segment-to-segment (sampled). */
const _lerp3 = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t];
function ptSegDist(p, a, b) {
  const ab = sub(b, a);
  const e = dot(ab, ab);
  const t = e < 1e-12 ? 0 : Math.min(Math.max(dot(sub(p, a), ab) / e, 0), 1);
  return len(sub(p, _lerp3(a, b, t)));
}
function segSegDist(p1, q1, p2, q2) {
  let m = Infinity;
  for (let i = 0; i <= 24; i++) {
    const d = ptSegDist(_lerp3(p1, q1, i / 24), p2, q2);
    if (d < m) m = d;
  }
  return m;
}

/* ── exact elbow from two-bone geometry ──
   Hand-authored elbow positions are almost never EXACTLY one forearm-length
   from the hand, which leaves the solver chasing an impossible pair. Author
   the hand plus a pole direction; derive the elbow on the circle of valid
   positions. */
const L1 = 0.2492, L2 = 0.2768;
function elbowFrom(anchor, hand, pole) {
  const d = sub(hand, anchor);
  const D = Math.min(len(d), (L1 + L2) * 0.999);
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

/* ── solve one arm: 12 DOF (shoulder / upper / forearm / hand), coordinate
   descent with shrinking step + multi-start. FK is ~1µs so brute force is
   free and deterministic. ── */
function solveArm(side, elbowT, handT, fingersT, palmT, shoulderT) {
  const B = SIDES[side];
  // Position error is metres-ish (whole arm 0.53) so it must be weighted far
  // above the radian-scale regulariser, or the reg wins and the solver just
  // hands back the rest pose. Orientation terms are (1 − dot), range 0..2.
  const W_ELBOW = 1500, W_HAND = 4000, W_ORI = 260;
  /* Clavicle reg is high: the shoulder should shrug, not relocate the arm.
     NOTE what that means in practice — it pins the clavicle to within 0.03 mm
     of the BIND pose, so the shoulders come out however the model was built
     and no pose can relax them. W_SH below is the opt-in override; it has to
     out-weigh this reg (moving the ball 0.015 costs the reg ~0.17) without
     rivalling W_HAND, or the shoulder starts solving the arm's job. */
  const W_SH = 3000;
  /* The clavicle reg exists to disambiguate a DOF nothing else constrains:
     the arm targets can be met from many shoulder positions, so without it
     the solver wanders. Once a pose supplies shoulderT that DOF IS
     constrained, and leaving the reg at 40 just means the two fight — at
     which point the authored number stops meaning anything (asking for 15 mm
     of drop delivered 9.7). Drop it to a light stabiliser instead. */
  const clav = shoulderT ? 6 : 40;
  const reg = [clav, clav, clav, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.08, 0.08, 0.08];

  const toOv = (p) => {
    const mk = (i) => {
      const ax = [p[i], p[i + 1], p[i + 2]];
      const a = len(ax);
      return a < 1e-9 ? [0, 0, 0, 1] : qaxis(ax, a);
    };
    return {
      [B.sh]: qmul(mk(0), sceneRest(B.sh)),
      [B.up]: qmul(mk(3), sceneRest(B.up)),
      [B.fo]: qmul(mk(6), sceneRest(B.fo)),
      [B.hd]: qmul(mk(9), sceneRest(B.hd)),
    };
  };

  const cost = (p) => {
    const ov = toOv(p);
    const e = worldScene(B.fo, ov).p;
    const h = worldScene(B.hd, ov);
    let c =
      W_ELBOW * len(sub(e, elbowT)) ** 2 + W_HAND * len(sub(h.p, handT)) ** 2;
    if (fingersT) c += W_ORI * (1 - dot(qrot(h.q, [0, 1, 0]), fingersT));
    if (palmT) c += W_ORI * (1 - dot(qrot(h.q, [0, 0, -1]), palmT));
    // Where the SHOULDER BALL should sit — the only handle on the clavicle
    // (the arm targets can be hit from any shoulder position, so without
    // this the reg decides and the answer is always "exactly as built").
    if (shoulderT) c += W_SH * len(sub(worldScene(B.up, ov).p, shoulderT)) ** 2;
    for (let i = 0; i < 12; i++) c += reg[i] * p[i] * p[i];
    return c;
  };

  let best = new Array(12).fill(0), bestC = cost(best);
  let rng = 12345;
  const rand = () => ((rng = (rng * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1;
  for (let restart = 0; restart < 40; restart++) {
    let p = restart === 0
      ? new Array(12).fill(0)
      : Array.from({ length: 12 }, (_, i) => (i < 3 ? rand() * 0.15 : rand() * 2.2));
    let c = cost(p), step = 0.35;
    for (let pass = 0; pass < 400; pass++) {
      let improved = false;
      for (let i = 0; i < 12; i++) {
        for (const d of [step, -step]) {
          const q = p.slice();
          q[i] += d;
          const cq = cost(q);
          if (cq < c - 1e-12) { p = q; c = cq; improved = true; }
        }
      }
      if (!improved) { step *= 0.55; if (step < 1e-6) break; }
    }
    if (c < bestC) { bestC = c; best = p; }
  }

  const ov = toOv(best);
  const e = worldScene(B.fo, ov).p;
  const h = worldScene(B.hd, ov);
  const ang = (a, b) => Math.acos(Math.max(-1, Math.min(1, dot(a, b)))) * 180 / Math.PI;
  return {
    ov,
    elbowT,
    err: {
      elbow: len(sub(e, elbowT)),
      hand: len(sub(h.p, handT)),
      fingers: fingersT ? ang(qrot(h.q, [0, 1, 0]), fingersT) : 0,
      palm: palmT ? ang(qrot(h.q, [0, 0, -1]), palmT) : 0,
    },
  };
}

/* ════════ AUTHORED POSES — all coordinates are CHEST SPACE (a, y, c) ════════
   a: + = character's LEFT, shoulder balls at ±0.2839
   y: absolute height, shoulders at 0.5052
   c: + = forward out of the chest                                            */
/* THE LEFT ARM SITS THIS ONE OUT.
   Shared by all three punch-sequence poses so it is provably identical in
   each: any drift between them would make the left arm twitch as the blend
   crosses a phase boundary, which is exactly the kind of motion that reads
   as "the animation is broken". Hand at a 0.36 / y 0.03 is a relaxed hang —
   92% of reach, a 133° elbow, so the arm is nearly straight without being
   locked out. Fingers point down, palm turned in against the thigh. */
const LEFT_HANG = {
  hand: [0.360, 0.030, 0.060],
  pole: [0.5, -1, -0.4], // elbow a touch outboard and behind
  fingers: [0.05, -1, 0.06],
  palm: [-1, 0, -0.15],
};

const POSES = {
  /* ── REST — the bind stance, as an AUTHORED pose ──
     No IK: these are simply scene.gltf's own arm rotations, emitted so the
     default stance is something the procedural layer can actively DRIVE.

     WHY THAT MATTERS. A beat with `arms: null` hands the arms back to the
     baked clip, which means the procedural layer stops writing them and the
     bones show whatever was last put there. If anything interrupts the clip
     — it fails to load, a track is missing, the mixer is not updated for a
     frame — the previous pose LATCHES: scroll from the folded-arms section
     back to the hero and he is still standing there with his arms crossed,
     because nothing ever asserted otherwise. Driving `rest` explicitly makes
     the opening stance a pose the rig holds rather than a pose it falls back
     to, so it cannot be left behind. */
  rest: { bind: true, curl: 0 },
  /* ── ARMS CROSSED ──
     A real fold: two forearms stacked in an X across the chest, right on
     top, left tucked under. Solved by fold-search.js against the measured
     skin surface rather than authored by eye — an earlier version of this
     pose put the hands at c 0.065 and 0.135 while the torso's own skin is
     at c ≈ 0.21, i.e. 7–15 cm INSIDE the body, which is why it rendered as
     a smudge with no readable forearm.

     WHY THE ARMS SIT WHERE THEY DO
     forearm 0.2768 vs shoulder half-span 0.2840: the forearm is SHORTER
     than the distance from the shoulder ball to the centreline, so with the
     elbows parked at the sides the fingertips do not even reach the
     sternum. The elbows therefore have to swing forward and inboard, which
     is exactly what a person does when they fold their arms.

     Stacking is what costs the reach. The bottom forearm rests on the chest
     (axis 0.016 proud of the skin); the top one has to ride a further 0.063
     in front of it to pass over, which puts the right hand 0.36 forward of
     the shoulder plane while that shoulder is 0.284 out to the side. Hence
     the right arm at 95% extension. Of ~540 M candidate pairs only 106 are
     geometrically valid and every one lands on these same numbers — this is
     the rig's wall, not a search artefact.

       • both forearms level at y ≈ 0.38–0.44, crossing over the lower ribs
       • they overlap across 0.06 of the body's width, right arm 0.063 in
         front of the left, so the X is unambiguous and nothing intersects
       • RIGHT hand crosses to a +0.04 and lies on the left forearm; LEFT
         hand crosses to a −0.02 and tucks 0.063 behind the right forearm,
         up in its elbow crook, the way the lower hand disappears in a real
         fold
       • elbows 144° (right, the stacked one) and 101° (left)

     FOREARM ROLL — the thing that makes or breaks this pose.
     A first pass had the palms facing straight down and straight up, which
     put both forearms in SUPINATION: the soft inner side of the forearm and
     the open palms turned toward the camera. That reads as someone offering
     their hands, not folding them. People fold their arms PRONATED — the
     palms turn in against the torso, so what faces out is the back of the
     hand and the outer edge of the forearm. Hence both palm hints point
     at −c (into the chest); the vertical term is only the tilt that lets
     the top hand settle onto the forearm below and the bottom hand cup up
     under the arm above.
     Fingers gently curled (0.5) so the top hand drapes over the forearm
     instead of gripping it. */
  fold: {
    r: {
      // TOP arm — high across the chest, riding on the left forearm.
      hand: [0.020, 0.460, 0.300],
      pole: [-0.69, -0.69, 0.23], // elbow forward, inboard AND DOWN
      /* Wrist tucked ~19° down off the forearm line so the hand folds over
         the arm underneath instead of continuing straight out past it. The
         forearm direction itself is [0.911, 0.234, 0.339]; a hand left on
         that line points up and away into empty space, which is the
         "fingers sticking out" read. */
      fingers: [0.90, -0.10, 0.28],
      palm: [0.15, -1, -0.45], // face down onto the left forearm, rolled into the body
    },
    l: {
      // BOTTOM arm — across the belly, hand tucked under the right forearm.
      hand: [-0.020, 0.320, 0.280],
      pole: [0.58, -0.58, 0.58],
      fingers: [-0.94, 0.02, 0.26], // cupped a touch upward, under the arm above
      palm: [-0.10, 1, -0.40], // face up into the right forearm, rolled into the body
    },
    /* Fingers wrap the opposite forearm rather than lying flat on it. 0.5 was
       a half-open hand — the source of the "stiff, straight fingers": the
       only closed hand in the asset is a clenched FIST, so every value here
       is a compromise between "open" and "gripping". 0.72 reads as a relaxed
       hand curled over an arm; past ~0.85 it becomes a fist holding its own
       bicep. See FIST_FINGERS in armPoses.ts. */
    curl: 0.72,
    /* ── SHOULDERS DOWN AND FORWARD ──
       Target for the shoulder BALL, as an offset from where the bind pose
       puts it. Folding your arms rounds the shoulders: they settle down and
       roll forward. Without this the clavicle is regularised onto the bind
       pose and the character wears whatever the model was built with, in
       every pose, forever. Small numbers on purpose — 0.015 is about 1.5 cm
       on a figure whose shoulders are 0.568 apart, which is the difference
       between "at ease" and "shrugging", not a slump. */
    shoulder: { drop: 0.015, forward: 0.010 },
  },
  /* ── GUARD — the arm comes UP ──
     Upper arm horizontal out to his right, forearm straight up: the elbow is
     the full L1 from the shoulder ball with ZERO vertical offset, which is
     the only way to get a true 90° elbow with a vertical forearm (put the
     elbow below the shoulder and a vertical forearm folds the joint shut
     instead). Fist finishes at y 0.78 — head height, well clear of the head
     itself at a 0.01. Reads as a big, legible silhouette from the front. */
  guard: {
    r: {
      hand: [-0.421, 0.782, 0.208], // fist up beside the head
      pole: [-1, -0.15, 0.1], // elbow straight out to the side
      fingers: [0, 1, 0], // forearm vertical
      palm: [1, 0, 0.25], // knuckles out, palm turned in across the body
    },
    l: LEFT_HANG,
    curl: 1,
  },
  /* ── CHAMBER — the wind-up ──
     Drawn straight BACK from the guard — same side of the body, same rough
     height, just behind the chest plane (c −0.05). 48% of reach at a ~59°
     elbow.

     THE POINT OF THESE NUMBERS IS THE PATH, NOT THE POSE. The arm gets from
     here to `punch` by slerping between the two, so the straight-line delta
     between the two hands IS the trajectory the fist flies. The previous
     pair sat at a −0.40 and a +0.05, which made that delta 64% sideways: the
     fist swung out and around, and it read as a wide looping arm-wave rather
     than a punch. Keeping both hands on his own right turns the same delta
     into 85% pure forward — the fist now travels down the barrel toward the
     lens. */
  chamber: {
    r: {
      hand: [-0.430, 0.700, -0.050],
      pole: [-0.5, -0.4, -1], // elbow driven back behind the ribs
      fingers: [0.20, -0.05, 0.98], // knuckles already aimed downrange
      palm: [1, 0.30, 0], // palm turned in, the classic cocked fist
    },
    l: LEFT_HANG,
    curl: 1,
  },
  /* ── PUNCH — the release ──
     99% extension driving STRAIGHT out in front of his own right shoulder
     (a −0.14, barely inboard) rather than across to a +0.05. Elbow dropped a
     touch under the line of the arm — that drop is what makes it read as a
     thrown punch rather than an arm held up. Palm DOWN, which is how a cross
     actually lands. */
  punch: {
    r: {
      hand: [-0.140, 0.505, 0.500],
      pole: [-0.15, -1, -0.15],
      /* STRAIGHT WRIST. The authored [0.02, −0.04, 0.999] pointed the hand at
         the chest's forward axis, but the solved forearm does not arrive on
         that axis — it comes in from the shoulder, up and to the right — so
         the hand sat cocked back off it and the wrist read as broken. "align"
         puts the hand on whatever the forearm actually did, which is what a
         locked-out punch looks like. */
      fingers: "align",
      palm: [0.08, -0.99, 0.12], // palm down
    },
    l: LEFT_HANG,
    curl: 1,
  },
};

/* ── solve ── */
const out = {};
const curls = {};
for (const [name, spec] of Object.entries(POSES)) {
  out[name] = {};
  curls[name] = spec.curl;
  console.log("\n── " + name.toUpperCase());
  if (spec.bind) {
    // Nothing to solve — emit the rig's own bind rotations verbatim.
    for (const s of ["r", "l"]) {
      for (const b of [SIDES[s].sh, SIDES[s].up, SIDES[s].fo, SIDES[s].hd]) {
        out[name][b] = sceneRest(b);
      }
    }
    console.log("  bind stance — 8 bones emitted verbatim, no solve");
    continue;
  }
  for (const s of ["r", "l"]) {
    const t = spec[s];
    const anchor = s === "r" ? A_R : A_L;
    const handT = toRoot(t.hand);
    const elbowT = elbowFrom(anchor, handT, dirToRoot(t.pole));
    /* The palm is only ever a ROLL about the finger axis, so a palm target
       that is not perpendicular to the finger target describes a hand that
       cannot exist and the solver just splits the difference between them —
       that is where chamber's and punch's 2–7° residuals come from. Author
       `palm` as a rough intent ("faces the body") and orthogonalise it here
       so the two targets always describe one reachable orientation. */
    /* `fingers: "align"` = STRAIGHT WRIST. Points the hand's aim axis down
       the forearm instead of at an authored direction, which is the only way
       to guarantee no wrist break: any fixed target that disagrees with where
       the solved forearm actually ends up shows as the hand cocked back off
       it. Use it for the punch, where the joint must be locked out. */
    const fDir =
      t.fingers === "align"
        ? norm(sub(handT, elbowT))
        : dirToRoot(t.fingers);
    const pRaw = dirToRoot(t.palm);
    const k = dot(pRaw, fDir);
    const pDir = norm([
      pRaw[0] - k * fDir[0],
      pRaw[1] - k * fDir[1],
      pRaw[2] - k * fDir[2],
    ]);
    /* Shoulder-ball target, if the pose asks to relax the clavicle. Authored
       as a chest-space offset from BIND (down / forward) so it reads the same
       on both sides despite the torso's 30.2° yaw making them non-mirrored. */
    let shoulderT = null;
    if (spec.shoulder) {
      const bind = B.toChest(worldScene(SIDES[s].up, null).p);
      shoulderT = toRoot([
        bind[0],
        bind[1] - (spec.shoulder.drop || 0),
        bind[2] + (spec.shoulder.forward || 0),
      ]);
    }
    const res = solveArm(s, elbowT, handT, fDir, pDir, shoulderT);
    Object.assign(out[name], res.ov);
    const D = len(sub(handT, anchor));
    const cosE = (L1 * L1 + L2 * L2 - Math.min(D, (L1 + L2) * 0.999) ** 2) / (2 * L1 * L2);
    /* Clearance is checked on the SOLVED bones, not on the authored target:
       the solver can land the hand where asked and still swing the forearm
       through the ribs. This is the forearm AXIS against the skin, so a
       small positive value means the arm is resting on the body — correct
       for a fold. Only a negative number is a defect: that means the axis
       itself is inside the mesh and the limb gets eaten, which is exactly
       the bug the old fold shipped with (it sat at −0.145). */
    const elbowP = B.toChest(worldScene(SIDES[s].fo, res.ov).p);
    const handP = B.toChest(worldScene(SIDES[s].hd, res.ov).p);
    const clr = B.segmentClearance(elbowP, handP);
    /* The bar is the LIMB'S OWN RADIUS, not zero. The old test only caught an
       axis that had gone inside the mesh, so a forearm half-buried in the
       chest — axis proud by 0.015 against a measured radius of 0.051 — passed
       as "resting on the body". That is what shipped. */
    const verdict =
      clr < 0 ? "  <-- BURIED"
      : clr < R_FORE * 0.5 ? `  <-- ${((1 - clr / R_FORE) * 100).toFixed(0)}% SUNK`
      : clr < R_FORE ? "  (compressing the body)" : "";
    console.log(
      `  ${s}: reach ${((D / 0.526) * 100).toFixed(0)}%  elbow ${(Math.acos(Math.max(-1, Math.min(1, cosE))) * 180 / Math.PI).toFixed(0)}°  ` +
        `err hand ${res.err.hand.toFixed(4)} elbow ${res.err.elbow.toFixed(4)} ` +
        `fingers ${res.err.fingers.toFixed(0)}° palm ${res.err.palm.toFixed(0)}°  ` +
        `forearm axis ${clr >= 0 ? "+" : ""}${clr.toFixed(3)}${verdict}`
    );
    if (spec.shoulder) {
      const bind = B.toChest(worldScene(SIDES[s].up, null).p);
      const got = B.toChest(worldScene(SIDES[s].up, res.ov).p);
      console.log(
        `     shoulder ball: down ${((bind[1] - got[1]) * 1000).toFixed(1)}mm` +
          `  forward ${((got[2] - bind[2]) * 1000).toFixed(1)}mm` +
          `  (asked ${(spec.shoulder.drop * 1000).toFixed(0)}/${(spec.shoulder.forward * 1000).toFixed(0)}mm)`
      );
    }
  }

  /* ══ CROSS-LIMB CHECK — the one that never existed ══
     Every check above looks at ONE arm against the torso. Nothing compared
     the two arms to EACH OTHER, so the shipped fold put the forearm axes
     0.0695 apart when the measured forearm radius is 0.051 — the two arms
     overlapped by 3.5 cm of solid limb and no tool said a word. For any pose
     where both arms work (only the fold, today) this is the check that
     matters most, because self-intersection is the single most obvious way
     for a 3D pose to look broken. */
  {
    const p = {};
    for (const s of ["r", "l"]) {
      p[s + "Sh"] = B.toChest(worldScene(SIDES[s].up, out[name]).p);
      p[s + "El"] = B.toChest(worldScene(SIDES[s].fo, out[name]).p);
      p[s + "Hd"] = B.toChest(worldScene(SIDES[s].hd, out[name]).p);
    }
    const tests = [
      ["forearm x forearm", segSegDist(p.rEl, p.rHd, p.lEl, p.lHd), 2 * R_FORE],
      ["R hand x L upper ", ptSegDist(p.rHd, p.lSh, p.lEl), R_HAND + R_UPPER],
      ["L hand x R upper ", ptSegDist(p.lHd, p.rSh, p.rEl), R_HAND + R_UPPER],
      ["R fore x L upper ", segSegDist(p.rEl, p.rHd, p.lSh, p.lEl), R_FORE + R_UPPER],
      ["L fore x R upper ", segSegDist(p.lEl, p.lHd, p.rSh, p.rEl), R_FORE + R_UPPER],
      ["hand x hand      ", len(sub(p.rHd, p.lHd)), 2 * R_HAND],
    ];
    let bad = 0;
    for (const [label, got, need] of tests) {
      // Only report the pair tests where the two limbs are anywhere near each
      // other; for the punch poses the left arm hangs at the thigh and every
      // number is a meaningless "miles away".
      if (got > need * 2.2) continue;
      const fail = got < need;
      if (fail) bad++;
      console.log(
        `     ${label} ${got.toFixed(3)} (need ${need.toFixed(3)})` +
          (fail ? `  <-- INTERSECTING by ${((need - got) * 1000).toFixed(0)}mm` : "  ok")
      );
    }
    if (bad) console.log(`     !! ${bad} self-intersection(s) in ${name}`);
  }
}

/* ── FINGERS ──
   Stored ONCE as the full fist (baked pose 5 of arm_poses.glb, the only
   artist-authored closed hand in the file) plus a per-pose curl scalar. The
   runtime slerps bind-rest -> fist by that scalar, so a relaxed closed hand
   costs one number instead of 38 more quaternions. */
const FINGER_RE = /^(index|middle|pinky|ring|thumb)\d?(_base)?\.[lr]_\d+$/;
const fingerBones = N.filter((n) => FINGER_RE.test(n.name)).map((n) => n.name);
const fist = {};
for (const ch of R.J.animations[0].channels) {
  if (ch.target.path !== "rotation") continue;
  const nm = N[ch.target.node].name;
  if (!fingerBones.includes(nm)) continue;
  const o = R.rot[ch.target.node];
  const f = 120; // t=5s, the punch/fist key
  fist[nm] = [o[f * 4], o[f * 4 + 1], o[f * 4 + 2], o[f * 4 + 3]];
}
console.log(`\nfinger bones: ${fingerBones.length}, fist keys captured: ${Object.keys(fist).length}`);

/* ── emit ── */
const san = (s) => s.replace(/[[\]./:]/g, "");
const f6 = (q) => "[" + q.map((v) => (Math.abs(v) < 1e-6 ? 0 : +v.toFixed(6))).join(", ") + "]";
let ts = "";
for (const [name, bones] of Object.entries(out)) {
  ts += `  ${name}: {\n    curl: ${curls[name]},\n    bones: {\n`;
  for (const [bone, q] of Object.entries(bones)) ts += `      ${san(bone)}: ${f6(q)},\n`;
  ts += `    },\n  },\n`;
}
let tsF = "";
for (const [bone, q] of Object.entries(fist)) tsF += `  ${san(bone)}: ${f6(q)},\n`;
fs.writeFileSync(__dirname + "/poses.ts.txt", ts + "\n/* FIST */\n" + tsF);
console.log("\nwrote poses.ts.txt");
