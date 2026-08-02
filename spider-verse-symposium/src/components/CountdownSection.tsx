"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import ComicStamp from "./ComicStamp";
import CountdownSpiders from "./CountdownSpiders";
import { CAMPUS_LOCALITY } from "@/data/events";

/* ══════════════════════════════════════════════════════════════════
   COUNTDOWN TO XPLORE'26

   Four comic panels in the events section's brutalist language — hard
   4px borders, offset shadows, alternating tilt — with the procedural
   spiders crawling over them.

   THE TARGET IS PINNED TO IST, deliberately. `new Date(2026, 7, 8, 8)`
   would mean 8am *wherever the visitor's device happens to be set*, so
   a phone left on another timezone would count down to the wrong
   moment. The offset in the string makes it one fixed instant for
   everyone. Change the literal below and nothing else moves.
   ══════════════════════════════════════════════════════════════════ */
const TARGET = Date.parse("2026-08-08T08:00:00+05:30");

const DAY = 86400;

/* Alternating lean — no two neighbouring panels tilt the same way, which
   is what stops four boxes in a row reading as a table. */
const TILT = [-2, 1.5, -1, 2];

const UNITS = ["DAYS", "HOURS", "MINS", "SECS"] as const;

const pad = (n: number) => String(n).padStart(2, "0");

