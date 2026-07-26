"use client";

import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF, useAnimations, Environment, Lightformer } from "@react-three/drei";
import {
  EffectComposer,
  Bloom,
  ChromaticAberration,
  ToneMapping,
  HueSaturation,
  BrightnessContrast,
  Vignette,
} from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import * as THREE from "three";
import { scrollState } from "@/lib/scrollState";
import { BEATS, BEAT_DAMP, PUNCH } from "@/lib/beats";

/* ════════════════════════════════════════════════════════════
   CINEMATIC LOOK CONFIG — everything an art pass would tweak.
   Sections: TONE (film response), LIGHTS (the rig), MAT (per-
   surface shading), POST (composer effects).
   ════════════════════════════════════════════════════════════ */

/* ── TONE — the "film stock". With the EffectComposer active the renderer's
   own tone mapping is bypassed (postprocessing forces NoToneMapping and tone
   maps in its own final pass), and that pass has NO exposure uniform — so
   `exposure` here is applied as a multiplier on every light + envmap instead,
   which is optically the same knob. ── */
const TONE = {
  // "aces"    = filmic S-curve, rich saturated punch (best fit for neon 2099)
  // "agx"     = Blender-4-style neutral: handles hot saturated lights without
  //             hue skew, but reads flatter/grayer — try if ACES feels garish
  // "neutral" = Khronos PBR neutral, most faithful to the raw textures
  mode: "aces" as "aces" | "agx" | "neutral",
  exposure: 1.15, // master brightness: raise if he sinks into the black bg
};
const TONEMAP_MODE = {
  aces: ToneMappingMode.ACES_FILMIC,
  agx: ToneMappingMode.AGX,
  neutral: ToneMappingMode.NEUTRAL,
};

/* ── MAT — per-surface families, matched by material name. The model ships
   ONLY baseColor maps (skin's 2048² map is a near-uniform pale salmon — no
   pores, no normal/rough/AO anywhere), so ALL form must come from lighting,
   fresnel and grading; these knobs are what stop it reading pasty. ── */
type RimOpts = { color: string; color2: string; power: number; intensity: number };
const MAT: Record<
  "suit" | "skin" | "hair" | "eye",
  { tint?: string; env: number; roughness?: number; rim: RimOpts }
> = {
  // Suit (B_O_D_Y / H_E_A_D mask / B_A_N_D): slick sheen + the neon red→cyan
  // fresnel edge that sells the 2099 silhouette against the dark bg.
  suit: {
    env: 0.7, // envmap strength (lower = matte fabric, higher = glossy)
    roughness: 0.45,
    rim: { color: "#e23636", color2: "#00e5ff", power: 3.0, intensity: 0.55 },
  },
  // Skin: the pasty culprit. `tint` MULTIPLIES the flat pale map into a
  // deeper warm tan; low env keeps neon from washing it gray; the warm
  // orange→red fresnel fakes subsurface backscatter (light through the ear/
  // jawline) since there's no real SSS. Push tint darker for more bronze.
  skin: {
    tint: "#dda183",
    env: 0.35,
    roughness: 0.58, // livelier highlight than the authored 0.77 chalk-matte
    rim: { color: "#ff8a5c", color2: "#ff2e63", power: 2.0, intensity: 0.4 },
  },
  // Hair has NO texture (flat near-black) — high env + a cool sheen rim keep
  // it reading as glossy hair instead of a void against the background.
  hair: {
    env: 1.3,
    roughness: 0.5,
    rim: { color: "#4a5a7a", color2: "#00e5ff", power: 2.5, intensity: 0.3 },
  },
  // Eyes: glossy already (roughness 0 in the file) — just a whisper of rim.
  eye: {
    env: 1.0,
    rim: { color: "#e23636", color2: "#00e5ff", power: 3.0, intensity: 0.15 },
  },
};
// Emissive maps (suit bands + eye lenses) are pushed past 1.0 into HDR so the
// bloom pass (threshold 1) picks up ONLY them — nothing else glows.
const EMISSIVE_BOOST = 2.4;
// The Spidey lenses ship no emissive map, so we self-light them — pushed past
// the bloom threshold (1.0) they pick up a glow. 0 disables.
/* Suit colours for UNTEXTURED rigs (Miguel). Extracted from the original
   Blender materials: Material.001 ~ near-black, Material.002 = red. */
/* ── MASKED vs UNMASKED ────────────────────────────────────────────────────
   This Miguel ships BOTH an unmasked head (separate skin / hair / eyeball
   meshes) AND the masked look (the H_E_A_D material on the body mesh). Hiding
   the bare-head parts by MATERIAL name leaves the mask, which is the iconic
   2099 silhouette. Remove an entry here to bring that part back. */
// E_Y_E = the UNMASKED head's eyeballs; with the mask on they poke through
// as a stray glowing dot beside the head.
const HIDE_MATERIALS = ["H_A_I_R", "S_K_I_N", "E_Y_E"];

/* ── SUIT LOOK — strip the blue, pulse the 2099 bands ─────────────────────
   The texture is blue+red. `desat` removes colour (1 = fully greyscale) and
   `tint` multiplies what's left, so we go BLACK while keeping the circuit
   pattern's luminance detail — much better than flattening it to a solid fill.
   `accent` re-tints the emissive band map, which then throbs via `pulse` and
   feeds the bloom. */
const SUIT_LOOK = {
  desat: 0.84,          // slightly less greyscale so a little suit blue survives
  tint: "#2c3550",      // dark BLUE cast — multiplied over the desaturated texture
  accent: "#ff2436",    // colour of the glowing 2099 bands
  pulse: { min: 0.8, max: 4.0, rate: 1.15 }, // emissive throb (intensity, Hz-ish)
  rimPulse: { min: 0.15, max: 1.9, rate: 0.9 }, // fresnel rim breathing (wide = obvious)
  eyePulse: { min: 2.0, max: 7.0, rate: 1.15 }, // mask lenses — brightest element
  // ── THE 2099 CIRCUITRY — the suit texture's OWN trace linework, lit up. ──
  // The baseColor maps draw the circuit pattern in a slightly lighter blue
  // than the base suit (measured from the PNGs: base = rgb(16,56,136), traces
  // = rgb(16,64–79,136–144) — only the GREEN channel separates them). The
  // shader isolates those texels (green threshold gated to blue-dominant
  // areas) and drives them as pulsing emissive, so the suit's actual printed
  // circuits glow — no bands, no scanlines. Reference: ATSV Miguel — near-
  // black blue suit, markings glowing an ominous red.
  circuit: {
    color: "#ff2d3f", // trace glow — movie red. Try "#00e5ff" for cyber-cyan.
    // Green-channel mask thresholds in LINEAR colour space (the shader sees
    // sRGB-decoded texels): base g ≈ 0.040–0.045, traces ≈ 0.051–0.077.
    // Lower maskLo → more of the faint tracery lights; raise if base leaks.
    maskLo: 0.047,
    maskHi: 0.064,
    // Whole-net breathing: emissive multiplier on the traces. max > 1 clears
    // the bloom threshold so the peaks halo. rate ≈ Hz.
    pulse: { min: 0.7, max: 3.6, rate: 0.5 },
    // Energy crawling THROUGH the net: a soft moving gradient (two detuned
    // sines in UV space) modulates trace brightness, so lit packets travel
    // along the linework instead of the whole net throbbing in unison.
    // amp 0 = pure breathing; 1 = full-depth travelling packets.
    flow: {
      amp: 0.8,
      scale: 7.0,  // packets per UV tile (higher = shorter packets)
      speed: 0.45, // packet travel speed (cycles/s)
      angle: 0.9,  // travel direction in UV space (radians) — off-axis on
                   // purpose: axis-aligned motion is what reads "scanline"
    },
  },
};

const SUIT = {
  black: "#191926", // lifted off the #0A0A0A background so it can't vanish
  red: "#c4172b",
  roughness: 0.38,
  metalness: 0.45,
};

const LENS_GLOW = 1.6;
const LENS_GLOW_COLOR = "#dce8ff"; // cool white; try "#e23636" for red lenses

/* ── POST — the composer stack (bloom → lens CA → filmic tonemap → grade →
   vignette). Set `enabled: false` to fall back to plain ACES on the canvas. ── */
const POST = {
  enabled: true,
  bloom: {
    intensity: 0.85, // glow strength on the 2099 bands/eyes; >1.2 gets hazy
    threshold: 1.0, // only HDR (boosted emissive / hot speculars) blooms
    smoothing: 0.25,
    radius: 0.7,
  },
  // Tiny radial chromatic aberration — lens fringe grows toward frame edges,
  // stays off his face at centre. The Spider-Verse "misprint" accent.
  chroma: { offset: 0.0012, modulationOffset: 0.15 },
  grade: {
    saturation: 0.14, // post-tonemap sat push — the anti-pasty knob (−1..1)
    contrast: 0.12, // deepens shadows, crispens the key (−1..1)
    brightness: 0.0,
  },
  vignette: { offset: 0.28, darkness: 0.72 }, // darkened corners = framed, cinematic
};
const CHROMA_OFFSET = new THREE.Vector2(POST.chroma.offset, POST.chroma.offset);
// One-shot RGB-split spike when the final punch lands (see PUNCH in beats.ts):
// the ChromaticAberration effect holds THIS Vector2 as its uniform value, so
// mutating it per-frame drives the effect with no React involved. Fired by
// BeatDriver on the upward crossing of PUNCH.impactEnd, decays in ~0.3s, and
// re-arms when the user scrolls back above the impact.
const PUNCH_FX = { landed: false, spike: 0, boost: 0.014, decay: 7 };

/* ── PERF — the cost dials. Post-processing runs a full-screen pass per effect,
   so its cost scales with PIXEL COUNT: `dpr` is by far the biggest lever
   (dpr 2 renders ~1.8× the pixels of 1.5, and every pass pays it). Lower these
   if it's janky; raise `maxDpr` toward 2 on a strong GPU for crisper edges. ── */
const PERF = {
  maxDpr: 1.5, // hard cap on device pixel ratio (was 2 — main cause of lag)
  multisampling: 0, // MSAA inside the composer. 0 = off (cheapest); 2–4 = smoother
  bloomLevels: 5, // mip levels of blur (was 8 — each level is another pass)
  envResolution: 128, // cubemap res for the Lightformer environment
};

/* ── THE LINEUP — three Spider-Men across the frame. Each is an independent
   rigged model that runs the same over-the-shoulder look-back, staggered by
   `delay` so they turn one after another instead of in lockstep.

   All three are Mixamo-rigged with full PBR maps (baseColor + normal +
   metallicRoughness), optimised from ~313 MB of 4K source down to ~30 MB
   (1K WebP textures + mesh simplification).

   • x     — world position across the frame (−left, +right)
   • yaw   — extra body rotation on top of POSE.bodyYaw (angle him inward/outward)
   • delay — seconds added to this character's turn, for a staggered reveal
   • scale — per-model size trim (auto-fit normalises height first)          ── */
const CHARACTERS = [
  { key: "miguel", url: "/models/miguel2099/scene.gltf", x: 0, yaw: 0, delay: 0, scale: 1.0 },
];

/* ── CLIPS — baked Mixamo animation playback.
   Each GLB now ships one clip (swinging / rope swinging / start swinging),
   downloaded from Mixamo and transferred onto these rigs in Blender. The clip
   drives the FULL body, which is why the procedural arm/finger posing is no
   longer needed (and stays disabled).
   • enabled:false → fall back to the procedural pose system.
   • timeScale     → playback speed.
   • startOffset   → per-character phase so the trio never moves in unison. ── */
const CLIPS = {
  // OFF. Mixamo clips retarget onto this rig well enough to LOOK right in a
  // Blender still, but the motion reads badly in the browser. The procedural
  // system below (staggered spine->neck->head look-back, breathing, weight
  // shift, cursor-follow glance) is what actually works and what was signed
  // off on. The clip data is still in the GLB if this is revisited.
  enabled: false,
  timeScale: 1.0,
  startOffset: { raimi: 0.0, homecoming: 0.9, tasm2: 1.7 } as Record<string, number>,
};

