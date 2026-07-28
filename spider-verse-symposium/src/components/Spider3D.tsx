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
import { perfProbe } from "@/lib/perfProbe";
import { scrollState } from "@/lib/scrollState";
import {
  activeBeats,
  BEATS,
  BEAT_DAMP,
  PUNCH,
  resolveArms,
  punchDrive,
  punchPos,
  type ArmBlend,
  type PunchDrive,
} from "@/lib/beats";
import {
  ARM_POSES,
  FINGER_BONES,
  FIST_FINGERS,
  POSED_BONES,
  REST_BONES,
  sanitizeBoneName,
} from "@/lib/armPoses";

/* ════════════════════════════════════════════════════════════
   MIGUEL O'HARA — the scroll-driven 3D hero.

   THE RIG (measured from the files, not guessed): 70 joints, Auto-Rig Pro
   naming — spine_01.x / shoulder.l / arm_stretch.r / index1.l / thigh_
   stretch.l. NOT Mixamo. three's GLTFLoader strips "." from node names, so
   `arm_stretch.l_37` arrives as `arm_stretchl_37`; every name test below
   accounts for that. scene.gltf ships zero animations — all motion comes
   from arm_poses.glb plus the procedural layer here.

   TWO ANIMATION LAYERS, OWNING DISJOINT BONE SETS (this is the invariant
   that keeps them from fighting):
     A. ARM CLIP  — arm/hand/finger rotations, SCRUBBED by scroll position.
     B. PROCEDURAL — spine_01/02/03 + neck + head: the over-the-shoulder
        look-back, breathing, and the cursor-follow glance.
   Legs and root are driven by neither and rest at bind pose.
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

/* ── MAT — per-surface families, matched by material name. This model ships
   ONLY baseColor maps (no normal / roughness / AO anywhere), so ALL form has
   to come from lighting, fresnel and grading. ── */
type RimOpts = { color: string; color2: string; power: number; intensity: number };
const MAT: Record<
  "suit" | "eye",
  { tint?: string; env: number; roughness?: number; rim: RimOpts }
> = {
  // Suit (B_O_D_Y / H_E_A_D mask / B_A_N_D): slick sheen + the neon red→cyan
  // fresnel edge that sells the 2099 silhouette against the dark bg.
  suit: {
    env: 0.7, // envmap strength (lower = matte fabric, higher = glossy)
    roughness: 0.45,
    rim: { color: "#e23636", color2: "#00e5ff", power: 3.0, intensity: 0.55 },
  },
  // Eyes / mask lenses: glossy already (roughness 0 in the file).
  eye: {
    env: 1.0,
    rim: { color: "#e23636", color2: "#00e5ff", power: 3.0, intensity: 0.15 },
  },
};

/* ── MASKED vs UNMASKED ────────────────────────────────────────────────────
   This model ships BOTH an unmasked head (separate skin / hair / eyeball
   meshes) AND the masked look (the H_E_A_D material on the body mesh).
   Hiding the bare-head parts BY MATERIAL name leaves the mask, which is the
   iconic 2099 silhouette. Remove an entry to bring that part back.
   E_Y_E = the unmasked head's eyeballs; with the mask on they poke through
   as a stray glowing dot beside the head. */
const HIDE_MATERIALS = ["H_A_I_R", "S_K_I_N", "E_Y_E"];

/* ── SUIT LOOK — strip the blue, pulse the 2099 circuitry ─────────────────
   The texture is blue+red. `desat` removes colour (1 = fully greyscale) and
   `tint` multiplies what's left, so we go BLACK while keeping the circuit
   pattern's luminance detail — much better than flattening it to a solid fill.
   `accent` re-tints the emissive band map, which then throbs via `pulse` and
   feeds the bloom. */
const SUIT_LOOK = {
  desat: 0.84, // slightly less greyscale so a little suit blue survives
  tint: "#2c3550", // dark BLUE cast — multiplied over the desaturated texture
  accent: "#ff2436", // colour of the glowing 2099 bands
  pulse: { min: 0.8, max: 4.0, rate: 1.15 }, // emissive throb (intensity, Hz-ish)
  rimPulse: { min: 0.15, max: 1.9, rate: 0.9 }, // fresnel rim breathing
  eyePulse: { min: 2.0, max: 7.0, rate: 1.15 }, // mask lenses — brightest element
  // ── THE 2099 CIRCUITRY — the suit texture's OWN trace linework, lit up. ──
  // The baseColor maps draw the circuit pattern in a slightly lighter blue
  // than the base suit (measured from the PNGs: base = rgb(16,56,136), traces
  // = rgb(16,64–79,136–144) — only the GREEN channel separates them). The
  // shader isolates those texels (green threshold gated to blue-dominant
  // areas) and drives them as pulsing emissive, so the suit's actual printed
  // circuits glow — no bands, no scanlines.
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
    flow: {
      amp: 0.8,
      scale: 7.0, // packets per UV tile (higher = shorter packets)
      speed: 0.45, // packet travel speed (cycles/s)
      angle: 0.9, // travel direction in UV space (rad) — off-axis on purpose:
      //             axis-aligned motion is what reads "scanline"
    },
  },
};

/* Fallback colours for any material that ships no baseColor map. */
const SUIT = {
  black: "#191926", // lifted off the #0A0A0A background so it can't vanish
  red: "#c4172b",
  roughness: 0.38,
  metalness: 0.45,
};

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
  vignette: { offset: 0.28, darkness: 0.72 },
};
const CHROMA_OFFSET = new THREE.Vector2(POST.chroma.offset, POST.chroma.offset);
// One-shot RGB-split spike when the final punch lands: the ChromaticAberration
// effect holds THIS Vector2 as its uniform value, so mutating it per-frame
// drives the effect with no React involved. Fired by BeatDriver on the upward
// crossing of the punch window, decays in ~0.3s, and re-arms on scroll-back.
const PUNCH_FX = { landed: false, spike: 0, boost: 0.014, decay: 7 };

