/* ════════════════════════════════════════════════════════════
   SCROLL STATE — the single source of truth for scroll progress.

   A plain module-level mutable object, NOT React state: it is written by
   ScrollRig on every scroll event and read by the R3F frame loop inside
   `useFrame`. Driving this through setState would re-render React every
   frame; a shared ref-like object costs nothing.

   Writers: src/components/ScrollRig.tsx (native scroll),
            MiguelCharacter in Spider3D.tsx (the fist position below).
   Readers: BeatDriver + CameraRig + MiguelCharacter in Spider3D.tsx,
            ImpactCrack.tsx.
   ════════════════════════════════════════════════════════════ */

export type ScrollState = {
  /** Whole-page scroll progress, 0 (top) → 1 (bottom). */
  progress: number;
  /**
   * Continuous story-beat position, 0 → (beatCount − 1).
   * Integer values = a beat section is centred in the viewport;
   * fractional values = travelling between two adjacent sections.
   * The 3D side interpolates BEATS[floor] → BEATS[ceil] with this.
   */
  beatPos: number;
  /** Smoothed scroll velocity (px/frame-ish, sign = direction). Purely FYI. */
  velocity: number;
  /** Number of beat sections actually found in the DOM. */
  beatCount: number;
  /** Live `prefers-reduced-motion` flag — 3D side snaps instead of gliding. */
  reducedMotion: boolean;
  /**
   * True once the entry portal has uncovered the page.
   *
   * The canvas mounts immediately (so the ~6.5 MB model is downloaded and
   * warm behind the portal), but Miguel's signature over-the-shoulder
   * look-back runs on a ~2.6 s clock from first frame. Without this gate it
   * would play — and finish — while the user is still looking at the splash
   * and portal, and they would arrive to find him already turned. The
   * character holds at frame 0 of the turn until this flips true.
   */
  revealed: boolean;
  /**
   * Where the RIGHT FIST is on screen, in VIEWPORT PIXELS from the top-left.
   * Written every frame by MiguelCharacter: world position of the knuckle
   * bone → `project(camera)` → NDC → pixels. ImpactCrack drops its overlay
   * straight onto these as CSS `left`/`top`.
   *
   * Pixels rather than percentages because the consumer is a positioned DOM
   * element, and going through percentages means the browser re-derives the
   * same number from a containing block that may not be the viewport.
   *
   * This used to be a hard-coded (36, 34) in ImpactCrack — a constant that
   * was correct for a character position two edits earlier and silently wrong
   * after, and which could never have tracked him anyway because the camera
   * moves during the beat.
   */
  fistX: number;
  fistY: number;
  /** False until the hand bone has been found and projected at least once. */
  fistValid: boolean;
};

export const scrollState: ScrollState = {
  progress: 0,
  beatPos: 0,
  velocity: 0,
  beatCount: 1,
  reducedMotion: false,
  revealed: false,
  fistX: 0,
  fistY: 0,
  fistValid: false,
};
