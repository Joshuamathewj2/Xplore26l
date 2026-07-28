"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";

/* ------------------------------------------------------------------ *
 * Geometry
 *
 * Everything lives in a fixed 1000x1000 viewBox that is centred over the
 * viewport (preserveAspectRatio="xMidYMid meet"), so the eyes sit dead
 * centre on any screen size and scale with the shorter viewport edge.
 *
 * One lens is authored in a local 210x148 box with its centre at
 * (105, 74); the left lens is the same path mirrored about x = 500.
 * ------------------------------------------------------------------ */

/* Hard-edged comic lens: straight runs meeting at sharp vertices, with a
   pointed inner tip toward the nose and a broad outer corner. Kept inside the
   same 210x148 box centred on (105, 74) so the existing lens transforms and
   per-eye transform-origins still line up. */
const EYE_PATH = `
  M 10 78
  L 44 20
  L 120 2
  L 190 28
  L 208 80
  L 172 132
  L 80 148
  L 22 116
  Z
`;

const LENS = "translate(522 426) rotate(-5 105 74)";

const EYES = [
  // transformOrigin is in viewBox user units (SVG default transform-box: view-box),
  // so each lens scales around ITS OWN centre. That matters for the zoom: growing
  // from a shared centre would blow the nose gap open into a black band.
  { key: "right", transform: LENS, origin: "627px 500px" },
  { key: "left", transform: `translate(1000 0) scale(-1 1) ${LENS}`, origin: "373px 500px" },
];

/* ------------------------------------------------------------------ *
 * Timeline
 * ------------------------------------------------------------------ */

type Phase = "opening" | "looking" | "zooming" | "completed";

const DURATION: Record<Exclude<Phase, "completed">, number> = {
  opening: 1400,
  looking: 2400,
  zooming: 1150,
};
const NEXT_PHASE: Record<Exclude<Phase, "completed">, Phase> = {
  opening: "looking",
  looking: "zooming",
  zooming: "completed",
};

/* Per-lens transform.
 *
 * scaleX/scaleY are always driven together — Framer builds scale(x, y) from
 * them, so leaving one out during the zoom would stretch the lens instead of
 * blowing it up.
 *
 * x/y are applied on the OUTER group, above the per-eye mirror transform, so
 * a positive x moves both lenses the same way on screen rather than sending
 * them in opposite directions.
 */
const lensMotion: Variants = {
  // Starts shut: a zero-height lid on the lens centreline.
  initial: { scaleX: 1, scaleY: 0, x: 0, y: 0 },

  /* Eyelids parting. Holding a hairline slit for the first beat sells it as
     an eye cracking open rather than a shape scaling in. */
  opening: {
    scaleX: 1,
    scaleY: [0, 0.07, 1, 0.92, 1],
    x: 0,
    y: 0,
    transition: {
      duration: DURATION.opening / 1000,
      times: [0, 0.2, 0.72, 0.86, 1],
      ease: "easeOut",
    },
  },

  /* Looking around: dart, hold, dart, hold, blink, glance, recentre. The
     holds matter more than the moves — eyes fixate between saccades, and
     without the pauses this reads as drifting rather than looking. */
  looking: {
    x: [0, 30, 30, -32, -32, -32, -32, 14, 0],
    y: [0, -9, -9, 6, 6, 6, 6, -13, 0],
    scaleY: [1, 1, 1, 1, 1, 0.1, 1, 1, 1],
    scaleX: [1, 1, 1, 1, 1, 1.04, 1, 1, 1],
    transition: {
      duration: DURATION.looking / 1000,
      times: [0, 0.12, 0.3, 0.42, 0.58, 0.635, 0.69, 0.85, 1],
      ease: "easeInOut",
    },
  },

  zooming: {
    /* Scale is linear in value but coverage is not: by ~14x the lens already
       fills a 16:9 viewport. Keyframes keep the first half as a menacing swell
       and put the explosive part where it reads, with the screen fully white
       by t=0.78 so there is something to dissolve. 46 covers ultrawide. */
    scaleX: [1, 2.4, 40, 46],
    scaleY: [1, 2.4, 40, 46],
    x: 0,
    y: 0,
    transition: {
      duration: DURATION.zooming / 1000,
      times: [0, 0.42, 0.78, 1],
      ease: ["easeIn", "easeIn", "linear"],
    },
  },
  completed: { scaleX: 46, scaleY: 46, x: 0, y: 0 },
};

