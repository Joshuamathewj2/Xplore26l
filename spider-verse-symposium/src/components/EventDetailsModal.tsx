"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { getEventDetails, type EventItem } from "@/data/events";
import SpiderTracerIcon from "./SpiderTracerIcon";

const PAPER = "#F2EFE9";

export default function EventDetailsModal({
  event,
  onClose,
}: {
  event: EventItem | null;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Escape to dismiss, and lock the page behind the dialog.
  useEffect(() => {
    if (!event) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    // Capture phase so the carousel's arrow-key handler doesn't also fire.
    window.addEventListener("keydown", onKey, true);

    // Lock BOTH elements: this page scrolls on <html>, so locking only
    // <body> left the section behind the dialog free to scroll.
    const html = document.documentElement;
    const prevHtml = html.style.overflow;
    const prevBody = document.body.style.overflow;
    html.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    return () => {
      window.removeEventListener("keydown", onKey, true);
      html.style.overflow = prevHtml;
      document.body.style.overflow = prevBody;
    };
  }, [event, onClose]);

  if (!event || typeof document === "undefined") return null;

  const poster = event.brochure ?? event.image;
  const details = getEventDetails(event.title);
  /* The dialog wears the same palette as the card it was opened from. */
  const RED = event.palette.accent;
  const FUCHSIA = event.palette.glow;
  const VELVET = event.palette.base;

  // Portalled to <body> so no ancestor stacking or `overflow: clip` context
  // (the events section has one) can clip or re-order the dialog.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${event.title} — event details`}
      onClick={(e) => {
        if (!panelRef.current?.contains(e.target as Node)) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "rgba(3,7,30,0.86)",
        // Stop wheel/touch momentum escaping the dialog to the page beneath.
        overscrollBehavior: "contain",
        touchAction: "none",
      }}
    >
      <div
        ref={panelRef}
        className="event-modal__panel"
        style={{
          position: "relative",
          width: "min(1040px, 100%)",
          maxHeight: "min(88vh, 760px)",
          display: "flex",
          background: VELVET,
          border: `5px solid ${VELVET}`,
          boxShadow: `14px 14px 0 ${VELVET}, 14px 14px 0 5px ${VELVET}`,
          overflow: "hidden",
        }}
      >
        {/* ── Left: brochure + register ── */}
        <div
          className="event-modal__poster-col"
          style={{
            width: "40%",
            minWidth: 280,
            flexShrink: 0,
            borderRight: `5px solid ${VELVET}`,
            display: "flex",
            flexDirection: "column",
            background: VELVET,
          }}
        >
          <div
            style={{
              position: "relative",
              flex: 1,
              minHeight: 0,
              overflow: "hidden",
              background: `linear-gradient(160deg, ${RED}30 0%, ${VELVET} 60%)`,
            }}
          >
            <div
              className="benday-lg"
              style={
                {
                  position: "absolute",
                  inset: 0,
                  "--benday-color": `${RED}55`,
                  pointerEvents: "none",
                } as React.CSSProperties
              }
            />
            <Image
              src={poster}
              alt={`${event.title} brochure`}
              fill
              style={{ objectFit: "contain", objectPosition: "center" }}
              sizes="(max-width: 900px) 90vw, 400px"
            />
            <div
              style={{
                position: "absolute",
                left: 14,
                bottom: 14,
                right: 14,
                background: PAPER,
                border: `3px solid ${VELVET}`,
                boxShadow: `6px 6px 0 ${VELVET}`,
                padding: "8px 12px",
                transform: "rotate(-1.2deg)",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontFamily: "var(--font-brutal)",
                  fontSize: "1.05rem",
                  lineHeight: 1.05,
                  textTransform: "uppercase",
                  color: VELVET,
                  textShadow: `2px 2px 0 ${FUCHSIA}`,
                }}
              >
                {event.title}
              </p>
            </div>
          </div>

          <div style={{ padding: 16, borderTop: `5px solid ${VELVET}` }}>
            <button
              type="button"
              className="brutal-btn"
              onClick={() =>
                window.open(event.registerUrl, "_blank", "noopener,noreferrer")
              }
              style={{
                width: "100%",
                padding: "14px 0",
                background: RED,
                color: PAPER,
                border: `3px solid ${VELVET}`,
                fontSize: "0.82rem",
                boxShadow: `5px 5px 0 ${VELVET}`,
              }}
            >
              Register
            </button>
          </div>
        </div>

        {/* ── Right: details ── */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              background: RED,
              borderBottom: `5px solid ${VELVET}`,
              padding: "12px 14px",
            }}
          >
            <h3
              style={{
                margin: 0,
                fontFamily: "var(--font-brutal)",
                fontSize: "0.98rem",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: PAPER,
              }}
            >
              Event Details &amp; Rules
            </h3>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label="Close details"
              className="brutal-btn"
              style={{
                width: 38,
                height: 38,
                flexShrink: 0,
                padding: 0,
                background: VELVET,
                color: PAPER,
                border: `3px solid ${VELVET}`,
                fontSize: "1rem",
                boxShadow: `4px 4px 0 ${VELVET}`,
              }}
            >
              &times;
            </button>
          </div>

          <div
            className="event-modal__rules"
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: "auto",
              // `contain` keeps the scroll chain from reaching the page once
              // this list hits its top or bottom.
              overscrollBehavior: "contain",
              touchAction: "pan-y",
              padding: "18px 20px 22px",
            }}
          >
            <p
              style={{
                margin: "0 0 20px",
                fontFamily: "var(--font-mono)",
                fontSize: "0.82rem",
                lineHeight: 1.65,
                color: "rgba(242,239,233,0.92)",
              }}
            >
              {event.description}
            </p>

            {details.map((section) => (
              <section key={section.heading} style={{ marginBottom: 20 }}>
                <h4
                  style={{
                    display: "inline-block",
                    margin: "0 0 10px",
                    fontFamily: "var(--font-brutal)",
                    fontSize: "0.76rem",
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: VELVET,
                    background: FUCHSIA,
                    border: `2px solid ${VELVET}`,
                    boxShadow: `3px 3px 0 ${VELVET}`,
                    padding: "4px 10px",
                  }}
                >
                  {section.heading}
                </h4>
                <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                  {section.points.map((point) => (
                    <li
                      key={point}
                      style={{
                        display: "flex",
                        gap: 9,
                        fontFamily: "var(--font-mono)",
                        fontSize: "0.78rem",
                        lineHeight: 1.6,
                        color: "rgba(242,239,233,0.86)",
                        marginBottom: 5,
                      }}
                    >
                      <span style={{ flexShrink: 0, marginTop: 3 }}>
                        <SpiderTracerIcon size={11} color={RED} />
                      </span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
