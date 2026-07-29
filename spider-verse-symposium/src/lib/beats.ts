/* ════════════════════════════════════════════════════════════
   STORY BEATS — the art-directable scrollytelling script for Miguel.

   One entry per anchor section, in page order. Each beat names the CSS
   `selector` of the section it belongs to, so nothing in the existing page
   markup needs a `data-*` attribute — every selector below already exists.

   As the page scrolls, scrollState.beatPos travels 0 → N−1; the 3D side
   smoothsteps between the two adjacent beats and then damps toward the
   result, so every value below is a *target*, not an instant jump.

   KNOBS (world units / radians — the character is auto-fit to ~2.2 units
   tall with feet at y=0, camera looks down −Z):
   • cam        — camera position [x, y, z]. Smaller z = closer/tighter.
   • look       — camera aim point. Aim HIGHER to push him DOWN in frame.
   • char.x     — slides him along screen-X (+x = viewer's RIGHT, −x = LEFT).
   • char.yaw   — extra body rotation (rad) ADDED to the base 180° turned-
                  away pose. ± ~1.1 reads as a profile.
   • char.scale — size multiplier (0.85 = "small, in the background").
   • energy     — master multiplier on ALL glow: circuit pulse, emissive
                  bands, mask lenses, fresnel rim.
   • fade       — world-Y dissolve band for the lower body. Solid above
                  `top`, gone below `bottom`.
   • armPose    — which pose index in arm_poses.glb this beat holds. The
                  clip keys pose i at t = i seconds; scrolling between two
                  beats scrubs smoothly from one pose to the next.
   • zIndex     — the fixed canvas layer for this beat. THIS IS LOAD-BEARING:
                  the existing sections each pin their own content at a
                  different z, so the rig has to change layers as it travels.
                  See the note on each beat.
   ════════════════════════════════════════════════════════════ */

import type { ArmPoseName } from "./armPoses";

/** Viewport width at/below which the phone overrides apply. Matches the
    `isMobile` break FeaturedEventsSection already uses for its card list, so
    the deck and the rig always agree about which layout is on screen. */
export const MOBILE_BREAKPOINT = 768;

/** A partial beat. The nested groups are partial too, so a mobile block can
    move `char.x` alone without restating `yaw` and `scale`. */
export type BeatOverride = {
  cam?: [number, number, number];
  look?: [number, number, number];
  char?: Partial<Beat["char"]>;
  energy?: number;
  fade?: Partial<Beat["fade"]>;
  armPose?: number;
  arms?: ArmPoseName | null;
  zIndex?: number;
  pose?: Partial<Beat["pose"]>;
};

export type Beat = {
  /** CSS selector of the section this beat anchors to. Must already exist. */
  selector: string;
  /** For humans reading configs/logs only. */
  id: string;
  cam: [number, number, number];
  look: [number, number, number];
  char: { x: number; yaw: number; scale: number };
  energy: number;
  fade: { top: number; bottom: number };
  /** Pose index into arm_poses.glb (see ARM_CLIP in Spider3D.tsx).
      With `arms` set below this only still governs the FINGERS, since the
      procedural layer overrides the arm bones themselves. */
  armPose: number;
  /** Procedural arm stance (src/lib/armPoses.ts), overriding the baked clip.
      `null` = let the clip's `armPose` drive the arms as before. Exists
      because the baked clip has no arms-folded pose and its punch reads
      weakly — see the header of armPoses.ts. */
  arms: ArmPoseName | null;
  /** Stacking layer for the fixed canvas while this beat is dominant. */
  zIndex: number;
  /**
   * PHONE-ONLY OVERRIDES, merged over this beat below `MOBILE_BREAKPOINT`.
   *
   * An override map rather than a second BEATS array on purpose: the desktop
   * numbers above are the tuned ones and must not move. A beat with no
   * `mobile` block is byte-identical on both, and anything not named here
   * keeps its desktop value — so there is no way to edit this and silently
   * change the laptop view.
   *
   * WHY PHONES NEED THEIR OWN CAMERA AT ALL. `fov` is VERTICAL, so a
   * portrait viewport does not crop the top and bottom — it crops the SIDES.
   * At the hero's `cam.z` of 2.65 a 390x844 phone sees only ±0.328 of world
   * width, and the character's shoulders alone span ±0.28: he arrives with
   * both arms touching the frame edges. Every `cam` below is pulled back far
   * enough to buy that width back.
   */
  mobile?: BeatOverride;
  /** BODY POSE. Drives the spine→neck→head chain only — ARMS come from
      armPose above. The two systems own disjoint bone sets.
        turn — 0 = face fully away, 1 = the hero look-back, >1 = further round
        lean — chest pitch: + hunches forward, − opens the chest up (heroic)
        tilt — side roll through the chest (attitude/swagger)
        chin — head pitch: − lifts the chin, + drops the head              */
  pose: { turn: number; lean: number; tilt: number; chin: number };
};