/* ── ARM CLIP — baked per-section arm poses, SCRUBBED by scroll. ──────────
   Authored directly on THIS rig in Blender (no retargeting, no runtime
   aiming — both are what mangled arms before) and visually verified per pose
   in Workbench renders before export. One clip, pose i keyed at
   t = i * secondsPerPose, in BEATS order:
     0 hero (= the live default stance, byte-identical to the file's bind-
       node pose — verified), 1 about (arms crossed), 2 events (right arm
       pointing out), 3 tracks (hands on hips), 4 sponsors (relaxed, hands
       low), 5 register (FULL-BODY PUNCH at the lens — right arm extended
       to the camera, left fist recoiled). An extra ANTICIPATION key sits at
       t = 109/24 ≈ 4.54 s (fist chambered, lead hand measuring) so the
       4→5 scroll reads wind-up → release; the screen-crack overlay
       (ImpactCrack.tsx) + the chroma spike land it at PUNCH.impactEnd.
   The clip is FILTERED to arm/hand rotation tracks only, so the procedural
   spine→neck→head system (look-back, breathing, cursor glance) keeps its
   bones untouched — the two layers drive disjoint bone sets and cannot
   fight. Position/scale tracks are dropped outright (root motion killed).
   Scrubbing (action.time = f(beatPos), action stays paused) means no
   playback timing to manage: scroll position IS the pose. `damp` eases the
   scrub so poses morph instead of snapping (lower = heavier arms). */
const ARM_CLIP = {
  enabled: true,
  // NOTE: bump ?v= whenever the clip is re-exported. drei's useGLTF caches by
  // URL in memory and the browser caches the bytes, so re-exporting to the SAME
  // filename silently keeps serving the old poses (this bit us: the punch was
  // in the file but the page still showed the thwip).
  url: "/models/miguel2099/arm_poses.glb?v=punch1",
  secondsPerPose: 1, // Blender keyed pose i at frame i*24 @ 24 fps = i seconds
  damp: 2.2, // exp-damp lambda for the scrub time (≈ BEAT_DAMP feel)
  // Arm/hand bones ONLY (Auto-Rig Pro names, "." already stripped by
  // GLTFLoader — e.g. "arm_stretchl_37"). Deliberately excludes spine/neck/
  // head/root/legs so the procedural upper-body layer keeps full ownership.
  boneRe: /(shoulder|arm_stretch|arm_twist|forearm_stretch|forearm_twist|hand|index\d|middle\d|ring\d|pinky\d|thumb\d)/,
};

/* ────────────────────────────────────────────────────────────
   FRAMING — the model is auto-fit at runtime (measured, centered,
   scaled to TARGET_HEIGHT, feet on the floor) so we don't guess.
   Tune these to move/zoom him without touching the model.
   ──────────────────────────────────────────────────────────── */
const FRAME = {
  targetHeight: 2.2, // world units the figure is normalised to
  // Aiming HIGHER pushes the character DOWN in frame; smaller camZ zooms in.
  camY: 1.85, // camera height
  camZ: 2.65, // distance — smaller = tighter crop
  fov: 30,
  lookY: 1.82, // aim point; raise with camY to drop him further down the frame
};

// Dissolve the lower body into the background. Alpha ramps by WORLD height:
// fully solid above `top`, fully gone below `bottom` (feet≈0, head≈targetHeight).
// NOTE: keep `top` BELOW where the hands hang (~y 1.05 with arms down), or the
// dissolve eats the forearms/hands and the figures look chopped up. The old
// 1.5/0.85 band only looked fine while the arms were still stuck out in T-pose
// at shoulder height — once they dropped into a natural stance they fell right
// into the fade. Fades through the thighs now, well clear of the fingertips.
const FADE = {
  top: 0.75, // above this world-Y = fully opaque
  bottom: 0.2, // below this = fully transparent (dissolves through the shins)
};

/* ────────────────────────────────────────────────────────────
   POSE — the over-the-shoulder look-back.

   The whole figure yaws away from camera (bodyYaw). Then a twist travels UP
   the spine chain — waist first, head last (overlapping action) — bringing
   the face back around toward the viewer, where it HOLDS with breathing +
   a small cursor-driven glance layered on top.

   Every `twist` is radians about the WORLD-VERTICAL axis. Per frame we
   re-express world-up in each bone's parent space and premultiply a
   quaternion delta (new_local = (parent⁻¹·ΔworldYaw·parent) · rest), so the
   twist is a true vertical spiral regardless of the rig's rest flexion —
   naive local-euler adds compounded each bone's ~7° forward lean into a kink.

   Retuning cheat-sheet (fine-tune by eye):
   • bodyYaw sign        → which way the body faces away from camera.
   • all twist signs     → flip TOGETHER to switch which shoulder he looks
     over. For the face to come back to the lens, sum(twist) ≈ -bodyYaw.
     Here sum = -1.98 vs bodyYaw 2.15 → he settles aimed ~10° past camera,
     which reads more alive than a dead-center stare.
   • delay               → when each bone joins the turn (s after `hold`).
     Wider spread = lazier, more whip-like turn; tighter = snappier.
   • dur                 → per-bone ease time.
   • back: true          → that bone overshoots its target and settles back
     (follow-through). `overshoot` scales how far past it swings.
   • headPitch/neckPitch → chin attitude in the held pose (- = chin up).
   • lean                → chest tilts sideways into the turn (roll).
   ──────────────────────────────────────────────────────────── */
type ChainKey = "spine" | "spine1" | "spine2" | "neck" | "head";

const POSE = {
  bodyYaw: Math.PI, // rad — body FULLY faced away (back to camera, 180°)
  hold: 0.85, // beat (s) holding still before the lazy head turn begins
  overshoot: 0.7, // low = controlled settle, no bouncy snap (nonchalant)
  headPitch: -0.06, // held chin attitude for the head (- = chin up)
  neckPitch: -0.03, // held chin attitude for the neck
  lean: 0.03, // faint chest side-tilt (roll on Spine2)
  // Nonchalant over-the-shoulder glance: the body stays turned away and the
  // twist is almost ALL in the neck + head (the spine barely moves), so he
  // just cranks his head around to show half his face. Sum ≈ -72° puts the
  // face near profile (180° body − 72° ≈ 108° = half-face). Flip all signs
  // together to look over the other shoulder.
  chain: [
    { key: "spine", twist: 0.0, delay: 0.0, dur: 1.4, back: false },
    { key: "spine1", twist: -0.06, delay: 0.2, dur: 1.4, back: false },
    { key: "spine2", twist: -0.16, delay: 0.5, dur: 1.3, back: false },
    { key: "neck", twist: -0.48, delay: 1.0, dur: 1.3, back: true },
    { key: "head", twist: -0.56, delay: 1.4, dur: 1.2, back: true },
  ] as { key: ChainKey; twist: number; delay: number; dur: number; back: boolean }[],
};

/* Idle life on top of the held pose. Breathing pitches the chest around its
   own left-right axis (head gently counter-nods); the cursor glance is
   damp-smoothed and fades in only once the head has settled. */
// Kept intentionally tiny — he should read as almost still, holding the glance,
// with only a faint breath and a whisper of cursor response.
const IDLE = {
  breath: { rate: 1.0, spine1: 0.007, spine2: 0.009, head: -0.004 },
  sway: { yaw: 0.005, rate: 0.22, bob: 0.004, bobRate: 0.45 },
  glance: {
    yawHead: 0.045, // rad of head yaw at full cursor deflection
    yawNeck: 0.02,
    pitchHead: 0.03,
    pitchNeck: 0.015,
    damp: 1.6, // lower = slower, weightier tracking
  },
};

/* ════════════════════════════════════════════════════════════
   CHARACTER POSING — kill the bind pose, give each Spidey a stance.

   ── HOW THE RIGS ACTUALLY WORK (measured from the GLB bind poses, not
   guessed — a script decoded each file's node hierarchy and dumped every
   arm/hand bone's world-space axes):

   • All three are standard Mixamo: each bone's LOCAL +Y points along the
     bone toward its child. Character faces +Z, his left is +X.
   • They are NOT identical bind poses: raimi's arms hang ~42° below
     horizontal, homecoming ~30° with pre-bent elbows, tasm2 ~40°. So we do
     NOT pose with per-rig euler offsets — instead every arm bone is AIMED
     at an absolute target DIRECTION in character space (swing quaternion
     from its live bind direction to the target). One pose set then lands
     identically on all three rigs, whatever their rest pose.
   • Fingers: local +Z ≈ palm normal on every digit of every hand of every
     rig, so CURL = positive rotation about LOCAL +X, same sign both hands
     (Mixamo mirrors the frames so flexion keeps its sign). Thumb frames
     are pre-rotated so the same local-X curl tucks the thumb toward the
     palm. (Signs still exposed below — thumbs are the classic Mixamo
     trouble spot.)

   ── DIRECTION CONVENTION for every Vec3 target below (character frame):
        X = character's LEFT   (his left hand hangs at +X)
        Y = up
        Z = the way HIS CHEST faces
     The body is yawed ~180° away from camera, so on screen:
        char +X → viewer LEFT, char −Z → TOWARD the camera.
     e.g. [0.3, -0.95, 0.1] = "upper arm points mostly down, a little out
     to his left, a little forward". Vectors are normalized at runtime —
     only the ratios matter.
   ════════════════════════════════════════════════════════════ */

type Vec3 = [number, number, number];
type FingerName = "thumb" | "index" | "middle" | "ring" | "pinky";

/* ── FINGER AXIS KNOBS — the signs most likely to need eyeball flips.
   If fingers curl BACKWARD (away from the palm), flip `curlSign` to -1.
   If only thumbs misbehave, flip `thumbCurlSign` alone.
   If the web-shooter fingers splay the wrong way, flip `splaySign`. ── */
const FINGER = {
  // MASTER SWITCH: false = every digit stays at its bind pose. Mixamo rest
  // hands read fine — this is the safe fallback if anything looks wrong.
  // Currently OFF alongside ARMS.enabled so the hands are guaranteed clean.
  enabled: false,
  // Measured per SEGMENT on all 3 rigs (script-decoded bind poses): local +Z
  // is palm-ward on every phalange of every digit of every hand (dot with the
  // palm normal ≥ 0.76, mostly ≥ 0.9), so +X rotation curls toward the palm —
  // SAME sign on both hands (Mixamo mirroring preserves flexion sign).
  curlAxis: "x" as "x" | "y" | "z",
  curlSign: 1, // + curls toward the palm (flip to -1 if fingers bend backward)
  thumbCurlSign: 1, // thumbs have their own sign (classic Mixamo pain point)
  splayAxis: "z" as "x" | "y" | "z", // in-palm-plane spread axis (≈ palm normal)
  splaySign: 1, // + spreads index/pinky APART for the thwip pose
  // Per-segment curl multipliers knuckle→tip (kept conservative — deep curls
  // with no palm collision read broken fast).
  segFalloff: [1.0, 1.0, 0.7],
  thumbFalloff: [1.0, 0.55, 0.35],
};

/* ── WRIST SAFETY SWITCH. All six hands list the THUMB as the hand bone's
   first child, so naively aiming the hand's "axis to first child" cranked
   every wrist ~50° (the mangled-hands bug). Default = don't aim wrists at
   all: the hand keeps its bind attitude relative to the forearm (always
   anatomically sane) and only ArmPose.twist.hand applies. Set true to
   swing-aim hands at ArmPose.hand — now correctly along the MIDDLE-finger
   axis. ── */
const ARMS = {
  // MASTER SWITCH for the whole arm layer.
  //
  // false (current) = arms stay at their BIND pose. That is NOT a T-pose on
  // these rigs — measured from the inverse-bind matrices, the shoulder→elbow
  // already rests 30–42° below horizontal (raimi −42°, homecoming −30°,
  // tasm2 −40°), i.e. a natural relaxed A-pose. The models are correctly
  // rigged; it was our procedural aiming that was deforming them.
  //
  // true = re-enable procedural arm aiming (ArmPose targets below). Only flip
  // this back on while you can watch the result — that layer is what produced
  // the mangled arms.
  enabled: false,
  aimHands: false,
};

/* tasm2's web-shooter hand. false = that hand just relaxes like the rest. */
const THWIP = { enabled: false }; // off while ARMS.enabled is false

/* One arm's pose: aim directions for each segment + roll + finger curls.
   Elbow bend is IMPLICIT: it's the angle between `arm` and `fore`. */
