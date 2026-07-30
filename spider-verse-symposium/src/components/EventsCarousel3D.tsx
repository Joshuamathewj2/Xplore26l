"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import EventCard from "./EventCard";
import type { EventItem } from "@/data/events";

export const CARD_W = 420;
export const CARD_H = 560;

// drei's <Html transform> sizes DOM content in real CSS pixels but positions
// 3D objects in world units, where 1 unit == ZOOM screen pixels. So every
// pixel-space offset below is divided by ZOOM before it hits a position.
const ZOOM = 40;
const GAP_PX = 300;
const Z_STEP_PX = 90;

const STIFFNESS = 3.0;
const MAX_BLUR = 5;
// The centred card sits proudest; neighbours drop back down.
const LIFT_PX = 26;

/* How far past its own border a card paints: the 10px hard shadow plus its
   4px ring, and the same ring bleeding up-left off the top edge. */
const CARD_BLEED = 16;
/* Slack on top of that. A blurred neighbour spreads roughly 3× MAX_BLUR past
   its box, and the deck should never sit flush against the clip edge. */
const STAGE_PAD = 40;

/* The section shrinks the whole stage into its own column with a CSS
   transform. That factor has to live HERE, not only in the section, because
   of a chain that is easy to miss:

     R3F measures its container with getBoundingClientRect() — a TRANSFORMED
     rect — and then sizes the canvas in CSS pixels from it. An ancestor
     `scale()` therefore shrinks the canvas a SECOND time. drei's
     <Html transform> in turn clips the cards to a portal it hard-codes to
     `overflow:hidden` and resizes to that canvas every frame.

   So the clip box is the container times the scale, not the container. At
   the old fixed 660 it came out ~511px tall around a 493px card that lifts
   23px, and the centred card — the only one that lifts — lost ~14px off its
   top edge. Dividing the height back out by the scale is what buys the deck
   real headroom instead of appearing to. */
export const STAGE_SCALE = 0.88;
const DECK_HEIGHT = CARD_H + 2 * (LIFT_PX + CARD_BLEED + STAGE_PAD);
export const STAGE_HEIGHT = Math.round(DECK_HEIGHT / STAGE_SCALE);

/* ── Cursor → scroll sensitivity ──
   The deck advances while the cursor sits off-centre, so these two numbers
   set how eager that is. DEAD_ZONE_PX is the band down the middle where
   nothing moves at all; STEP_PX is how much further you must travel to feed
   the deck one more card. Steady-state speed is roughly
   STIFFNESS × (distance − DEAD_ZONE_PX) / STEP_PX cards per second, and the
   deck first moves at DEAD_ZONE_PX + STEP_PX / 2 — 300px here, against 150px
   before, so a small mouse movement no longer flings the whole ring past.

   300px is also the practical ceiling. The section shifts this stage 17% to
   the right to clear the 3D rig, which puts its centre around x 965 on a
   1440 viewport — only ~475px of cursor travel exists on the right-hand
   side. Push the threshold much past 300 and rightward scrolling becomes
   unreachable before the pointer leaves the window. */
const DEAD_ZONE_PX = 110;
const STEP_PX = 380;

/**
 * Map a raw index delta into the shortest signed distance around a ring of
 * `total` cards, i.e. into [-total/2, total/2). This is what makes the
 * carousel infinite: a card that walks off one side reappears on the other.
 */
function wrapOffset(raw: number, total: number) {
  const half = total / 2;
  return ((((raw + half) % total) + total) % total) - half;
}

/* ══════════════════════════════════════════════
   Card — reads the shared scroll position each
   frame and writes straight to the scene/DOM.
   Style writes are quantised and diffed: naively
   re-assigning a blur() every frame forces the
   compositor to re-rasterise a 420x560 layer 6x
   per frame, which is what made this feel laggy.
   ══════════════════════════════════════════════ */