/* Neon-red outline, drawn on with pathLength as the lids part. */
const strokeMotion: Variants = {
  initial: { pathLength: 0, opacity: 0 },
  opening: {
    pathLength: 1,
    opacity: 1,
    transition: {
      pathLength: { duration: 1.15, ease: "easeInOut" },
      opacity: { duration: 0.3 },
    },
  },
  looking: { pathLength: 1, opacity: 1 },
  zooming: { pathLength: 1, opacity: 0, transition: { duration: 0.5 } },
  completed: { pathLength: 1, opacity: 0 },
};

/* Black inner shade that bleeds in behind the outline, so the lens reads as
   a sharp red rule around a dark pupil before it flares white. */
const shadeFillMotion: Variants = {
  initial: { opacity: 0 },
  opening: { opacity: 0.9, transition: { duration: 1, delay: 0.3 } },
  looking: { opacity: 1 },
  zooming: { opacity: 0, transition: { duration: 0.35 } },
  completed: { opacity: 0 },
};

/* Solid white fill — the lenses go proper mask-white once they are open, then
   hold opaque through the first half of the zoom (white wipes over the screen)
   before dissolving to uncover the punched-out hole. */
const whiteFillMotion: Variants = {
  initial: { opacity: 0 },
  opening: { opacity: 0 },
  looking: { opacity: 1, transition: { duration: 0.4, ease: "easeOut" } },
  zooming: {
    opacity: [1, 1, 0],
    transition: {
      duration: DURATION.zooming / 1000,
      times: [0, 0.78, 1],
      ease: "easeOut",
    },
  },
  completed: { opacity: 0 },
};

/* Gate for the mask cut-out: the lenses only start punching through the
   black overlay once the zoom begins. */
const punchMotion: Variants = {
  initial: { opacity: 0 },
  opening: { opacity: 0 },
  looking: { opacity: 0 },
  zooming: { opacity: 1, transition: { duration: 0 } },
  completed: { opacity: 1 },
};

function LensPair({ children }: { children: React.ReactNode }) {
  return (
    <>
      {EYES.map(({ key, transform, origin }) => (
        <motion.g
          key={key}
          variants={lensMotion}
          style={{ transformOrigin: origin, willChange: "transform" }}
        >
          <g transform={transform}>{children}</g>
        </motion.g>
      ))}
    </>
  );
}

/**
 * Spider-Man mask-eye splash transition.
 *
 * Renders as a fixed overlay ABOVE the page, so the site should be mounted
 * normally underneath — the zoom punches genuine transparent holes through
 * the black overlay and reveals the real DOM, not a copy of it.
 */
