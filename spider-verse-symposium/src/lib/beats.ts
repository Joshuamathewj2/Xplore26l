/* ════════════════════════════════════════════════════════════
   STORY BEATS — the art-directable scrollytelling script.

   One entry per `[data-beat]` section in page order. As the page scrolls,
   scrollState.beatPos travels 0 → N−1; the 3D side smoothsteps between the
   two adjacent beats and then damps toward the result, so every value below
   is a *target*, not an instant jump.

   KNOBS (all in world units / radians — the character is auto-fit to
   ~2.2 units tall with feet at y=0, camera looks down −Z):
   • cam        — camera position [x, y, z]. Smaller z = closer/tighter.
   • look       — camera aim point [x, y, z]. Aim HIGHER to push the
                  character DOWN in frame; aim at his head (~y 1.8) to centre.
   • char.x     — slides the whole character along screen-X
                  (+x = viewer's RIGHT, −x = LEFT).
   • char.yaw   — extra body rotation (rad) ADDED to the base 180° turned-
                  away pose. ± ~1.1 reads as a profile. The procedural
                  over-the-shoulder head-turn/breathing layer on top.
   • char.scale — size multiplier (0.85 = "small, in the background").
   • energy     — master multiplier on ALL the glow: circuit-trace pulse,
                  emissive bands, mask lenses, fresnel rim. 1 = the hero
                  look, 0.5 = dormant, 1.5 = threat-display.
   • fade       — world-Y dissolve band for the lower body. Solid above
                  `top`, gone below `bottom`. Lower both to reveal more leg
                  (only materials that reach the band at load time can fade —
                  head/hair are opaque by design, see applyFresnel PERF note).
   ════════════════════════════════════════════════════════════ */

export type Beat = {
  /** For humans reading configs/logs only. */
  id: string;
  cam: [number, number, number];
  look: [number, number, number];
  char: { x: number; yaw: number; scale: number };
  energy: number;
  fade: { top: number; bottom: number };
  /** BODY POSE for this beat. Drives the spine→neck→head chain only. ARMS
      are NOT driven here: each beat's arm/hand pose is baked in Blender into
      /models/miguel2099/arm_poses.glb (pose i keyed at t = i seconds, in
      BEATS order) and scrubbed by scroll — see ARM_CLIP in Spider3D.tsx.
      The two systems own disjoint bone sets. All values are radians except
      `turn`, which SCALES the signature over-the-shoulder look-back.
        turn — 0 = face fully away, 1 = the hero look-back, >1 = further round
        lean — chest pitch: + hunches forward, − opens the chest up (heroic)
        tilt — side roll through the chest (attitude/swagger)
        chin — head pitch: − lifts the chin, + drops the head              */
  pose: { turn: number; lean: number; tilt: number; chin: number };
};