export const BEATS: Beat[] = [
  {
    /* 1 ── HERO. The poster sandwich, exactly where the flat PNG used to be.
       z15 slots him BETWEEN the existing hero title layers: the solid fill
       (z8) reads behind him, the outlined stroke (z16) in front. The nav
       (z50), vignette (z20), scrim (z22) and bottom cards (z30) all stay
       above him, which is what the old <Image> at z15 did too. */
    selector: "#hero",
    id: "hero",
    cam: [0, 1.85, 2.65],
    look: [0, 1.82, 0],
    char: { x: 0, yaw: 0.0, scale: 1 },
    energy: 1.0,
    fade: { top: 0.75, bottom: 0.2 },
    armPose: 0, // default stance — matches the rig's own bind pose
    /* DRIVEN, not `null`. `null` means "the baked clip owns the arms", which
       means the procedural layer fades to zero weight and stops writing these
       bones — and whatever pose was last written stays on the skeleton. That
       is why scrolling down to the folded-arms section and back left him
       standing in the hero with his arms still crossed. See `rest` in
       armPoses.ts: the opening stance is now asserted every frame. */
    arms: "rest",
    zIndex: 15,
    pose: { turn: 1.0, lean: 0.0, tilt: 0.0, chin: 0.0 }, // the look-back
    /* PHONE — he is the whole hero. Centred, and the camera pulled back from
       2.65 to 3.1 so the frame is ±0.384 wide instead of ±0.328: enough that
       his shoulders (±0.28) sit inside the frame with air on both sides
       rather than bleeding off the edges. Everything else — the look-back,
       the pose, the glow — is the desktop beat untouched. */
    mobile: { cam: [0, 1.85, 3.1], look: [0, 1.8, 0] },
  },
  {
    /* 2 ── EVENTS. He crosses to the LEFT and PLANTS: arms folded, standing
       square, watching the deck rather than presenting it (armPose 1). The
       carousel is shifted/scaled into the right column beside him.

       Arms-crossed is a FRONTAL silhouette — seen edge-on it's just a lump,
       so `yaw` −2.45 puts him at a three-quarter view (~40° off the lens,
       angled toward the deck) instead of the near-profile −1.05 the old
       presenting pose used. `pose.turn` is DIALLED DOWN rather than up to
       match: the spine chain twists the head roughly −1.26 rad at turn 1, so
       a big turn on an already-frontal body would crank his head past the
       lens and away from the carousel. 0.45 lands the face on the camera
       while the body still addresses the deck.
       `lean`/`tilt` are near zero on purpose: this beat is "stood there,
       arms folded", not a lean-in.

       z11 is the critical bit: the events <section> is position:relative
       with NO z-index, so its dark-blue background, Ben-Day dots and
       diagonal colour blocks all paint at layer 0 — while its heading and
       carousel stage are pinned at z10. Sitting above that (z11) puts him
       in front of the deck instead of behind it: he stands at char.x −1.18,
       screen-left, which is exactly where the outermost carousel card sits,
       and reading as "in front of" that card rather than "walled off
       behind" it is the intended art direction. Safe to do — the rig's
       fixed wrapper is pointerEvents:"none" (see MiguelStage), so raising
       it above the cards and nav arrows never blocks a click; the hit test
       falls through to whatever is actually underneath. */
    selector: "#events",
    id: "events",
    cam: [0, 1.7, 3.6],
    look: [0.15, 1.55, 0],
    // x further LEFT + full scale: the folded-arms stance is a narrower
    // silhouette than the extended-arm one, so he can sit bigger and still
    // clear the carousel's new column.
    char: { x: -1.18, yaw: -2.45, scale: 1.0 },
    energy: 1.15,
    fade: { top: 0.72, bottom: 0.18 },
    armPose: 1, // fingers only now — `arms` below owns the arm bones
    arms: "fold", // ARMS FOLDED — standing, watching the deck
    zIndex: 11,
    pose: { turn: 0.45, lean: -0.02, tilt: 0.01, chin: -0.04 },
    /* PHONE — HE LEAVES. There is no room for a character beside a card deck
       on a 390px screen, so instead of standing next to it he walks out of
       frame to the left and gives the cards the whole width.

       x −1.7 is decisively gone, not just nudged: the frame is ±0.446 wide
       here and he is ±0.28, so he clears the left edge by more than a full
       body width. Anything smaller risks an elbow hanging in shot on a
       wider phone. Glow drops with him so nothing bleeds in from off-frame. */
    mobile: { char: { x: -1.7, yaw: -2.0, scale: 0.9 }, energy: 0.5 },
  },
  {
    /* 3 ── THE VIDEO BREAK (the 40vh loader1.mp4 strip between events and
       sponsors). That section has no id of its own and I'm not adding one,
       so this selects it as the first `section` sibling AFTER #events —
       NOT `#events + section` (adjacent-sibling), because a zero-height
       `<div>` wrapping the "POW!" ComicStamp sits between them in page.tsx,
       so `+` never matches and this beat silently dropped out of
       `activeBeats` (console-warned, easy to miss). Losing it isn't just a
       cosmetic gap: `resolveArms`/`punchDrive` key the whole wind-up-to-
       landed punch off `pos > maxIdx − 1`, so with this beat gone `maxIdx`
       drops from 3 to 2 and the ENTIRE punch sequence compresses into the
       events→sponsors gap, firing the instant `pos` clears 1 — i.e. while
       still on the "events" beat, before the six-card deck has even
       scrolled past on a phone.

       Pure transit: he drifts back toward centre, arms dropping to a relaxed
       hang (armPose 4), glow dimming so the video reads. z20 because this
       strip is opaque black at layer 0 and the sponsors block right after it
       pins itself at z10. */
    selector: "#events ~ section",
    id: "interlude",
    cam: [0, 1.8, 4.2],
    look: [-0.1, 1.6, 0],
    char: { x: -0.55, yaw: -1.9, scale: 0.88 },
    energy: 0.6,
    fade: { top: 0.66, bottom: 0.22 },
    // z30 for the same reason as the sponsors beat below — this strip's own
    // gradient masks sit at z10/z20 and would otherwise cut across him.
    armPose: 4, // relaxed, hands low
    /* Also DRIVEN — same reason as the hero beat. This one additionally
       cleans up the punch entry: resolveArms' RAISE stage blends from
       `beats[maxIdx-1].arms`, so with `null` the wind-up started from "no
       procedural pose at all" and had to ramp its weight in from zero. It is
       now a straight pose-to-pose blend, rest -> guard, at full weight. */
    arms: "rest",
    zIndex: 30,
    pose: { turn: 0.3, lean: 0.05, tilt: 0.0, chin: 0.03 },
    /* PHONE — HE COMES BACK, over the video strip. This is the return leg of
       the exit above, and it has to happen HERE rather than on the sponsors
       beat: the punch's wind-up starts at beatPos 2.4 (see PUNCH.raiseFrac)
       and char.x only interpolates between adjacent beats, so leaving the
       return until sponsors would keep him off-frame through the raise and
       the chamber — the whole wind-up would happen where nobody can see it,
       and he would arrive already swinging. Landing him at −0.1 by this beat
       means he walks back in over the video and is on screen, centred and
       loading, before the arm starts to move. */
    mobile: { char: { x: -0.1, yaw: -1.9, scale: 0.85 } },
  },
  {
    /* 4 ── SPONSORS -> THE PUNCH. He stands to the RIGHT of the section,
       squares up on the lens and throws a right cross.

       THE PUNCH IS NOT THE BAKED CLIP ANY MORE. Pose 5 of arm_poses.glb only
       reaches 83% arm extension from a wind-up key that flings the fist wide
       to the side, which is why it read as a limp shove. The procedural layer
       replaces it with a four-stage throw — raise to a 90° guard, cock the
       fist back, hold, then a 99%-extension release — sequenced by
       resolveArms() below rather than by this beat's `arms` value alone.
       ONLY THE RIGHT ARM MOVES; the left hangs at his side throughout, which
       is what stops the whole thing reading as flailing.

       CHARACTER IS ON THE RIGHT (x +0.45). Screen-x is not proportional to
       this — `look.x` −0.25 already pans the view left, which pushes him
       right on its own, so the useful range is small: +1.15 put him
       three-quarters off the right edge and +0.8 still cropped him by ~40%.
       The sponsors <section> pins itself
       at z10 and the canvas sits at z20, so he is unavoidably in FRONT of it;
       the centred heading artwork spans roughly 29–71vw, so he has to clear
       it on the right rather than stand over it. `yaw` is past −π so his
       forward faces back toward frame centre — he punches INTO the frame and
       at the lens, not off the right edge.

       NOTE: this is the last reachable anchor. The sponsors block and the
       footer sit too close to the page bottom for either to be scrolled to
       the viewport centre, so the punch is timed to land as you arrive at
       sponsors, with the footer settling underneath it. */
    selector: "#sponsors",
    id: "sponsors",
    cam: [0, 1.7, 3.2],
    look: [-0.25, 1.58, 0],
    // x 0.72 (was 0.45): at 0.45 his punching arm crossed the tail of the
    // SPONSORS heading artwork and ate the last letter. ~0.2 world units is
    // ~105 px at this camera, so this clears the heading's panel without
    // pushing his outstretched left arm off the right edge — which is what
    // happens past ~0.85. Retune together with `look.x` below: that pans the
    // view left and so ALSO pushes him right, which is why the useful range
    // on this knob is small.
    char: { x: 0.72, yaw: -3.45, scale: 1 },
    energy: 1.5,
    fade: { top: 0.45, bottom: 0.05 },
    armPose: 5, // fingers only — pose 5 is where the FIST is baked
    arms: "punch",
    /* z30, not z20. The video interlude above pins its own gradient masks at
       z10/z20 and the sponsors block at z10, so at z20 the rig TIED with the
       interlude's overlay — and a tie is broken by DOM order, which puts the
       overlay (rendered after MiguelStage) on top. That drew the section's
       dark edge band straight across his arm as he passed the boundary. */
    zIndex: 30,
    // lean + = forward drive into the punch; chin − keeps the face up.
    pose: { turn: 0.25, lean: 0.05, tilt: -0.04, chin: -0.05 },
    /* PHONE — THE PUNCH, dead centre. The desktop x of 0.72 exists only to
       clear the SPONSORS heading artwork, which on a phone is a narrow
       centred block he is meant to be in front of anyway — so he comes back
       to the middle and hits the glass in the middle of the screen.

       cam.z 3.6 rather than 3.2: at 3.2 the frame is ±0.42 and a figure
       squared up to the lens spans ±0.28 with the punching arm foreshortened
       toward the viewer, which leaves almost nothing either side. 3.6 gives
       ±0.446 — enough that the recoil and the shoulder drive cannot swing an
       arm off the edge at the exact moment the screen cracks. x 0.05 nudges
       him a hair right of centre so the crack does not land dead on the
       vertical midline, which reads as a decal rather than a hit. */
    mobile: { cam: [0, 1.7, 3.6], look: [0, 1.58, 0], char: { x: 0.05 } },
  },
];

