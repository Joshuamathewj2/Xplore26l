"use client";

import HeroSection from "@/components/HeroSection";
import FeaturedEventsSection from "@/components/FeaturedEventsSection";

export default function Home() {
  return (
    <main style={{ background: "#0A0A0A", minHeight: "100vh", overflowX: "hidden" }}>
      {/* Hero Section */}
      <HeroSection />

      {/* Featured Events Section */}
      <FeaturedEventsSection />

      {/* Video Asset Integration (loader1.mp4) */}
      <section className="relative w-full h-[40vh] overflow-hidden bg-[#0A0A0A] flex items-center justify-center">
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
          <h2
            className="text-4xl md:text-6xl lg:text-7xl text-center"
            style={{
              fontFamily: "var(--font-display)",
              color: "var(--paper-white)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Sponsors
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

      {/* Footer */}
      <footer
        className="relative z-10 py-12 px-4 text-center border-t border-[rgba(226,54,54,0.2)]"
        style={{
          background: "var(--ink-black)",
          fontFamily: "var(--font-body)",
        }}
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
          <p className="text-sm opacity-55 mb-3">
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
