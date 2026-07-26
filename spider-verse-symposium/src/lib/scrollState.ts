/* ════════════════════════════════════════════════════════════
   SCROLL STATE — the single source of truth for scroll progress.

   A plain module-level mutable object, NOT React state: it is written by
   ScrollRig on every scroll event and read by the R3F frame loop inside
   `useFrame`. Driving this through setState would re-render React every
   frame; a shared ref-like object costs nothing.

   Writers: src/components/ScrollRig.tsx (Lenis / native scroll).
   Readers: BeatDriver + CameraRig + SpideyCharacter in Spider3D.tsx.
   ════════════════════════════════════════════════════════════ */

export type ScrollState = {
  /** Whole-page scroll progress, 0 (top) → 1 (bottom). */
  progress: number;
  /**
   * Continuous story-beat position, 0 → (beatCount − 1).
   * Integer values = a `[data-beat]` section is centred in the viewport;
   * fractional values = travelling between two adjacent sections.
   * The 3D side interpolates BEATS[floor] → BEATS[ceil] with this.
   */
  beatPos: number;
  /** Smoothed scroll velocity (px/frame-ish, sign = direction). Purely FYI. */
  velocity: number;
  /** Number of `[data-beat]` sections found in the DOM. */
  beatCount: number;
  /** Live `prefers-reduced-motion` flag — 3D side snaps instead of gliding. */
  reducedMotion: boolean;
};

export const scrollState: ScrollState = {
  progress: 0,
  beatPos: 0,
  velocity: 0,
  beatCount: 1,
  reducedMotion: false,
};
