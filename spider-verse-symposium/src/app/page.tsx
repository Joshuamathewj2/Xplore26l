"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import sponsorsHeading from "../../images/sponsors-heading.webp";
import SplashScreen from "@/components/SplashScreen";
import HeroSection from "@/components/HeroSection";
import FeaturedEventsSection from "@/components/FeaturedEventsSection";
import MiguelStage from "@/components/MiguelStage";
import ComicStamp from "@/components/ComicStamp";

import SpiderTracerIcon from "@/components/SpiderTracerIcon";
import PerfHUD from "@/components/PerfHUD";
import ProceduralPortal from "@/components/ProceduralPortal";
import SpiderWebTunnel from "@/components/SpiderWebTunnel";

/* ── LAZY LOOP VIDEO ──
   `loader1.mp4` (the events→sponsors interlude strip) is ~30MB — by far the
   heaviest single asset on the page. With `autoPlay` + `preload="auto"` a
   plain <video> starts pulling all 30MB the instant the page mounts,
   competing with the hero video, the 3D model and every other above-the-fold
   asset for the same connection — that's the biggest single contributor to
   the site feeling laggy on first load, especially once actually hosted
   (no local dev-server cache to hide it).

   `preload="none"` until an IntersectionObserver says the section is
   actually about to be scrolled into view, so the byte cost is deferred to
   the moment it's needed rather than paid up front by every visitor,
   including the many who never scroll this far. `rootMargin` starts the
   fetch a bit before the section is actually on screen so it still has time
   to buffer before it's visible. */
function LazyLoopVideo({
  src,
  className,
  style,
}: {
  src: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || shouldLoad) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldLoad(true);
          io.disconnect();
        }
      },
      { rootMargin: "800px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [shouldLoad]);

  // The `autoPlay` attribute only reliably starts playback when it's present
  // at the moment the browser begins loading a resource — toggling it on an
  // ALREADY-MOUNTED <video> via a React re-render (which is what happens
  // here: `src` flips from undefined to the real URL on the same element)
  // is not guaranteed to fire it. Measured: `readyState` reaches 4 (fully
  // buffered) but the element stays paused. An explicit `.play()` once the
  // source is actually assigned is the reliable trigger.
  useEffect(() => {
    if (!shouldLoad) return;
    ref.current?.play().catch(() => {
      // Autoplay can still be blocked by browser policy even when muted, in
      // which case there's nothing to recover from here — it's a silent,
      // paused loop instead of a crash.
    });
  }, [shouldLoad]);

  return (
    <video
      ref={ref}
      src={shouldLoad ? src : undefined}
      autoPlay={shouldLoad}
      loop
      muted
      playsInline
      preload={shouldLoad ? "auto" : "none"}
      className={className}
      style={style}
    />
  );
}