/* ── PERF — post-processing runs a full-screen pass per effect, so its cost
   scales with PIXEL COUNT: `maxDpr` is by far the biggest lever. Note this
   page already runs a SECOND WebGL context for the events carousel, so this
   canvas is deliberately conservative. ── */
const PERF = {
  maxDpr: 1.5, // hard cap on device pixel ratio
  multisampling: 0, // MSAA inside the composer. 0 = off (cheapest); 2–4 = smoother
  // Mip levels of blur. Each level is a downsample AND an upsample, so this is
  // the single most expensive knob in the composer — 5 levels is ~10 full-screen
  // passes on top of the five other effects. At the bloom radius used here the
  // difference between 3 and 5 is not visible on the emissive bands, and the
  // audience is on laptops with integrated graphics.
  bloomLevels: 3,
  envResolution: 128, // cubemap res for the Lightformer environment
};

const MODEL_URL = "/models/miguel2099/scene.gltf";

/* ── ARM CLIP — baked per-section arm poses, SCRUBBED by scroll. ──────────
   Authored directly on THIS rig in Blender (no retargeting, no runtime
   aiming — both are what mangled arms before). One clip, pose i keyed at
   t = i * secondsPerPose:
     0 hero (= the live default stance, byte-identical to the file's bind-
       node pose), 1 arms crossed, 2 right arm pointing out, 3 hands on hips,
       4 relaxed / hands low, 5 FULL-BODY PUNCH at the lens (right arm
       extended to camera, left fist recoiled). An extra ANTICIPATION key
       sits at t = 109/24 ≈ 4.54 s (fist chambered, lead hand measuring) so
       travelling 4 → 5 reads as wind-up → release.

   Which pose each scroll section holds is set per-beat via `armPose` in
   beats.ts — this file only knows how to scrub between them.

   The clip is FILTERED to arm/hand rotation tracks only, so the procedural
   spine→neck→head system keeps its bones untouched. Position/scale tracks
   are dropped outright (root motion killed). Scrubbing (action.time =
   f(beatPos), action stays paused) means there is no playback timing to
   manage: scroll position IS the pose. */
const ARM_CLIP = {
  enabled: true,
  // NOTE: bump ?v= whenever the clip is re-exported. drei's useGLTF caches by
  // URL in memory and the browser caches the bytes, so re-exporting to the
  // SAME filename silently keeps serving the old poses.
  url: "/models/miguel2099/arm_poses.glb?v=punch1",
  secondsPerPose: 1, // Blender keyed pose i at frame i*24 @ 24 fps = i seconds
  damp: 2.2, // exp-damp lambda for the scrub time (≈ BEAT_DAMP feel)
  // Arm/hand bones ONLY (Auto-Rig Pro names, "." already stripped by
  // GLTFLoader — e.g. "arm_stretchl_37"). Deliberately excludes spine/neck/
  // head/root/legs so the procedural layer keeps full ownership of those.
  boneRe: /(shoulder|arm_stretch|arm_twist|forearm_stretch|forearm_twist|hand|index\d|middle\d|ring\d|pinky\d|thumb\d)/,
};

/* ────────────────────────────────────────────────────────────
   FRAMING — the model is auto-fit at runtime (measured, centered,
   scaled to targetHeight, feet on the floor) so we don't guess.
   ──────────────────────────────────────────────────────────── */
const FRAME = {
  targetHeight: 2.2, // world units the figure is normalised to
  // Aiming HIGHER pushes the character DOWN in frame; smaller camZ zooms in.
  camY: 1.85,
  camZ: 2.65,
  fov: 30,
  lookY: 1.82,
};