/* ── ACTIVE BEATS ──
   ScrollRig rewrites this after measuring the DOM, dropping any beat whose
   selector didn't resolve. Everything downstream (BeatDriver, ImpactCrack)
   reads THIS, never BEATS directly, so a missing section degrades to "that
   beat doesn't exist" instead of silently shifting every later beat's index. */
export const activeBeats: { list: Beat[] } = { list: BEATS };

/**
 * Fold each beat's `mobile` block over it, or hand the list back untouched.
 *
 * Called by ScrollRig every time it measures, so a rotate or a resize across
 * the breakpoint re-resolves rather than keeping whichever layout the page
 * happened to load at.
 *
 * On desktop this returns the SAME ARRAY, not a copy — the identity check
 * matters because it is the guarantee that no phone-only value can leak into
 * a laptop render, and it makes the no-op path free.
 */
export function forViewport(list: Beat[], isMobile: boolean): Beat[] {
  if (!isMobile) return list;
  return list.map((b) => {
    const m = b.mobile;
    if (!m) return b;
    // Nested groups merge one level deep so an override can move char.x
    // alone; a plain spread would drop yaw and scale on the floor.
    return {
      ...b,
      ...m,
      char: { ...b.char, ...m.char },
      fade: { ...b.fade, ...m.fade },
      pose: { ...b.pose, ...m.pose },
    };
  });
}