function Card({
  event,
  index,
  total,
  scrollRef,
  isActive,
  onSelect,
  onOpenDetails,
}: {
  event: EventItem;
  index: number;
  total: number;
  scrollRef: React.RefObject<number>;
  isActive: boolean;
  onSelect: () => void;
  onOpenDetails: (event: EventItem) => void;
}) {
  const groupRef = useRef<THREE.Group>(null!);
  const wrapRef = useRef<HTMLDivElement>(null);

  const prevOpacity = useRef(-1);
  const prevBlur = useRef(-1);
  const prevZ = useRef(-1);
  const prevHit = useRef<string>("");

  useFrame(() => {
    const w = wrapOffset(index - scrollRef.current, total);
    const a = Math.abs(w);

    if (groupRef.current) {
      // Lift falls off over the first slot, so only the centred card rides high.
      const lift = (1 - Math.min(a, 1)) * LIFT_PX;
      groupRef.current.position.set(
        (w * GAP_PX) / ZOOM,
        lift / ZOOM,
        (-a * Z_STEP_PX) / ZOOM
      );
      // Neighbours rotate inward so their inner edge faces the centre card.
      groupRef.current.rotation.y =
        -Math.sign(w) * THREE.MathUtils.degToRad(Math.min(a, 2.5) * 27);
    }

    const el = wrapRef.current;
    if (!el) return;

    // Fade right out before the wrap point so the jump is never visible.
    const edge = 1 - THREE.MathUtils.smoothstep(a, 2.1, 2.85);
    const opacity = Math.max(0, edge * (1 - Math.min(a, 2) * 0.2));
    const blur = Math.min(a * 2.2, MAX_BLUR);

    // Quantise so the expensive properties only change when it's visible.
    const opacityQ = Math.round(opacity * 50) / 50; // 0.02 steps
    const blurQ = Math.round(blur * 4) / 4; // 0.25px steps
    const zQ = Math.max(0, Math.round(200 - a * 40));
    const hit = a < 0.5 ? "auto" : "none";

    if (opacityQ !== prevOpacity.current) {
      el.style.opacity = String(opacityQ);
      prevOpacity.current = opacityQ;
    }
    if (blurQ !== prevBlur.current) {
      el.style.filter = blurQ > 0.1 ? `blur(${blurQ}px)` : "none";
      prevBlur.current = blurQ;
    }
    if (hit !== prevHit.current) {
      el.style.pointerEvents = hit;
      // drei wraps our node in its own positioned div which keeps
      // `pointer-events: auto`. Left alone, an off-centre card's wrapper sits
      // over the centre card and swallows its button clicks — z-index alone
      // doesn't save us, since that wrapper is not the node we restyle below.
      const host = el.parentElement;
      if (host) host.style.pointerEvents = hit;
      prevHit.current = hit;
    }
    if (zQ !== prevZ.current) {
      // Centre card must paint on top of its neighbours.
      const host = el.parentElement;
      if (host) host.style.zIndex = String(zQ);
      prevZ.current = zQ;
    }
  });

  return (
    <group ref={groupRef}>
      <Html transform occlude={false} style={{ pointerEvents: "none" }}>
        <div
          ref={wrapRef}
          onClick={() => {
            if (!isActive) onSelect();
          }}
          style={{ width: CARD_W, willChange: "opacity, filter" }}
        >
          <EventCard
            event={event}
            width={CARD_W}
            height={CARD_H}
            isActive={isActive}
            onOpenDetails={onOpenDetails}
          />
        </div>
      </Html>
    </group>
  );
}

/* ══════════════════════════════════════════════
   Rig — owns the scroll position and eases it
   toward whichever card the cursor last picked.
   ══════════════════════════════════════════════ */
function Rig({
  total,
  pendingRef,
  desiredRef,
  scrollRef,
  onActiveChange,
}: {
  total: number;
  pendingRef: React.RefObject<number | null>;
  desiredRef: React.RefObject<number>;
  scrollRef: React.RefObject<number>;
  onActiveChange: (i: number) => void;
}) {
  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05); // clamp after tab-out stalls

    // Resolve at most one pointer sample per frame. Picking the target from
    // the *current* scroll means sweeping the cursor keeps feeding the next
    // card in — that's what makes it scroll continuously and infinitely —
    // while a stationary cursor stops feeding and it settles.
    const px = pendingRef.current;
    if (px !== null) {
      // Distance beyond the dead zone, in whole cards. Cursor parked near the
      // centre yields 0, so the deck holds still instead of creeping.
      const reach = Math.max(0, Math.abs(px) - DEAD_ZONE_PX);
      const step = Math.round((Math.sign(px) * reach) / STEP_PX);
      if (step !== 0) desiredRef.current = Math.round(scrollRef.current) + step;
      pendingRef.current = null;
    }

    const target = desiredRef.current;
    const k = 1 - Math.exp(-STIFFNESS * delta);
    scrollRef.current += (target - scrollRef.current) * k;
    if (Math.abs(target - scrollRef.current) < 0.0005) {
      scrollRef.current = target;
    }

    const idx = ((Math.round(scrollRef.current) % total) + total) % total;
    onActiveChange(idx);
  });

  return null;
}

