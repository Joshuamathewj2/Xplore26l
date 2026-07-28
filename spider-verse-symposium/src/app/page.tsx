"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import sponsorsHeading from "../../images/sponsors-heading.webp";
import HeroSection from "@/components/HeroSection";
import FeaturedEventsSection from "@/components/FeaturedEventsSection";
import SplashScreen from "@/components/SplashScreen";
import MiguelStage from "@/components/MiguelStage";
import ComicStamp from "@/components/ComicStamp";
import SponsorsPeekCharacter from "@/components/SponsorsPeekCharacter";
import SpiderTracerIcon from "@/components/SpiderTracerIcon";

export default function EntryPortal() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [isGlitching, setIsGlitching] = useState(false);
  const [glitchStyle, setGlitchStyle] = useState({});
  const [isHovered, setIsHovered] = useState(false);
  const [isClicked, setIsClicked] = useState(false);
  const [isPlayingVideo, setIsPlayingVideo] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);
  // The splash owns the very first beat: its zoom punches transparent holes
  // through its own black overlay, so the reveal uncovers the portal itself
  // rather than a stand-in. Everything below is mounted from the first paint.
  const [splashDone, setSplashDone] = useState(false);
  const [removeOverlay, setRemoveOverlay] = useState(false);
  const redirectTriggered = useRef(false);

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
      {!splashDone && <SplashScreen onComplete={() => setSplashDone(true)} />}

      {/* CSS Animation definitions */}
      <style jsx global>{`
        @keyframes portalGlow {
          0%, 100% {
            filter: drop-shadow(0 0 12px rgba(0, 150, 255, 0.75)) drop-shadow(0 0 25px rgba(0, 150, 255, 0.35));
          }
          50% {
            filter: drop-shadow(0 0 12px rgba(0, 255, 102, 0.75)) drop-shadow(0 0 25px rgba(0, 255, 102, 0.35));
          }
        }

        @keyframes portalGlowHover {
          0% {
            filter: drop-shadow(-4px 2px 0 rgba(255, 0, 85, 0.8)) drop-shadow(4px -2px 0 rgba(0, 229, 255, 0.8)) drop-shadow(0 0 15px rgba(0, 229, 255, 0.6));
            transform: translate(-3px, 1px) scale(1.02);
            clip-path: inset(15% 0 55% 0);
          }
          10% {
            filter: drop-shadow(4px -2px 0 rgba(255, 0, 85, 0.8)) drop-shadow(-4px 2px 0 rgba(0, 229, 255, 0.8)) drop-shadow(0 0 15px rgba(0, 229, 255, 0.6));
            transform: translate(3px, -1px) scale(0.98);
            clip-path: inset(0 0 0 0);
          }
          20% {
            filter: drop-shadow(0 0 15px rgba(0, 255, 102, 0.8));
            transform: translate(0, 0) scale(1);
            clip-path: inset(70% 0 5% 0);
          }
          30% {
            filter: drop-shadow(-5px -2px 0 rgba(255, 0, 85, 0.8)) drop-shadow(5px 2px 0 rgba(0, 229, 255, 0.8)) drop-shadow(0 0 25px rgba(0, 229, 255, 0.8));
            transform: translate(-2px, -3px) scale(1.03);
            clip-path: inset(0 0 0 0);
          }
          40% {
            filter: drop-shadow(0 0 15px rgba(0, 150, 255, 0.8));
            transform: translate(2px, 2px) scale(0.97);
            clip-path: inset(35% 0 45% 0);
          }
          50% {
            filter: drop-shadow(-2px 3px 0 rgba(255, 0, 85, 0.8)) drop-shadow(2px -3px 0 rgba(0, 229, 255, 0.8)) drop-shadow(0 0 15px rgba(0, 229, 255, 0.6));
            transform: translate(-1px, 2px) scale(1.01);
            clip-path: inset(0 0 0 0);
          }
          60% {
            filter: drop-shadow(0 0 20px rgba(0, 255, 102, 0.8));
            transform: translate(0, 0) scale(1);
            clip-path: inset(10% 0 75% 0);
          }
          70% {
            filter: drop-shadow(-4px -2px 0 rgba(255, 0, 85, 0.8)) drop-shadow(4px 2px 0 rgba(0, 229, 255, 0.8)) drop-shadow(0 0 25px rgba(0, 229, 255, 0.8));
            transform: translate(3px, -2px) scale(1.02);
            clip-path: inset(0 0 0 0);
          }
          80% {
            filter: drop-shadow(0 0 15px rgba(0, 150, 255, 0.8));
            transform: translate(-2px, 3px) scale(0.99);
            clip-path: inset(80% 0 2% 0);
          }
          90% {
            filter: drop-shadow(-3px -1px 0 rgba(255, 0, 85, 0.8)) drop-shadow(3px 1px 0 rgba(0, 229, 255, 0.8)) drop-shadow(0 0 20px rgba(0, 229, 255, 0.7));
            transform: translate(1px, -1px) scale(1.01);
            clip-path: inset(0 0 0 0);
          }
          100% {
            filter: drop-shadow(-4px 2px 0 rgba(255, 0, 85, 0.8)) drop-shadow(4px -2px 0 rgba(0, 229, 255, 0.8)) drop-shadow(0 0 15px rgba(0, 229, 255, 0.6));
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
          animation: portalGlow 5s ease-in-out infinite;
          transition: filter 0.5s ease;
        }

        .portal-base.hovered {
          animation: portalGlowHover 0.3s linear infinite;
        }

        .portal-base.clicked {
          animation: none;
          filter: drop-shadow(0 0 35px #00E5FF) invert(1);
        }

        .text-glow {
          text-shadow: 0 0 8px rgba(0, 229, 255, 0.8),
                       0 0 20px rgba(0, 229, 255, 0.4);
          transition: all 0.3s ease;
        }

        .text-glow:hover {
          text-shadow: 0 0 15px rgba(0, 229, 255, 1),
                       0 0 30px rgba(0, 229, 255, 0.7),
                       0 0 45px rgba(0, 229, 255, 0.5);
          letter-spacing: 0.18em;
        }

        .text-glow.clicked {
          animation: microJitter 0.1s infinite;
          color: #e23636;
          text-shadow: 0 0 20px #e23636, 0 0 40px #e23636;
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

          <video
            src="/loader1.mp4"
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
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

          {/* Portal UI Controls (Centered Stack) */}
          <div 
            className="relative flex flex-col items-center justify-center z-20 transition-opacity duration-300"
            style={{
              opacity: isPlayingVideo ? 0 : 1,
              pointerEvents: isPlayingVideo ? "none" : "auto",
            }}
          >
            {!isPlayingVideo && (
              <ComicStamp
                text="THWIP!"
                rotate={-11}
                bg="var(--spider-red)"
                shadow="var(--ink-black)"
                style={{ top: "8%", right: "-4%", zIndex: 25 }}
              />
            )}

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

            {/* Explore 26 Button (Small gap of 12px/16px below portal button) */}
            <div className="text-center mt-3 md:mt-4 z-30">
              <button
                onClick={handleExploreClick}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                className={`text-glow select-none outline-none border-none bg-transparent cursor-pointer font-[var(--font-title)] text-[32px] md:text-[44px] uppercase tracking-[0.15em] ${isClicked ? "clicked scale-95" : "hover:scale-105 active:scale-95"}`}
                style={{
                  fontFamily: "var(--font-title)",
                  color: "#00E5FF",
                }}
              >
                Explore 26
              </button>
            </div>

            {/* Subtitle Snugly Underneath Explore 26 (Tight 6px gap) */}
            <div className="mt-[6px] text-center px-4 z-30">
              <h2 
                className="text-white text-[10px] md:text-xs tracking-[0.25em] uppercase font-light opacity-80"
                style={{
                  fontFamily: "var(--font-body)",
                  fontWeight: 300,
                }}
              >
                Welcome to the Licet Universe
              </h2>
            </div>
          </div>

          {/* Atmospheric background gradient (behind portal UI, in front of video) */}
          {!isPlayingVideo && (
            <>
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,10,20,0.4)_0%,rgba(0,0,0,1)_80%)] pointer-events-none z-15" />
              <div className="absolute inset-0 halftone-bg opacity-5 pointer-events-none z-15" />
            </>
          )}
        </div>
      )}
    </main>
  );
}
