/* ════════════════════════════════════════════════════════════
   DEBUG FLAGS — URL switches for isolating what costs frame time.

   The probe established that our per-frame JS is 0.135ms against a 25ms
   frame. Whatever is spending the other 25ms is not code we time, and the
   remaining candidates cannot be separated by reading the source — they have
   to be switched off one at a time and measured.

   These exist so that takes seconds rather than an edit-rebuild cycle:

     ?debug=perf              probe + HUD
     ?debug=perf&nopost=1     no EffectComposer — isolates the 5 post passes
     ?debug=perf&dpr=1        force devicePixelRatio 1 — isolates fill rate
     ?debug=perf&novideo=1    skip the autoplaying videos — isolates decode

   Compare frame p50 across runs. Whichever switch moves it is the cost.

   All default to off, so a normal visit is unaffected and there is no way to
   reach any of this without deliberately typing it.
   ════════════════════════════════════════════════════════════ */

function flag(name: string): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get(name) === "1";
}

function num(name: string): number | null {
  if (typeof window === "undefined") return null;
  const v = new URLSearchParams(window.location.search).get(name);
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/* Read once at module load. Reading per frame would put URL parsing in the
   render loop, which is the sort of thing this file exists to find. */
export const DEBUG = {
  /** Disable the post-processing composer entirely. */
  noPost: flag("nopost"),
  /* Drop ONLY Bloom, keeping the rest of the stack.
     nopost=1 showed the composer costs ~14ms/frame, but that is six effects
     together. Five of them merge into a single pass; Bloom does not — it runs
     its own downsample/upsample mip chain. This separates "the stack is too
     expensive" from "Bloom is too expensive", which lead to different fixes. */
  noBloom: flag("nobloom"),
  /** Skip the autoplaying background videos. */
  noVideo: flag("novideo"),
  /** Override the device pixel ratio cap. `?dpr=1` is the useful one. */
  dpr: num("dpr"),
};

/** True if any switch is set — used to warn loudly that this is not a fair run. */
export const DEBUG_ACTIVE = DEBUG.noPost || DEBUG.noVideo || DEBUG.dpr !== null;

if (typeof window !== "undefined" && DEBUG_ACTIVE) {
  console.warn(
    "%c[debug] rendering is MODIFIED: " +
      [
        DEBUG.noPost ? "no post-processing" : "",
        DEBUG.noVideo ? "no videos" : "",
        DEBUG.dpr !== null ? `dpr forced to ${DEBUG.dpr}` : "",
      ]
        .filter(Boolean)
        .join(", ") +
      " — this is a measurement, not what users see.",
    "color:#f4a261;font-weight:bold"
  );
}
