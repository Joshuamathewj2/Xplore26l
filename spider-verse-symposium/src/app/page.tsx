"use client";

import HeroSection from "@/components/HeroSection";

export default function Home() {
  return (
    <main style={{ background: "#0A0A0A", minHeight: "100vh", overflowX: "hidden" }}>
      {/* Hero Section */}
      <HeroSection />

      {/* Placeholder sections for future spec */}
      <section
        id="events"
        className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4"
        style={{
          background: "var(--ink-black)",
        }}
      >
        {/* Comic panel header decoration */}
        <div className="relative">
          <div
            className="absolute -inset-4 border-2 border-[var(--spider-red)] opacity-20"
            style={{ transform: "rotate(-1deg)" }}
          />
          <h2
            className="text-4xl md:text-6xl lg:text-7xl text-center chromatic-text"
            style={{
              fontFamily: "var(--font-display)",
              color: "var(--paper-white)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Events
          </h2>
        </div>

        <p
          className="mt-8 text-center max-w-lg opacity-50 text-sm tracking-wider uppercase"
          style={{
            fontFamily: "var(--font-display)",
            letterSpacing: "0.2em",
          }}
        >
          Coming soon — crossing dimensions
        </p>

        {/* Decorative halftone dots */}
        <div className="absolute inset-0 halftone-bg pointer-events-none" />
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
          <p className="text-sm opacity-40">
            © 2026 XPLORE&apos;26. All dimensions reserved.
          </p>
        </div>
      </footer>
    </main>
  );
}
