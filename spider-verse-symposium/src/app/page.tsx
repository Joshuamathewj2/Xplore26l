"use client";

import HeroSection from "@/components/HeroSection";
import Spider3D from "@/components/Spider3D";
import ScrollRig from "@/components/ScrollRig";
import CTAButton from "@/components/CTAButton";
import ImpactCrack from "@/components/ImpactCrack";

/* ════════════════════════════════════════════════════════════
   SCROLLYTELLING LAYOUT

   • ONE persistent 3D canvas in a position:fixed full-viewport layer at
     z-index 15. It mounts once, never remounts, and every section scrolls
     past it. Scroll → character reactions are driven by BEATS
     (src/lib/beats.ts) reading scrollState (written by <ScrollRig/>).
   • Every `data-beat` section below maps 1:1, in order, to a BEATS entry.
     Section BACKGROUNDS paint below the canvas (no z-index), section
     CONTENT sits at z-30 — above the character — so copy stays readable
     while he passes behind it. The hero is the exception: its solid title
     (z8) is behind him and its outline title (z16) in front (the sandwich).
   • `data-reveal` elements get a scroll-triggered rise+fade (skipped under
     prefers-reduced-motion).
   ════════════════════════════════════════════════════════════ */

/* Shared bits for the placeholder sections — short, on-theme copy. */
const displayFont: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  color: "var(--paper-white)",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const kickerStyle: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  color: "var(--spider-red)",
  letterSpacing: "0.3em",
  textTransform: "uppercase",
  fontSize: 13,
};

/* Translucent comic-panel card — lets the character read through the gaps. */
function PanelCard({
  title,
  tag,
  children,
}: {
  title: string;
  tag: string;
  children: React.ReactNode;
}) {
  return (
    <div
      data-reveal
      className="relative border border-[rgba(242,239,233,0.14)] p-6 backdrop-blur-[2px]"
      style={{ background: "rgba(10,10,10,0.72)" }}
    >
      <span style={kickerStyle}>{tag}</span>
      <h3 className="mt-2 text-2xl" style={displayFont}>
        {title}
      </h3>
      <p className="mt-3 text-sm leading-relaxed opacity-60">{children}</p>
      <span
        className="absolute top-0 left-0 h-3 w-3 border-t-2 border-l-2"
        style={{ borderColor: "var(--spider-red)" }}
      />
      <span
        className="absolute bottom-0 right-0 h-3 w-3 border-b-2 border-r-2"
        style={{ borderColor: "var(--glitch-cyan)" }}
      />
    </div>
  );
}