type ArmPose = {
  arm: Vec3; // upper-arm aim (shoulder→elbow)
  fore: Vec3; // forearm aim (elbow→wrist) — diverge from `arm` to bend the elbow
  hand: Vec3; // wrist→knuckles aim — ONLY used when ARMS.aimHands is true
  // Roll (rad) about each bone's own long axis, + = ccw looking down the bone.
  // The aim leaves roll at whatever the bind pose had — palm-facing lives here.
  twist: { arm: number; fore: number; hand: number };
  // Base curl per digit (rad at the knuckle; segFalloff scales segs 2-3).
  // ~0 = straight, ~0.35 = relaxed, ~1.2 = fist. `splay` spreads
  // index (+) / pinky (−) in the palm plane — the thwip "V".
  curl: { thumb: number; index: number; middle: number; ring: number; pinky: number; splay: number };
};

/* Everything that makes one Spidey read differently from the next. */
type Personality = {
  // Bind-pose → stance blend: when it starts (s after spawn), how long,
  // and how much it overshoots + settles (easeOutBack `s`, 0 = none).
  poseDelay: number;
  poseDur: number;
  overshoot: number;
  // Clavicle offsets ADDED to its bind direction: drop>0 lowers the
  // shoulder line (kills the scarecrow shrug), forward>0 rounds it.
  shoulder: { drop: number; forward: number };
  // Occasional shoulder-shrug pulse (amp in dir-units, rate in rad/s).
  shrug: { amp: number; rate: number };
  L: ArmPose;
  R: ArmPose;
  // Pelvis attitude = weight shift. roll + tilts LEFT hip up (weight on the
  // left leg), yaw + swings his left hip forward, sway = slow living lean.
  hips: { roll: number; yaw: number; pitch: number; swayAmp: number; swayRate: number };
  // rate/scale MULTIPLY the global IDLE.breath; armLift = how much the
  // inhale floats the upper arms outward (chest expanding into them).
  breath: { rate: number; scale: number; armLift: number };
  // Organic never-still drift on the arm aim dirs. `lag` = phase delay per
  // segment down the chain (upper→fore→hand) = drag / follow-through.
  wobble: { amp: number; rate: number; lag: number };
  // Finger-curl oscillation (fidget). Per-side scale so e.g. a web-shooter
  // hand only micro-twitches while the relaxed hand drums.
  fidget: { amp: number; rate: number; side: { L: number; R: number } };
  // Held head attitude on TOP of the look-back: roll = curious ear-to-
  // shoulder tilt, bob = restless micro-nod amplitude.
  head: { roll: number; bob: number };
  // Personal clock offset (s) — keeps the three idles permanently desynced.
  phase: number;
};

/* ── THE THREE PERSONALITIES ─────────────────────────────────
   raimi      = the veteran: planted power stance, fists, slow heavy breath.
   homecoming = the kid: narrow, restless, shrugs, drumming fingers.
   tasm2      = the cocky one: weight popped onto one hip, thwip hand aimed
                out beside the hip toward the camera side.               ── */
const PERSONALITIES = {
  raimi: {
    poseDelay: 0.05,
    poseDur: 1.3,
    overshoot: 1.2, // weighty settle
    shoulder: { drop: 0.06, forward: 0.02 },
    shrug: { amp: 0, rate: 0.3 }, // the veteran doesn't shrug
    L: {
      // arms held a touch away from the body (lat spread), elbows soft
      arm: [0.34, -0.92, -0.06],
      fore: [0.26, -0.86, 0.32],
      hand: [0.24, -0.85, 0.32],
      twist: { arm: 0, fore: 0, hand: 0 },
      curl: { thumb: 0.35, index: 0.65, middle: 0.7, ring: 0.72, pinky: 0.75, splay: 0 }, // loose fists
    },
    R: {
      arm: [-0.34, -0.92, -0.06],
      fore: [-0.26, -0.86, 0.32],
      hand: [-0.24, -0.85, 0.32],
      twist: { arm: 0, fore: 0, hand: 0 },
      curl: { thumb: 0.32, index: 0.6, middle: 0.66, ring: 0.68, pinky: 0.7, splay: 0 },
    },
    hips: { roll: 0, yaw: 0, pitch: 0, swayAmp: 0.012, swayRate: 0.13 },
    breath: { rate: 0.85, scale: 1.25, armLift: 0.05 }, // slow, deep
    wobble: { amp: 0.02, rate: 0.5, lag: 0.9 },
    fidget: { amp: 0.03, rate: 0.9, side: { L: 1, R: 1 } },
    head: { roll: 0, bob: 0 },
    phase: 0,
  },
  homecoming: {
    poseDelay: 0.15,
    poseDur: 1.1,
    overshoot: 1.6, // springy, youthful settle
    shoulder: { drop: 0.1, forward: 0.05 }, // sloped + slightly rounded
    shrug: { amp: 0.07, rate: 0.45 }, // periodic little shrug pulses
    L: {
      // arms close to the body, hanging near-vertical
      arm: [0.2, -0.96, 0.02],
      fore: [0.13, -0.9, 0.36],
      hand: [0.12, -0.88, 0.36],
      twist: { arm: 0, fore: 0, hand: 0 },
      curl: { thumb: 0.25, index: 0.3, middle: 0.38, ring: 0.42, pinky: 0.5, splay: 0 }, // open, relaxed
    },
    R: {
      arm: [-0.22, -0.95, 0.0],
      fore: [-0.15, -0.89, 0.38],
      hand: [-0.14, -0.87, 0.38],
      twist: { arm: 0, fore: 0, hand: 0 },
      curl: { thumb: 0.28, index: 0.32, middle: 0.4, ring: 0.45, pinky: 0.52, splay: 0 },
    },
    hips: { roll: 0, yaw: 0, pitch: 0.02, swayAmp: 0.02, swayRate: 0.31 },
    breath: { rate: 1.25, scale: 1.4, armLift: 0.06 }, // faster, lighter
    wobble: { amp: 0.045, rate: 0.9, lag: 1.2 }, // fidgety arms
    fidget: { amp: 0.07, rate: 1.6, side: { L: 1, R: 1 } }, // drumming fingers
    head: { roll: 0.1, bob: 0.012 }, // curious tilt + micro-nods
    phase: 5.2,
  },
  tasm2: {
    poseDelay: 0.1,
    poseDur: 1.2,
    overshoot: 1.35,
    shoulder: { drop: 0.05, forward: 0 },
    shrug: { amp: 0, rate: 0.3 },
    L: {
      // inner arm: just hangs, loose
      arm: [0.3, -0.93, 0.04],
      fore: [0.22, -0.87, 0.35],
      hand: [0.2, -0.86, 0.35],
      twist: { arm: 0, fore: 0, hand: 0 },
      curl: { thumb: 0.3, index: 0.38, middle: 0.45, ring: 0.5, pinky: 0.55, splay: 0 },
    },
    R: {
      // THE THWIP HAND — outer edge of the lineup. Arm swings a little out
      // and back (char −Z = toward camera), forearm juts the hand out beside
      // the hip so the web-shooter silhouette reads from behind.
      arm: [-0.46, -0.86, -0.16],
      fore: [-0.42, -0.42, -0.75],
      hand: [-0.4, -0.35, -0.8], // only used if ARMS.aimHands is enabled
      twist: { arm: 0, fore: 0, hand: 0 }, // ← add hand roll here if the palm faces wrong
      // index + pinky straight, middle + ring buried, thumb tucked = thwip
      curl: THWIP.enabled
        ? { thumb: 0.55, index: -0.05, middle: 1.05, ring: 1.1, pinky: 0.05, splay: 0.22 }
        : { thumb: 0.3, index: 0.38, middle: 0.45, ring: 0.5, pinky: 0.55, splay: 0 },
    },
    hips: { roll: 0.07, yaw: 0.1, pitch: 0, swayAmp: 0.015, swayRate: 0.17 }, // weight popped left
    breath: { rate: 1.0, scale: 1.0, armLift: 0.04 },
    wobble: { amp: 0.03, rate: 0.6, lag: 1.0 },
    fidget: { amp: 0.05, rate: 1.1, side: { L: 1, R: 0.4 } }, // thwip hand stays composed
    head: { roll: -0.06, bob: 0 },
    phase: 9.7,
  },
} satisfies Record<string, Personality>;

// Window-normalized pointer (-1..1), shared into the frame loop. Uses a window
// listener (not R3F's canvas pointer) so head-follow still works while the
// canvas itself is pointer-events:none and never blocks the UI beneath it.
function usePointer() {
  const pointer = useRef({ x: 0, y: 0 });
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);
  return pointer;
}

/* ────────────────────────────────────────────────────────────
   FRESNEL RIM — inject a view-dependent emissive term into the
   standard material so edges catch neon regardless of light angle.
   ──────────────────────────────────────────────────────────── */