export default function EntryPortal() {
  // The splash owns the entire entrance beat: its zoom punches transparent
  // holes through its own black overlay, so the reveal uncovers the site
  // itself rather than a stand-in. Everything below is mounted from the
  // first paint, and `splashDone` alone drives when it comes alive.
  const [splashDone, setSplashDone] = useState(false);

  return (
    <main className="bg-[#0A0A0A] w-full min-h-screen relative">
      {/* Renders nothing unless the page is opened with ?debug=perf. */}
      <PerfHUD />

      {!splashDone && <SplashScreen onComplete={() => setSplashDone(true)} />}

      {/* Miguel: one persistent 3D canvas that every section scrolls past.
          Lives INSIDE this wrapper so it shares a stacking context with the
          sections it weaves through — see the z-index note in MiguelStage. */}
      <MiguelStage start={splashDone} />

      {/* The hero holds its entrance until the splash hands over, so the
          sequence isn't spent behind an opacity-0 wrapper. */}
      <HeroSection start={splashDone} />
        <FeaturedEventsSection />

        {/* Zero-height seam: lets a decorative stamp straddle the boundary
            between two sections without either section needing to know
            about it. */}
        <div style={{ position: "relative", height: 0 }}>
          <ComicStamp
            text="POW!"
            rotate={-6}
            style={{ top: -22, left: "8%", zIndex: 25 }}
          />
        </div>

        {/* Video Asset Integration (loader1.mp4)

            `isolation: isolate` is load-bearing: this section is
            position:relative with no z-index, so it creates NO stacking
            context of its own and its z-10/z-20 gradient masks below were
            competing directly with the persistent 3D canvas in the page's
            stacking context. Isolating it keeps those masks inside this
            section, where they belong, instead of painting over the character
            passing in front of it. */}
        <section
          // The "interlude" beat anchors on this. It used to be found by
          // position — `#events + section` — which broke the moment the
          // zero-height ComicStamp seam above was inserted between the two,
          // because `+` needs an IMMEDIATE sibling. The beat was then dropped
          // and the character interpolated straight from events to sponsors,
          // skipping a pose he was authored to hold. An explicit id cannot be
          // broken by rearranging what sits next to it.
          id="interlude"
          className="relative w-full h-[40vh] overflow-hidden bg-[#0A0A0A] flex items-center justify-center"
          style={{ isolation: "isolate" }}
        >
          {/* Subtle dark gradient overlay mask to transition smoothly */}
          <div 
            className="absolute inset-0 z-20 pointer-events-none"
            style={{
              background: "linear-gradient(to bottom, #0A0A0A 0%, rgba(10, 10, 10, 0) 25%, rgba(10, 10, 10, 0) 75%, #0A0A0A 100%)",
            }}
          />
          {/* Dark blue multiverse ambient glow */}
          <div 
            className="absolute inset-0 z-10 pointer-events-none mix-blend-screen opacity-45"
            style={{
              background: "radial-gradient(circle at center, rgba(13, 71, 161, 0.5) 0%, rgba(10, 10, 10, 0) 80%)",
            }}
          />

          <LazyLoopVideo
            src="/loader1.mp4"
            className="w-full h-full object-cover"
            style={{
              width: "100%",
              height: "100%",
            }}
          />
        </section>

        <section
          id="sponsors"
          className="relative z-10 min-h-[50vh] flex flex-col items-center justify-center px-4"
          style={{
            background:
              "linear-gradient(180deg, var(--ink-black), #062654 50%, var(--ink-black))",
          }}
        >
          <div className="relative">
            <div
              className="absolute -inset-4 border-2 border-[var(--web-blue-light)] opacity-20"
              style={{ transform: "rotate(1deg)" }}
            />
            {/* Heading is artwork; the <h2> keeps a real heading for assistive
                tech, with the alt text carrying the name. */}
            <h2
              style={{
                margin: 0,
                width: "clamp(240px, 42vw, 560px)",
                lineHeight: 0,
              }}
            >
              <Image
                src={sponsorsHeading}
                alt="Sponsors"
                style={{
                  width: "100%",
                  height: "auto",
                  filter:
                    "drop-shadow(0 0 1px rgba(242,239,233,0.55)) drop-shadow(0 6px 26px rgba(0,0,0,0.85))",
                }}
                sizes="(max-width: 768px) 80vw, 560px"
              />
            </h2>
          </div>

          <p
            className="mt-8 text-center max-w-lg opacity-50 text-sm tracking-wider uppercase"
            style={{
              fontFamily: "var(--font-display)",
              letterSpacing: "0.2em",
            }}
          >
            Partners across the multiverse
          </p>
          <div className="absolute inset-0 halftone-bg pointer-events-none" />
        </section>

        {/* ── Event coordinators ──
            Sits between the sponsors block and the footer. Numbers are real
            contact details, so they are `tel:` links (digits only in the
            href, +91 country code so they dial from any handset) with the
            spaced grouping kept for reading. */}
        <section
          id="coordinators"
          className="relative z-10 px-4"
          style={{
            background: "var(--ink-black)",
            padding: "clamp(48px, 7vw, 80px) 16px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <ComicStamp
            text="SNIKT!"
            rotate={7}
            style={{ top: "2%", right: "6%", zIndex: 5 }}
          />
          <h2
            style={{
              margin: 0,
              fontFamily: "var(--font-display)",
              fontSize: "clamp(1.4rem, 3.4vw, 2.2rem)",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--paper-white)",
              textAlign: "center",
            }}
          >
            Event Coordinators
          </h2>
          <p
            style={{
              marginTop: 10,
              marginBottom: "clamp(28px, 4vw, 40px)",
              fontFamily: "var(--font-mono)",
              fontSize: "0.72rem",
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "var(--paper-white)",
              opacity: 0.45,
              textAlign: "center",
            }}
          >
            Reach the team across any dimension
          </p>

          {/* Wraps to a column on narrow screens rather than squeezing. */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: "clamp(18px, 3vw, 34px)",
            }}
          >
            {[
              {
                id: "01",
                name: "Kaif",
                role: "Event Coordinator",
                display: "93453 65508",
                dial: "+919345365508",
              },
              {
                id: "02",
                name: "Jeroline",
                role: "Event Coordinator",
                display: "73583 03462",
                dial: "+917358303462",
              },
            ].map((person) => (
              <a
                key={person.dial}
                href={`tel:${person.dial}`}
                style={{
                  position: "relative",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  gap: 8,
                  minWidth: 230,
                  padding: "18px 24px",
                  border: "3px solid var(--paper-white)",
                  boxShadow: "7px 7px 0 var(--spider-red)",
                  background: "var(--velvet-black)",
                  textDecoration: "none",
                  color: "var(--paper-white)",
                }}
              >
                {/* ID-card accent stripe — the "badge", not just a card */}
                <span
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    top: -3,
                    left: -3,
                    right: -3,
                    height: 5,
                    background: "var(--glitch-cyan)",
                  }}
                />
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    width: "100%",
                    gap: 10,
                  }}
                >
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontFamily: "var(--font-mono)",
                      fontSize: "0.62rem",
                      letterSpacing: "0.18em",
                      textTransform: "uppercase",
                      color: "var(--glitch-cyan)",
                      opacity: 0.85,
                    }}
                  >
                    <SpiderTracerIcon size={12} color="var(--glitch-cyan)" />
                    Crew ID
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "0.62rem",
                      letterSpacing: "0.14em",
                      color: "var(--paper-white)",
                      opacity: 0.55,
                    }}
                  >
                    NO. {person.id}
                  </span>
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "1.15rem",
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                  }}
                >
                  {person.name}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "0.68rem",
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: "var(--paper-white)",
                    opacity: 0.5,
                    marginTop: -6,
                  }}
                >
                  {person.role}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "0.95rem",
                    letterSpacing: "0.08em",
                    color: "var(--glitch-cyan)",
                  }}
                >
                  {person.display}
                </span>
              </a>
            ))}
          </div>
        </section>

        <footer
          className="relative z-10 py-12 px-4 border-t border-[rgba(226,54,54,0.2)]"
          style={{
            background: "var(--ink-black)",
            fontFamily: "var(--font-body)",
            /* Centred by explicit flex rather than `text-center` +
               `mx-auto`: those centre the TEXT inside whatever box the
               container happens to be, which left the block sitting off to
               the left. Laying the footer out as a centred column makes the
               position independent of the box's width. */
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "56rem",
              marginInline: "auto",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <p
              className="text-2xl mb-4"
              style={{
                fontFamily: "var(--font-display)",
                color: "var(--spider-red)",
                letterSpacing: "0.1em",
              }}
            >
              XPLORE&apos;26
            </p>
            {/* Venue address. Every event room (I11/I21/I22/I23/H22/A12) is on
                this one campus, so the postal address lives here rather than
                being repeated per section. */}
            <p className="text-sm opacity-55 mb-3" style={{ maxWidth: "34rem" }}>
              Loyola-ICAM College of Engineering and Technology,
              <br />
              Loyola College Campus, Nungambakkam, Chennai – 600034
            </p>
            <p className="text-sm opacity-40">
              © 2026 XPLORE&apos;26. All dimensions reserved.
            </p>
          </div>
        </footer>
    </main>
  );
}