export default function Home() {
  return (
    <main style={{ background: "#0A0A0A", minHeight: "100vh", overflowX: "hidden" }}>
      {/* Scroll engine: Lenis + beat mapping. Renders nothing. */}
      <ScrollRig />

      {/* ── THE persistent 3D layer ─────────────────────────────────────
          fixed + z15: above section backgrounds and the hero's solid title
          (z8), below all z-30 section content and the hero's outline title
          (z16). pointer-events:none so it never blocks the page. Mounted
          exactly once — the 6.5MB model loads exactly once. The CSS fadeIn
          replaces the old hero entrance for the character. ── */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 15,
          pointerEvents: "none",
          animation: "fadeIn 1.1s ease 0.55s both",
        }}
      >
        {/* Inner wrapper (NOT the fixed element — transforms on a fixed
            element's ancestor would re-anchor it): ImpactCrack shakes this
            when the final punch lands. */}
        <div data-impact-shake style={{ width: "100%", height: "100%" }}>
          <Spider3D />
        </div>
      </div>

      {/* Viewport "glass" that cracks when the register punch lands.
          pointer-events:none — the CTA under it stays clickable. */}
      <ImpactCrack />

      {/* ── BEAT 1: HERO (data-beat lives inside HeroSection) ── */}
      <HeroSection />

      {/* ── BEAT 2: ABOUT — character drifts right, copy owns the left ── */}
      <section
        id="about"
        data-beat="about"
        className="relative min-h-screen flex items-center px-6 md:px-16"
      >
        <div className="absolute inset-0 halftone-bg pointer-events-none" />
        <div className="relative z-30 max-w-xl" data-reveal>
          <span style={kickerStyle}>The Symposium</span>
          <h2 className="mt-4 text-4xl md:text-6xl chromatic-text" style={displayFont}>
            Where Dimensions Collide
          </h2>
          <p className="mt-6 text-base leading-relaxed opacity-70 max-w-md">
            XPLORE&apos;26 tears a hole between disciplines — two days where
            engineers, designers and dreamers cross into each other&apos;s
            universes. Every timeline welcome. Bring your own canon.
          </p>
          <p className="mt-4 text-sm opacity-50 max-w-md">
            One campus. Forty events. Infinite Earths.
          </p>
        </div>
      </section>

      {/* ── BEAT 3: EVENTS — character in profile on the left, grid right ── */}
      <section
        id="events"
        data-beat="events"
        className="relative min-h-screen flex items-center px-6 md:px-16"
      >
        <div className="absolute inset-0 halftone-bg pointer-events-none" />
        <div className="relative z-30 ml-auto w-full md:w-3/5">
          <div data-reveal>
            <span style={kickerStyle}>Line-Up</span>
            <h2 className="mt-4 mb-10 text-4xl md:text-6xl" style={displayFont}>
              Events
            </h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <PanelCard tag="Flagship" title="Hack the Verse">
              24 hours. One anomaly. Build the thing that stitches the
              multiverse back together.
            </PanelCard>
            <PanelCard tag="Arena" title="Circuit Break">
              Head-to-head hardware showdown — fastest rig across the
              dimensional rift wins.
            </PanelCard>
            <PanelCard tag="Stage" title="Glitch Talks">
              Lightning talks from people who broke reality and shipped it
              anyway.
            </PanelCard>
            <PanelCard tag="Lab" title="Web-Shooter Workshop">
              Hands-on builds: from zero to thwip in ninety minutes.
            </PanelCard>
          </div>
        </div>
      </section>

      {/* ── BEAT 4: TRACKS — low hero angle, copy left ── */}
      <section
        id="tracks"
        data-beat="tracks"
        className="relative min-h-screen flex items-center px-6 md:px-16"
      >
        <div className="absolute inset-0 halftone-bg pointer-events-none" />
        <div className="relative z-30 max-w-xl">
          <div data-reveal>
            <span style={kickerStyle}>Choose Your Timeline</span>
            <h2 className="mt-4 mb-8 text-4xl md:text-6xl" style={displayFont}>
              Tracks
            </h2>
          </div>
          <ul className="space-y-4">
            {[
              ["Earth-928", "AI & Emerging Tech"],
              ["Earth-1610", "Design & Interaction"],
              ["Earth-616", "Core Engineering"],
              ["Earth-65", "Startups & Impact"],
            ].map(([earth, name]) => (
              <li
                key={earth}
                data-reveal
                className="flex items-baseline gap-4 border-b border-[rgba(242,239,233,0.12)] pb-3"
              >
                <span
                  className="text-xs"
                  style={{ ...kickerStyle, color: "var(--glitch-cyan)" }}
                >
                  {earth}
                </span>
                <span className="text-xl md:text-2xl" style={displayFont}>
                  {name}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── BEAT 5: SPONSORS — character small in the distance behind grid ── */}
      <section
        id="sponsors"
        data-beat="sponsors"
        className="relative min-h-screen flex flex-col items-center justify-center px-6"
      >
        <div className="absolute inset-0 halftone-bg pointer-events-none" />
        <div className="relative z-30 w-full max-w-3xl text-center">
          <div data-reveal>
            <span style={kickerStyle}>Backed Across the Multiverse</span>
            <h2 className="mt-4 mb-10 text-4xl md:text-6xl" style={displayFont}>
              Sponsors
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {["Alchemax", "Oscorp R&D", "Daily Bugle", "Horizon Labs", "Parker Ind.", "Stark Grid"].map(
              (s) => (
                <div
                  key={s}
                  data-reveal
                  className="border border-[rgba(242,239,233,0.12)] py-6 text-sm uppercase tracking-widest opacity-60"
                  style={{
                    background: "rgba(10,10,10,0.6)",
                    fontFamily: "var(--font-display)",
                  }}
                >
                  {s}
                </div>
              )
            )}
          </div>
        </div>
      </section>

      {/* ── BEAT 6: REGISTER — final confrontation + CTA ── */}
      <section
        id="register"
        data-beat="register"
        className="relative min-h-screen flex flex-col items-center justify-center px-6 text-center"
      >
        <div className="absolute inset-0 halftone-bg pointer-events-none" />
        <div className="relative z-30 flex flex-col items-center" data-reveal>
          <span style={kickerStyle}>Your Universe Needs You</span>
          <h2 className="mt-4 text-5xl md:text-7xl chromatic-text" style={displayFont}>
            Cross Over
          </h2>
          <p className="mt-6 max-w-md text-sm opacity-60">
            Registration portals are open. Step through before the rift
            closes — January 2026.
          </p>
          <CTAButton text="Register Now" href="#register" delay={0.4} />
        </div>
      </section>

      {/* Footer */}
      <footer
        className="relative z-30 py-12 px-4 text-center border-t border-[rgba(226,54,54,0.2)]"
        style={{ background: "var(--ink-black)", fontFamily: "var(--font-body)" }}
      >
        <div className="max-w-4xl mx-auto">
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
    </main>
  );
}