export default function CountdownSection() {
  /* null until the first client tick. This page is a static export, so the
     markup is generated at build time — deriving digits from Date.now()
     during render would bake in the build machine's clock and then trip a
     hydration mismatch when the browser disagreed. Placeholders render on
     both sides; the real numbers arrive on mount. */
  const [left, setLeft] = useState<number | null>(null);
  const secondsPanelRef = useRef<HTMLDivElement>(null);
  const reducedRef = useRef(false);

  useEffect(() => {
    reducedRef.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    /* Recomputed from the wall clock every tick rather than decremented.
       A decrementing counter drifts: background tabs throttle timers to
       once a minute or stop them outright, and the error never comes back.
       Polling faster than 1s keeps the flip close to the real second
       boundary without having to align to it; React bails out of the
       re-render when the value hasn't changed. */
    const tick = () => {
      const secs = Math.max(0, Math.floor((TARGET - Date.now()) / 1000));
      setLeft((prev) => (prev === secs ? prev : secs));
    };
    tick();
    const id = window.setInterval(tick, 250);

    /* A tab restored after hours away shouldn't show a stale time for up
       to a quarter second — repaint the moment it's looked at again. */
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const live = left !== null && left <= 0;
  /* Inside the last day the strip turns fuchsia — the one moment the
     countdown is allowed to shout. */
  const urgent = left !== null && left > 0 && left <= DAY;
  const accent = urgent ? "var(--hot-fuchsia)" : "var(--main-red)";

  const values =
    left === null
      ? ["--", "--", "--", "--"]
      : [
          pad(Math.floor(left / DAY)),
          pad(Math.floor(left / 3600) % 24),
          pad(Math.floor(left / 60) % 60),
          pad(left % 60),
        ];

  /* Punch the seconds panel on every flip. Driven straight through the WAAPI
     rather than a CSS class toggle so there's no re-render and no animation
     to restart — each call is its own one-shot. */
  useEffect(() => {
    const el = secondsPanelRef.current;
    if (!el || left === null || left <= 0 || reducedRef.current) return;
    const base = `rotate(${TILT[3]}deg)`;
    el.animate(
      [
        { transform: `${base} scale(1)` },
        { transform: `${base} scale(1.075)`, offset: 0.3 },
        { transform: `${base} scale(1)` },
      ],
      { duration: 280, easing: "cubic-bezier(0.2, 0.9, 0.3, 1)" }
    );
  }, [left]);

  const readable =
    left === null
      ? "Countdown loading."
      : live
        ? "XPLORE'26 is live now."
        : `${Math.floor(left / DAY)} days, ${Math.floor(left / 3600) % 24} hours and ${
            Math.floor(left / 60) % 60
          } minutes until XPLORE'26 begins.`;

  return (
    <section
      id="countdown"
      className="relative z-10"
      style={{
        background: "var(--ink-black)",
        padding: "clamp(56px, 8vw, 96px) 16px clamp(64px, 9vw, 104px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        overflow: "hidden",
      }}
    >
      <div className="absolute inset-0 halftone-bg pointer-events-none" />

      {/* The spiders live here, above the panels, so they crawl ON the timer
          rather than behind it. They find the panels by `data-spider-surface`
          within this section. */}
      <CountdownSpiders />

      {/* Wrapped only so the stamp can be dropped on phones — it's a static
          box, so the stamp still positions against the section. At 390px
          there is no clear margin left of the heading for it to sit in. */}
      <div className="cd-stamp">
        <ComicStamp
          text={live ? "THWIP!" : "TICK TICK!"}
          rotate={-7}
          bg={accent}
          style={{ top: "9%", left: "6%", zIndex: 5 }}
        />
      </div>

      <div
        style={{
          position: "relative",
          zIndex: 2,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          width: "100%",
        }}
      >
        <h2
          style={{
            margin: 0,
            fontFamily: "var(--font-brutal)",
            fontSize: "clamp(1.5rem, 4.2vw, 2.6rem)",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--paper-white)",
            textAlign: "center",
            textShadow: `4px 4px 0 ${accent}`,
          }}
        >
          {live ? "It's On" : "T-Minus"}
        </h2>

        <p
          style={{
            marginTop: 14,
            marginBottom: "clamp(30px, 4.5vw, 48px)",
            fontFamily: "var(--font-mono)",
            fontSize: "0.72rem",
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "var(--paper-white)",
            opacity: 0.5,
            textAlign: "center",
          }}
        >
          {live
            ? "The multiverse is open — get to campus"
            : "Sat 08 Aug 2026 · 08:00 AM IST"}
        </p>

        {/* Screen readers get one sentence instead of four ticking boxes.
            No aria-live: a value that changes every second would talk over
            everything else on the page. */}
        <p className="sr-only">{readable}</p>

        {live ? (
          <div
            data-spider-surface
            style={{
              padding: "clamp(20px, 4vw, 34px) clamp(28px, 6vw, 56px)",
              background: "var(--velvet-black)",
              border: "4px solid var(--paper-white)",
              boxShadow: `10px 10px 0 ${accent}`,
              transform: "rotate(-1.5deg)",
              fontFamily: "var(--font-brutal)",
              fontSize: "clamp(1.6rem, 6vw, 3.4rem)",
              letterSpacing: "0.04em",
              color: "var(--paper-white)",
              textTransform: "uppercase",
              textAlign: "center",
            }}
          >
            XPLORE&apos;26 is live
          </div>
        ) : (
          <div aria-hidden="true" className="cd-strip">
            {UNITS.map((unit, i) => (
              /* Fragment, not a wrapper element: the panels and the dashes
                 have to be siblings in the SAME grid, or the 2x2 phone
                 layout has nothing to lay out. */
              <Fragment key={unit}>
                {i > 0 && <span className="cd-sep">-</span>}
                <div
                  ref={i === 3 ? secondsPanelRef : undefined}
                  data-spider-surface
                  className="cd-panel"
                  style={{
                    transform: `rotate(${TILT[i]}deg)`,
                    boxShadow: `10px 10px 0 ${accent}`,
                  }}
                >
                  <span className="cd-num">{values[i]}</span>
                  <span className="cd-label" style={{ background: accent }}>
                    {unit}
                  </span>
                </div>
              </Fragment>
            ))}
          </div>
        )}

        {/* ── VENUE PLATE ──
            Same brutalist construction as the panels above it — hard border,
            offset shadow — so the address reads as part of the countdown
            rather than a caption under it. The campus line comes from the
            shared CAMPUS_ADDRESS constant that every event's venue block
            already uses, minus the college name it repeats. */}
        <div className="cd-venue" style={{ boxShadow: `8px 8px 0 ${accent}` }}>
          <span className="cd-venue-pin" aria-hidden="true">
            📍
          </span>
          <span className="cd-venue-text">
            <span className="cd-venue-name">
              {urgent ? "Final day · " : ""}LICET : Loyola-ICAM College of
              Engineering and Technology
            </span>
            <span className="cd-venue-addr">{CAMPUS_LOCALITY}</span>
          </span>
        </div>
      </div>

      <style>{`
        /* A GRID, not a wrapping flex row. Left to wrap, four panels on a
           390px screen break 3+1 — a lone SECS panel stranded on its own
           line. A grid can be told to go 2x2 instead, which is the only
           arrangement of four boxes that stays balanced at that width. */
        .cd-strip {
          display: grid;
          grid-template-columns: repeat(7, min-content);
          justify-content: center;
          align-items: center;
          /* The hard shadows sit outside the border box, so the gap has to
             clear them or each panel's drop lands on its neighbour. */
          gap: clamp(10px, 1.8vw, 22px);
        }
        .cd-sep {
          font-family: var(--font-brutal);
          font-size: clamp(1.1rem, 3vw, 2.1rem);
          line-height: 1;
          color: var(--paper-white);
          opacity: 0.45;
          /* Nudged up off the panel's vertical middle onto the DIGITS' line —
             the caption bar at the foot of each panel drags the box centre
             below where the numbers actually sit. */
          transform: translateY(-0.35em);
        }
        .cd-panel {
          display: flex;
          flex-direction: column;
          align-items: stretch;
          width: clamp(72px, 20vw, 148px);
          background: var(--velvet-black);
          border: var(--brutal-border) solid var(--paper-white);
          /* Clips the caption bar to the panel's inner edge, so the bar ends
             flush against the border instead of poking under it. */
          overflow: hidden;
          /* transform + box-shadow come from the call site: both depend on
             which panel this is and how close the event is. */
        }
        .cd-num {
          padding: clamp(11px, 2.3vw, 20px) 4px clamp(8px, 1.6vw, 14px);
          text-align: center;
          font-family: var(--font-brutal);
          font-size: clamp(1.9rem, 7.5vw, 4.2rem);
          line-height: 0.92;
          color: var(--paper-white);
          font-variant-numeric: tabular-nums;
          /* Without this the digits are proportional and the panel jitters
             as 1s and 8s swap in. */
          font-feature-settings: "tnum" 1;
        }
        /* A solid caption bar rather than coloured text: the accent reds are
           dark enough that as type on velvet black they turn to mud, while
           as a fill behind paper-white they carry the whole panel. */
        .cd-label {
          display: block;
          padding: 5px 2px 4px;
          text-align: center;
          font-family: var(--font-comic);
          font-size: clamp(0.62rem, 1.7vw, 0.9rem);
          letter-spacing: 0.16em;
          line-height: 1;
          color: var(--paper-white);
        }

        .cd-venue {
          display: flex;
          /* Top-aligned, not centred: the name wraps to two or three lines on
             a phone and a vertically-centred pin then floats beside the
             middle of the block instead of marking its first line. */
          align-items: flex-start;
          gap: clamp(10px, 1.6vw, 16px);
          margin-top: clamp(34px, 5vw, 52px);
          max-width: min(92vw, 620px);
          padding: clamp(11px, 1.8vw, 16px) clamp(14px, 2.4vw, 24px);
          background: var(--velvet-black);
          border: 3px solid var(--paper-white);
          text-align: left;
        }
        .cd-venue-pin {
          font-size: clamp(1.1rem, 2.4vw, 1.5rem);
          line-height: 1;
          flex-shrink: 0;
        }
        .cd-venue-text {
          display: flex;
          flex-direction: column;
          gap: 5px;
          min-width: 0;
        }
        .cd-venue-name {
          font-family: var(--font-display);
          font-size: clamp(0.72rem, 1.7vw, 0.95rem);
          letter-spacing: 0.1em;
          line-height: 1.35;
          text-transform: uppercase;
          color: var(--paper-white);
        }
        .cd-venue-addr {
          font-family: var(--font-mono);
          font-size: clamp(0.58rem, 1.3vw, 0.7rem);
          letter-spacing: 0.12em;
          line-height: 1.5;
          text-transform: uppercase;
          color: var(--paper-white);
          opacity: 0.5;
        }

        @media (max-width: 560px) {
          .cd-strip {
            grid-template-columns: repeat(3, min-content);
            gap: 22px 14px;
          }
          /* The HOURS–MINS dash is the one that would fall between the two
             ROWS of the 2x2, where a dash means nothing. Removing it from
             the flow entirely (not just hiding it) is also what lets the
             remaining six items land 3-and-3. */
          .cd-sep:nth-of-type(2) {
            display: none;
          }
          /* Two columns leave room for real panels — at the desktop width
             they'd be four postage stamps in the middle of an empty screen. */
          .cd-panel {
            width: min(38vw, 150px);
          }
          .cd-num {
            font-size: 2.9rem;
          }
        }
        @media (max-width: 640px) {
          .cd-stamp {
            display: none;
          }
        }
      `}</style>
    </section>
  );
}