/* ══════════════════════════════════════════════
   EventsCarousel3D — main export
   ══════════════════════════════════════════════ */
export default function EventsCarousel3D({
  events,
  activeIndex,
  goTo,
  onOpenDetails,
  frozen = false,
}: {
  events: EventItem[];
  activeIndex: number;
  goTo: (i: number) => void;
  onOpenDetails: (event: EventItem) => void;
  /** While the details dialog is open the carousel stops tracking the
   *  cursor, so moving toward the dialog never drags the deck. */
  frozen?: boolean;
}) {
  const total = events.length;
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef(0);
  const desiredRef = useRef(0);
  const pendingRef = useRef<number | null>(null);
  const activeRef = useRef(0);

  /* Drives the Canvas frameloop below. State rather than a ref because the
     Canvas prop has to re-render to change — and it flips at most twice per
     visit, not per frame, so the render is free.

     rootMargin gives it a screen of lead-in either side: the loop is already
     running by the time the carousel is looked at, and it does not stop the
     instant the top edge leaves. */
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const io = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { rootMargin: "100% 0px" }
    );

    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Read inside the pointer handler without re-creating the callback.
  const frozenRef = useRef(frozen);
  useEffect(() => {
    frozenRef.current = frozen;
    if (frozen) pendingRef.current = null; // drop any queued sample
  }, [frozen]);

  // Only push a React update when the centred card actually changes.
  const handleActiveChange = useCallback(
    (i: number) => {
      if (i !== activeRef.current) {
        activeRef.current = i;
        goTo(i);
      }
    },
    [goTo]
  );

  // External navigation (dots / arrows / keyboard) — travel the short way
  // round the ring rather than unwinding through the middle.
  useEffect(() => {
    if (activeIndex === activeRef.current) return;
    activeRef.current = activeIndex;
    const base = Math.round(scrollRef.current);
    const currentIdx = ((base % total) + total) % total;
    desiredRef.current = base + wrapOffset(activeIndex - currentIdx, total);
  }, [activeIndex, total]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (frozenRef.current) return;
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    pendingRef.current = e.clientX - rect.left - rect.width / 2;
  }, []);

  return (
    <div
      ref={containerRef}
      onPointerMove={handlePointerMove}
      style={{
        width: "100%",
        height: STAGE_HEIGHT,
        position: "relative",
      }}
    >
      {/* frameloop is gated on visibility. This is the page's SECOND WebGL
          context — the hero's character canvas is the first — and it used to
          render continuously whether or not it was on screen, including while
          the hero was doing its scroll transition directly above it. Two live
          render loops competing for one GPU is a cost paid on every frame of
          an animation the user is actually watching.

          "never" rather than "demand": demand still renders on state change,
          and this scene animates from a ref inside useFrame, so it would keep
          drawing. */}
      <Canvas
        orthographic
        frameloop={inView ? "always" : "never"}
        camera={{ position: [0, 0, 500], zoom: ZOOM, near: 0.1, far: 2000 }}
        gl={{ alpha: true, antialias: true }}
        // Capped for the same reason Spider3D caps its own canvas (see the
        // PERF note there): this page runs TWO WebGL contexts continuously
        // for as long as it's open, and an uncapped dpr here was rendering
        // at full device pixel ratio (2-3x on most laptops/phones) — 4-9x
        // the pixels to shade per frame — on top of the persistent 3D rig
        // already running. That's a standing cost for the whole session,
        // not just while this section is on screen.
        dpr={[1, 1.5]}
        style={{ background: "transparent" }}
      >
        <Rig
          total={total}
          pendingRef={pendingRef}
          desiredRef={desiredRef}
          scrollRef={scrollRef}
          onActiveChange={handleActiveChange}
        />
        {events.map((event, i) => (
          <Card
            key={event.title}
            event={event}
            index={i}
            total={total}
            scrollRef={scrollRef}
            isActive={i === activeIndex}
            onSelect={() => goTo(i)}
            onOpenDetails={onOpenDetails}
          />
        ))}
      </Canvas>
    </div>
  );
}