/* ── THE PUNCH IMPACT ──
   Scroll positions (in beatPos units) where the punch reads as landing.
   Consumed by the screen-crack overlay (ImpactCrack.tsx) AND the chromatic-
   aberration spike in Spider3D.tsx so both stay frame-locked to the same
   scroll moment — scrolling back up reverses/clears everything.

   Expressed as a FRACTION of the last beat index so they survive a beat
   being dropped (see activeBeats above). */
/* ── PUNCH TIMING ──
   Fractions of the final beat index, so they survive a beat being dropped.
   The sequence is deliberately in four readable stages rather than one
   wind-and-throw, because a single blend from "arms wherever they were" to
   "fist extended" is what made the old punch look like a shove:

     .. → raiseFrac    RAISE     the right arm comes up to a 90° guard,
                                 upper arm out, forearm vertical. Slow.
     .. → chamberFrac  DRAW BACK the fist cocks down and behind the chest.
     .. → releaseFrac  HOLD      everything loaded, nothing moving.
     .. → impactStart  FIRE      accelerating into full extension.

   RAISE gets the largest share of the scroll: it is the readable part, and
   the two that follow are meant to feel fast by contrast. */
export const PUNCH = {
  /** Arm-clip time of the wind-up key (s) — armTime ≈ this = fully coiled. */
  anticipation: 109 / 24,
  /** Fraction where the right arm has finished coming up to the guard. */
  raiseFrac: 0.8,
  /** Fraction where the fist is FULLY CHAMBERED — cocked down and back. */
  chamberFrac: 0.9,
  /** Fraction where the arm starts firing. Narrow gap to impactStartFrac on
      purpose: the strike is easeOutExpo, so a wide window would spend most of
      itself with the fist already extended and waiting. */
  releaseFrac: 0.945,
  /** Fraction of the final beat index where the cracks START growing. This is
      also where the arm reaches full extension — contact and crack coincide. */
  impactStartFrac: 0.958,
  /** Fraction of the final beat index where the impact is fully landed. */
  impactEndFrac: 0.978,
};

