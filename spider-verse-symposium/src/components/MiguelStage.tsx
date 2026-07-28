"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import ScrollRig from "./ScrollRig";
import ImpactCrack from "./ImpactCrack";
import { scrollState } from "@/lib/scrollState";
import { activeBeats, BEATS } from "@/lib/beats";

/* ════════════════════════════════════════════════════════════
   MIGUEL STAGE — the single mount point for the 3D hero.

   Renders the persistent full-viewport canvas plus the two systems that
   drive it (ScrollRig writes scroll→beat; ImpactCrack draws the punch).
   Mounted exactly once, so the ~6.5 MB model loads exactly once and the
   character survives across every section rather than remounting.

   ── WHY THE Z-INDEX MOVES ──────────────────────────────────────────────
   The existing sections each pin their content at a different layer, and
   they were not built with a character passing through them:

     #hero              section z-auto; solid title z8, character slot z15,
                        outline title z16, vignette z20, scrim z22, cards
                        z30, nav z50
     #events            section z-auto; backdrop/dots/colour-blocks at
                        layer 0, heading + carousel stage pinned at z10
     video interlude    section z-auto, opaque black background
     #sponsors, footer  section itself pinned at z10

   A single fixed z-index cannot satisfy all of those: z15 puts him in the
   hero's title sandwich but on top of the carousel; z5 puts him behind the
   carousel but underneath the sponsors' own background. So the layer is
   part of the art direction — each beat declares its own `zIndex` and this
   wrapper switches as the dominant beat changes.

   Switching happens at the midpoint between two beats, with a small dead
   zone so parking the scroll exactly on a boundary can't strobe it.
   ════════════════════════════════════════════════════════════ */

// The canvas is WebGL and the model is large — never render it on the server.
const Spider3D = dynamic(() => import("./Spider3D"), { ssr: false });

/** Half-width of the hysteresis band around each beat boundary. */
const SWITCH_DEADZONE = 0.08;

export default function MiguelStage({ start = true }: { start?: boolean }) {
  const [zIndex, setZIndex] = useState(BEATS[0].zIndex);

  /* Hand the portal's reveal state to the frame loop. The canvas mounts
     immediately either way — that's what gets the 6.5 MB model downloaded and
     the shaders compiled while the user is still on the portal — but the
     character holds frame 0 of his look-back until this flips. */
  useEffect(() => {
    scrollState.revealed = start;
  }, [start]);

  useEffect(() => {
    let raf = 0;
    // Tracked separately from React state so the dead-zone comparison reads
    // the beat index we last COMMITTED to, not a stale render value.
    let currentIdx = 0;

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const beats = activeBeats.list;
      if (!beats.length) return;

      const pos = Math.min(Math.max(scrollState.beatPos, 0), beats.length - 1);
      // Only move to a new beat once we're clear of the boundary dead zone.
      const nearest = Math.round(pos);
      if (nearest !== currentIdx && Math.abs(pos - nearest) < 0.5 - SWITCH_DEADZONE) {
        currentIdx = nearest;
        const z = beats[nearest].zIndex;
        setZIndex((prev) => (prev === z ? prev : z));
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <>
      {/* Scroll engine: resolves beat sections and writes scrollState. */}
      <ScrollRig />

      <div
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          zIndex,
          pointerEvents: "none", // never blocks the page beneath it
        }}
      >
        {/* Inner wrapper (NOT the fixed element — a transform on a fixed
            element's ancestor would re-anchor it): ImpactCrack shakes this
            when the punch lands. */}
        <div data-impact-shake style={{ width: "100%", height: "100%" }}>
          <Spider3D />
        </div>
      </div>

      {/* Viewport "glass" that cracks when the punch lands. */}
      <ImpactCrack />
    </>
  );
}