export default function SplashScreen({ onComplete }: { onComplete?: () => void }) {
  const [phase, setPhase] = useState<Phase>("opening");
  const prefersReducedMotion = useReducedMotion();
  const done = useRef(false);

  const finish = useCallback(() => {
    if (done.current) return;
    done.current = true;
    onComplete?.();
  }, [onComplete]);

  // Drive the state machine: opening -> looking -> zooming -> completed.
  useEffect(() => {
    // "completed" is checked first: reaching it must always fire onComplete,
    // including on the reduced-motion shortcut below.
    if (phase === "completed") {
      finish();
      return;
    }
    // Reduced motion skips the sequence outright. Completing directly rather
    // than hopping through a "completed" state avoids a cascading re-render.
    if (prefersReducedMotion) {
      finish();
      return;
    }
    const id = setTimeout(() => setPhase(NEXT_PHASE[phase]), DURATION[phase]);
    return () => clearTimeout(id);
  }, [phase, prefersReducedMotion, finish]);

  // Let the viewer bail out early — jumps straight to the wipe.
  const skip = useCallback(() => {
    setPhase((p) => (p === "zooming" || p === "completed" ? p : "zooming"));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === " " || e.key === "Enter") skip();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [skip]);

  // non-scaling-stroke pins the outline to device pixels, so a fixed width would
  // read as a hairline on a desktop lens and swallow a phone one. Track the
  // viewport instead: the lenses are sized off the shorter edge, so the stroke is too.
  const [strokeWidth, setStrokeWidth] = useState(13);
  useEffect(() => {
    const update = () =>
      setStrokeWidth(Math.min(window.innerWidth, window.innerHeight) * 0.016);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Nothing should scroll behind the splash. This page scrolls on <html>, so
  // both elements have to be pinned.
  useEffect(() => {
    const html = document.documentElement;
    const prevHtml = html.style.overflow;
    const prevBody = document.body.style.overflow;
    html.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      html.style.overflow = prevHtml;
      document.body.style.overflow = prevBody;
    };
  }, []);

  if (phase === "completed" || prefersReducedMotion) return null;

  return (
    <div
      className="fixed inset-0 overflow-hidden"
      // Above the global noise overlay and the hero's fixed frame, both at 9999.
      style={{ zIndex: 10000 }}
      role="presentation"
      onClick={skip}
    >
      {/* ---- Layer 1: black overlay with the lenses punched out of it ---- */}
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 1000 1000"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        <defs>
          <mask
            id="spider-eye-mask"
            maskUnits="userSpaceOnUse"
            x="-3000"
            y="-3000"
            width="7000"
            height="7000"
          >
            {/* white = keep the overlay, black = cut a hole through to the site */}
            <rect x="-3000" y="-3000" width="7000" height="7000" fill="#fff" />
            <motion.g initial="initial" animate={phase} variants={punchMotion}>
              <LensPair>
                <path d={EYE_PATH} fill="#000" />
              </LensPair>
            </motion.g>
          </mask>
        </defs>
        <rect
          x="-3000"
          y="-3000"
          width="7000"
          height="7000"
          fill="#000"
          mask="url(#spider-eye-mask)"
        />
      </svg>

      {/* ---- Layer 2: the visible lenses (red outline + fills) ---- */}
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 1000 1000"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        <motion.g initial="initial" animate={phase}>
          <LensPair>
            <motion.path d={EYE_PATH} fill="#000000" variants={shadeFillMotion} />
            <motion.path d={EYE_PATH} fill="#ffffff" variants={whiteFillMotion} />
            <motion.path
              d={EYE_PATH}
              fill="none"
              stroke="#ff0014"
              strokeWidth={strokeWidth}
              strokeLinecap="butt"
              strokeLinejoin="miter"
              /* Low limit: any vertex too acute to mitre cleanly bevels
                 instead of throwing a spike out past the lens. */
              strokeMiterlimit={3}
              /* keeps the outline a crisp band instead of a giant red slab at scale(46) */
              vectorEffect="non-scaling-stroke"
              variants={strokeMotion}
            />
          </LensPair>
        </motion.g>
      </svg>

      {/* ---- Skip ---- */}
      <motion.button
        type="button"
        onClick={skip}
        className="absolute bottom-6 right-6 rounded-full border border-white/20 px-4 py-1.5 text-[11px] font-medium uppercase tracking-[0.2em] text-white/60 transition hover:border-white/40 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        initial={{ opacity: 0 }}
        animate={{ opacity: phase === "zooming" ? 0 : 1 }}
        transition={{ duration: 0.4, delay: phase === "opening" ? 1.2 : 0 }}
      >
        Skip
      </motion.button>
    </div>
  );
}