function applyFresnel(
  mat: THREE.MeshStandardMaterial,
  rimOpts: RimOpts,
  needsFade: boolean,
  onShader?: (sh: { uniforms: Record<string, { value: unknown }> }) => void
) {
  const rim = new THREE.Color(rimOpts.color);
  const rim2 = new THREE.Color(rimOpts.color2);
  // Dithered (hashed) alpha instead of blended transparency — the fade can
  // dissolve the lower body with NO draw-order/sorting artifacts across the
  // model's many overlapping meshes (skin, suit, hair, eyes).
  //
  // PERF: hashed alpha forces a shader `discard`, which disables the GPU's
  // early-Z rejection. So only pay it on materials whose geometry actually
  // reaches into the fade band — head/hair/eyes sit entirely above it and
  // stay fully opaque (and cheap). The fade code below is a no-op for them.
  if (needsFade) mat.alphaHash = true;
  mat.onBeforeCompile = (shader) => {
    onShader?.(shader as unknown as { uniforms: Record<string, { value: unknown }> });
    shader.uniforms.uRimColor = { value: rim };
    shader.uniforms.uRimColor2 = { value: rim2 };
    shader.uniforms.uRimPower = { value: rimOpts.power };
    shader.uniforms.uRimIntensity = { value: rimOpts.intensity };
    shader.uniforms.uFadeTop = { value: FADE.top };
    shader.uniforms.uFadeBottom = { value: FADE.bottom };
    shader.uniforms.uDesat = { value: SUIT_LOOK.desat };
    shader.uniforms.uTint = { value: new THREE.Color(SUIT_LOOK.tint) };
    shader.uniforms.uAccent = { value: new THREE.Color(SUIT_LOOK.accent) };
    shader.uniforms.uTime = { value: 0 };
    const cir = SUIT_LOOK.circuit;
    shader.uniforms.uCircuitColor = { value: new THREE.Color(cir.color) };
    shader.uniforms.uCircuitLo = { value: cir.maskLo };
    shader.uniforms.uCircuitHi = { value: cir.maskHi };
    shader.uniforms.uCircuitMin = { value: cir.pulse.min };
    shader.uniforms.uCircuitMax = { value: cir.pulse.max };
    shader.uniforms.uCircuitRate = { value: cir.pulse.rate };
    shader.uniforms.uFlowAmp = { value: cir.flow.amp };
    shader.uniforms.uFlowScale = { value: cir.flow.scale };
    shader.uniforms.uFlowSpeed = { value: cir.flow.speed };
    shader.uniforms.uFlowDir = {
      value: new THREE.Vector2(Math.cos(cir.flow.angle), Math.sin(cir.flow.angle)),
    };

    // ── Vertex: pass the fragment's WORLD-space Y (post-skinning) ──
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
         varying float vWorldY;`
      )
      .replace(
        "#include <project_vertex>",
        `#include <project_vertex>
         vWorldY = ( modelMatrix * vec4( transformed, 1.0 ) ).y;`
      );

    // ── Fragment: fresnel rim + world-height alpha fade ──
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
         uniform vec3 uRimColor;
         uniform vec3 uRimColor2;
         uniform float uRimPower;
         uniform float uRimIntensity;
         uniform float uFadeTop;
         uniform float uFadeBottom;
         uniform float uDesat;
         uniform vec3 uTint;
         uniform vec3 uAccent;
         uniform float uTime;
         uniform vec3 uCircuitColor;
         uniform float uCircuitLo;
         uniform float uCircuitHi;
         uniform float uCircuitMin;
         uniform float uCircuitMax;
         uniform float uCircuitRate;
         uniform float uFlowAmp;
         uniform float uFlowScale;
         uniform float uFlowSpeed;
         uniform vec2 uFlowDir;
         varying float vWorldY;
         // Circuit-trace mask, computed in color_fragment from the ORIGINAL
         // texel (before the desaturation overwrites it), consumed later in
         // emissivemap_fragment. 0 = base suit, 1 = on a circuit line.
         float gCircuit = 0.0;`
      )
      // Fold the world-height fade into diffuseColor.a EARLY so the hashed-alpha
      // discard (alphahash_fragment, later in the chain) picks it up.
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
         // ── Circuit-trace mask (must run BEFORE the desaturation below,
         // which overwrites diffuseColor). The suit's circuit linework is the
         // base blue with an elevated GREEN channel (measured: base linear
         // g ≈ 0.040–0.045, traces 0.051–0.077), so a green smoothstep gated
         // to blue-dominant texels isolates exactly the printed traces —
         // reds, the silver web-shooter and greys all fail the blue gate.
         float _cirBlue = smoothstep( 0.10, 0.20, diffuseColor.b - diffuseColor.r );
         gCircuit = smoothstep( uCircuitLo, uCircuitHi, diffuseColor.g ) * _cirBlue;
         // Desaturate to black BUT KEEP THE REDS. A flat desaturate also greys
         // out the spider emblem and the red suit panels (they live in the same
         // baseColor texture), so measure how red-dominant each texel is and
         // protect those, pushing them toward the accent colour instead.
         float _lum = dot( diffuseColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) );
         float _red = clamp( ( diffuseColor.r - max( diffuseColor.g, diffuseColor.b ) ) * 3.5, 0.0, 1.0 );
         vec3 _blackened = mix( diffuseColor.rgb, vec3( _lum ), uDesat ) * uTint;
         vec3 _redKept   = uAccent * ( 0.30 + 1.5 * _lum );
         diffuseColor.rgb = mix( _blackened, _redKept, _red );
         diffuseColor.a *= smoothstep( uFadeBottom, uFadeTop, vWorldY );`
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
         // normal + vViewPosition are defined by here in MeshStandard frag
         float fres = pow(1.0 - clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0), uRimPower);
         vec3 rimMix = mix(uRimColor, uRimColor2, smoothstep(0.55, 1.0, fres));
         totalEmissiveRadiance += rimMix * fres * uRimIntensity;

         // ── 2099 circuit glow: the texture's own trace linework (gCircuit,
         // isolated in color_fragment) lights up and pulses. Two layers:
         //   1. BREATHING — the whole net swells uCircuitMin→Max (squared
         //      sine = sharper throb, matching the material pulse above).
         //   2. FLOW — two detuned sines moving through UV space modulate
         //      trace brightness, so bright packets crawl ALONG the lines
         //      (visible only where gCircuit > 0, hence circuit-shaped —
         //      not a screen-space band).
         float cirBreath = pow( 0.5 + 0.5 * sin( uTime * uCircuitRate * 6.2831853 ), 2.0 );
         float cirPulse = uCircuitMin + ( uCircuitMax - uCircuitMin ) * cirBreath;
         #ifdef USE_MAP
           float _fa = dot( vMapUv, uFlowDir ) * uFlowScale * 6.2831853;
           float _ft = uTime * uFlowSpeed * 6.2831853;
           float cirFlow = 0.5
             + 0.32 * sin( _fa - _ft )
             + 0.18 * sin( _fa * 1.73 + _ft * 0.61 + 2.4 );
         #else
           float cirFlow = 0.5; // untextured material: no UVs to flow along
         #endif
         // amp 0 → constant 1; amp 1 → full-depth 0..2 packet modulation.
         float cirMod = 1.0 + uFlowAmp * ( cirFlow - 0.5 ) * 2.0;
         totalEmissiveRadiance += uCircuitColor * gCircuit * cirPulse * cirMod;`
      );
  };
  mat.needsUpdate = true;
}

/* ── Animation helpers (module-level scratch objects: zero per-frame GC) ── */
const UP = new THREE.Vector3(0, 1, 0);
const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);
const LOCAL_AXIS = { x: X_AXIS, y: Y_AXIS, z: Z_AXIS } as const;
const _qParentInv = new THREE.Quaternion();
const _qDelta = new THREE.Quaternion();
const _vAxis = new THREE.Vector3();
// Scratch for the limb aim pass:
const _qChar = new THREE.Quaternion(); // character(group) → world
const _qParent = new THREE.Quaternion();
const _qRestW = new THREE.Quaternion();
const _qSwing = new THREE.Quaternion();
const _qTmp = new THREE.Quaternion();
const _qTwist = new THREE.Quaternion();
const _vTarget = new THREE.Vector3();
const _vTmp = new THREE.Vector3();
const _vRestDir = new THREE.Vector3();

const easeInOutCubic = (p: number) =>
  p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
// Ends with a swing PAST 1 then settles back — classic follow-through.
const easeOutBack = (p: number, s: number) =>
  1 + (s + 1) * Math.pow(p - 1, 3) + s * Math.pow(p - 1, 2);

// Cheap organic drift: three detuned sines (irrational frequency ratios) —
// never visibly repeats, no noise-table lookups. Output roughly ±1.
const wob = (t: number) =>
  Math.sin(t) * 0.62 + Math.sin(t * 1.83 + 1.7) * 0.27 + Math.sin(t * 3.71 + 4.2) * 0.11;

// Bind-pose quaternion snapshot, stored ON the bone. userData survives HMR
// module reloads (the drei scene cache outlives this module), whereas a fresh
// module-level cache would re-snapshot an already-POSED skeleton as "rest"
// and permanently corrupt the pose (double-curled fingers etc.). This is only
// the FALLBACK — the capture effect prefers ground-truth rest rebuilt from
// the skeleton's inverseBindMatrices, which is pose-independent.
const restOf = (b: THREE.Object3D) => {
  let q = b.userData.__bindQuat as THREE.Quaternion | undefined;
  if (!q) {
    q = b.quaternion.clone();
    b.userData.__bindQuat = q;
  }
  return q;
};

// "mixamorigLeftForeArm_09" → "leftforearm": lowercase, strip the numeric
// export suffix and the (possibly ":"-stripped) mixamorig namespace. Bones
// without the namespace (some rigs' Hips) just lose the suffix.
function semanticBoneName(raw: string): string {
  const n = raw.toLowerCase().replace(/_\d+$/, "");
  const i = n.indexOf("mixamorig");
  return i >= 0 ? n.slice(i + 9).replace(/^:/, "") : n;
}

/* A bone driven by AIMING: we store its long axis (dir to its child, bone-
   local — constant) and where that axis pointed in character space at bind.
   Per frame we swing rest→target in world space; no per-rig euler guessing. */
type AimSlot = "shoulder" | "arm" | "fore" | "hand";
type AimBone = {
  bone: THREE.Bone;
  rest: THREE.Quaternion;
  boneAxis: THREE.Vector3; // bone→child dir in BONE-local space (unit)
  bindDir: THREE.Vector3; // same dir in CHARACTER space at bind (unit)
  slot: AimSlot;
  side: "L" | "R";
};
type FingerBone = {
  bone: THREE.Bone;
  rest: THREE.Quaternion;
  finger: FingerName;
  seg: number; // 1 = knuckle … 3 = tip
  side: "L" | "R";
  phase: number; // personal fidget phase so fingers never move in unison
};

// Map a bone name to a chain slot. Rig-agnostic: handles this model's Auto-Rig
// Pro naming (spine_01.x / spine_02.x / spine_03.x / neck.x / head.x) AND a
// Mixamo skeleton (mixamorig:Spine/Spine1/Spine2/Neck/Head). three.js's
// GLTFLoader strips reserved chars (":", ".") from names, so we lowercase and
// test loosely. Order matters — most specific first.
function chainKeyFor(raw: string): ChainKey | null {
  // These exports suffix every joint with its index ("mixamorig:Head_07",
  // "mixamorig:Spine_02"), and GLTFLoader strips the ":" — so drop a trailing
  // _NN before matching.
  const n = raw.toLowerCase().replace(/_\d+$/, "");
  // Mixamo
  if (n.includes("mixamorig")) {
    if (/head$/.test(n)) return "head";
    if (/neck$/.test(n)) return "neck";
    // Spine3 exists on some rigs (4-segment spine); it sits between Spine2 and
    // Neck. Left undriven — the neck/head carry the glance in this pose.
    if (/spine3$/.test(n)) return null;
    if (/spine2$/.test(n)) return "spine2";
    if (/spine1$/.test(n)) return "spine1";
    if (/spine$/.test(n)) return "spine";
    return null;
  }
  // Auto-Rig Pro style
  if (n.startsWith("head")) return "head";
  if (n.includes("subneck")) return null; // ignore the sub-neck helper
  if (n.startsWith("neck")) return "neck";
  if (n.startsWith("spine_01")) return "spine";
  if (n.startsWith("spine_02")) return "spine1";
  if (n.startsWith("spine_03")) return "spine2";
  return null;
}

type CharCfg = (typeof CHARACTERS)[number];