/* ── TORSO DRIVE ──
   A punch is thrown with the hips and chest; the arm only delivers it. This
   is the one signal that carries that, and the torso, the clavicle and the
   arm all read it so they can never disagree with each other.

     −1  wound up   — chest twisted to HIS RIGHT, right shoulder drawn back
      0  neutral
     +1  delivered  — chest whipped to HIS LEFT, right shoulder driven forward

   Sign is in world-Y. On the sponsors beat his net facing (bodyYaw π plus
   char.yaw −3.45) puts him roughly square to the lens, where +Y turns him to
   his own left. That coupling is why this lives beside the beat that uses it
   rather than in the character. */
export type PunchDrive = {
  /** −1 wound right … +1 delivered left. */
  torso: number;
  /** 0 before the throw … 1 at contact. Scales impact-only garnish. */
  impact: number;
  /**
   * GRIP — 0 relaxed hand … 1 white-knuckle fist.
   *
   * Exists because "closed" and "clenched" are different poses and the asset
   * only has the first. The baked fist (pose 5 of arm_poses.glb, the source of
   * FIST_FINGERS) is an artist's neutral closed hand — the knuckles are shut
   * but the last phalanges are still soft, which is exactly the slack that
   * drains the tension out of a held wind-up. Spider3D over-curls the fingers
   * PAST that baked fist by this amount (see FIST_GRIP there), so the hand
   * tightens as he coils and stays tight through the strike.
   */
  grip: number;
};

const _drive: PunchDrive = { torso: 0, impact: 0, grip: 0 };

export function punchDrive(pos: number, out: PunchDrive = _drive): PunchDrive {
  const beats = activeBeats.list;
  const maxIdx = beats.length - 1;
  out.torso = 0;
  out.impact = 0;
  out.grip = 0;
  if (maxIdx <= 0 || pos <= maxIdx - 1) return out;

  const { seqStart, raiseEnd, drawEnd, fireStart, fireEnd } = punchStages(maxIdx);

  if (pos <= raiseEnd) {
    // Bringing the arm up already starts loading the chest — and the hand
    // closes with it: the fist is made on the way up, not at the last moment.
    const u = smooth((pos - seqStart) / (raiseEnd - seqStart));
    out.torso = -0.35 * u;
    out.grip = 0.5 * u;
  } else if (pos <= drawEnd) {
    // ANTICIPATION — wind fully onto the back foot, hand clamped shut.
    const u = smooth((pos - raiseEnd) / (drawEnd - raiseEnd));
    out.torso = -0.35 - 0.65 * u;
    out.grip = 0.5 + 0.5 * u;
  } else if (pos < fireStart) {
    out.torso = -1; // HOLD, fully coiled
    out.grip = 1; // …and squeezing. This is the tension the hold is FOR.
  } else if (pos < fireEnd) {
    /* THE STRIKE — the chest LEADS the arm, and must use the same easing
       FAMILY or it stops leading. Both are accelerating power curves now
       (see easeInStrike); the chest simply uses a lower exponent, so at every
       instant of the window it is further through its travel than the fist
       is — the body arrives first and the arm is whipped along behind it.
       The 1.15 gain lands the chest at full rotation around t = 0.9, i.e.
       just before contact, which is what a thrown cross actually does. */
    const t = clamp01((pos - fireStart) / (fireEnd - fireStart));
    out.torso = -1 + 2 * clamp01(Math.pow(t, 1.35) * 1.15);
    out.impact = easeInStrike(t);
    out.grip = 1; // stays clenched all the way through contact
  } else {
    /* FOLLOW-THROUGH — the chest settles back off the strike, which stops the
       end pose looking like a freeze-frame.

       Kept SMALL (0.10, was 0.28). The glass is frozen at the contact point,
       so every radian the torso unwinds afterwards walks the resting fist off
       its own crack — 0.28 moved it ~100px, which is what made the crack look
       like it was missing. 0.10 leaves the fist inside its own break while
       still reading as a settle. */
    const t = clamp01((pos - fireEnd) / Math.max(maxIdx - fireEnd, 1e-3));
    // Nothing unwinds while the glass is still breaking — see CONTACT_HOLD.
    const tr = contactHold(t);
    out.torso = 1 - 0.10 * smooth(tr);
    out.impact = 1;
    // The hand only half-relaxes on the follow-through — a fist that opens
    // straight after contact undoes the weight of the hit.
    out.grip = 1 - 0.35 * smooth(tr);
  }
  return out;
}

/** beatPos at which the cracks start / finish, for the current beat count. */
export function punchWindow() {
  const last = Math.max(activeBeats.list.length - 1, 1);
  return {
    start: last * PUNCH.impactStartFrac,
    end: last * PUNCH.impactEndFrac,
  };
}

