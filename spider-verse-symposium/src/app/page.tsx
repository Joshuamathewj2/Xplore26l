"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import sponsorsHeading from "../../images/sponsors-heading.webp";
import HeroSection from "@/components/HeroSection";
import FeaturedEventsSection from "@/components/FeaturedEventsSection";
import MiguelStage from "@/components/MiguelStage";
import ComicStamp from "@/components/ComicStamp";
import SponsorsPeekCharacter from "@/components/SponsorsPeekCharacter";
import SpiderTracerIcon from "@/components/SpiderTracerIcon";
import PerfHUD from "@/components/PerfHUD";

export default function EntryPortal() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [isGlitching, setIsGlitching] = useState(false);
  const [glitchStyle, setGlitchStyle] = useState({});
  const [isHovered, setIsHovered] = useState(false);
  const [isClicked, setIsClicked] = useState(false);
  const [isPlayingVideo, setIsPlayingVideo] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);
  const [removeOverlay, setRemoveOverlay] = useState(false);
  const redirectTriggered = useRef(false);
  const breakVideoRef = useRef<HTMLVideoElement>(null);

  /* The ~30 MB video break loads and plays only while it is on screen.
     It is well below the fold, so autoPlay + preload="auto" spent that
     bandwidth — and the GPU time to decode it — during the hero's 3D warm-up,
     which is where the scroll transition was losing frames.

     rootMargin starts the fetch a little before it scrolls in, so it is
     playing by the time it is actually looked at; pausing on the way out stops
     it decoding behind the rest of the page. */
  useEffect(() => {
    const el = breakVideoRef.current;
    if (!el) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          void el.play().catch(() => {
            /* Autoplay can be refused (battery saver, reduced data). The strip
               is decorative, so a still frame is an acceptable outcome — what
               is not acceptable is an unhandled rejection in the console. */
          });
        } else {
          el.pause();
        }
      },
      { rootMargin: "200px 0px" }
    );

    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Randomized glitch generator for the portal UI
  useEffect(() => {
    let active = true;

    const triggerGlitch = () => {
      if (!active || isClicked) return;

      const nextDelay = Math.random() * 2500 + 1500;

      setTimeout(() => {
        if (!active || isClicked) return;

        setIsGlitching(true);

        const xOffset = (Math.random() - 0.5) * 16;
        const yOffset = (Math.random() - 0.5) * 12;
        const skewAngle = (Math.random() - 0.5) * 8;
        const clipTop = Math.random() * 70;
        const clipBottom = clipTop + Math.random() * 25 + 5;
        const filterVal = `hue-rotate(${Math.random() * 360}deg) saturate(2)`;

        setGlitchStyle({
          transform: `translate(${xOffset}px, ${yOffset}px) skew(${skewAngle}deg)`,
          clipPath: `inset(${clipTop}% 0 ${100 - clipBottom}% 0)`,
          filter: filterVal,
          opacity: 0.85,
        });

        const duration = Math.random() * 150 + 50;
        setTimeout(() => {
          if (!active) return;
          setIsGlitching(false);
          setGlitchStyle({});
          
          if (Math.random() > 0.6) {
            setTimeout(() => {
              if (!active || isClicked) return;
              setIsGlitching(true);
              const xOffset2 = (Math.random() - 0.5) * 20;
              const yOffset2 = (Math.random() - 0.5) * 15;
              const clipTop2 = Math.random() * 80;
              const clipBottom2 = clipTop2 + Math.random() * 15;
              setGlitchStyle({
                transform: `translate(${xOffset2}px, ${yOffset2}px)`,
                clipPath: `inset(${clipTop2}% 0 ${100 - clipBottom2}% 0)`,
                filter: `invert(1) hue-rotate(180deg)`,
                opacity: 0.7,
              });
              setTimeout(() => {
                if (!active) return;
                setIsGlitching(false);
                setGlitchStyle({});
                triggerGlitch();
              }, 60);
            }, 80);
          } else {
            triggerGlitch();
          }
        }, duration);

      }, nextDelay);
    };

    triggerGlitch();

    return () => {
      active = false;
    };
  }, [isClicked]);

  // Reveal the landing page by hiding/unmounting the video and loading overlays
  const triggerReveal = () => {
    if (redirectTriggered.current) return;
    redirectTriggered.current = true;

    // Hard Cut / Instant Hide: Set style to display none immediately to bypass React async delay
    if (overlayRef.current) {
      overlayRef.current.style.display = "none";
    }
    
    setIsRevealed(true);
    setRemoveOverlay(true);
  };

  // Click handler to trigger instant playback
  const handleExploreClick = () => {
    if (isClicked) return;
    setIsClicked(true);
    setIsPlayingVideo(true);

    if (videoRef.current) {
      videoRef.current.play().catch((err) => {
        console.warn("Autoplay block or playback interruption: ", err);
        // Fallback to immediate reveal if video completely fails to play
        triggerReveal();
      });
    }

    setIsGlitching(true);
    setGlitchStyle({
      transform: "scale(1.15) skew(15deg)",
      filter: "hue-rotate(270deg) contrast(3) saturate(4)",
      clipPath: "none",
    });
  };

  // Video play / time update / ended handlers
  const handleVideoPlay = () => {
    // 1.3s hard cap timer
    const capTimer = setTimeout(() => {
      triggerReveal();
    }, 1300);

    return () => clearTimeout(capTimer);
  };

  const handleVideoTimeUpdate = () => {
    if (videoRef.current && videoRef.current.currentTime >= 1.3) {
      triggerReveal();
    }
  };

  const handleVideoEnded = () => {
    triggerReveal();
  };

  return (
    <main
      className="bg-[#0A0A0A] w-full min-h-screen relative"
      style={{
        height: isRevealed ? "auto" : "100vh",
        overflowY: isRevealed ? "visible" : "hidden",
        overflowX: "hidden",
      }}
    >
      {/* Renders nothing unless the page is opened with ?debug=perf. */}
      <PerfHUD />

      {/* CSS Animation definitions */}
      <style jsx global>{`
        @keyframes portalGlitchHover {
          0% {
            filter: drop-shadow(-4px 2px 0 rgba(255, 0, 85, 0.8)) drop-shadow(4px -2px 0 rgba(0, 229, 255, 0.8));
            transform: translate(-3px, 1px) scale(1.02);
            clip-path: inset(15% 0 55% 0);
          }
          10% {
            filter: drop-shadow(4px -2px 0 rgba(255, 0, 85, 0.8)) drop-shadow(-4px 2px 0 rgba(0, 229, 255, 0.8));
            transform: translate(3px, -1px) scale(0.98);
            clip-path: inset(0 0 0 0);
          }
          20% {
            filter: none;
            transform: translate(0, 0) scale(1);
            clip-path: inset(70% 0 5% 0);
          }
          30% {
            filter: drop-shadow(-5px -2px 0 rgba(255, 0, 85, 0.8)) drop-shadow(5px 2px 0 rgba(0, 229, 255, 0.8));
            transform: translate(-2px, -3px) scale(1.03);
            clip-path: inset(0 0 0 0);
          }
          40% {
            filter: none;
            transform: translate(2px, 2px) scale(0.97);
            clip-path: inset(35% 0 45% 0);
          }
          50% {
            filter: drop-shadow(-2px 3px 0 rgba(255, 0, 85, 0.8)) drop-shadow(2px -3px 0 rgba(0, 229, 255, 0.8));
            transform: translate(-1px, 2px) scale(1.01);
            clip-path: inset(0 0 0 0);
          }
          60% {
            filter: none;
            transform: translate(0, 0) scale(1);
            clip-path: inset(10% 0 75% 0);
          }
          70% {
            filter: drop-shadow(-4px -2px 0 rgba(255, 0, 85, 0.8)) drop-shadow(4px 2px 0 rgba(0, 229, 255, 0.8));
            transform: translate(3px, -2px) scale(1.02);
            clip-path: inset(0 0 0 0);
          }
          80% {
            filter: none;
            transform: translate(-2px, 3px) scale(0.99);
            clip-path: inset(80% 0 2% 0);
          }
          90% {
            filter: drop-shadow(-3px -1px 0 rgba(255, 0, 85, 0.8)) drop-shadow(3px 1px 0 rgba(0, 229, 255, 0.8));
            transform: translate(1px, -1px) scale(1.01);
            clip-path: inset(0 0 0 0);
          }
          100% {
            filter: drop-shadow(-4px 2px 0 rgba(255, 0, 85, 0.8)) drop-shadow(4px -2px 0 rgba(0, 229, 255, 0.8));
            transform: translate(-3px, 1px) scale(1.02);
            clip-path: inset(15% 0 55% 0);
          }
        }

        @keyframes titleGlitchHover {
          0% {
            transform: translate(-3px, 1px) scale(1.02);
            clip-path: inset(15% 0 55% 0);
          }
          10% {
            transform: translate(3px, -1px) scale(0.98);
            clip-path: inset(0 0 0 0);
          }
          20% {
            transform: translate(0, 0) scale(1);
            clip-path: inset(70% 0 5% 0);
          }
          30% {
            transform: translate(-2px, -3px) scale(1.03);
            clip-path: inset(0 0 0 0);
          }
          40% {
            transform: translate(2px, 2px) scale(0.97);
            clip-path: inset(35% 0 45% 0);
          }
          50% {
            transform: translate(-1px, 2px) scale(1.01);
            clip-path: inset(0 0 0 0);
          }
          60% {
            transform: translate(0, 0) scale(1);
            clip-path: inset(10% 0 75% 0);
          }
          70% {
            transform: translate(3px, -2px) scale(1.02);
            clip-path: inset(0 0 0 0);
          }
          80% {
            transform: translate(-2px, 3px) scale(0.99);
            clip-path: inset(80% 0 2% 0);
          }
          90% {
            transform: translate(1px, -1px) scale(1.01);
            clip-path: inset(0 0 0 0);
          }
          100% {
            transform: translate(-3px, 1px) scale(1.02);
            clip-path: inset(15% 0 55% 0);
          }
        }

        @keyframes microJitter {
          0%, 100% { transform: translate(0, 0); }
          10% { transform: translate(-0.5px, 0.5px); }
          20% { transform: translate(0.5px, -0.5px); }
          30% { transform: translate(-0.5px, -0.5px); }
          40% { transform: translate(0.5px, 0.5px); }
          50% { transform: translate(-0.5px, 0.5px); }
        }

        .portal-base {
          transition: filter 0.5s ease;
        }

        .portal-base.hovered {
          animation: portalGlitchHover 0.3s linear infinite;
        }

        .portal-base.clicked {
          animation: none;
          filter: invert(1);
        }

        .title-base {
          mix-blend-mode: screen;
          filter: contrast(1.4) brightness(1.1);
          transition: filter 0.5s ease;
        }

        .title-base.hovered {
          animation: titleGlitchHover 0.3s linear infinite;
          filter: contrast(1.4) brightness(1.1);
        }

        .title-base.clicked {
          animation: microJitter 0.1s infinite;
          filter: invert(1);
        }
      `}</style>

      {/* 1. Main Hero Section Landing Page mounted in the background */}
      <div 
        style={{ 
          opacity: isRevealed ? 1 : 0,
          transition: "opacity 0.4s ease-in-out",
          width: "100%",
          minHeight: "100vh",
          pointerEvents: isRevealed ? "auto" : "none",
        }}
      >
        {/* Miguel: one persistent 3D canvas that every section scrolls past.
            Lives INSIDE this wrapper so it shares a stacking context with the
            sections it weaves through — see the z-index note in MiguelStage. */}
        <MiguelStage start={isRevealed} />

        {/* The hero holds its entrance until the portal actually uncovers it,
            so the sequence isn't spent behind an opacity-0 wrapper. */}
        <HeroSection start={isRevealed} />
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

          {/* preload="none" + play-on-visible, NOT autoPlay + preload="auto".
              This clip is ~30 MB and sits well below the fold, but eager
              preload fetched all of it the moment the page opened — during
              exactly the window the hero's 3D scene is downloading its model
              and warming up. Video decode and WebGL contend for the same GPU,
              so the character's scroll transition stuttered on behalf of a
              strip nobody had scrolled to yet. Now it costs nothing until it
              is actually on screen. */}
          <video
            ref={breakVideoRef}
            src="/loader1.mp4"
            loop
            muted
            playsInline
            preload="none"
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
          <SponsorsPeekCharacter />
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
            <p className="text-sm opacity-40">
              © 2026 XPLORE&apos;26. All dimensions reserved.
            </p>
          </div>
        </footer>
      </div>

      {/* 2. Transition Overlays (Portal & Video) */}
      {!removeOverlay && (
        <div 
          ref={overlayRef}
          className="fixed inset-0 w-full h-full flex flex-col items-center justify-center bg-black transition-opacity duration-300 z-50 select-none"
          style={{
            opacity: isRevealed ? 0 : 1,
            pointerEvents: isRevealed ? "none" : "auto",
          }}
        >
          {/* Preloaded video element layered directly behind/beneath the portal UI */}
          <video
            ref={videoRef}
            src="/loader.mp4"
            preload="auto"
            muted
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
            style={{
              width: "100vw",
              height: "100vh",
              zIndex: 10,
              opacity: isPlayingVideo ? 1 : 0,
              pointerEvents: isPlayingVideo ? "auto" : "none",
              backgroundColor: "#000000",
            }}
            onPlay={handleVideoPlay}
            onTimeUpdate={handleVideoTimeUpdate}
            onEnded={handleVideoEnded}
          />

          {/* Full Screen Animated Spider Web GIF Background */}
          {!isPlayingVideo && (
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage: "url('/web-loop.gif')",
                backgroundSize: "cover",
                backgroundPosition: "center",
                opacity: 0.5,
                mixBlendMode: "screen",
                zIndex: 12,
              }}
            />
          )}

           {/* Portal UI Controls (Centered Stack) */}
          <div 
            className="absolute inset-0 z-20 transition-opacity duration-300"
            style={{
              opacity: isPlayingVideo ? 0 : 1,
              pointerEvents: isPlayingVideo ? "none" : "auto",
            }}
          >
            {/* Center Container for Portal Button */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center">
              {/* Portal Wrapper (Clickable Area) */}
              <button 
                onClick={handleExploreClick}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                className="relative w-[360px] h-[360px] md:w-[540px] md:h-[540px] flex items-center justify-center cursor-pointer outline-none border-none bg-transparent transition-transform active:scale-95"
                aria-label="Enter portal"
              >
                {/* Static Portal Image (Base Layer) */}
                <div 
                  className={`absolute inset-0 w-full h-full portal-base ${isHovered ? "hovered" : ""} ${isClicked ? "clicked" : ""}`}
                  style={{ 
                    backgroundImage: "url('/portal.png')",
                    backgroundSize: "contain",
                    backgroundPosition: "center",
                    backgroundRepeat: "no-repeat",
                  }}
                />

                {/* Glitching Overlay Layer */}
                {isGlitching && (
                  <div 
                    className="absolute inset-0 w-full h-full pointer-events-none"
                    style={{
                      backgroundImage: "url('/portal.png')",
                      backgroundSize: "contain",
                      backgroundPosition: "center",
                      backgroundRepeat: "no-repeat",
                      mixBlendMode: "screen",
                      ...glitchStyle,
                    }}
                  />
                )}
              </button>
            </div>

            {/* Bottom Container for Custom Title Image */}
            <div className="absolute bottom-[8vh] left-1/2 -translate-x-1/2 w-full flex justify-center">
              <button
                onClick={handleExploreClick}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                className="relative outline-none border-none bg-transparent cursor-pointer select-none flex justify-center items-center"
                style={{
                  maxWidth: "380px",
                  width: "80%",
                }}
                aria-label="Explore 26"
              >
                {/* Static base image */}
                <img
                  src="/xplorefont.png"
                  alt="XPLORE 26"
                  className={`title-base object-contain w-full h-auto ${isHovered ? "hovered" : ""} ${isClicked ? "clicked" : ""}`}
                />

                {/* Glitching Overlay Layer */}
                {isGlitching && (
                  <img
                    src="/xplorefont.png"
                    alt="XPLORE 26 Glitch"
                    className="absolute top-0 left-0 w-full h-auto object-contain pointer-events-none mix-blend-screen"
                    style={glitchStyle}
                  />
                )}
              </button>
            </div>
          </div>

          {/* Dotted texture background overlay */}
          {!isPlayingVideo && (
            <div className="absolute inset-0 halftone-bg opacity-10 pointer-events-none z-15" />
          )}
        </div>
      )}
    </main>
  );
}
