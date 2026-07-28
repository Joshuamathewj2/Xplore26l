"use client";

import Image from "next/image";
import { labelOn, type EventItem } from "@/data/events";
import spiderMask from "../../images/spider-mask.png";

/* Structural ink. Brutalism needs a high-contrast edge, so paper white and a
   near-black stay fixed while every hue comes from the event's own palette. */
const PAPER = "#F2EFE9";
const INK = "#03071E";

/** Hand-drawn-ish comic speed lines radiating from the top-left corner. */
function SpeedLines({ color }: { color: string }) {
  return (
    <svg
      width="100%"
      height="46%"
      viewBox="0 0 200 120"
      preserveAspectRatio="none"
      className="event-card__speed"
      style={{ position: "absolute", top: 0, left: 0, opacity: 0.5 }}
      aria-hidden="true"
    >
      <g stroke={color} strokeWidth="2.4" strokeLinecap="square" fill="none">
        <line x1="-4" y1="10" x2="52" y2="4" />
        <line x1="-4" y1="26" x2="78" y2="16" />
        <line x1="-4" y1="44" x2="42" y2="36" />
        <line x1="-4" y1="62" x2="96" y2="48" />
        <line x1="-4" y1="82" x2="34" y2="74" />
      </g>
    </svg>
  );
}

export default function EventCard({
  event,
  width,
  height,
  isActive = true,
  onOpenDetails,
}: {
  event: EventItem;
  width: number;
  height: number;
  isActive?: boolean;
  onOpenDetails?: (event: EventItem) => void;
}) {
  const { accent, glow, base, key } = event.palette;
  const { position, mirror } = event.framing;
  // Ink or paper, whichever actually reads on this card's accent.
  const onAccent = labelOn(accent);

  return (
    <div
      className={`event-card${isActive ? " event-card--active" : ""}`}
      style={
        {
          width,
          height,
          position: "relative",
          // Brutalism: no radius, thick rule, solid un-blurred offset.
          borderRadius: 0,
          border: `4px solid ${PAPER}`,
          background: base,
          // The hard shadow is handed to CSS rather than written inline, so
          // the hover rule in globals.css can grow it — an inline box-shadow
          // would outrank the class and the lift would have no shadow to
          // travel with it.
          "--card-accent": accent,
          "--card-paper": PAPER,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        } as React.CSSProperties
      }
    >
      {/* Light raking across the centred card. Purely decorative, and only
          animated while this is the active card — see .event-card--active. */}
      <div className="event-card__glint" aria-hidden="true" />
      {/* ── Panel 1: header strip ── */}
      <div
        style={{
          flexShrink: 0,
          display: "flex",
          alignItems: "stretch",
          borderBottom: `4px solid ${PAPER}`,
          background: accent,
        }}
      >
        <span
          style={{
            flex: 1,
            fontFamily: "var(--font-brutal)",
            // Was 0.74rem/0.2em. Archivo Black at that size with tracking that
            // wide reads as texture rather than words; bigger and tighter is
            // what actually made it legible on the deck.
            fontSize: "0.86rem",
            letterSpacing: "0.13em",
            color: onAccent,
            textTransform: "uppercase",
            padding: "10px 13px",
            alignSelf: "center",
          }}
        >
          {event.subtitle}
        </span>

        {/* Site mark, top-right of every card */}
        <span
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 46,
            flexShrink: 0,
            borderLeft: `4px solid ${PAPER}`,
            background: base,
          }}
        >
          <Image
            src={spiderMask}
            alt=""
            width={26}
            height={26}
            className="event-card__mask"
            style={{ display: "block" }}
          />
        </span>
      </div>

      {/* ── Panel 2: art cell ── */}
      <div
        style={{
          position: "relative",
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
          background: base,
        }}
      >
        {/* Rim light behind the figure, in the character's own key colour —
            this is what stops the art reading as a cutout pasted on a panel. */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background: `radial-gradient(68% 52% at 54% 42%, ${key}44 0%, ${key}18 42%, transparent 72%)`,
          }}
        />

        {/* Ben-Day dot screen */}
        <div
          className="benday-lg event-card__benday"
          style={
            {
              position: "absolute",
              inset: 0,
              "--benday-color": `${accent}4D`,
              pointerEvents: "none",
            } as React.CSSProperties
          }
        />

        <SpeedLines color={`${accent}88`} />

        {/* The drift/push-in lives on this wrapper, not on the <Image>: the
            image already owns its transform for the mirror flip, and the two
            would overwrite each other on the same node. */}
        <div className="event-card__art">
          <Image
            src={event.image}
            alt={event.title}
            fill
            priority={isActive}
            style={{
              objectFit: "cover",
              objectPosition: position,
              transform: mirror ? "scaleX(-1)" : undefined,
              filter: "saturate(1.12) contrast(1.06)",
            }}
            sizes="(max-width: 768px) 340px, 440px"
          />
        </div>

        {/* Edge wash in the card's own base colour. Fading the art out into
            the panel on every side is what makes the two read as one image. */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background: `
              linear-gradient(0deg, ${base} 0%, ${base}D9 16%, transparent 46%),
              linear-gradient(90deg, ${base}CC 0%, transparent 34%),
              linear-gradient(270deg, ${base}AA 0%, transparent 26%)
            `,
          }}
        />

        {/* Title in a hard-edged caption box. The resting -1.4deg tilt now
            lives in the rock keyframes so the two don't fight. */}
        <div
          className="event-card__title"
          style={{
            position: "absolute",
            left: -2,
            bottom: 14,
            maxWidth: "92%",
            background: PAPER,
            border: `3px solid ${INK}`,
            boxShadow: `6px 6px 0 ${accent}`,
            padding: "9px 15px 8px",
          }}
        >
          <h3
            style={{
              margin: 0,
              fontFamily: "var(--font-brutal)",
              fontSize: "1.5rem",
              lineHeight: 1.02,
              letterSpacing: "-0.01em",
              textTransform: "uppercase",
              color: INK,
              textShadow: `3px 3px 0 ${glow}`,
            }}
          >
            {event.title}
          </h3>
        </div>
      </div>

      {/* ── Panel 3: action bar ── */}
      <div
        style={{
          flexShrink: 0,
          display: "flex",
          gap: 10,
          padding: 14,
          borderTop: `4px solid ${PAPER}`,
          background: base,
        }}
      >
        <button
          type="button"
          disabled={!isActive}
          onClick={(e) => {
            e.stopPropagation();
            window.open(event.registerUrl, "_blank", "noopener,noreferrer");
          }}
          className="brutal-btn"
          style={{
            flex: 1,
            padding: "12px 0",
            background: accent,
            color: onAccent,
            border: `3px solid ${PAPER}`,
            fontSize: "0.82rem",
            letterSpacing: "0.06em",
            boxShadow: `5px 5px 0 ${PAPER}`,
          }}
        >
          Register
        </button>
        <button
          type="button"
          disabled={!isActive}
          onClick={(e) => {
            e.stopPropagation();
            onOpenDetails?.(event);
          }}
          className="brutal-btn"
          style={{
            flex: 1,
            padding: "12px 0",
            background: base,
            color: PAPER,
            border: `3px solid ${PAPER}`,
            fontSize: "0.82rem",
            letterSpacing: "0.06em",
            boxShadow: `5px 5px 0 ${accent}`,
          }}
        >
          Description
        </button>
      </div>
    </div>
  );
}