// Dissolve the lower body into the background. Alpha ramps by WORLD height:
// fully solid above `top`, fully gone below `bottom` (feet≈0, head≈2.2).
// Keep `top` BELOW where the hands hang (~y 1.05 with arms down), or the
// dissolve eats the forearms and the figure looks chopped up. Driven per-beat
// from beats.ts; these are just the load-time defaults.
const FADE = {
  top: 0.75,
  bottom: 0.2,
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
   naive local-euler adds compound each bone's ~7° forward lean into a kink.

   Retuning cheat-sheet:
   • bodyYaw sign     → which way the body faces away from camera.
   • all twist signs  → flip TOGETHER to look over the other shoulder. For
     the face to come back to the lens, sum(twist) ≈ -bodyYaw. Here sum
     = -1.26 vs bodyYaw π, so he settles near profile (half-face), which
     reads more alive than a dead-centre stare.
   • delay            → when each bone joins the turn (s after `hold`).
   • dur              → per-bone ease time.
   • back: true       → that bone overshoots and settles (follow-through).
   ──────────────────────────────────────────────────────────── */
type ChainKey = "spine" | "spine1" | "spine2" | "neck" | "head";

const POSE = {
  bodyYaw: Math.PI, // rad — body FULLY faced away (back to camera, 180°)
  hold: 0.85, // beat (s) holding still before the lazy head turn begins
  overshoot: 0.7, // low = controlled settle, no bouncy snap (nonchalant)
  headPitch: -0.06, // held chin attitude for the head (- = chin up)
  neckPitch: -0.03,
  lean: 0.03, // faint chest side-tilt (roll on spine2)
  // Nonchalant over-the-shoulder glance: the body stays turned away and the
  // twist is almost ALL in the neck + head (the spine barely moves), so he
  // just cranks his head around to show half his face.
  chain: [
    { key: "spine", twist: 0.0, delay: 0.0, dur: 1.4, back: false },
    { key: "spine1", twist: -0.06, delay: 0.2, dur: 1.4, back: false },
    { key: "spine2", twist: -0.16, delay: 0.5, dur: 1.3, back: false },
    { key: "neck", twist: -0.48, delay: 1.0, dur: 1.3, back: true },
    { key: "head", twist: -0.56, delay: 1.4, dur: 1.2, back: true },
  ] as { key: ChainKey; twist: number; delay: number; dur: number; back: boolean }[],
};

/* Idle life on top of the held pose. Kept intentionally tiny — he should read
   as almost still, holding the glance, with only a faint breath and a whisper
   of cursor response. */
const IDLE = {
  breath: { rate: 1.0, scale: 1.15, spine1: 0.007, spine2: 0.009, head: -0.004 },
  sway: { yaw: 0.005, rate: 0.22, bob: 0.004, bobRate: 0.45 },
  head: { roll: 0.0, bob: 0.006 }, // restless micro-nod
  glance: {
    yawHead: 0.045, // rad of head yaw at full cursor deflection
    yawNeck: 0.02,
    pitchHead: 0.03,
    pitchNeck: 0.015,
    damp: 1.6, // lower = slower, weightier tracking
  },
};

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
  // model's many overlapping meshes.
  //
  // PERF: hashed alpha forces a shader `discard`, which disables the GPU's
  // early-Z rejection. So only pay it on materials whose geometry actually
  // reaches into the fade band — the head/mask sits entirely above it.
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

    // ── Fragment: fresnel rim + world-height alpha fade + circuit glow ──
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
         //      sine = sharper throb).
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

/* ── Animation helpers (module-level scratch: zero per-frame GC) ── */
const UP = new THREE.Vector3(0, 1, 0);
const X_AXIS = new THREE.Vector3(1, 0, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);
const _qParentInv = new THREE.Quaternion();
const _qDelta = new THREE.Quaternion();
const _qArm = new THREE.Quaternion();
const _vAxis = new THREE.Vector3();
const _vFist = new THREE.Vector3();

/* ── HOW MUCH BODY GOES INTO THE PUNCH (radians) ──
   Spread waist → chest so the twist reads as a wave travelling up the body.
   The totals are deliberately modest: the clavicles hang off spine_03, so
   every radian here is multiplied again at the fist by the length of the arm,
   and it is very easy to make him look like he is swinging a bat. */
const PUNCH_BODY = {
  twistWaist: 0.10,
  twistMid: 0.16,
  twistChest: 0.22,
  /** Extra clavicle rotation on TOP of the chest twist — the shoulder itself
      retracting on the wind-up and protracting through the strike. */
  shoulder: 0.20,
  /** Chest roll at contact: the near shoulder drops into the blow. */
  chestDrop: 0.05,
};
/* ── FIST GRIP — how far PAST the baked fist the fingers close ────────────
   The only closed hand in the source asset (pose 5 of arm_poses.glb, lifted
   into FIST_FINGERS) is a neutral one: knuckles shut, last phalanges still
   soft. Held at a wind-up that reads as a relaxed hand, which is precisely
   the slack that drains the tension out of the punch.

   Rather than re-author 38 quaternions, the curl is EXTRAPOLATED along the
   same great circle: slerp(rest → fist, t) with t > 1 keeps rotating each
   joint in the direction it was already flexing, so the whole chain
   (index1 → index2 → index3 and siblings) tightens as one and stays
   anatomically consistent. `extra` is scaled by punchDrive's `grip`, so the
   squeeze arrives with the wind-up and holds through contact.

     extra   how much past the baked fist at full grip (0.14 ≈ 8° more flexion
             per joint here). Above ~0.25 the fingertips start to sink into
             the palm — the extrapolation has no collision model.
     thumbCap  the thumb is DIFFERENT: it lies ACROSS the closed fingers, so
             extrapolating it drives it through them. Capped at the baked
             pose, which already wraps correctly. */
const FIST_GRIP = { extra: 0.14, thumbCap: 1 };
/** Sanitized thumb bones — matched by name, since they're capped above. */
const THUMB_RE = /^thumb\d/;

/* Sanitized bone names for the punching hand — see sanitizeBoneName().
   Prefer the middle-finger knuckle: that is the surface that actually hits
   the glass. The wrist sits a good 6% of viewport height up-and-back from it
   at full extension, which is enough to read as the cracks missing the fist. */
const FIST_BONE = "middle1r_49";
const FIST_BONE_FALLBACK = "handr_65";
/** Right clavicle — the bone the shoulder drive rotates. */
const CLAVICLE_R = "shoulderr_69";

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
// and permanently corrupt the pose.
const restOf = (b: THREE.Object3D) => {
  let q = b.userData.__bindQuat as THREE.Quaternion | undefined;
  if (!q) {
    q = b.quaternion.clone();
    b.userData.__bindQuat = q;
  }
  return q;
};

/* Map a bone name to a spine-chain slot. This rig is Auto-Rig Pro
   (spine_01.x / spine_02.x / spine_03.x / neck.x / head.x); GLTFLoader strips
   the ":" and "." from names, so lowercase and test loosely. A Mixamo
   skeleton is also handled in case the model is ever swapped.
   Order matters — most specific first. */
function chainKeyFor(raw: string): ChainKey | null {
  // Exports suffix every joint with its index ("head.x_5"), so drop a
  // trailing _NN before matching.
  const n = raw.toLowerCase().replace(/_\d+$/, "");
  // Mixamo
  if (n.includes("mixamorig")) {
    if (/head$/.test(n)) return "head";
    if (/neck$/.test(n)) return "neck";
    if (/spine3$/.test(n)) return null; // 4-segment spine: left undriven
    if (/spine2$/.test(n)) return "spine2";
    if (/spine1$/.test(n)) return "spine1";
    if (/spine$/.test(n)) return "spine";
    return null;
  }
  // Auto-Rig Pro (this model)
  if (n.startsWith("head")) return "head";
  if (n.includes("subneck")) return null; // ignore the sub-neck helper
  if (n.startsWith("neck")) return "neck";
  if (n.startsWith("spine_01")) return "spine";
  if (n.startsWith("spine_02")) return "spine1";
  if (n.startsWith("spine_03")) return "spine2";
  return null;
}

function MiguelCharacter() {
  const { scene } = useGLTF(MODEL_URL);

  // The mixer is what binds and evaluates the arm clip. scene.gltf itself
  // ships no animations, so this starts empty and only ever hosts the
  // scroll-scrubbed arm action created below.
  const { mixer } = useAnimations([], scene);

  /* ── Scroll-scrubbed arm-pose clip (see ARM_CLIP). Ships in a separate
     animation-only GLB authored on THIS rig (same skeleton, same node names —
     nothing is retargeted) and binds onto the character's bones BY NAME.
     Tracks are filtered to arm/hand rotations before the action is built, so
     the mixer can never touch spine/neck/head or move a root. ── */
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
  // Outer group — scroll beats slide/scale the whole character via this.
  const stageRef = useRef<THREE.Group>(null);

  // Chain bones, their bind-pose (rest) quaternions, sequence start time,
  // and the damp-smoothed cursor used for the live glance.
  const rig = useRef<{
    bones: Partial<Record<ChainKey, THREE.Bone>>;
    rest: Map<ChainKey, THREE.Quaternion>;
    glow: THREE.MeshStandardMaterial[]; // emissive bands that pulse
    eyes: THREE.MeshStandardMaterial[]; // mask lenses (brighter pulse)
    shaders: { uniforms: Record<string, { value: unknown }> }[];
    start: number;
    glance: { x: number; y: number };
    /** Damped scrub time (s) into the baked arm clip; -1 = snap on first frame. */
    armTime: number;
    /** Bones the procedural arm layer drives (sanitized name -> bone). */
    armBones: Map<string, THREE.Bone>;
    /** Bones it forces back to bind rest (arm/forearm twists). */
    armRest: Map<string, THREE.Bone>;
    /** Finger bones, curled bind-rest -> fist by the pose's `curl`. */
    fingers: Map<string, THREE.Bone>;
    /** Damped copy of the ArmBlend weights; -1 = snap on first frame.
        `from`/`to` remember which pair those scalars were measured against. */
    armMix: {
      blend: number;
      weight: number;
      from: ArmBlend["from"];
      to: ArmBlend["to"];
    };
  }>({
    bones: {},
    rest: new Map(),
    glow: [],
    eyes: [],
    shaders: [],
    start: -1,
    glance: { x: 0, y: 0 },
    armTime: -1,
    armBones: new Map(),
    armRest: new Map(),
    armMix: { blend: -1, weight: -1, from: null, to: null },
    fingers: new Map(),
  });

  // Apply materials + fresnel once, capture bones, and auto-fit.
  useLayoutEffect(() => {
    /* ── Bind pose: use the on-bone snapshot, NOT a matrix reconstruction ──
       Rebuilding local rest rotations from skeleton.boneInverses looks
       principled, but this Sketchfab export carries 0.01 / 100 unit-conversion
       scales in its node graph, so Matrix4.decompose() on the relative bind
       matrices returns unreliable rotations — the reset produces a deformed
       skeleton, which then poisons the auto-fit measurement (Box3.setFromObject
       measures a SkinnedMesh through its CURRENT pose) and blows the scale up.
       `restOf` snapshots each bone's quaternion the first time it is seen and
       stores it in userData, which survives HMR because drei caches the scene
       object itself. */
    const trueRest = restOf;

    // Re-runs (StrictMode/HMR) must capture from the BIND pose, not whatever
    // the last frame posed — restore every bone to true rest first (this also
    // makes the auto-fit below measure the unposed figure).
    scene.traverse((o) => {
      if ((o as THREE.Bone).isBone) o.quaternion.copy(trueRest(o));
    });

    /* ── Auto-fit: scale to a known height, center X/Z, feet on y=0 ──
       Fit by the SKELETON (bone world positions), not the mesh: bones are
       character-sized by definition, so no stray geometry a model ships can
       corrupt the scale/centering. */
    scene.position.set(0, 0, 0);
    scene.scale.setScalar(1);
    // updateMatrixWorld (NOT updateWorldMatrix): the SkinnedMesh override also
    // re-syncs bindMatrixInverse.
    scene.updateMatrixWorld(true);

    /* Measure in the SCENE'S PARENT space, NOT world space. `scene.position`
       is relative to its parent, and that parent carries the beat-driven
       stage offset. Measuring with getWorldPosition() would fold that offset
       into the box centre, and the recentring below would then cancel it. */
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

    // Scale / centre / floor from the skeleton box (uniform scale about the
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
      console.info(
        `[Miguel:fit] skeletonHeight=${size.y.toFixed(2)} scale=${s.toFixed(3)}`
      );
    } else {
      // No bones at all (not our rig) — mesh-bounds fallback.
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

    // (re)create on every run — a hot-reload can hand us a ref object from an
    // older version of this module that lacks these fields entirely.
    rig.current.glow = [];
    rig.current.eyes = [];
    rig.current.shaders = [];
    rig.current.armBones = new Map();
    rig.current.armRest = new Map();
    rig.current.fingers = new Map();
    const patched = new Set<THREE.Material>();
    const charHeight = Math.max(skelBox.getSize(new THREE.Vector3()).y, 0.001);

    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) {
          mesh.frustumCulled = false; // skinned bounds can be wrong; keep it drawn
        } else {
          /* NOT skinned. Some Sketchfab exports ship a big backdrop mesh, but
             plenty of unskinned meshes are legitimate character parts (hair,
             eyes, lenses, facial detail). Blanket-hiding every unskinned mesh
             erased Miguel's whole head, leaving the bare skin underneath. So
             only drop it if it's actually BACKDROP-SIZED: a mesh wider than
             the character is tall cannot be a piece of the character. */
          const bb = new THREE.Box3().setFromObject(mesh);
          const msize = new THREE.Vector3();
          bb.getSize(msize);
          const isBackdrop =
            Math.max(msize.x, msize.z) > charHeight * 0.9 || msize.y > charHeight * 1.5;
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
          // reads flat, pale & pasty. Force dielectric unless the material
          // actually ships a metalness map.
          if (!std.metalnessMap) std.metalness = 0;

          /* These materials are named with separators between every letter
             ("E_Y_E.002", "B_A_N_D.001"), so a plain /eye/ test NEVER matches
             and the lenses were never registered for the pulse. Flatten first. */
          const flat = (std.name || "").toLowerCase().replace(/[_.\-\s]/g, "");
          const isLens = /lens|eye|glass/.test(flat);
          const fam = isLens ? MAT.eye : MAT.suit;

          if (fam.tint && !std.map) std.color.multiply(new THREE.Color(fam.tint));

          /* UNTEXTURED materials: without this they render as a white
             mannequin. Key the colour off the MATERIAL name, never the mesh
             name — materials are shared and de-duplicated by `patched`, so a
             mesh-name test uses whichever mesh happened to be traversed first
             and can paint BOTH materials the same (both landing on near-black
             made the character invisible against the near-black background). */
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

          // Emissive band map = the 2099 circuit lines. Re-tint to the accent
          // colour and register it so useFrame can pulse it.
          if (std.emissiveMap) {
            std.emissive = new THREE.Color(SUIT_LOOK.accent);
            std.emissiveIntensity = SUIT_LOOK.pulse.min;
            std.toneMapped = true;
            rig.current.glow.push(std);
          }
          // EYES / MASK LENSES: force them self-lit in the accent colour and
          // register for the pulse. They ship little or no emissive map of
          // their own, so without this they read as dull grey holes.
          if (isLens) {
            std.emissive = new THREE.Color(SUIT_LOOK.accent);
            std.emissiveIntensity = SUIT_LOOK.eyePulse.min;
            std.toneMapped = true;
            rig.current.eyes.push(std);
          }
          // adds rim + world-Y fade (hashed alpha only where it's needed)
          applyFresnel(std, fam.rim, fadingMats.has(m), (sh) => {
            rig.current.shaders.push(sh);
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

        /* Procedural arm layer. Match on the SANITIZED name so this works
           whether or not the loader stripped the dots out of "arm_stretch.l".
           trueRest() is called here (before anything has posed the skeleton
           this run) so REST_BONES have a genuine bind snapshot to return to. */
        const flat = sanitizeBoneName(b.name);
        if (POSED_BONES.includes(flat)) rig.current.armBones.set(flat, b);
        if (REST_BONES.includes(flat)) {
          rig.current.armRest.set(flat, b);
          trueRest(b);
        }
        if (FIST_FINGERS.has(flat)) {
          rig.current.fingers.set(flat, b);
          trueRest(b);
        }
      }
    });

    if (
      rig.current.armBones.size !== POSED_BONES.length ||
      rig.current.fingers.size !== FINGER_BONES.length
    ) {
      console.warn(
        `[Miguel:arms] procedural arm layer matched ${rig.current.armBones.size}/` +
          `${POSED_BONES.length} arm bones and ${rig.current.fingers.size}/` +
          `${FINGER_BONES.length} finger bones — authored poses will be partial.`
      );
    }
  }, [scene]);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const r = rig.current;

    /* ── Emissive pulse: the 2099 bands breathe, feeding the bloom pass. ── */
    {
      // Scroll-beat energy scales EVERY glow system in lockstep — dormant in
      // the interlude, threat-display at the punch.
      const energy = beatNow.energy;
      const p = SUIT_LOOK.pulse;
      const w = 0.5 + 0.5 * Math.sin(t * p.rate * Math.PI);
      const lvl = (p.min + (p.max - p.min) * w * w) * energy; // squared = sharper
      for (const m of r.glow) m.emissiveIntensity = lvl;
      const ep = SUIT_LOOK.eyePulse;
      const eLvl = (ep.min + (ep.max - ep.min) * w * w) * energy;
      for (const m of r.eyes) m.emissiveIntensity = eLvl;

      // Pulse the fresnel rim too — the bands are thin, but the rim wraps the
      // whole silhouette, so this is what actually reads as "pulsing".
      const rp = SUIT_LOOK.rimPulse;
      const rim =
        (rp.min + (rp.max - rp.min) * (0.5 + 0.5 * Math.sin(t * rp.rate * Math.PI))) *
        energy;
      const cir = SUIT_LOOK.circuit;
      for (const sh of r.shaders) {
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

    /* ── SCROLL BEAT: place the character where the current beat wants him.
       This only moves the outer stage group, never bones. ── */
    if (stageRef.current) {
      stageRef.current.position.x = beatNow.charX;
      stageRef.current.scale.setScalar(beatNow.charScale);
    }

    /* ── ARM POSES: SCRUB the baked clip by scroll position. Each beat names
       an `armPose` index; BeatDriver smoothsteps between adjacent beats'
       indices, and pose i lives at t = i · secondsPerPose. Damped so the arms
       morph between sections instead of snapping. The action stays paused;
       drei's useAnimations updates the mixer every frame, which applies the
       pose at whatever time we set — there is no playback, so no timing and
       no root motion to go wrong. ── */
    if (armAction.current) {
      const action = armAction.current;
      const dur = action.getClip().duration;
      const target = Math.min(
        Math.max(beatNow.armPoseRaw * ARM_CLIP.secondsPerPose, 0),
        dur
      );
      const lam = scrollState.reducedMotion ? BEAT_DAMP.reducedLambda : ARM_CLIP.damp;
      r.armTime = r.armTime < 0 ? target : THREE.MathUtils.damp(r.armTime, target, lam, delta);
      action.time = r.armTime;
    }

    /* ── PROCEDURAL ARM OVERRIDE ──────────────────────────────────────────
       Runs AFTER the mixer for this frame (drei's useAnimations registers its
       own useFrame at default priority from the top of this component, so it
       is already in the subscriber list ahead of us) — which is exactly what
       lets us treat the clip's output as the base layer and slerp off it.

       `armNow` gives a from/to pair; see resolveArms() for why that shape.
       Fingers are untouched, so the beat's armPose still picks fist vs open
       hand while these bones carry the authored stance. ── */
    if (r.armBones.size) {
      const from = armNow.from ? ARM_POSES[armNow.from] : null;
      const to = armNow.to ? ARM_POSES[armNow.to] : null;

      // Reduce the from/to pair to "one target, one strength".
      let weight: number;
      if (from && to) weight = 1;
      else if (from) weight = 1 - armNow.blend;
      else if (to) weight = armNow.blend;
      else weight = 0;

      /* Damp blend + weight (not the bone quaternions) — one exp-damp on two
         scalars, rather than per-bone smoothing that would drift out of sync.

         SNAP WHEN THE PAIR CHANGES. `blend` is only meaningful relative to a
         specific from/to pair: the moment resolveArms hands back a different
         pair, the OLD damped value means something else entirely. Damping
         across that boundary makes the wind-up fire to full extension, snap
         back and re-extend — the pair flips at exactly the point where blend
         resets 1 -> 0. resolveArms is written so the effective POSE is
         continuous across every such flip, so snapping the parameter is both
         safe and correct; only the parameterisation jumps, never the arm. */
      const lam = scrollState.reducedMotion ? BEAT_DAMP.reducedLambda : armNow.lambda;
      const mix = r.armMix;
      const pairChanged = mix.from !== armNow.from || mix.to !== armNow.to;
      if (mix.blend < 0 || pairChanged) {
        mix.blend = armNow.blend;
        mix.weight = weight;
        mix.from = armNow.from;
        mix.to = armNow.to;
      } else {
        mix.blend = THREE.MathUtils.damp(mix.blend, armNow.blend, lam, delta);
        mix.weight = THREE.MathUtils.damp(mix.weight, weight, lam, delta);
      }

      if (mix.weight > 0.001) {
        for (const [name, bone] of r.armBones) {
          const qa = from?.bones.get(name);
          const qb = to?.bones.get(name);
          if (qa && qb) {
            _qArm.copy(qa).slerp(qb, mix.blend);
          } else if (qa || qb) {
            _qArm.copy((qa ?? qb) as THREE.Quaternion);
          } else continue;
          bone.quaternion.slerp(_qArm, mix.weight);
        }
        // Twists back toward bind rest: the pose solve assumed they sat
        // there, so leaving them on the clip skews where the hand lands.
        for (const [, bone] of r.armRest) {
          bone.quaternion.slerp(restOf(bone), mix.weight);
        }

        /* FINGERS. No baked pose is a relaxed CLOSED hand — 0/2/4 are ~fully
           open, 1/3 are 87% open, only 5 is a fist — and open fingers meeting
           at the centreline is exactly what made the fold look wrong. So curl
           each finger from its own bind rest toward the baked fist by the
           pose's `curl`, which makes "relaxed closed" a tunable that the
           source asset simply doesn't contain. */
        const curl =
          from && to
            ? from.curl + (to.curl - from.curl) * mix.blend
            : (from ?? to)?.curl ?? 0;
        /* GRIP — squeeze PAST the baked fist through the wind-up and the
           strike (see FIST_GRIP). Every driven finger bone is written every
           frame from its own bind rest, so the clip's finger tracks can never
           leave a joint half-open underneath this. */
        const tight = curl * (1 + FIST_GRIP.extra * punchNow.grip);
        if (curl > 0.001) {
          for (const [name, bone] of r.fingers) {
            const fist = FIST_FINGERS.get(name);
            if (!fist) continue;
            const c = THUMB_RE.test(name) ? Math.min(tight, FIST_GRIP.thumbCap) : tight;
            _qArm.copy(restOf(bone)).slerp(fist, c);
            bone.quaternion.slerp(_qArm, mix.weight);
          }
        }
      }

      /* ── SHOULDER DRIVE ──
         Layered ON TOP of whatever the arm pose set for the clavicle, because
         the poses were solved with a heavy clavicle regulariser (the solve
         wants the shoulder to shrug, not relocate the arm) and so barely move
         it at all. Same world-up premultiply the spine chain uses, so the
         retraction/protraction stays horizontal however far the chest has
         already twisted underneath it. */
      const clav = r.armBones.get(CLAVICLE_R);
      if (clav?.parent && Math.abs(punchNow.torso) > 1e-3) {
        clav.parent.getWorldQuaternion(_qParentInv).invert();
        _vAxis.copy(UP).applyQuaternion(_qParentInv);
        _qDelta.setFromAxisAngle(_vAxis, punchNow.torso * PUNCH_BODY.shoulder);
        clav.quaternion.premultiply(_qDelta);
      }

      /* ── PUBLISH THE FIST'S SCREEN POSITION ──
         ImpactCrack needs to break the glass where the punch actually lands.
         It cannot be a constant: the character slides along x per beat AND
         the camera moves during the beat, so the fist's screen position is
         only knowable here, after this frame's bones are set.

         updateWorldMatrix(true, false) walks the parents and refreshes just
         this chain — the renderer's own updateMatrixWorld has not run yet
         this frame, so without it we would publish last frame's pose. */
      const fistBone = r.fingers.get(FIST_BONE) ?? r.armBones.get(FIST_BONE_FALLBACK);
      if (fistBone) {
        // The renderer has not run updateMatrixWorld yet this frame, so walk
        // this bone's own parent chain first or we publish last frame's pose.
        fistBone.updateWorldMatrix(true, false);
        fistBone.getWorldPosition(_vFist); // A: absolute world position
        _vFist.project(state.camera); // B: -> normalised device coordinates
        // C: NDC -> exact viewport pixels. Valid because the rig canvas is a
        // fixed, full-viewport layer, so its client rect IS the viewport.
        scrollState.fistX = (_vFist.x * 0.5 + 0.5) * window.innerWidth;
        scrollState.fistY = -(_vFist.y * 0.5 - 0.5) * window.innerHeight;
        scrollState.fistValid = true;
      }
    }

    /* Sequence clock. Held at 0 until the entry portal uncovers the page —
       otherwise the ~2.6s look-back plays out (and finishes) behind the
       splash/portal and the user arrives to find him already turned.
       Re-stamping `start` every frame keeps `local` pinned at 0, so he holds
       the pre-turn pose: back fully to camera, arms at armPose 0. */
    if (scrollState.revealed) {
      if (r.start < 0) r.start = t;
    } else {
      r.start = t;
    }
    const local = t - r.start;

    // Body: yaw away + faint idle sway/bob. Set FIRST so the bone parent
    // world orientations sampled below already include this frame's motion.
    if (groupRef.current) {
      groupRef.current.rotation.y =
        POSE.bodyYaw + beatNow.charYaw + Math.sin(t * IDLE.sway.rate) * IDLE.sway.yaw;
      groupRef.current.position.y = Math.sin(t * IDLE.sway.bobRate) * IDLE.sway.bob;
    }

    // Frame-rate-independent smoothing of the cursor (no jitter on the head).
    r.glance.x = THREE.MathUtils.damp(r.glance.x, pointer.current.x, IDLE.glance.damp, delta);
    r.glance.y = THREE.MathUtils.damp(r.glance.y, pointer.current.y, IDLE.glance.damp, delta);

    // 0→1 as the head finishes its turn: gates the cursor glance so it only
    // fades in once the pose is held.
    const headCfg = POSE.chain[POSE.chain.length - 1];
    const settle = THREE.MathUtils.clamp(
      (local - POSE.hold - headCfg.delay) / headCfg.dur,
      0,
      1
    );

    const breathe = Math.sin(t * IDLE.breath.rate) * IDLE.breath.scale;

    /* ── SPINE CHAIN — look-back twist + breathing + glance. Walk ROOT→TIP so
       every parent's world orientation is already updated (this frame) when
       its child re-expresses the world-up axis. ── */
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

      /* ── PUNCH TORSO DRIVE ──
         A cross is thrown with the chest, not the arm. `punchDrive.torso`
         runs −1 (wound onto his right) → +1 (whipped through to his left);
         spreading it down the chain waist-first is what makes it read as the
         body driving the fist instead of the fist dragging the body. The
         clavicles hang off spine_03 (the `spine2` slot), so this alone
         already carries the right shoulder back on the wind-up and forward
         on the strike — the shoulder work below only exaggerates it. */
      if (seg.key === "spine") yaw += punchNow.torso * PUNCH_BODY.twistWaist;
      if (seg.key === "spine1") {
        pitch += breathe * IDLE.breath.spine1;
        pitch += beatNow.poseLean * 0.45; // chest hunch / open-up
        roll += beatNow.poseTilt * 0.5; // swagger through the torso
        yaw += punchNow.torso * PUNCH_BODY.twistMid;
      }
      if (seg.key === "spine2") {
        pitch += breathe * IDLE.breath.spine2;
        pitch += beatNow.poseLean * 0.55;
        roll = eased * POSE.lean + beatNow.poseTilt * 0.5;
        yaw += punchNow.torso * PUNCH_BODY.twistChest;
        // Drop the shoulder into the punch as it lands — weight, not just spin.
        roll += punchNow.impact * PUNCH_BODY.chestDrop;
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
          wob(t * 1.3) * IDLE.head.bob + // restless micro-nod
          beatNow.poseChin; // beat chin attitude (− lifts, + drops)
        yaw += r.glance.x * IDLE.glance.yawHead * settle;
        roll += IDLE.head.roll * eased;
      }

      /* ── World-vertical twist, quaternion-correct for this chain ──
         new_local = (parent⁻¹ · Δworld · parent) · rest  ⇒  premultiply a
         rotation about world-up re-expressed in the parent's space. This is
         what keeps the spiral vertical instead of kinking down the chain. */
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
  });

  // Outer group = beat-driven stage offset; inner group carries the body yaw
  // + idle motion. Auto-fit put feet at y=0.
  return (
    <group ref={stageRef}>
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
     1. pick the two adjacent beats and smoothstep-blend their values
        (eased target — holds shape near each section centre);
     2. exponential-damp beatNow toward that target (frame-rate independent,
        gives the camera a cinematic lag; near-instant under reduced motion).
   CameraRig + MiguelCharacter then consume beatNow inside their own
   useFrame — no React state anywhere in the per-frame path, and BeatDriver
   runs at priority −1 so beatNow is fresh before any consumer reads it.
   ════════════════════════════════════════════════════════════ */
const B0 = BEATS[0];
const beatNow = {
  cam: new THREE.Vector3(B0.cam[0], B0.cam[1], B0.cam[2]),
  look: new THREE.Vector3(B0.look[0], B0.look[1], B0.look[2]),
  charX: B0.char.x,
  charYaw: B0.char.yaw,
  charScale: B0.char.scale,
  energy: B0.energy,
  fadeTop: B0.fade.top,
  fadeBottom: B0.fade.bottom,
  poseTurn: B0.pose.turn,
  poseLean: B0.pose.lean,
  poseTilt: B0.pose.tilt,
  poseChin: B0.pose.chin,
  /** UNDAMPED arm-pose index — the arm layer applies its own heavier damp. */
  armPoseRaw: B0.armPose,
  initialized: false,
};
/** Current procedural arm stance pair. Written by BeatDriver, read by
    MiguelCharacter's frame loop — same no-React-state contract as beatNow.
    UNDAMPED on purpose: the damping happens on the two blend scalars in the
    consumer, where the punch can use its own much faster rate. */
const armNow: ArmBlend = {
  from: BEATS[0].arms,
  to: BEATS[0].arms,
  blend: 1,
  lambda: 2.6,
};

/** Torso/shoulder drive for the punch. Recomputed beside armNow every frame
    so the body and the arm are always reading the SAME scroll position — the
    whole point of the shared signal is that they cannot disagree. */
const punchNow: PunchDrive = { torso: 0, impact: 0, grip: 0 };

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
    const beats = activeBeats.list;
    const maxIdx = beats.length - 1;
    const pos = THREE.MathUtils.clamp(scrollState.beatPos, 0, maxIdx);
    const i = Math.min(Math.floor(pos), Math.max(maxIdx - 1, 0));
    const a = beats[i];
    const b = beats[Math.min(i + 1, maxIdx)];
    const f = THREE.MathUtils.clamp(pos - i, 0, 1);
    const e = f * f * (3 - 2 * f); // smoothstep: eases out of / into each hold

    /* ── THE PUNCH RUNS OFF ITS OWN PLAYHEAD, NOT `pos` ──
       Everything above and below this reads the raw scroll position: the
       camera, the character's placement, the grading, the dissolve. The
       throw does not, because scrubbing it means a fast scroll plays the
       entire punch inside two frames. `punchPos` rate-limits its advance per
       stage (see PUNCH_TEMPO), so a flick leaves the punch performing behind
       you instead of teleporting through it. Slow scrolling never hits the
       limit and is unchanged.

       performance.now(), NOT state.clock: ImpactCrack's own rAF advances the
       same playhead and the two must share a timebase. */
    const pPos = punchPos(pos, performance.now(), scrollState.reducedMotion);

    // Procedural arm stance + torso drive for this scroll position (both
    // mutate in place; BeatDriver runs at priority −1 so consumers see them
    // fresh in the same frame).
    resolveArms(pPos, armNow);
    punchDrive(pPos, punchNow);

    /* ── PUNCH IMPACT: lens "takes the hit" — a chromatic-aberration spike
       fired exactly when the screen-crack overlay lands (same beatPos gate),
       decaying fast. Skipped under prefers-reduced-motion. ── */
    /* impactStartFrac, not End: that is the frame the fist stops, and the
       lens has to take the hit at the same instant the glass does. (End is
       where the CRACKS finish growing — ~100 ms later once PUNCH_TEMPO is
       pacing the throw, which would put the RGB split visibly after it.) */
    const landed = pPos >= maxIdx * PUNCH.impactStartFrac;
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

    // Arms bypass the camera damp entirely — the arm layer applies its own
    // (heavier) damp, and stacking the two just made the arms feel mushy.
    beatNow.armPoseRaw = a.armPose + (b.armPose - a.armPose) * e;

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

/* Feeds the perf probe one sample per frame. Renders nothing.

   Priority is NEGATIVE so it runs ahead of the scene's own callbacks — and,
   more importantly, so it stays out of the way: a positive priority makes R3F
   hand rendering over to the caller, and a probe that changes how the page
   draws is not measuring the page.

   gl.info.render reports the PREVIOUS frame's draw calls, which is what we
   want anyway: the frame whose interval we just measured. */
function PerfSampler() {
  const gl = useThree((s) => s.gl);

  /* three.js clears info.render at the START of every render() call, and
     EffectComposer renders once per pass. Reading it at the top of the next
     frame therefore returned the LAST pass only — the fullscreen composite,
     which is exactly 1 draw call and 1 triangle. That is what the first
     recording reported, and it said nothing about the scene.

     autoReset off makes the counters accumulate across every pass; we read the
     whole frame's total and clear it ourselves. */
  useEffect(() => {
    if (!perfProbe.enabled) return;
    gl.info.autoReset = false;
    return () => {
      gl.info.autoReset = true;
    };
  }, [gl]);

  useFrame(() => {
    perfProbe.frame(gl.info.render.calls, gl.info.render.triangles);
    if (perfProbe.enabled) gl.info.reset();
  }, -1000);

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

      {/* ── CINEMATIC RIG: low-key three-point + coloured rims + kicker.
          Ratios matter more than values: key ≈ 7× fill keeps a real shadow
          side (form), rims ≈ 0.6× key cut him out of the black bg. ── */}

      {/* Ambient near-zero — a big flat ambient is exactly what reads "pasty".
          Just enough cool spill to keep shadows from clipping to pure black. */}
      <ambientLight intensity={0.12 * E} color={"#3d4460"} />

      {/* KEY — warm, high, from front-left (short-side Rembrandt-ish). */}
      <directionalLight position={[-2.5, 3.8, 3]} intensity={2.6 * E} color={"#ffe9d6"} />

      {/* FILL — cool + faint (key:fill ≈ 7:1, low-key drama). */}
      <directionalLight position={[3.5, 1, 2.5]} intensity={0.35 * E} color={"#8fa0c8"} />

      {/* RIM — spider red from back-left: hot coloured edge on the suit */}
      <directionalLight position={[-4, 1.5, -3]} intensity={1.8 * E} color={"#e23636"} />

      {/* RIM — glitch cyan from back-right: the complementary edge */}
      <directionalLight position={[4, 2, -2.5]} intensity={1.5 * E} color={"#00e5ff"} />

      {/* KICKER — cool white from top-back: shoulder highlight that separates
          the dark silhouette from the dark background. */}
      <directionalLight position={[0, 4.5, -3.5]} intensity={0.9 * E} color={"#dfe8ff"} />

      {/* Environment built from emissive planes (no CDN/HDR fetch) — gives the
          suit neon reflections so it reads as a sheened surface, not flat paint. */}
      <Environment resolution={PERF.envResolution} background={false}>
        <Lightformer intensity={2.4} color="#e23636" position={[-3, 1, -2]} scale={[3, 5, 1]} />
        <Lightformer intensity={2.0} color="#00e5ff" position={[3, 1.5, -1]} scale={[3, 5, 1]} />
        <Lightformer intensity={1.2} color="#ffffff" position={[0, 4, 2]} scale={[6, 2, 1]} />
        <Lightformer intensity={0.8} color="#1565c0" position={[0, -2, 3]} scale={[6, 3, 1]} />
      </Environment>

      <Suspense fallback={null}>
        <MiguelCharacter />
      </Suspense>

      <PerfSampler />

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

useGLTF.preload(MODEL_URL);
if (ARM_CLIP.enabled) useGLTF.preload(ARM_CLIP.url);
