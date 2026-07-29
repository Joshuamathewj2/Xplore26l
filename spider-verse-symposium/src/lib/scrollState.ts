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
  /** `window.innerWidth < MOBILE_BREAKPOINT`, live — written by ScrollRig on
      every measure so Spider3D can gate phone-only behaviour without its own
      resize listener. */
  isMobile: boolean;
  /**
   * 0 → 1 as `#coordinators` scrolls up from the bottom of the viewport into
   * full view; 0 whenever it is still below the fold.
   *
   * There is no story BEAT for this section — see the note at the bottom of
   * `beats.ts` on why `sponsors` is "the last reachable anchor" — so
   * `beatPos` simply clamps at the sponsors beat and the rig holds that
   * pose's full-screen-centred camera for the rest of the page. On a phone
   * that frozen pose sits at zIndex 30, on top of the coordinator cards'
   * zIndex 10, and blocks their names. This is a second, independent scroll
   * signal (plain viewport-rect math, nothing to do with beat anchors) that
   * Spider3D blends against ON MOBILE ONLY to ease him down to a small
   * silhouette at the screen edge as the section arrives, instead of adding
   * a real beat that would shift `maxIdx` and detune the punch timing.
   */
  postSponsorProgress: number;
  /**
   * 0 while any part of `#events` is still below the viewport's top edge —
   * i.e. the section hasn't fully scrolled past yet; ramps to 1 over a SHORT
   * band (12% of a viewport height) after. Mirrors `postSponsorProgress`
   * above, but for the OPPOSITE edge: that one detects a section ARRIVING,
   * this one detects `#events` LEAVING.
   *
   * WHY THIS EXISTS: the "events" beat's mobile exit pose (walked off-frame
   * left, see beats.ts) is anchored to the SECTION'S CENTRE via the normal
   * beat-anchor system, but on a phone `#events` is a vertical stack of six
   * cards — far taller than one screen. Worse, the HOLD-compressed beatPos
   * formula in ScrollRig SATURATES at the next beat well before the section
   * has actually scrolled past (measured: beatPos can reach the "interlude"
   * beat with ~700px of a six-card stack still below the fold), so gating
   * the hold on "which beat is active" releases it too early no matter which
   * beat that check names. Only a real bounding-rect signal catches this.
   *
   * The release band is kept short on purpose: the punch's wind-up-to-landed
   * sequence (PUNCH_TEMPO in beats.ts) starts timing itself the moment
   * Miguel is let back on screen, so a slow release here would eat into —
   * or entirely swallow — the punch before the user ever sees him throw it.
   */
  eventsClearProgress: number;
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
  isMobile: false,
  postSponsorProgress: 0,
  eventsClearProgress: 1,
};
