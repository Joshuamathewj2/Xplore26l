# Progress — Miguel scroll rig

Handoff notes. Written 2026-07-27. Read this before touching the 3D character.

---

## ⚠️ First thing: none of this is committed

The entire 3D rig is **untracked**. `git status`:

```
?? public/models/            ← the character asset (~5 MB)
?? src/components/ImpactCrack.tsx
?? src/components/MiguelStage.tsx
?? src/components/ScrollRig.tsx
?? src/components/Spider3D.tsx
?? src/lib/                  ← armPoses.ts, beats.ts, scrollState.ts
?? tools/miguel-rig/         ← the pose solver
 M src/app/page.tsx
 M src/components/FeaturedEventsSection.tsx
 M src/components/HeroSection.tsx
```

Commit before doing anything else, or one bad `git clean` loses all of it.

---

## What this is

A Spider-Verse character (Miguel O'Hara) rendered on a fixed full-page canvas,
posed and moved by **scroll position**. Four "beats", each anchored to a real
section on the page:

| # | id | anchor | what he does |
|---|----|--------|--------------|
| 0 | `hero` | `#hero` | default stance, centred |
| 1 | `events` | `#events` | **arms folded**, left of the carousel |
| 2 | `interlude` | `#events + section` | relaxed, arms down |
| 3 | `sponsors` | `#sponsors` | crosses **right**, throws a punch |

Scroll drives a continuous `beatPos` (0→3); everything interpolates off it.
No React state in the frame loop — `beatNow` / `armNow` are module-level
mutable objects written by `BeatDriver` and read by `MiguelCharacter`.

**Key files**
- `src/lib/beats.ts` — the beat script. Camera, position, yaw, pose, arms.
- `src/lib/armPoses.ts` — solved procedural arm stances.
- `src/components/Spider3D.tsx` — the rig, bone layers, frame loop.
- `tools/miguel-rig/` — offline pose solver (Node, no deps).

---

## Findings that cost real time to establish

These are not obvious from the code and are expensive to rediscover. Trust
them or re-derive with `tools/miguel-rig/`.

### 1. `arm_poses.glb` has NO arms-crossed pose

The comment in `Spider3D.tsx` claims pose index 1 is "arms crossed". **It is
not.** FK on the actual baked keyframes puts both hands ~15 cm *below* the
shoulders, slightly forward, and *wider apart than the shoulders* — hands
hanging low in front. The six baked poses are really:

```
t=0  arms down at sides (identical to scene.gltf's bind pose)
t=1  hands low in front, near-clasped   ← the fake "arms crossed"
t=2  right arm out to the side
t=3  hands on hips
t=4  relaxed, hands low
t=5  punch — only 83% arm extension
```

This is why the character was dropping his hands at the events section.
Fixing it properly needs Blender + the original scene, so it was solved
procedurally instead (see below).

### 2. The two model files are the same skeleton at 81× different scale

`scene.gltf` and `arm_poses.glb` share bone **offsets** and hierarchy, but:

- **Arm bind rotations differ** (up to 0.15 in quaternion components). So a
  pose encoded as "delta from rest" lands somewhere different depending on
  which file you measured against. **Poses must be ABSOLUTE local
  quaternions** — which is what the clip's own tracks are, and what
  `armPoses.ts` stores.
- **Uniform 81.35× scale difference.** `scene.gltf` arm bones measure
  20.27 / 22.52; `arm_poses.glb` measures 0.2492 / 0.2768. Rotations are
  scale-invariant so this doesn't affect the solve, but it *will* confuse you
  if you compare raw positions across files. All numbers in `armPoses.ts` and
  the solver are in the **small (arm_poses) space**.
- The spine chain rotations *do* match between files, which is why
  chest-relative arm targets are stable.

### 3. THE BIND POSE IS YAWED 30.2° — author poses in CHEST space

This one caused a visibly broken fold and is the easiest trap to fall back
into. `scene.gltf`'s bind pose has the torso rotated about Y. The shoulder
balls are **not** mirror images:

```
arm_stretch.l   ( 0.2905, 0.5052,  0.0652)
arm_stretch.r   (-0.2004, 0.5052, -0.2203)
→ chest LEFT axis U = (0.864, 0, 0.503),  FORWARD = (−0.503, 0, 0.864)
```

The first version of `armPoses.ts` authored hand targets in raw root space.
Applied to a chest turned 30°, "cross the hands at the centreline" put **both
hands on the same side of the sternum**, fingers splayed at each other — the
render looked like the arms were knotted.

`solve.js` now works in chest space: `a` along the chest's left axis
(±0.2839 = the shoulder balls), `y` = absolute height (0.5052 = shoulders),
`c` = forward. **Never author poses in raw XYZ.**

### 4. Rig geometry and the hand frame

```
upper arm  0.2492      forearm  0.2768      total reach  0.5260
shoulder span 0.5679 (half 0.2839)
bone aim axis   = local +Y  (every arm bone)
hand: fingers   = local +Y
      palm      = local −Z          ← verified via the thumb bone offset,
      radial    = +X left / −X right   cross-checked against the bind pose
                                       where both palms face inward
```

**Shoulders are wider than the arms are long** (reach 0.526 vs span 0.568).
A hand cannot reach the opposite bicep — that needs ~0.541. A textbook
arms-fold is geometrically impossible on this rig. See the caveat below.

### 5. No baked pose is a relaxed CLOSED hand

Finger curl across the six baked poses, measured as fingertip-to-wrist span
vs. fully straight:

```
pose 0: 100%   pose 1: 87%   pose 2: 94%
pose 3:  87%   pose 4: 97%   pose 5: 65%  ← the only fist
```

So leaving fingers to the clip gives either near-splayed or a hard fist,
nothing in between. Splayed fingers meeting at the centreline was the single
ugliest part of the first fold attempt. Fingers are now part of the pose.

### 6. drei's `useAnimations` runs the mixer at default priority

It calls `useFrame((s, d) => mixer.update(d))` from the top of the component,
so it is already in the subscriber list *ahead* of `MiguelCharacter`'s own
`useFrame`. That ordering is what makes the procedural arm layer work: it
treats the mixer's output as a base layer and slerps off it. **If you move
the `useAnimations` call below the `useFrame`, the override silently stops
working.**

---

## What was built

### Procedural arm layer (`src/lib/armPoses.ts`)

Three stances as absolute local quaternions for **8 bones** (shoulder /
arm_stretch / forearm_stretch / **hand**, both sides), plus finger curl.
**Solved, not eyeballed** — a 12-DOF IK fit per arm targeting a hand position,
an elbow derived from a pole vector, and the hand's finger + palm directions.
Residuals ~0.1 mm on position, 0–7° on orientation.

| pose | reach | elbow | notes |
|------|-------|-------|-------|
| `fold` R / L | 68% / 72% | 85° / 92° | elbows low & tucked, hands cross centreline |
| `chamber` R | 35% | 41° | fist at ribs, drawn back behind chest plane |
| **`punch` R** | **99%** | **164°** | palm down, crossing past centreline |
| `punch` L | 34% | 39° | hard recoil to own ribs |

Fold verified in chest coords — right hand at `a +0.040` (past the centreline
to his left), left at `a −0.055`, left forearm **0.070 in front** so it lies
on top, elbows at y 0.28/0.30 (0.2 below shoulder), hands 0.122 apart so
nothing interpenetrates.

Constraints that will break the poses if ignored, all documented in the file
header:

1. Chest space, not root space (finding #3).
2. Absolute quaternions, not deltas (finding #2).
3. The solve **assumes `arm_twist` + `forearm_twist` sit at bind rest**, which
   is why `REST_BONES` are forced back there. (The hand is now solved, so it
   is no longer in that list.)

**Fingers** are stored once as the baked fist (pose 5 — the only artist-made
closed hand in the asset) plus a per-pose `curl` scalar; the runtime slerps
each finger from its own bind rest toward the fist by that amount. One number
per pose instead of 38 more quaternions, and it makes "relaxed closed"
(`fold` uses 0.62) a tunable that the source asset simply doesn't contain.
`armPose` on a beat is now purely vestigial for arms — the procedural layer
owns arms *and* fingers whenever `arms` is set.

### The punch is sequenced, not a single end pose

`resolveArms()` in `beats.ts` special-cases the final scroll segment, because
there's no beat after `sponsors` to interpolate toward. Over `beatPos` 2→3:

```
2.00 → 2.58   COIL     interlude pose winds into `chamber`
2.58 → 2.74   HOLD     fist parked at the ribs, loaded
2.74 → 2.90   FIRE     ease-out cubic → `punch` at full extension
2.90 → 3.00   HOLD     landed
```

Release finishes exactly at `PUNCH.impactStartFrac`, so contact coincides with
`ImpactCrack` starting to draw. Tuning knobs are `PUNCH.chamberFrac`,
`releaseFrac`, `impactStartFrac` in `beats.ts`.

### Blend model

`resolveArms` returns a `{ from, to, blend }` pair which the consumer reduces
to one target + one strength:

```
both set → slerp(from, to, blend), strength 1
from only→ hold `from`,  strength 1 − blend
to only  → hold `to`,    strength blend
neither  → baked clip owns the arms outright
```

**Non-obvious**: the damped `blend` scalar is **snapped, not damped, whenever
the from/to pair changes.** `blend` only means anything relative to a specific
pair; damping across a pair flip makes the wind-up fire to full extension,
snap back and re-extend. `resolveArms` is written so the effective *pose* is
continuous across every flip, so snapping the parameter is safe. Don't
"simplify" this away.

### Beat changes

- `events`: `arms: "fold"`, yaw −1.35 → **−2.45** (three-quarter view; a fold
  seen edge-on is just a lump), `pose.turn` 0.78 → **0.45** (the spine chain
  twists the head ~−1.26 rad at turn 1, so a big turn on an already-frontal
  body cranks his head past the lens and away from the carousel).
- `sponsors`: `char.x` −0.75 → **+0.5** (~78% across frame), `yaw` −2.78 →
  **−3.45** (past −π, so his forward faces back toward frame centre and he
  punches *into* the frame at the lens, not off the right edge), `look.x`
  −0.35 → −0.25.

---

## Verification status

- `npx tsc --noEmit` — passes.
- `npx next build` — passes.
- `node tools/miguel-rig/verify.js` — passes; sweeps `beatPos` 1.0→3.0 through
  the real resolver + FK and confirms the stances and sequencing.
- **NOT verified in a browser.** Nothing here has been looked at on screen.
  That's the first job next session.

`verify.js` reports `OK: extension is monotone through the release`.

Note the `ext%` column is measured from the **solved** shoulder ball, which
moves with the clavicle. An earlier version used a fixed anchor and printed
impossible values like 106%. If you see extension over 100%, the anchor is
wrong, not the pose.

---

## Known caveats (raised with the user, accepted)

1. **He covers the right side of the sponsors block.** The canvas is z20 and
   the sponsors `<section>` pins itself at z10, so he is unavoidably in front
   of it. The centred heading spans ~29–71vw and he clears it, but anything
   added to the right of that section will be behind him.
2. **The fold is a compromise the rig forces** (finding #4). The hands cannot
   reach the opposite bicep, so what's authored is elbows tucked low to the
   ribs with the forearms angling up and across, each hand crossing just past
   the centreline, left forearm 7 cm forward so it lies on top, right hand
   cupped under it. It reads as a proper formal fold at his on-screen size,
   but it is not a tight anatomical fold and can't be without different arm
   proportions.

---

## Re-tuning poses

`tools/miguel-rig/` — plain Node, no dependencies, repo-relative paths.

```bash
node tools/miguel-rig/solve.js    # re-solve → prints TS + writes poses.ts.txt
node tools/miguel-rig/verify.js   # sweep the whole scroll range, FK the hands
```

To change a stance, edit the `POSES` block in `solve.js`. Each side takes, all
in **chest space**:

- `hand` — target wrist position `[a, y, c]`
- `pole` — which way the elbow swings; the elbow itself is derived on the
  circle of geometrically valid positions
- `fingers` — direction the fingers point
- `palm` — direction the palm faces

plus a per-pose `curl` (0 = open, 1 = fist). Then paste the emitted block into
`armPoses.ts`.

Gotchas, each of which has already bitten once:
- **Author in chest space.** Raw XYZ ignores the 30° torso yaw (finding #3).
- **Position error is in metres-ish** (whole arm = 0.53) so it must be
  weighted ~1e3 above the radian-scale regulariser, or the regulariser wins
  and the solver just hands back the rest pose.
- **Don't author elbow positions directly** — hand-picked hand/elbow pairs are
  almost never exactly one forearm-length apart, and the solver then chases an
  impossible target. That's what the pole vector is for.
- **Measure extension from the solved shoulder ball**, not a fixed anchor; the
  clavicle moves.

---

## Suggested next steps

1. **Commit.** Everything above is untracked.
2. Run the page and actually look at the three beats. Specifically: does the
   fold read at the events section, and does the punch land with the crack?
3. Check the sponsors overlap on a real 16:9 viewport — `char.x` was computed
   for ~78% across at 16:10 and will sit slightly further left on 16:9.
4. `PUNCH.anticipation` (`beats.ts:195`) is now **dead** — confirmed zero
   references anywhere in `src/`. It pointed at the baked clip's wind-up key,
   which the procedural chamber replaced. Safe to delete; left in place rather
   than making an unrequested edit at a session boundary.