function SpideyCharacter({ cfg }: { cfg: CharCfg }) {
  const { scene, animations: rawClips } = useGLTF(cfg.url);

  // ── Strip POSITION tracks from every clip ────────────────────────────────
  // Mixamo authors root motion in CENTIMETRES against a ~100-unit rig; our
  // model is ~2 units tall and auto-fit on top of that. The Hips position
  // track peaks at 382 units, so the instant the clip played it threw the
  // character hundreds of units off-screen — invisible, with no error (that is
  // exactly the "renders until you enable clips" symptom).
  //
  // For a hero shot we want the motion in place anyway, so drop position
  // tracks entirely and keep rotations (and scale). Bones don't need to
  // translate; only the root did, and that's the part we're deleting.
  const animations = useMemo(() => {
    if (!rawClips?.length) return rawClips;
    return rawClips.map((clip) => {
      const c = clip.clone();
      c.tracks = c.tracks.filter((t) => !t.name.endsWith(".position"));
      return c;
    });
  }, [rawClips]);

  // Baked Mixamo clips (downloaded via the Mixamo API, retargeted onto this
  // rig in Blender). When a clip plays it owns the whole skeleton, so the
  // procedural pose layers below are skipped; otherwise they'd fight it.
  const { actions, mixer } = useAnimations(animations, scene);
  const hasClip = CLIPS.enabled && animations && animations.length > 0;

  // ── Scroll-scrubbed arm-pose clip (see ARM_CLIP). Ships in a separate
  // animation-only GLB authored on THIS rig (same skeleton, same node names —
  // nothing is retargeted) and binds onto this character's bones BY NAME via
  // the existing mixer. Tracks are filtered to arm/hand rotations before the
  // action is built, so the mixer can never touch spine/neck/head or move a
  // root. ──
  const { animations: armAnims } = useGLTF(ARM_CLIP.url);
  const armClip = useMemo(() => {
    if (!ARM_CLIP.enabled || !armAnims?.length) return null;
    const clip = armAnims[0].clone();
    clip.tracks = clip.tracks.filter(
      (t) => t.name.endsWith(".quaternion") && ARM_CLIP.boneRe.test(t.name)
    );
    return clip.tracks.length ? clip : null;
  }, [armAnims]);
  const armAction = useRef<THREE.AnimationAction | null>(null);
  useEffect(() => {
    if (!armClip || !mixer) return;
    const action = mixer.clipAction(armClip, scene);
    action.play();
    action.paused = true; // never self-advances — scroll scrubs action.time
    action.enabled = true;
    action.setEffectiveWeight(1);
    armAction.current = action;
    return () => {
      action.stop();
      mixer.uncacheAction(armClip, scene);
      armAction.current = null;
    };
  }, [armClip, mixer, scene]);

  const pointer = usePointer();
  const groupRef = useRef<THREE.Group>(null);
  // Outer lineup group — scroll beats slide/scale the whole character via this.
  const lineupRef = useRef<THREE.Group>(null);
  // This character's stance/idle DNA (falls back to raimi for unknown keys).
  const pers: Personality =
    PERSONALITIES[cfg.key as keyof typeof PERSONALITIES] ?? PERSONALITIES.raimi;

  // Chain bones, their bind-pose (rest) quaternions, sequence start time,
  // and the damp-smoothed cursor used for the live glance.
  const rig = useRef<{
    bones: Partial<Record<ChainKey, THREE.Bone>>;
    rest: Map<ChainKey, THREE.Quaternion>;
    aim: AimBone[]; // shoulders/arms/forearms/hands, ordered root→tip
    fingers: FingerBone[];
    hips: { bone: THREE.Bone; rest: THREE.Quaternion } | null;
    glow: THREE.MeshStandardMaterial[]; // emissive bands that pulse
    eyes: THREE.MeshStandardMaterial[]; // mask lenses (brighter pulse)
    shaders: { uniforms: Record<string, { value: unknown }> }[]; // for rim pulsing
    start: number;
    glance: { x: number; y: number };
    /** Damped scrub time (s) into the baked arm clip; -1 = snap on first frame. */
    armTime: number;
  }>({ bones: {}, rest: new Map(), aim: [], fingers: [], hips: null, glow: [], eyes: [], shaders: [], start: -1, glance: { x: 0, y: 0 }, armTime: -1 });

  // Kick off the baked clip: loop it, and offset each character's start time so
  // the three are never in phase with one another.
  useEffect(() => {
    if (!hasClip || !actions) return;
    const first = Object.values(actions)[0];
    if (!first) return;
    first.reset();
    first.setLoop(THREE.LoopRepeat, Infinity);
    first.clampWhenFinished = false;
    first.timeScale = CLIPS.timeScale;
    first.play();
    const off = CLIPS.startOffset[cfg.key] ?? 0;
    first.time = off;
    if (mixer) mixer.update(0);
    return () => {
      first.stop();
    };
  }, [actions, mixer, hasClip, cfg.key]);

  // Apply the suit material + fresnel once, capture bones, and auto-fit.
  useLayoutEffect(() => {
    // ── Bind pose: use the on-bone snapshot, NOT a matrix reconstruction ──
    // Rebuilding local rest rotations from skeleton.boneInverses looked
    // principled, but these Sketchfab exports carry 0.01 / 100 unit-conversion
    // scales in their node graph, so Matrix4.decompose() on the relative bind
    // matrices returns unreliable rotations — the reset produced a deformed
    // skeleton, which then poisoned the auto-fit measurement (Box3.setFromObject
    // measures a SkinnedMesh through its CURRENT pose) and blew the scale up.
    // `restOf` snapshots each bone's quaternion the first time it is seen (a
    // full page load, i.e. true bind pose) and stores it in userData, which
    // survives HMR because drei caches the scene object itself.
    const trueRest = restOf;

    // Re-runs (StrictMode/HMR) must capture from the BIND pose, not whatever
    // the last frame posed — restore every bone to true rest first (this also
    // makes the auto-fit below measure the unposed figure).
    rig.current.aim = [];
    rig.current.fingers = [];
    rig.current.hips = null;
    scene.traverse((o) => {
      if ((o as THREE.Bone).isBone) o.quaternion.copy(trueRest(o));
    });

    // ── Auto-fit: scale to a known height, center X/Z, feet on y=0 ──
    //
    // Measured from the GLBs themselves (script-decoded): homecoming's suit is
    // MERGED with giant scene web-strands into three skinned meshes spanning
    // ±20m × 10m — 90%+ of their verts are the suit, the rest streak across
    // the scene (the "beams"). So neither "measure only skinned meshes" nor
    // "hide non-skinned meshes" can work: the offenders ARE skinned, and
    // hiding them would delete the suit. Two-part fix:
    //   1. Fit the figure by its SKELETON (bone world positions). Bones are
    //      character-sized by definition — no stray geometry, whatever a
    //      model ships, can corrupt the scale/centering.
    //   2. Surgically drop triangles whose RENDERED (skinned) position falls
    //      outside a padded skeleton box — kills the web-strand beams while
    //      keeping every suit triangle (verified: suit verts lie < 0.45m
    //      from the axis, strands start at ~0.8m; raimi's widest legit
    //      geometry reaches 0.76m, inside the 0.55m pad).
    scene.position.set(0, 0, 0);
    scene.scale.setScalar(1);
    // updateMatrixWorld (NOT updateWorldMatrix): the SkinnedMesh override also
    // re-syncs bindMatrixInverse, which the CPU-skinning below relies on.
    scene.updateMatrixWorld(true);

    // 1 ── skeleton bounds (at scale 1), expressed in the SCENE'S PARENT space.
    //
    // CRITICAL: measure in parent space, NOT world space. `scene.position` is
    // relative to its parent, and that parent is the per-character group that
    // carries `position={[cfg.x, 0, 0]}` — the lineup offset. Measuring bones
    // with getWorldPosition() folds that offset into the box centre, so the
    // recentring below (`scene.position.x = -center.x * s`) then CANCELS the
    // lineup offset and every character collapses onto x≈0, stacked on top of
    // each other. (Symptom: "only the middle one renders" — the outer two were
    // hidden inside it.) Converting to parent space keeps the offset intact.
    const skelBox = new THREE.Box3();
    {
      const v = new THREE.Vector3();
      const parent = scene.parent;
      parent?.updateWorldMatrix(true, false);
      scene.traverse((o) => {
        if (!(o as THREE.Bone).isBone) return;
        o.getWorldPosition(v);
        if (parent) parent.worldToLocal(v);
        skelBox.expandByPoint(v);
      });
    }

    // 2 ── strip scenery triangles from skinned meshes. Uses three's own CPU
    // skinning (getVertexPosition = exactly what the GPU renders), tested
    // against the skeleton box padded by KEEP — tunable if a rig ever loses a
    // wanted tuft (raise pad) or keeps a strand stub (lower pad). Any-vertex-
    // outside drops the whole triangle, so long strands die at the boundary.
    // Idempotent: re-runs (StrictMode/HMR) find nothing left to drop.
    // DISABLED. This compared `getVertexPosition()` (mesh-LOCAL space) against
    // a skeleton box built from `getWorldPosition()` (WORLD space) — a space
    // mismatch that is harmless only when a model's node transforms happen to
    // be near-identity. These Sketchfab exports carry 0.01/100 unit-conversion
    // scales, so on raimi/tasm2 it silently deleted most of the character.
    // The stray strand geometry it was meant to remove has since been stripped
    // from the GLBs themselves in Blender, so nothing needs doing at runtime.
    const STRIP_SCENERY = false;
    const KEEP = { pad: 0.55, padTop: 0.25 }; // metres, in bind space
    if (STRIP_SCENERY && !skelBox.isEmpty()) {
      const keepBox = skelBox.clone();
      keepBox.min.x -= KEEP.pad; keepBox.max.x += KEEP.pad;
      keepBox.min.z -= KEEP.pad; keepBox.max.z += KEEP.pad;
      keepBox.min.y -= 0.1; keepBox.max.y += KEEP.padTop;
      const v = new THREE.Vector3();
      const updatedSkeletons = new Set<THREE.Skeleton>();
      let droppedTotal = 0;
      scene.traverse((o) => {
        const mesh = o as THREE.SkinnedMesh;
        if (!mesh.isSkinnedMesh || !mesh.geometry) return;
        try {
          if (!updatedSkeletons.has(mesh.skeleton)) {
            mesh.skeleton.update(); // boneMatrices are stale before 1st render
            updatedSkeletons.add(mesh.skeleton);
          }
          const geom = mesh.geometry;
          const vertCount = geom.attributes.position.count;
          const keep = new Uint8Array(vertCount);
          for (let i = 0; i < vertCount; i++) {
            mesh.getVertexPosition(i, v); // skinned, mesh-local
            v.applyMatrix4(mesh.matrixWorld); // → world (== render position)
            keep[i] = keepBox.containsPoint(v) ? 1 : 0;
          }
          const index = geom.index;
          const triCount = (index ? index.count : vertCount) / 3;
          const kept: number[] = [];
          for (let t = 0; t < triCount; t++) {
            const a = index ? index.getX(t * 3) : t * 3;
            const b = index ? index.getX(t * 3 + 1) : t * 3 + 1;
            const c = index ? index.getX(t * 3 + 2) : t * 3 + 2;
            if (keep[a] && keep[b] && keep[c]) kept.push(a, b, c);
          }
          const dropped = triCount - kept.length / 3;
          // SAFETY VALVE: stripping (almost) EVERYTHING means the world-space
          // assumption broke for this mesh — deleting it would decimate the
          // character. Keep it untouched and shout instead. Legit scenery in
          // these rigs is always MERGED with suit geometry (never >98% strays),
          // so this can only trip on a genuine space mismatch.
          if (dropped > 0 && kept.length / 3 < triCount * 0.02 && triCount > 500) {
            console.warn(
              `[Spider3D:fit] ${cfg.key}: NOT stripping "${mesh.name}" — filter would drop ` +
                `${dropped}/${triCount} tris (space mismatch?); left untouched`
            );
          } else if (dropped > 0) {
            geom.setIndex(kept);
            droppedTotal += dropped;
            console.info(
              `[Spider3D:fit] ${cfg.key}: stripped ${dropped}/${triCount} scenery tris from "${mesh.name}"`
            );
          }
        } catch (e) {
          // Never let cleanup kill the render — worst case the strands stay.
          console.warn("[Spider3D:fit] scenery strip failed on", mesh.name, e);
        }
      });
      if (droppedTotal > 0)
        console.info(`[Spider3D:fit] ${cfg.key}: stripped ${droppedTotal} scenery tris total`);
    }

    // 3 ── scale/centre/floor from the skeleton box (uniform scale about the
    // origin, so the scaled box is just box × s — no re-measure needed).
    const size = new THREE.Vector3();
    skelBox.getSize(size);
    if (size.y > 0) {
      const s = FRAME.targetHeight / size.y;
      const center = new THREE.Vector3();
      skelBox.getCenter(center);
      scene.scale.setScalar(s);
      scene.position.x = -center.x * s;
      scene.position.z = -center.z * s;
      scene.position.y = -skelBox.min.y * s; // feet to the floor
      console.warn(
        `[Spider3D:fit] ${cfg.key} skelH=${size.y.toFixed(2)} scale=${s.toFixed(3)} pos=(${scene.position.x.toFixed(2)},${scene.position.y.toFixed(2)},${scene.position.z.toFixed(2)}) clips=${(animations||[]).length} hasClip=${hasClip}`
      );
    } else {
      // No bones at all (not one of our rigs) — old mesh-bounds fallback.
      const box = new THREE.Box3().setFromObject(scene);
      box.getSize(size);
      if (size.y > 0) {
        scene.scale.setScalar(FRAME.targetHeight / size.y);
        scene.updateMatrixWorld(true);
        box.setFromObject(scene);
        const center = new THREE.Vector3();
        box.getCenter(center);
        scene.position.x -= center.x;
        scene.position.z -= center.z;
        scene.position.y -= box.min.y;
      }
    }

    // PERF pre-pass: which materials actually reach into the fade band? Only
    // those need hashed alpha (see applyFresnel). A material is "fading" if ANY
    // mesh using it has geometry below FADE.top in world space.
    const fadingMats = new Set<THREE.Material>();
    scene.updateWorldMatrix(true, true);
    const _mb = new THREE.Box3();
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh || !mesh.geometry) return;
      _mb.setFromObject(mesh);
      if (_mb.min.y < FADE.top) {
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of mats) if (m) fadingMats.add(m);
      }
    });

    // This model ships REAL textured PBR materials — keep them and just layer
    // our FX on top (fresnel rim + world-height fade + neon reflections).
    // (re)create on every run — a hot-reload can hand us a ref object from
    // an older version of this module that lacks these fields entirely.
    rig.current.glow = [];
    rig.current.eyes = [];
    rig.current.shaders = [];
    const patched = new Set<THREE.Material>();
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) {
          mesh.frustumCulled = false; // skinned bounds can be wrong; keep it drawn
        } else {
          // NOT skinned. Some of these are scenery (the Sketchfab Spider-Man
          // files ship a big backdrop "Icosphere"), but plenty are legitimate
          // character parts that simply aren't weighted — hair, eyes, lenses,
          // facial detail. Blanket-hiding every unskinned mesh erased Miguel's
          // whole head, leaving the bare skin mesh underneath.
          //
          // So only drop it if it's actually BACKDROP-SIZED: a mesh wider than
          // the character is tall cannot be a piece of the character.
          const bb = new THREE.Box3().setFromObject(mesh);
          const size = new THREE.Vector3();
          bb.getSize(size);
          const charHeight = Math.max(skelBox.getSize(new THREE.Vector3()).y, 0.001);
          const isBackdrop =
            Math.max(size.x, size.z) > charHeight * 0.9 || size.y > charHeight * 1.5;
          if (isBackdrop) {
            mesh.visible = false;
            return;
          }
        }
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

        // Hide the unmasked-head parts so the MASK reads (see HIDE_MATERIALS).
        const matNames = mats.map((m) => (m && m.name) || "").join("|");
        if (HIDE_MATERIALS.some((h) => matNames.includes(h))) {
          mesh.visible = false;
          return;
        }

        for (const m of mats) {
          if (!m || patched.has(m)) continue;
          patched.add(m);
          const std = m as THREE.MeshStandardMaterial;
          // glTF defaults an omitted metallicFactor to 1.0, so this export left
          // the face/suit FULLY METALLIC — which mirrors the environment and
          // reads as flat, pale & pasty (esp. skin). Force dielectric unless the
          // material actually ships a metalness map.
          if (!std.metalnessMap) std.metalness = 0;
          // Per-surface family by material name. These suits are fully covered
          // (no bare skin/hair), so it's really "lens/eye" vs "everything else".
          const name = (std.name || "").toLowerCase();
          // These materials are named with separators between every letter
          // ("E_Y_E.002", "B_A_N_D.001"), so a plain /eye/ test NEVER matched
          // and the lenses were never registered for the pulse. Flatten first.
          const flat = name.replace(/[_.\-\s]/g, "");
          const isLens = /lens|eye|glass/.test(flat);
          const fam = isLens ? MAT.eye : MAT.suit;

          // IMPORTANT: these models ship REAL normal + metallicRoughness maps —
          // the surface detail we were faking on the old model is baked in. So
          // only override tint/roughness where there is NO map to override;
          // clobbering `roughness` when a roughnessMap exists multiplies the map
          // down and flattens exactly the detail we want.
          if (fam.tint && !std.map) std.color.multiply(new THREE.Color(fam.tint));

          // UNTEXTURED MODELS (Miguel): this rig ships no baseColor maps — its
          // look lived in a Blender-only toon shader that cannot be exported —
          // so without this it renders as a white mannequin.
          //
          // Key the colour off the MATERIAL name, never the mesh name: materials
          // are shared and de-duplicated by `patched`, so a mesh-name test uses
          // whichever mesh happened to be traversed first and can paint BOTH
          // materials the same. Both landing on near-black made the character
          // invisible against the near-black background.
          if (!std.map && !isLens) {
            const isRed = /002/.test(std.name || "");
            std.color.set(isRed ? SUIT.red : SUIT.black);
            std.roughness = SUIT.roughness;
            std.metalness = SUIT.metalness;
          }
          if (fam.roughness !== undefined && !std.roughnessMap) {
            std.roughness = fam.roughness;
          }
          // exposure scales IBL too, so the whole rig brightens as one.
          std.envMapIntensity = fam.env * TONE.exposure;
          // The lenses have no emissive map, so make them self-lit: pushes them
          // past the bloom threshold for that glowing-eyes look.
          // Emissive band map = the 2099 circuit lines. Re-tint to the accent
          // colour and register it so useFrame can pulse it.
          if (std.emissiveMap) {
            std.emissive = new THREE.Color(SUIT_LOOK.accent);
            std.emissiveIntensity = SUIT_LOOK.pulse.min;
            std.toneMapped = true;
            rig.current.glow.push(std);
          }
          // EYES / MASK LENSES: force them self-lit in the accent colour and
          // register for the pulse. They have little or no emissive map of their
          // own, so without this they read as dull grey holes in the mask.
          if (isLens) {
            std.emissive = new THREE.Color(SUIT_LOOK.accent);
            std.emissiveIntensity = SUIT_LOOK.eyePulse.min;
            std.toneMapped = true;
            if (!rig.current.glow) rig.current.glow = [];
            rig.current.eyes = rig.current.eyes || [];
            rig.current.eyes.push(std);
          }
          if (false && isLens && LENS_GLOW > 0) {
            std.emissive = new THREE.Color(LENS_GLOW_COLOR);
            std.emissiveIntensity = LENS_GLOW;
          } else if (std.emissiveMap) {
            // (kept for models that DO ship an emissive map)
            std.emissive = new THREE.Color(0xffffff);
            std.emissiveIntensity = EMISSIVE_BOOST;
          }
          // adds rim + world-Y fade (hashed alpha only where it's needed)
          applyFresnel(std, fam.rim, fadingMats.has(m), (sh) => {
            (rig.current.shaders ||= []).push(sh);
          });
        }
      }
      if ((obj as THREE.Bone).isBone) {
        const b = obj as THREE.Bone;
        const key = chainKeyFor(b.name);
        if (key && !rig.current.bones[key]) {
          rig.current.bones[key] = b;
          rig.current.rest.set(key, trueRest(b).clone());
        }

        // ── Limb + finger capture (semantic name, rig-agnostic) ──
        const s = semanticBoneName(b.name);
        const mArm = /^(left|right)(shoulder|arm|forearm|hand)$/.exec(s);
        const mFing = /^(left|right)hand(thumb|index|middle|ring|pinky)([1-3])$/.exec(s);
        if (mArm) {
          const slotMap = { shoulder: "shoulder", arm: "arm", forearm: "fore", hand: "hand" } as const;
          const slot = slotMap[mArm[2] as keyof typeof slotMap];
          // The bone's long axis = direction to its ANATOMICAL child, in the
          // bone's own local space. Child ORDER is unreliable — every hand
          // lists the THUMB first (aiming along it mangled all six wrists),
          // and raimi interleaves "armtwist" helpers — so pick the child by
          // NAME (shoulder→arm→forearm→hand→middle knuckle), only falling
          // back to the first bone child.
          const nextRe = {
            shoulder: /^(left|right)arm$/,
            arm: /^(left|right)forearm$/,
            fore: /^(left|right)hand$/,
            hand: /^(left|right)handmiddle1$/,
          }[slot];
          const boneKids = b.children.filter((c) => (c as THREE.Bone).isBone);
          const child =
            boneKids.find((c) => nextRe.test(semanticBoneName(c.name))) ?? boneKids[0];
          if (child && child.position.lengthSq() > 1e-8) {
            const boneAxis = child.position.clone().normalize();
            // Where that axis points in CHARACTER space at bind. The group
            // yaw hasn't been applied yet in this layout pass, so character
            // space == world space here (scene scale is uniform).
            const bindDir = boneAxis
              .clone()
              .applyQuaternion(b.getWorldQuaternion(new THREE.Quaternion()));
            rig.current.aim.push({
              bone: b,
              rest: trueRest(b).clone(),
              boneAxis,
              bindDir,
              slot,
              side: mArm[1] === "left" ? "L" : "R",
            });
          }
        } else if (mFing) {
          const side = mFing[1] === "left" ? "L" : "R";
          rig.current.fingers.push({
            bone: b,
            rest: trueRest(b).clone(),
            finger: mFing[2] as FingerName,
            seg: Number(mFing[3]),
            side,
            phase: rig.current.fingers.length * 1.9 + (side === "L" ? 0 : 3.1),
          });
        } else if (s === "hips" && !rig.current.hips) {
          rig.current.hips = { bone: b, rest: trueRest(b).clone() };
        }
      }
    });
  }, [scene]);

  useFrame((state, delta) => {
    // ── Emissive pulse: the 2099 bands breathe, feeding the bloom pass.
    // Runs regardless of clip playback since it only touches materials.
    {
      const t = state.clock.elapsedTime;
      // Scroll-beat energy scales EVERY glow system in lockstep — dormant in
      // the sponsors beat, threat-display at the register CTA.
      const energy = beatNow.energy;
      const p = SUIT_LOOK.pulse;
      const w = 0.5 + 0.5 * Math.sin(t * p.rate * Math.PI);
      const lvl = (p.min + (p.max - p.min) * w * w) * energy; // squared = sharper throb
      for (const m of rig.current.glow ?? []) m.emissiveIntensity = lvl;
      const ep = SUIT_LOOK.eyePulse;
      const eLvl = (ep.min + (ep.max - ep.min) * w * w) * energy;
      for (const m of rig.current.eyes ?? []) m.emissiveIntensity = eLvl;

      // Pulse the fresnel rim too — the bands are thin, but the rim wraps the
      // whole silhouette, so this is what actually reads as "pulsing".
      const rp = SUIT_LOOK.rimPulse;
      const rim =
        (rp.min + (rp.max - rp.min) * (0.5 + 0.5 * Math.sin(t * rp.rate * Math.PI))) * energy;
      const cir = SUIT_LOOK.circuit;
      for (const sh of rig.current.shaders ?? []) {
        const u = sh.uniforms.uRimIntensity;
        if (u) u.value = rim;
        const ut = sh.uniforms.uTime;
        if (ut) ut.value = t;
        // Circuit-trace glow tracks the beat energy too (min AND max scale so
        // the breathing keeps its proportions, just louder/quieter).
        const cMin = sh.uniforms.uCircuitMin;
        if (cMin) cMin.value = cir.pulse.min * energy;
        const cMax = sh.uniforms.uCircuitMax;
        if (cMax) cMax.value = cir.pulse.max * energy;
        // Beat-driven dissolve band (world-Y). Materials that never reach the
        // band were compiled without hashed alpha and simply ignore this.
        const fTop = sh.uniforms.uFadeTop;
        if (fTop) fTop.value = beatNow.fadeTop;
        const fBot = sh.uniforms.uFadeBottom;
        if (fBot) fBot.value = beatNow.fadeBottom;
      }
    }

    // ── SCROLL BEAT: place the character where the current beat wants him.
    // Runs even when a baked clip owns the skeleton — this only moves the
    // outer lineup group, never bones. ──
    if (lineupRef.current) {
      lineupRef.current.position.x = cfg.x + beatNow.charX;
      lineupRef.current.scale.setScalar(cfg.scale * beatNow.charScale);
    }

    // ── ARM POSES: SCRUB the baked clip by scroll position. beatPos 0→N−1
    // maps straight onto the clip's pose keys (pose i lives at t = i·
    // secondsPerPose), damped so the arms morph between sections instead of
    // snapping. The action stays paused; drei's useAnimations updates the
    // mixer every frame, which applies the pose at whatever time we set —
    // there is no playback, so no timing or root motion to go wrong. ──
    if (armAction.current) {
      const action = armAction.current;
      const dur = action.getClip().duration;
      const target = Math.min(
        THREE.MathUtils.clamp(scrollState.beatPos, 0, BEATS.length - 1) * ARM_CLIP.secondsPerPose,
        dur
      );
      const lam = scrollState.reducedMotion ? BEAT_DAMP.reducedLambda : ARM_CLIP.damp;
      const ra = rig.current;
      ra.armTime = ra.armTime < 0 ? target : THREE.MathUtils.damp(ra.armTime, target, lam, delta);
      action.time = ra.armTime;
    }

    // A baked clip owns every bone it animates — running the procedural
    // pose layers on top would overwrite it each frame.
    if (hasClip) return;
    const t = state.clock.elapsedTime;
    const r = rig.current;
    if (r.start < 0) r.start = t; // stamp sequence start on first frame
    // Per-character offset staggers the lineup so they turn one after another.
    const local = t - r.start - cfg.delay;

    // Body: yaw away + faint idle sway/bob. Set FIRST so the bone parent
    // world orientations sampled below already include this frame's motion.
    if (groupRef.current) {
      groupRef.current.rotation.y =
        POSE.bodyYaw + cfg.yaw + beatNow.charYaw + Math.sin(t * IDLE.sway.rate) * IDLE.sway.yaw;
      // Desync the idle bob per character so the lineup doesn't pulse in unison.
      groupRef.current.position.y =
        Math.sin(t * IDLE.sway.bobRate + cfg.delay * 3) * IDLE.sway.bob;
    }

    // Frame-rate-independent smoothing of the cursor (no jitter on the head).
    r.glance.x = THREE.MathUtils.damp(r.glance.x, pointer.current.x, IDLE.glance.damp, delta);
    r.glance.y = THREE.MathUtils.damp(r.glance.y, pointer.current.y, IDLE.glance.damp, delta);

    // 0→1 as the head finishes its turn: gates the cursor glance so it only
    // fades in once the pose is held.
    const headCfg = POSE.chain[POSE.chain.length - 1];
    const settle = THREE.MathUtils.clamp(
      (local - POSE.hold - headCfg.delay) / headCfg.dur, 0, 1
    );

    // Personal clock (never syncs with the other two) + personalized breath.
    const ti = t + pers.phase;
    const breathe = Math.sin(ti * IDLE.breath.rate * pers.breath.rate) * pers.breath.scale;

    // Stance blend: 0 = bind pose, 1 = held personality pose. easeOutBack
    // makes the arms swing DOWN past the target and settle — follow-through
    // on the pose itself. Uses undelayed time: killing the bind pose must
    // not wait for the staggered head-turn.
    const sinceSpawn = t - r.start;
    const poseP = THREE.MathUtils.clamp((sinceSpawn - pers.poseDelay) / pers.poseDur, 0, 1);
    const poseE = easeOutBack(poseP, pers.overshoot);

    // ── LAYER 0: pelvis — weight shift. Runs FIRST (root of the chain) so
    // the spine/arm passes below sample its fresh orientation. ──
    if (r.hips && r.hips.bone.parent) {
      const { bone, rest } = r.hips;
      const sway = Math.sin(ti * pers.hips.swayRate) * pers.hips.swayAmp;
      bone.quaternion.copy(rest);
      // Yaw about world-vertical (same premultiply trick as the spine).
      bone.parent!.getWorldQuaternion(_qParentInv).invert();
      _vAxis.copy(UP).applyQuaternion(_qParentInv);
      _qDelta.setFromAxisAngle(_vAxis, pers.hips.yaw * poseE);
      bone.quaternion.premultiply(_qDelta);
      const hipPitch = pers.hips.pitch * poseE;
      const hipRoll = pers.hips.roll * poseE + sway;
      if (hipPitch !== 0) bone.quaternion.multiply(_qDelta.setFromAxisAngle(X_AXIS, hipPitch));
      if (hipRoll !== 0) bone.quaternion.multiply(_qDelta.setFromAxisAngle(Z_AXIS, hipRoll));
    }

    // ── LAYER 1: spine chain — look-back twist + breathing + glance. Walk
    // ROOT→TIP so every parent's world orientation is already updated (this
    // frame) when its child re-expresses the world-up axis. ──
    for (const seg of POSE.chain) {
      const bone = r.bones[seg.key];
      const rest = r.rest.get(seg.key);
      if (!bone || !bone.parent || !rest) continue;

      // Staggered eased progress — waist leads, head trails (overlapping
      // action); neck + head overshoot and settle (follow-through).
      const p = THREE.MathUtils.clamp((local - POSE.hold - seg.delay) / seg.dur, 0, 1);
      const eased = seg.back ? easeOutBack(p, POSE.overshoot) : easeInOutCubic(p);

      // Scroll-beat pose: `poseTurn` scales the signature look-back (0 = faces
      // away, 1 = hero turn), so each section gets a genuinely different body
      // attitude rather than the same pose slid around the screen.
      let yaw = eased * seg.twist * beatNow.poseTurn; // about world-vertical
      let pitch = 0; // about the bone's own left-right axis (nod)
      let roll = 0; // about the bone's own front axis (side-tilt)

      if (seg.key === "spine1") {
        pitch += breathe * IDLE.breath.spine1;
        pitch += beatNow.poseLean * 0.45; // chest hunch / open-up
        roll += beatNow.poseTilt * 0.5; // swagger through the torso
      }
      if (seg.key === "spine2") {
        pitch += breathe * IDLE.breath.spine2;
        pitch += beatNow.poseLean * 0.55;
        roll = eased * POSE.lean + beatNow.poseTilt * 0.5;
      }
      if (seg.key === "neck") {
        pitch += POSE.neckPitch * eased + r.glance.y * IDLE.glance.pitchNeck * settle;
        yaw += r.glance.x * IDLE.glance.yawNeck * settle;
      }
      if (seg.key === "head") {
        pitch +=
          POSE.headPitch * eased +
          breathe * IDLE.breath.head +
          r.glance.y * IDLE.glance.pitchHead * settle +
          wob(ti * 1.3) * pers.head.bob + // restless micro-nod (personality)
          beatNow.poseChin; // beat chin attitude (− lifts, + drops)
        yaw += r.glance.x * IDLE.glance.yawHead * settle;
        roll += pers.head.roll * eased; // curious ear-to-shoulder tilt
      }

      // ── World-vertical twist, quaternion-correct for a Mixamo chain ──
      // new_local = (parent⁻¹ · Δworld · parent) · rest  ⇒  premultiply a
      // rotation about world-up re-expressed in the parent's space. This is
      // what keeps the spiral vertical instead of kinking down the chain.
      bone.quaternion.copy(rest);
      bone.parent.getWorldQuaternion(_qParentInv).invert();
      _vAxis.copy(UP).applyQuaternion(_qParentInv);
      _qDelta.setFromAxisAngle(_vAxis, yaw);
      bone.quaternion.premultiply(_qDelta);

      // Anatomical nod/tilt: POST-multiplied = about the bone's own (body-
      // fixed) axes, so a nod stays a nod however far the chain has twisted.
      if (pitch !== 0) bone.quaternion.multiply(_qDelta.setFromAxisAngle(X_AXIS, pitch));
      if (roll !== 0) bone.quaternion.multiply(_qDelta.setFromAxisAngle(Z_AXIS, roll));
    }

    // ── LAYER 2: arms — swing-AIM each segment at its personality target.
    // For each bone: recompute where its bind axis points right now (parents
    // have breathed/twisted), build the world-space swing to the target
    // direction, and premultiply it re-expressed in the parent's frame:
    //   new_local = (parent⁻¹ · swing · parent) · rest
    // Absolute aiming = the same pose lands on all three rigs' different
    // A-poses, and no per-rig euler axis guessing can go wrong. ──
    if (groupRef.current && ARMS.enabled) {
      groupRef.current.getWorldQuaternion(_qChar); // character frame → world
      const shrug = Math.pow(Math.max(0, Math.sin(ti * pers.shrug.rate)), 6) * pers.shrug.amp;

      for (const a of r.aim) {
        const bone = a.bone;
        if (!bone.parent) continue;
        const P = pers[a.side];

        // Conservative wrist handling (see ARMS.aimHands): keep the hand at
        // its bind attitude relative to the forearm; only the roll knob runs.
        if (a.slot === "hand" && !ARMS.aimHands) {
          bone.quaternion.copy(a.rest);
          if (P.twist.hand !== 0) {
            bone.quaternion.multiply(
              _qTwist.setFromAxisAngle(a.boneAxis, P.twist.hand * poseE)
            );
          }
          continue;
        }

        if (a.slot === "shoulder") {
          // Clavicle: bind direction + drop/forward offsets + shrug pulse.
          _vTarget.copy(a.bindDir);
          _vTarget.y += -pers.shoulder.drop * poseE + shrug;
          _vTarget.z += pers.shoulder.forward * poseE;
        } else {
          const d = a.slot === "arm" ? P.arm : a.slot === "fore" ? P.fore : P.hand;
          _vTarget.set(d[0], d[1], d[2]);
          // Idle drift with per-segment phase LAG down the chain — the
          // forearm/hand trail the upper arm = drag / follow-through.
          const lagN = a.slot === "arm" ? 0 : a.slot === "fore" ? 1 : 2;
          const wt = ti * pers.wobble.rate - lagN * pers.wobble.lag + (a.side === "L" ? 0 : 2.6);
          const amp = pers.wobble.amp * (1 + 0.45 * lagN); // amplifies toward the tip
          _vTarget.x += wob(wt) * amp * 0.6;
          _vTarget.z += wob(wt * 0.83 + 1.9) * amp;
          // Inhale floats the upper arms outward off the ribcage.
          if (a.slot === "arm") _vTarget.y += breathe * pers.breath.armLift;
          // Blend bind→pose (overshoot >1 swings past the target, then settles).
          _vTmp.copy(_vTarget).sub(a.bindDir).multiplyScalar(poseE);
          _vTarget.copy(a.bindDir).add(_vTmp);
        }
        _vTarget.applyQuaternion(_qChar).normalize(); // char space → world

        // Current rest direction of the bone axis in world space.
        bone.parent.getWorldQuaternion(_qParent);
        _qRestW.copy(_qParent).multiply(a.rest);
        _vRestDir.copy(a.boneAxis).applyQuaternion(_qRestW);
        // Swing rest→target, re-expressed in the parent's frame, onto rest.
        _qSwing.setFromUnitVectors(_vRestDir, _vTarget);
        _qTmp.copy(_qParent).invert();
        _qDelta.copy(_qTmp).multiply(_qSwing).multiply(_qParent);
        bone.quaternion.copy(a.rest).premultiply(_qDelta);
        // Roll about the bone's own long axis (palm facing etc.).
        const tw =
          (a.slot === "arm"
            ? P.twist.arm
            : a.slot === "fore"
              ? P.twist.fore
              : a.slot === "hand"
                ? P.twist.hand
                : 0) * poseE;
        if (tw !== 0) bone.quaternion.multiply(_qTwist.setFromAxisAngle(a.boneAxis, tw));
      }

      // ── LAYER 3: fingers — per-digit curl + fidget + thwip splay.
      // FINGER.enabled=false leaves every digit at bind pose (safe fallback:
      // the capture effect reset them there and nothing else writes them). ──
      const curlAxis = LOCAL_AXIS[FINGER.curlAxis];
      const splayAxis = LOCAL_AXIS[FINGER.splayAxis];
      if (FINGER.enabled) for (const f of r.fingers) {
        const P = pers[f.side];
        const isThumb = f.finger === "thumb";
        const fall = (isThumb ? FINGER.thumbFalloff : FINGER.segFalloff)[f.seg - 1] ?? 1;
        // Fidget: tiny detuned curl oscillation, phase-offset per finger so
        // the hand ripples instead of pumping. Thumbs mostly sit it out.
        const fid =
          pers.fidget.amp *
          pers.fidget.side[f.side] *
          wob(ti * pers.fidget.rate + f.phase) *
          (isThumb ? 0.3 : 1) *
          poseE;
        const ang =
          (P.curl[f.finger] * fall * poseE + fid) *
          (isThumb ? FINGER.thumbCurlSign : FINGER.curlSign);
        f.bone.quaternion.copy(f.rest).multiply(_qTwist.setFromAxisAngle(curlAxis, ang));
        // Splay (knuckle only): index/pinky spread apart for the thwip "V".
        if (f.seg === 1 && P.curl.splay !== 0 && !isThumb) {
          const s = f.finger === "index" ? 1 : f.finger === "pinky" ? -1 : f.finger === "ring" ? -0.35 : 0;
          if (s !== 0) {
            f.bone.quaternion.multiply(
              _qTwist.setFromAxisAngle(splayAxis, s * P.curl.splay * FINGER.splaySign * poseE)
            );
          }
        }
      }
    }
  });

  // Outer group = where this character stands in the lineup; inner group
  // (groupRef) carries the body yaw + idle motion. Auto-fit put feet at y=0.
  return (
    <group ref={lineupRef} position={[cfg.x, 0, 0]} scale={cfg.scale}>
      <group ref={groupRef}>
        <primitive object={scene} />
      </group>
    </group>
  );
}