/* ════════════════════════════════════════════════════════════
   PUNCH TEMPO — the rate-limited playhead.

   THE PROBLEM THIS SOLVES. Everything on this page is scroll-scrubbed, and a
   scrubbed animation plays exactly as fast as you scroll. The whole throw
   lives in the last beatPos unit, and the strike itself in 0.04 of one — so
   a trackpad flick crossed raise, chamber, hold, fire, contact and recoil
   inside two frames. There was no punch to see: the arm was down, then it
   was extended, and the glass was already broken.

   THE FIX. The punch — and ONLY the punch; the camera, the character's
   position and every other beat value stay welded to the scroll — runs off
   this playhead. It chases the scroll-derived position but can never move
   forward faster than the stage it is currently in allows:

     • scroll slowly and the limit never binds — you are still scrubbing the
       punch by hand, frame for frame, exactly as before;
     • flick past it and the playhead keeps performing behind you at its own
       tempo, so the punch always gets its ~2 seconds;
     • scroll back up and it rewinds at a flat, much faster rate — a rewind
       is a correction, not a performance, and it must feel immediate.

   Because it is still a POSITION (not a timeline that has been started), the
   whole thing stays reversible and stateless in the way the rest of the rig
   assumes: there is no "playing" flag anywhere, and stopping mid-wind-up
   holds the wind-up.

   The numbers are MINIMUM REAL SECONDS for each stage. They only apply when
   the scroll is outrunning them.
   ════════════════════════════════════════════════════════════ */
export const PUNCH_TEMPO = {
  /** The arm comes up to the guard. The readable stage — give it room. */
  raise: 0.6,
  /** The cock. Faster than the raise so it reads as loading, not posing. */
  draw: 0.42,
  /** Coiled and still. Short: a held pose is tension, a long one is a pause. */
  hold: 0.22,
  /** THE STRIKE. A real cross is 100–150 ms and this should not be slower. */
  fire: 0.13,
  /** Contact — fist stopped dead, glass breaking. */
  contact: 0.1,
  /** Recoil + settle out of the extension. */
  settle: 0.7,
  /** Rewind, in beatPos units per second (flat — see above). */
  rewind: 4,
};

/* Stage boundaries in beatPos, derived from PUNCH's fractions. Module-level
   scratch: this is recomputed every frame by three callers and must not
   allocate. Every consumer reads the fields immediately, so the shared object
   is safe (single-threaded, no reentrancy). */
const _stages = {
  seqStart: 0,
  raiseEnd: 0,
  drawEnd: 0,
  fireStart: 0,
  fireEnd: 0,
  contactEnd: 0,
};

/** The one place the stage boundaries are computed. Each bound is forced
    strictly above the previous one, because a dropped beat can shrink maxIdx
    enough to land the fractions out of order — which would divide by ~0. */
function punchStages(maxIdx: number) {
  const s = _stages;
  s.seqStart = maxIdx - 1;
  s.raiseEnd = Math.max(maxIdx * PUNCH.raiseFrac, s.seqStart + 1e-3);
  s.drawEnd = Math.max(maxIdx * PUNCH.chamberFrac, s.raiseEnd + 1e-3);
  s.fireStart = Math.max(maxIdx * PUNCH.releaseFrac, s.drawEnd + 1e-3);
  s.fireEnd = Math.max(maxIdx * PUNCH.impactStartFrac, s.fireStart + 1e-3);
  s.contactEnd = Math.max(maxIdx * PUNCH.impactEndFrac, s.fireEnd + 1e-3);
  return s;
}

/** Speed limit at `pos`, in beatPos units per second. Infinity = unlimited,
    which is everything before the throw starts: the rest of the page must
    scrub as freely as it always did. */
function punchRateAt(pos: number, maxIdx: number): number {
  if (maxIdx <= 0) return Infinity;
  const s = punchStages(maxIdx);
  if (pos < s.seqStart) return Infinity;
  const T = PUNCH_TEMPO;
  if (pos < s.raiseEnd) return (s.raiseEnd - s.seqStart) / T.raise;
  if (pos < s.drawEnd) return (s.drawEnd - s.raiseEnd) / T.draw;
  if (pos < s.fireStart) return (s.fireStart - s.drawEnd) / T.hold;
  if (pos < s.fireEnd) return (s.fireEnd - s.fireStart) / T.fire;
  if (pos < s.contactEnd) return (s.contactEnd - s.fireEnd) / T.contact;
  return Math.max(maxIdx - s.contactEnd, 1e-3) / T.settle;
}

const _clock = { pos: -1, last: 0 };