export const BEATS: Beat[] = [
  {
    // 1 ── HERO: the poster sandwich. MUST match Spider3D's FRAME values so
    // the top-of-page look is exactly the signed-off hero framing.
    id: "hero",
    cam: [0, 1.85, 2.65],
    look: [0, 1.82, 0],
    // TURN: back to camera — the signature look-back
    char: { x: 0, yaw: 0.0, scale: 1 },
    energy: 1.0,
    fade: { top: 0.75, bottom: 0.2 },
    pose: { turn: 1.0,  lean: 0.0,   tilt: 0.0,   chin: 0.0 }, // the signed-off look-back
  },
  {
    // 2 ── ABOUT "Where Dimensions Collide": he drifts right, camera pushes
    // in a touch and follows him; copy sits on the left.
    id: "about",
    // Pulled back a touch + aim raised so the whole head clears the top edge
    // (mesh top ~2.4 with hair; aiming low cropped the hair at this distance).
    cam: [0.25, 1.8, 2.45],
    look: [0.55, 1.78, 0],
    // TURN: starts turning in; crossed arms begin to read
    char: { x: 0.55, yaw: -0.55, scale: 1 },
    energy: 1.15,
    fade: { top: 0.7, bottom: 0.15 },
    pose: { turn: 0.72, lean: -0.05, tilt: 0.04,  chin: -0.03 }, // half-turned toward the copy, chest opening
  },
  {
    // 3 ── EVENTS: near-profile on the left edge, camera pulled back so the
    // event grid owns the right two-thirds of the screen.
    id: "events",
    cam: [0, 1.6, 3.3],
    look: [-0.55, 1.5, 0],
    // TURN: past profile, gesturing toward the grid
    char: { x: -0.85, yaw: -1.15, scale: 1 },
    energy: 0.9,
    fade: { top: 0.75, bottom: 0.2 },
    pose: { turn: 0.5, lean: 0.09,  tilt: -0.05, chin: 0.05 }, // mostly away, hunched + head down, scanning the grid
  },
  {
    // 4 ── TRACKS: low-angle "hero shot" from beneath, more leg revealed
    // (fade band dropped), glow rising. Copy on the left.
    id: "tracks",
    // Low angle kept, but pulled back (2.45 -> 3.2) and re-aimed: the old
    // framing cropped him at the top AND ran him off the bottom-right.
    // Verified through this exact camera in Blender: full figure + headroom.
    cam: [-0.35, 0.95, 3.2],
    look: [0.3, 1.42, 0],
    // TURN: three-quarter — hands on hips reads fully
    char: { x: 0.45, yaw: -2.15, scale: 1 },
    energy: 1.3,
    fade: { top: 0.5, bottom: 0.05 },
    pose: { turn: 0.34, lean: -0.12, tilt: 0.06,  chin: -0.10 }, // low hero angle: chest up, chin lifted
  },
  {
    // 5 ── SPONSORS: he recedes — small, centred, dimmed — behind the
    // sponsor grid. Energy low so the cards read first.
    id: "sponsors",
    cam: [0, 1.9, 4.6],
    look: [0, 1.5, 0],
    // TURN: nearly front-on, relaxed
    char: { x: 0, yaw: -2.6, scale: 0.85 },
    energy: 0.55,
    // top 0.8 sat exactly at the hanging fingertips at 0.85 scale (hands end
    // ~0.8 world-Y) and nibbled the hands — kept safely below them now.
    fade: { top: 0.68, bottom: 0.25 },
    pose: { turn: 0.18, lean: 0.05,  tilt: 0.0,   chin: 0.03 }, // relaxed, disengaged, looking off
  },
  {
    // 6 ── REGISTER: THE PUNCH — full-body right cross straight at the lens.
    // The arm clip carries the arm/shoulder (wind-up key at t≈4.54s, impact
    // at t=5); the TORSO rotation lives here so his back is thrown into it:
    // char.yaw −2.78 (vs −3.05 square-on) yaws the whole body ~21° past
    // front, driving the punching (right) shoulder AT the camera, and
    // pose.turn 0.25 spirals the spine/neck/head back so the face stays on
    // the lens over the extended arm. Camera pushed in (3.35 -> 2.95) so the
    // foreshortened fist reads BIG.
    id: "register",
    cam: [0, 1.7, 3.2],
    look: [0, 1.58, 0],
    char: { x: 0, yaw: -2.78, scale: 1 },
    energy: 1.5,
    fade: { top: 0.45, bottom: 0.05 },
    // lean + = slight forward drive into the punch; chin − keeps the face up.
    pose: { turn: 0.25, lean: 0.05, tilt: -0.04, chin: -0.05 },
  },
];

/* ── THE PUNCH IMPACT (register beat) ──
   Scroll positions (in beatPos units) where the final punch reads as landing.
   Consumed by the screen-crack overlay (ImpactCrack.tsx) AND the chromatic-
   aberration spike in Spider3D.tsx so both stay frame-locked to the same
   scroll moment — scrolling back up reverses/clears everything. */
export const PUNCH = {
  /** Arm-clip time of the wind-up key (s) — beatPos ≈ this = fully coiled. */
  anticipation: 109 / 24,
  /** beatPos where the cracks START growing (fist nearly extended). */
  impactStart: 4.9,
  /** beatPos where the impact is fully landed (cracks complete, shake fires). */
  impactEnd: 4.98,
};

/* ── MOTION FEEL ──
   lambda        — exponential-damp rate toward the beat target (per second).
                   Lower = heavier/laggier camera, higher = tighter tracking.
   reducedLambda — used when prefers-reduced-motion: near-instant snap so the
                   scene still matches the section without gliding around. */
export const BEAT_DAMP = {
  /** Pose damping = lambda * this. <1 makes the BODY lag the camera slightly,
      so he settles into each beat instead of snapping with it. */
  poseFactor: 0.7,
  lambda: 2.4,
  reducedLambda: 30,
};