/* ════════════════════════════════════════════════════════════
   SCROLL-BEAT INTERPOLATION — the scrollytelling engine.

   `beatNow` holds the CURRENT (damped) values of every beat-driven knob.
   BeatDriver recomputes it once per frame from scrollState.beatPos:
     1. pick the two adjacent BEATS and smoothstep-blend their values
        (eased target — holds shape near each section centre);
     2. exponential-damp beatNow toward that target (frame-rate independent,
        gives the camera a cinematic lag; near-instant when the user prefers
        reduced motion).
   CameraRig + SpideyCharacter then consume beatNow inside their own
   useFrame — no React state anywhere in the per-frame path, and BeatDriver
   runs at priority −1 so beatNow is fresh before any consumer reads it.
   ════════════════════════════════════════════════════════════ */
const beatNow = {
  cam: new THREE.Vector3(BEATS[0].cam[0], BEATS[0].cam[1], BEATS[0].cam[2]),
  look: new THREE.Vector3(BEATS[0].look[0], BEATS[0].look[1], BEATS[0].look[2]),
  charX: BEATS[0].char.x,
  charYaw: BEATS[0].char.yaw,
  charScale: BEATS[0].char.scale,
  energy: BEATS[0].energy,
  fadeTop: BEATS[0].fade.top,
  fadeBottom: BEATS[0].fade.bottom,
  // Body pose for the current scroll position (see Beat.pose in beats.ts).
  poseTurn: BEATS[0].pose.turn,
  poseLean: BEATS[0].pose.lean,
  poseTilt: BEATS[0].pose.tilt,
  poseChin: BEATS[0].pose.chin,
  initialized: false,
};
// Scratch target (module-level: zero per-frame allocation).
const _beatTarget = {
  cam: new THREE.Vector3(),
  look: new THREE.Vector3(),
  charX: 0,
  charYaw: 0,
  charScale: 1,
  energy: 1,
  fadeTop: 0,
  fadeBottom: 0,
  poseTurn: 1,
  poseLean: 0,
  poseTilt: 0,
  poseChin: 0,
};