/**
 * Advance and read the punch playhead.
 *
 * Called by BOTH the R3F frame loop (BeatDriver) and ImpactCrack's own rAF,
 * which is why it advances from an absolute timestamp rather than a delta:
 * whoever runs first in a frame moves the clock, the second call sees a ~0
 * elapsed time and simply reads the same value back. No ordering dependency
 * between the two loops, and no way to double-advance.
 *
 * @param target  raw scrollState.beatPos (clamped here, so both callers agree)
 * @param now     performance.now()-timebase milliseconds (a rAF timestamp is)
 * @param reduced prefers-reduced-motion: no performance, just track the scroll
 */
export function punchPos(target: number, now: number, reduced = false): number {
  const c = _clock;
  const maxIdx = Math.max(activeBeats.list.length - 1, 0);
  const want = target < 0 ? 0 : target > maxIdx ? maxIdx : target;

  // First call, or reduced motion: snap. A reload landing at the bottom of
  // the page must NOT replay the punch on arrival.
  if (c.pos < 0 || reduced) {
    c.pos = want;
    c.last = now;
    return c.pos;
  }

  const dt = Math.min(Math.max((now - c.last) / 1000, 0), 0.1);
  if (dt <= 0) return c.pos; // same frame, already advanced (see above)
  c.last = now;

  if (want > c.pos) {
    // Infinity * dt = Infinity, so the unlimited region snaps to target.
    c.pos = Math.min(want, c.pos + punchRateAt(c.pos, maxIdx) * dt);
  } else if (want < c.pos) {
    c.pos = Math.max(want, c.pos - PUNCH_TEMPO.rewind * dt);
  }
  return c.pos;
}

/* ════════════════════════════════════════════════════════════
   ARM RESOLUTION — which procedural stance(s) the arms are between.

   Returns a FROM/TO pair plus a blend, which the 3D turns into:
     both set → slerp(from, to, blend), fully overriding the clip
     from only → hold `from`, override strength 1 − blend
     to only   → hold `to`,   override strength blend
     neither   → the baked clip owns the arms outright
   That falls out so every hand-off in and out of the clip is a fade, never
   a pop.

   The FINAL segment is special-cased: there is no beat after `sponsors` to
   interpolate toward, so the punch is sequenced against beatPos directly —
   coil → hold → release → hold — using the fractions in PUNCH above. That
   is what turns one static end pose into an actual thrown punch.
   ════════════════════════════════════════════════════════════ */
export type ArmBlend = {
  from: ArmPoseName | null;
  to: ArmPoseName | null;
  /** 0 = fully `from`, 1 = fully `to`. */
  blend: number;
  /** Exponential-damp rate for the blend. Raised hard on the release so the
      strike snaps instead of oozing into place. */
  lambda: number;
};

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (v: number) => {
  const t = clamp01(v);
  return t * t * (3 - 2 * t);
};
/* ── THE STRIKE CURVE ──
   Displacement of a limb thrown by a roughly constant torque: it leaves the
   chamber from a standstill, accelerates the whole way, and is travelling
   FASTEST at the moment of contact. The abrupt stop against the glass is
   then a real event — that velocity has to go somewhere, which is what the
   recoil, the shake and the crack are spending.

   This used to be easeOutExpo, which is the exact opposite shape: 50% of the
   travel in the first 10% of the window, i.e. the fist starts at maximum
   speed (an infinite acceleration — a teleport out of the chamber) and
   arrives creeping. That reads as a snap only because it is over before you
   can see it; slowed down to a watchable tempo it is a punch that lands
   gently, which is precisely the thing that looked unreal.

   Exponent 2 would be textbook constant acceleration; 1.8 keeps a little of
   the old snap without starting the fist off already moving. */
const easeInStrike = (v: number) => Math.pow(clamp01(v), 1.8);

/** Fraction of the post-impact window in which NOTHING moves — the fist is
    stopped dead against the glass. Derived from the crack window itself, so
    the hold lasts exactly as long as the cracks take to grow: he hits it,
    it breaks, and only then does anything rebound. Rescales the remaining
    time back to 0→1 so the settle keeps its full shape. */
const CONTACT_HOLD =
  (PUNCH.impactEndFrac - PUNCH.impactStartFrac) /
  Math.max(1 - PUNCH.impactStartFrac, 1e-3);
const contactHold = (t: number) =>
  clamp01((t - CONTACT_HOLD) / Math.max(1 - CONTACT_HOLD, 1e-3));

/** Damp rates for the procedural arm blend.

    RAISED HARD for the throw now that PUNCH_TEMPO paces it. These used to be
    doing two jobs — smoothing the signal AND supplying the punch's timing,
    since a scrubbed blend has no timing of its own. The playhead owns the
    timing now, so all that is left for the damp is to take the edge off, and
    a low rate here only buys lag: at `release` the blend crosses its whole
    range in 130 ms, and lambda 14 (τ ≈ 70 ms) would leave the arm barely
    two-thirds extended at the frame the glass breaks.

    Every stage's blend curve arrives at its boundary with ZERO velocity
    (smoothstep, and easeInStrike leaves the chamber at zero), so the lag —
    which is proportional to velocity — vanishes exactly where the from/to
    pair flips and Spider3D snaps the damped value. That is what keeps these
    rates from popping at the stage boundaries. */
