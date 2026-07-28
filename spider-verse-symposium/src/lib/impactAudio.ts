/* ════════════════════════════════════════════════════════════
   IMPACT AUDIO — the one-shot "glass shatters" hit.

   Set `IMPACT_SOUND.src` to a file in /public and it plays on the exact
   frame the punch lands (fired from ImpactCrack's frame loop). Until then
   every call here is a silent no-op, so the whole system can ship with no
   audio asset at all and nothing logs, throws, or stalls.

   ── THINGS THIS HAS TO SURVIVE ────────────────────────────────────────
   1. AUTOPLAY POLICY. Browsers refuse audio until the page has a user
      ACTIVATION — and scrolling is not one (only pointer/key/touch count).
      The entry portal is a click, which is what unlocks us in practice; if
      it somehow hasn't happened, play() rejects and we swallow it rather
      than throwing inside requestAnimationFrame.
   2. RE-TRIGGERING. The impact re-arms when you scroll back up and down, so
      the same hit can fire again while the previous one is still ringing.
      A single <audio> element would cut itself off, hence the small voice
      pool — each call takes the next element round-robin.
   3. SSR. This module is imported by a client component but Next still
      evaluates it on the server, so nothing touches `window`/`Audio` at
      module scope — only inside the functions.
   ════════════════════════════════════════════════════════════ */

export const IMPACT_SOUND = {
  /** DROP THE FILE PATH HERE — e.g. "/audio/glass-shatter.mp3" (served from
      /public). Empty string = audio disabled, every call below no-ops. */
  src: "",
  /** 0–1. The hit is a punctuation mark, not the soundtrack. */
  volume: 0.6,
  /** Overlapping copies. 2 is enough for a re-armed scroll-back-and-forth. */
  voices: 2,
  /** Playback rate — nudge >1 for a snappier, drier crack. */
  rate: 1,
};

let pool: HTMLAudioElement[] | null = null;
let next = 0;

/** Build the voice pool. Safe to call repeatedly; only the first does work. */
export function primeShatterSound() {
  if (pool || typeof window === "undefined" || !IMPACT_SOUND.src) return;
  pool = [];
  for (let i = 0; i < Math.max(1, IMPACT_SOUND.voices); i++) {
    const a = new Audio(IMPACT_SOUND.src);
    a.preload = "auto";
    a.volume = IMPACT_SOUND.volume;
    a.playbackRate = IMPACT_SOUND.rate;
    // Decode ahead of time — the punch is a single frame, and a first-play
    // network fetch would land the sound well after the glass breaks.
    a.load();
    pool.push(a);
  }
}

/**
 * Play the impact hit. Called from a rAF loop, so it must never throw and
 * must never block: a failed/blocked play is simply silence.
 */
export function playShatterSound() {
  if (typeof window === "undefined" || !IMPACT_SOUND.src) return;
  if (!pool) primeShatterSound();
  if (!pool || !pool.length) return;

  const a = pool[next];
  next = (next + 1) % pool.length;
  try {
    a.currentTime = 0; // restart even if this voice is still ringing
    a.volume = IMPACT_SOUND.volume; // picked up if tuned at runtime
    a.playbackRate = IMPACT_SOUND.rate;
    // play() returns a promise that REJECTS on autoplay block — unhandled, it
    // surfaces as a console error every frame the user scrolls the punch.
    void a.play()?.catch(() => {});
  } catch {
    /* element in a bad state (missing file, unsupported codec) — stay silent */
  }
}