function BeatDriver() {
  useFrame((_, delta) => {
    const maxIdx = BEATS.length - 1;
    // The DOM may have more/fewer [data-beat] sections than BEATS entries —
    // clamp so extra sections just hold the final beat.
    const pos = THREE.MathUtils.clamp(scrollState.beatPos, 0, maxIdx);
    const i = Math.min(Math.floor(pos), Math.max(maxIdx - 1, 0));
    const a = BEATS[i];
    const b = BEATS[Math.min(i + 1, maxIdx)];
    const f = THREE.MathUtils.clamp(pos - i, 0, 1);
    const e = f * f * (3 - 2 * f); // smoothstep: eases out of / into each hold

    // ── PUNCH IMPACT: lens "takes the hit" — a chromatic-aberration spike
    // fired exactly when the screen-crack overlay lands (same beatPos gate),
    // decaying fast. Skipped under prefers-reduced-motion. ──
    const landed = pos >= PUNCH.impactEnd;
    if (landed && !PUNCH_FX.landed && !scrollState.reducedMotion) PUNCH_FX.spike = 1;
    PUNCH_FX.landed = landed;
    if (PUNCH_FX.spike > 0) {
      PUNCH_FX.spike = Math.max(0, PUNCH_FX.spike - PUNCH_FX.spike * PUNCH_FX.decay * delta);
      if (PUNCH_FX.spike < 0.01) PUNCH_FX.spike = 0;
      const off = POST.chroma.offset + PUNCH_FX.boost * PUNCH_FX.spike;
      CHROMA_OFFSET.set(off, off);
    }

    const T = _beatTarget;
    T.cam.set(
      a.cam[0] + (b.cam[0] - a.cam[0]) * e,
      a.cam[1] + (b.cam[1] - a.cam[1]) * e,
      a.cam[2] + (b.cam[2] - a.cam[2]) * e
    );
    T.look.set(
      a.look[0] + (b.look[0] - a.look[0]) * e,
      a.look[1] + (b.look[1] - a.look[1]) * e,
      a.look[2] + (b.look[2] - a.look[2]) * e
    );
    T.charX = a.char.x + (b.char.x - a.char.x) * e;
    T.charYaw = a.char.yaw + (b.char.yaw - a.char.yaw) * e;
    T.charScale = a.char.scale + (b.char.scale - a.char.scale) * e;
    T.energy = a.energy + (b.energy - a.energy) * e;
    T.fadeTop = a.fade.top + (b.fade.top - a.fade.top) * e;
    T.fadeBottom = a.fade.bottom + (b.fade.bottom - a.fade.bottom) * e;
    T.poseTurn = a.pose.turn + (b.pose.turn - a.pose.turn) * e;
    T.poseLean = a.pose.lean + (b.pose.lean - a.pose.lean) * e;
    T.poseTilt = a.pose.tilt + (b.pose.tilt - a.pose.tilt) * e;
    T.poseChin = a.pose.chin + (b.pose.chin - a.pose.chin) * e;

    if (!beatNow.initialized) {
      // First frame (or a reload landing mid-page): snap, don't glide in.
      beatNow.cam.copy(T.cam);
      beatNow.look.copy(T.look);
      beatNow.charX = T.charX;
      beatNow.charYaw = T.charYaw;
      beatNow.charScale = T.charScale;
      beatNow.energy = T.energy;
      beatNow.fadeTop = T.fadeTop;
      beatNow.fadeBottom = T.fadeBottom;
      beatNow.poseTurn = T.poseTurn;
      beatNow.poseLean = T.poseLean;
      beatNow.poseTilt = T.poseTilt;
      beatNow.poseChin = T.poseChin;
      beatNow.initialized = true;
      return;
    }

    const lambda = scrollState.reducedMotion
      ? BEAT_DAMP.reducedLambda
      : BEAT_DAMP.lambda;
    const d = (c: number, t: number) => THREE.MathUtils.damp(c, t, lambda, delta);
    beatNow.cam.set(d(beatNow.cam.x, T.cam.x), d(beatNow.cam.y, T.cam.y), d(beatNow.cam.z, T.cam.z));
    beatNow.look.set(d(beatNow.look.x, T.look.x), d(beatNow.look.y, T.look.y), d(beatNow.look.z, T.look.z));
    beatNow.charX = d(beatNow.charX, T.charX);
    beatNow.charYaw = d(beatNow.charYaw, T.charYaw);
    beatNow.charScale = d(beatNow.charScale, T.charScale);
    beatNow.energy = d(beatNow.energy, T.energy);
    beatNow.fadeTop = d(beatNow.fadeTop, T.fadeTop);
    beatNow.fadeBottom = d(beatNow.fadeBottom, T.fadeBottom);
    // Pose damps a little slower than the camera so the body settles INTO each
    // beat rather than snapping with it — reads as weight.
    const pd = (c: number, t: number) =>
      THREE.MathUtils.damp(c, t, lambda * BEAT_DAMP.poseFactor, delta);
    beatNow.poseTurn = pd(beatNow.poseTurn, T.poseTurn);
    beatNow.poseLean = pd(beatNow.poseLean, T.poseLean);
    beatNow.poseTilt = pd(beatNow.poseTilt, T.poseTilt);
    beatNow.poseChin = pd(beatNow.poseChin, T.poseChin);
  }, -1); // negative priority: runs BEFORE all default-priority consumers
  return null;
}

