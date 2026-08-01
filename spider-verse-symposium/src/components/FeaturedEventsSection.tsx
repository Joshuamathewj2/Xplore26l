"use client";

import {
  useRef,
  useState,
  useEffect,
  useCallback,
  useSyncExternalStore,
} from "react";
import Image from "next/image";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import eventsHeading from "../../images/events-heading.webp";
import { EVENTS, WORKSHOPS, type EventItem } from "@/data/events";
import EventCard from "./EventCard";
import EventsHeadingSpider from "./EventsHeadingSpider";
import EventDetailsModal from "./EventDetailsModal";
import EventsCarousel3D, { STAGE_HEIGHT, STAGE_SCALE } from "./EventsCarousel3D";

gsap.registerPlugin(ScrollTrigger);

// The carousel touches WebGL, which only exists in the browser. This is
// the standard "has the client mounted" pattern via useSyncExternalStore:
// the server snapshot (and first client render, to match hydration) is
// always false, then React re-renders with the real client snapshot —
// no manual setState-in-effect required.
const subscribeNoop = () => () => {};
function useHasMounted() {
  return useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false
  );
}

/* ══════════════════════════════════════════════
   FeaturedEventsSection — Main export
   ══════════════════════════════════════════════ */
export default function FeaturedEventsSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLDivElement>(null);
  const subRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [detailsFor, setDetailsFor] = useState<EventItem | null>(null);
  /* Which deck the section is showing. The workshop is a separate tab rather
     than a seventh card because it is a different KIND of thing — and with
     one entry it would look broken inside a carousel built to rotate six. */
  const [tab, setTab] = useState<"events" | "workshop">("events");
  const mounted = useHasMounted();

  const openDetails = useCallback((e: EventItem) => setDetailsFor(e), []);
  const closeDetails = useCallback(() => setDetailsFor(null), []);

  /* ── Responsive detection ── */
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  /* ── Scroll-triggered entrance animation ── */
  useEffect(() => {
    const heading = headingRef.current;
    const sub = subRef.current;
    const stage = stageRef.current;
    if (heading) gsap.set(heading, { opacity: 0, y: 36 });
    if (sub) gsap.set(sub, { opacity: 0, y: 16 });
    if (stage) gsap.set(stage, { opacity: 0, y: 48 });

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: sectionRef.current,
        start: "top 80%",
        toggleActions: "play none none reverse",
      },
    });

    if (heading)
      tl.to(heading, {
        opacity: 1,
        y: 0,
        duration: 0.75,
        ease: "power3.out",
      });
    if (sub)
      tl.to(
        sub,
        { opacity: 1, y: 0, duration: 0.55, ease: "power3.out" },
        "-=0.45"
      );
    if (stage)
      tl.to(
        stage,
        { opacity: 1, y: 0, duration: 0.85, ease: "power3.out" },
        "-=0.25"
      );

    return () => {
      tl.kill();
    };
  }, []);

  /* ── Navigation ── */
  // Wraps rather than clamps — the carousel itself is a ring, so the arrows
  // should carry straight past either end instead of dead-ending.
  const goTo = useCallback((i: number) => {
    const n = EVENTS.length;
    setActiveIndex(((i % n) + n) % n);
  }, []);

  /* ── Keyboard navigation ──
     The handler reads its inputs from a ref that is refreshed every render,
     so the listener itself is bound ONCE with an empty dependency array.

     It used to depend on [activeIndex, goTo, detailsFor, tab], which meant
     tearing down and re-adding a window listener on every single arrow press
     — the deck's own state is in that list. It also made the dependency
     array something that grows whenever this handler learns about another
     piece of state, and React throws a hard error if a hook's dependency
     array changes SIZE between renders, which is exactly what Fast Refresh
     hits mid-edit. A fixed, empty array cannot have either problem. */
  const navState = useRef({ activeIndex, detailsFor, tab, goTo });
  // No dependency array: refresh the snapshot after every render, so the
  // listener below always sees current values without re-subscribing.
  useEffect(() => {
    navState.current = { activeIndex, detailsFor, tab, goTo };
  });

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      // Don't drive the deck while the details dialog owns the keyboard,
      // or while the workshop tab is showing — there is no deck to drive.
      const nav = navState.current;
      if (nav.detailsFor || nav.tab !== "events") return;
      if (e.key === "ArrowRight") nav.goTo(nav.activeIndex + 1);
      if (e.key === "ArrowLeft") nav.goTo(nav.activeIndex - 1);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  return (
    <section
      ref={sectionRef}
      id="events"
      style={{
        position: "relative",
        width: "100%",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        padding: "84px 0 76px",
        background: "#03071E",
        borderTop: "5px solid #F2EFE9",
        borderBottom: "5px solid #F2EFE9",
        overflow: "clip",
      }}
    >
      {/* Live backdrop — crawling Ben-Day screen, speed lines, ink sweep and
          rising shards. Styles live in globals.css under "Live events
          backdrop"; it is purely decorative and self-clipping, so it sits
          below everything else in the stacking order. */}
      <div className="events-bg" aria-hidden="true">
        <div className="events-bg__dots" />
        <div className="events-bg__speed" />
        <div className="events-bg__sweep" />
        <div className="events-bg__shards">
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
      </div>

      {/* Hard diagonal colour blocks — brutalist framing, no gradients */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          top: -70,
          left: -90,
          width: 320,
          height: 150,
          background: "#E20B17",
          transform: "rotate(-8deg)",
          pointerEvents: "none",
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          bottom: -70,
          right: -90,
          width: 320,
          height: 150,
          background: "#FF1973",
          transform: "rotate(-8deg)",
          pointerEvents: "none",
        }}
      />

      {/* ── Section Heading ── */}
      <div
        style={{
          position: "relative",
          zIndex: 10,
          textAlign: "center",
          marginBottom: 40,
          padding: "0 20px",
        }}
      >
        {/* Heading artwork sits in a hard-edged comic panel. The <h2> is kept
            so assistive tech still announces a heading named "Events".

            Two nested elements on purpose: GSAP owns the OUTER div's
            transform for the scroll entrance, while the idle sway/print
            loops in globals.css own the inner ones. Sharing a node would
            have the timeline and the keyframes overwrite each other. */}
        <div ref={headingRef} style={{ willChange: "transform, opacity" }}>
          <h2
            className="events-heading"
            style={{
              position: "relative",
              margin: "0 auto",
              width: "clamp(260px, 46vw, 620px)",
              lineHeight: 0,
              background: "#F2EFE9",
              border: "5px solid #F2EFE9",
              padding: "10px 18px",
              overflow: "hidden",
            }}
          >
            <Image
              src={eventsHeading}
              alt="Events"
              priority
              className="events-heading__art"
              style={{ width: "100%", height: "auto" }}
              sizes="(max-width: 768px) 80vw, 620px"
            />
            <span className="events-heading__glint" aria-hidden="true" />
            <EventsHeadingSpider />
          </h2>
        </div>
        <div ref={subRef} style={{ willChange: "transform, opacity" }}>
          <p
            className="events-sub"
            style={{
              display: "inline-block",
              fontFamily: "var(--font-mono)",
              fontWeight: 700,
              fontSize: "0.72rem",
              color: "#F2EFE9",
              background: "#FF1973",
              border: "3px solid #F2EFE9",
              boxShadow: "5px 5px 0 #03071E",
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              padding: "6px 14px",
              marginTop: 26,
            }}
          >
            Six dimensions of innovation
          </p>
        </div>
      </div>

      {/* ── EVENTS / WORKSHOP switch ──
          A segmented toggle, built in the section's own brutalist language
          (hard edges, 5px paper border, offset ink shadow, mono caps) rather
          than the soft rounded pill of the reference — a rounded control is
          the one thing on this page with no straight edges.

          Sits at z10 like the heading and the deck, and is NOT inside the
          right-column transform below: the switch belongs to the section, so
          it stays centred on the section while the deck is shifted into its
          own column beside the rig. */}
      <div
        role="tablist"
        aria-label="Events or workshop"
        style={{
          position: "relative",
          zIndex: 10,
          display: "flex",
          gap: 0,
          marginBottom: 34,
          border: "5px solid #F2EFE9",
          boxShadow: "7px 7px 0 #03071E",
          background: "#03071E",
        }}
      >
        {(
          [
            ["events", "Events", EVENTS.length],
            ["workshop", "Workshop", WORKSHOPS.length],
          ] as const
        ).map(([key, label, count]) => {
          const active = tab === key;
          return (
            <button
              key={key}
              role="tab"
              aria-selected={active}
              onClick={() => setTab(key)}
              style={{
                fontFamily: "var(--font-mono)",
                fontWeight: 700,
                fontSize: "0.82rem",
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                padding: isMobile ? "10px 18px" : "12px 30px",
                border: 0,
                borderRadius: 0,
                cursor: "pointer",
                // Steps, not a smooth ease — everything else in this section
                // animates on a comic-panel cadence.
                transition: "background 0.12s steps(2, end), color 0.12s steps(2, end)",
                background: active ? "#F2EFE9" : "transparent",
                color: active ? "#03071E" : "#F2EFE9",
              }}
            >
              {label}
              <span style={{ opacity: 0.55, marginLeft: 8, fontSize: "0.7em" }}>
                {String(count).padStart(2, "0")}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── 3D Carousel Stage ──
          Shifted + scaled into the RIGHT column so the Miguel rig (rendered
          in the persistent canvas behind this section, at z5) owns the left.

          The 17% shift puts the centred card at ~67% across the viewport,
          which is the middle of the space left over once the rig's column is
          taken out — i.e. the deck is centred in ITS OWN column, not in the
          section. Kept in sync with `char.x` on the "events" beat in
          beats.ts: move one and the pairing breaks.

          STAGE_SCALE (0.88, was 0.75) — bigger cards. This is the ceiling
          before the outer neighbour card's edge starts clipping on a 16:10
          laptop; those neighbours are blurred and faded by then, but past
          ~0.9 the centre card itself begins to crowd the rig.

          The scale is imported rather than written here because the carousel
          has to divide it back out of STAGE_HEIGHT — R3F sizes its canvas
          from a transformed bounding rect, so this transform shrinks the box
          drei clips the cards to. See the note beside STAGE_SCALE.

          This OUTER wrapper carries the layout transform; the inner stageRef
          div is left exactly as it was, because the entrance timeline above
          writes its own transform there via gsap.set/gsap.to and would
          clobber anything we put on the same element.

          Desktop only — below 768px the carousel is replaced by the vertical
          card list and the rig is centred, so no shift applies. ── */}
      <div
        style={{
          width: "100%",
          position: "relative",
          zIndex: 10,
          transform: isMobile
            ? undefined
            : `translateX(17%) scale(${STAGE_SCALE})`,
          transformOrigin: "center center",
        }}
      >
      <div
        ref={stageRef}
        style={{
          width: "100%",
          position: "relative",
        }}
      >
        {!mounted ? (
          <div style={{ height: STAGE_HEIGHT }} />
        ) : tab === "workshop" ? (
          /* One card, centred in the same column the deck occupies — so it
             lands beside the rig exactly where the carousel does. minHeight
             is STAGE_HEIGHT so switching tabs doesn't resize the section and
             jog the page (and, more importantly, doesn't move the scroll
             anchors the 3D beats are measured against). */
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              minHeight: STAGE_HEIGHT,
            }}
          >
            {WORKSHOPS.map((workshop) => (
              <EventCard
                key={workshop.title}
                event={workshop}
                width={isMobile ? 340 : 400}
                height={isMobile ? 430 : 500}
                isActive
                onOpenDetails={openDetails}
              />
            ))}
          </div>
        ) : !isMobile ? (
          <EventsCarousel3D
            events={EVENTS}
            activeIndex={activeIndex}
            goTo={goTo}
            onOpenDetails={openDetails}
            frozen={detailsFor !== null}
          />
        ) : (
          /* Mobile vertical fallback */
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 18,
              padding: "0 20px",
              alignItems: "center",
            }}
          >
            {EVENTS.map((event) => (
              <EventCard
                key={event.title}
                event={event}
                width={340}
                height={430}
                isActive
                onOpenDetails={openDetails}
              />
            ))}
          </div>
        )}
      </div>
      </div>

      {/* ── Navigation Controls ──
          Shifted to match the stage above so the arrows and tick indicators
          stay centred under the carousel's new right-column position. Uses
          vw, NOT %, because this is a narrow centred flex item — a
          percentage would resolve against its own ~300px width instead of
          the section's. Not scaled: the buttons keep their full hit area. ── */}
      {/* Events only — there is nothing to page through on the workshop tab. */}
      {!isMobile && tab === "events" && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
            marginTop: -10,
            zIndex: 10,
            transform: "translateX(17vw)",
          }}
        >
          <button
            onClick={() => goTo(activeIndex - 1)}
            aria-label="Previous event"
            className="brutal-nav"
          >
            &#8592;
          </button>

          {/* Square tick indicators */}
          <div style={{ display: "flex", gap: 7 }}>
            {EVENTS.map((event, i) => (
              <button
                key={event.title}
                onClick={() => goTo(i)}
                aria-label={`Go to ${event.title}`}
                aria-current={activeIndex === i}
                style={{
                  width: activeIndex === i ? 34 : 14,
                  height: 14,
                  borderRadius: 0,
                  border: "3px solid #F2EFE9",
                  background:
                    activeIndex === i ? event.palette.accent : "transparent",
                  transition: "width 0.15s steps(3, end)",
                  cursor: "pointer",
                  padding: 0,
                }}
              />
            ))}
          </div>

          <button
            onClick={() => goTo(activeIndex + 1)}
            aria-label="Next event"
            className="brutal-nav"
          >
            &#8594;
          </button>
        </div>
      )}


      <EventDetailsModal event={detailsFor} onClose={closeDetails} />
    </section>
  );
}