export const ARM_BLEND_DAMP = { normal: 2.6, wind: 9, release: 45 };

/** How far back off full extension the fist rebounds. 0.12 of the
    chamber→punch blend ≈ 6 cm of travel: visible as a snap, not a retreat. */
const RECOIL_DEPTH = 0.12;

export function resolveArms(pos: number, out: ArmBlend): ArmBlend {
  const beats = activeBeats.list;
  const maxIdx = beats.length - 1;
  out.lambda = ARM_BLEND_DAMP.normal;

  if (maxIdx <= 0) {
    out.from = beats[0]?.arms ?? null;
    out.to = out.from;
    out.blend = 1;
    return out;
  }

  /* ── final segment: the punch sequence ──
     RAISE → DRAW BACK → HOLD → FIRE. Every stage hands over at blend 1 into
     the next stage's blend 0 on the SAME pose, so the effective arm is
     continuous across all three boundaries even though the from/to pair (and
     therefore the meaning of `blend`) jumps. Spider3D relies on that: it
     snaps its damped blend whenever the pair changes. */
  if (pos > maxIdx - 1) {
    const { seqStart, raiseEnd, drawEnd, fireStart, fireEnd } = punchStages(maxIdx);

    if (pos <= raiseEnd) {
      // RAISE — whatever the previous beat was doing comes up to the guard:
      // upper arm out, forearm vertical. The left arm is already hanging in
      // `guard`, so it settles there and then stops moving for good.
      out.from = beats[maxIdx - 1].arms;
      out.to = "guard";
      out.blend = smooth((pos - seqStart) / (raiseEnd - seqStart));
      out.lambda = ARM_BLEND_DAMP.wind;
      return out;
    }
    if (pos <= drawEnd) {
      // DRAW BACK — the cock. Short and smooth.
      out.from = "guard";
      out.to = "chamber";
      out.blend = smooth((pos - raiseEnd) / (drawEnd - raiseEnd));
      out.lambda = ARM_BLEND_DAMP.wind;
      return out;
    }
    if (pos < fireStart) {
      // HOLD — fist cocked, everything loaded, nothing moving.
      out.from = "chamber";
      out.to = "chamber";
      out.blend = 1;
      out.lambda = ARM_BLEND_DAMP.wind;
      return out;
    }
    if (pos < fireEnd) {
      /* FIRE — accelerating out of the chamber (see easeInStrike), so full
         extension is reached at exactly `fireEnd`, which is exactly where
         the cracks start. Contact and impact are now the same instant.

         Under the old easeOutExpo the fist was ~97% extended by the halfway
         point and then hung there waiting for the scroll to catch up to the
         crack — the arm arrived, paused, and only then did the glass break. */
      const t = clamp01((pos - fireStart) / (fireEnd - fireStart));
      out.from = "chamber";
      out.to = "punch";
      out.blend = easeInStrike(t);
      out.lambda = ARM_BLEND_DAMP.release;
      return out;
    }
    /* RECOIL — the arm rebounds off the glass and settles back onto the
       strike. Modelled as a dip back toward `chamber` that returns to zero,
       so the pose the page ends on is still the full extension: a half-sine
       that peaks early (t^0.55) and decays, i.e. a hard bounce that damps
       out rather than a symmetric wobble.

       Blend NEVER leaves the chamber→punch pair here, so the arm stays
       continuous across the fire/recoil boundary and Spider3D's pair-change
       snap is not triggered. */
    const t = clamp01((pos - fireEnd) / Math.max(maxIdx - fireEnd, 1e-3));
    /* DEAD STOP FIRST. A fist does not bounce off the instant it touches —
       it stops, and the thing it hit is what breaks. Holding full extension
       across the crack-growth window (CONTACT_HOLD) is the single change that
       makes this read as hitting something solid rather than tapping it.
       It also gives the damped blend those ~100 ms to converge, so the arm
       finishes arriving at full extension DURING the freeze. */
    const tr = contactHold(t);
    out.from = "chamber";
    out.to = "punch";
    out.blend = 1 - RECOIL_DEPTH * Math.sin(Math.PI * Math.pow(tr, 0.55)) * (1 - tr);
    out.lambda = ARM_BLEND_DAMP.release;
    return out;
  }

  /* ── ordinary segment between two adjacent beats ── */
  const i = Math.max(Math.min(Math.floor(pos), maxIdx - 1), 0);
  out.from = beats[i].arms;
  out.to = beats[i + 1].arms;
  out.blend = smooth(pos - i);
  return out;
}

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