// Aim the camera explicitly (R3F doesn't auto-lookAt a moved camera).
// Per-frame it simply tracks beatNow — all smoothing already happened there.
function CameraRig() {
  const camera = useThree((s) => s.camera);
  useLayoutEffect(() => {
    camera.position.set(0, FRAME.camY, FRAME.camZ);
    camera.lookAt(0, FRAME.lookY, 0);
    camera.updateProjectionMatrix();
  }, [camera]);
  useFrame(() => {
    camera.position.copy(beatNow.cam);
    camera.lookAt(beatNow.look);
  });
  return null;
}

export default function Spider3D() {
  // Memoize camera so it isn't recreated each render.
  const camera = useMemo(
    () => ({ position: [0, FRAME.camY, FRAME.camZ] as [number, number, number], fov: FRAME.fov }),
    []
  );

  // Master exposure — multiplied into every light so the whole rig tracks one
  // knob (the composer's tone mapping pass has no exposure uniform of its own).
  const E = TONE.exposure;

  return (
    <Canvas
      gl={{
        alpha: true,
        // With the composer active, MSAA happens in its buffers — canvas AA
        // would be wasted work. (Fallback path keeps it.)
        antialias: !POST.enabled,
        powerPreference: "high-performance",
        // Only reached when POST.enabled is false — the composer otherwise
        // overrides renderer tone mapping and applies its own final pass.
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: TONE.exposure,
      }}
      dpr={[1, PERF.maxDpr]}
      camera={camera}
      style={{ width: "100%", height: "100%", pointerEvents: "none", background: "transparent" }}
    >
      <BeatDriver />
      <CameraRig />
      {/* ── CINEMATIC RIG: low-key three-point + colored rims + kicker.
          Ratios matter more than values: key ≈ 7× fill keeps a real shadow
          side (form), rims ≈ 0.6× key cut him out of the black bg. ── */}

      {/* Ambient near-zero — a big flat ambient is exactly what reads "pasty".
          Just enough cool spill to keep shadows from clipping to pure black. */}
      <ambientLight intensity={0.12 * E} color={"#3d4460"} />

      {/* KEY — warm, high, from front-left (short-side Rembrandt-ish). Slightly
          steeper than before so the brow/cheek shadows model the face. */}
      <directionalLight position={[-2.5, 3.8, 3]} intensity={2.6 * E} color={"#ffe9d6"} />

      {/* FILL — cool + faint (key:fill ≈ 7:1, low-key drama). Raise toward 0.6
          if the shadow side gets too crushed on dark screens. */}
      <directionalLight position={[3.5, 1, 2.5]} intensity={0.35 * E} color={"#8fa0c8"} />

      {/* RIM — spider red from back-left: hot colored edge on the suit */}
      <directionalLight position={[-4, 1.5, -3]} intensity={1.8 * E} color={"#e23636"} />

      {/* RIM — glitch cyan from back-right: the complementary edge */}
      <directionalLight position={[4, 2, -2.5]} intensity={1.5 * E} color={"#00e5ff"} />

      {/* KICKER — cool white from top-back: hair/shoulder highlight that
          separates the dark silhouette from the dark background. */}
      <directionalLight position={[0, 4.5, -3.5]} intensity={0.9 * E} color={"#dfe8ff"} />

      {/* Environment built from emissive planes (no CDN/HDR fetch) — gives the
          suit neon reflections so it reads as a sheened surface, not flat paint.
          Per-material strength lives in MAT.*.env. */}
      <Environment resolution={PERF.envResolution} background={false}>
        <Lightformer intensity={2.4} color="#e23636" position={[-3, 1, -2]} scale={[3, 5, 1]} />
        <Lightformer intensity={2.0} color="#00e5ff" position={[3, 1.5, -1]} scale={[3, 5, 1]} />
        <Lightformer intensity={1.2} color="#ffffff" position={[0, 4, 2]} scale={[6, 2, 1]} />
        <Lightformer intensity={0.8} color="#1565c0" position={[0, -2, 3]} scale={[6, 3, 1]} />
      </Environment>

      <Suspense fallback={null}>
        {CHARACTERS.map((c) => (
          <SpideyCharacter key={c.key} cfg={c} />
        ))}
      </Suspense>

      {/* ── POST STACK: bloom (HDR emissive only) → lens CA → filmic tone map
          → grade → vignette. Order is the order they run. ── */}
      {POST.enabled && (
        <EffectComposer multisampling={PERF.multisampling}>
          <Bloom
            mipmapBlur
            intensity={POST.bloom.intensity}
            luminanceThreshold={POST.bloom.threshold}
            luminanceSmoothing={POST.bloom.smoothing}
            radius={POST.bloom.radius}
            levels={PERF.bloomLevels}
          />
          <ChromaticAberration
            offset={CHROMA_OFFSET}
            radialModulation
            modulationOffset={POST.chroma.modulationOffset}
          />
          <ToneMapping mode={TONEMAP_MODE[TONE.mode]} />
          <HueSaturation hue={0} saturation={POST.grade.saturation} />
          <BrightnessContrast
            brightness={POST.grade.brightness}
            contrast={POST.grade.contrast}
          />
          <Vignette eskil={false} offset={POST.vignette.offset} darkness={POST.vignette.darkness} />
        </EffectComposer>
      )}
    </Canvas>
  );
}

CHARACTERS.forEach((c) => useGLTF.preload(c.url));
if (ARM_CLIP.enabled) useGLTF.preload(ARM_CLIP.url);
