import type { Metadata, Viewport } from "next";
import {
  Inter,
  Anton,
  Bebas_Neue,
  Bangers,
  Archivo_Black,
  Space_Mono,
} from "next/font/google";
import "./globals.css";
import WebTrailCursor from "@/components/WebTrailCursor";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const anton = Anton({
  variable: "--font-anton",
  subsets: ["latin"],
  weight: "400",
});

const bebasNeue = Bebas_Neue({
  variable: "--font-bebas-neue",
  subsets: ["latin"],
  weight: "400",
});

/* ── Comic / neo-brutalist set, used by the Events section ── */

// Classic comic lettering for impact titles.
const bangers = Bangers({
  variable: "--font-bangers",
  subsets: ["latin"],
  weight: "400",
});

// Heavy, blocky grotesque — the workhorse of brutalist UI.
const archivoBlack = Archivo_Black({
  variable: "--font-archivo-black",
  subsets: ["latin"],
  weight: "400",
});

// Monospace for tags and metadata; reads as raw/technical.
const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "XPLORE'26 | Where Dimensions Collide",
  description:
    "Cross dimensions and join XPLORE'26 — a convergence of innovators, creators, and visionaries pushing the boundaries of technology and creativity.",
  keywords: ["XPLORE", "Symposium", "Conference", "Innovation", "Technology", "Spider-Verse"],
  openGraph: {
    title: "XPLORE'26 | Where Dimensions Collide",
    description:
      "Cross dimensions and join XPLORE'26 — a convergence of innovators, creators, and visionaries.",
    type: "website",
  },
};

/** `themeColor` moved out of `metadata`: this Next version only honours it in
 *  a `viewport` export and warns on every build otherwise. */
export const viewport: Viewport = {
  themeColor: "#0A0A0A",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${anton.variable} ${bebasNeue.variable} ${bangers.variable} ${archivoBlack.variable} ${spaceMono.variable} antialiased`}
    >
      <body className="min-h-screen bg-[#0A0A0A] text-[#F2EFE9] font-[var(--font-body)]">
        {/* Global noise overlay */}
        <div className="noise-overlay" aria-hidden="true" />
        <WebTrailCursor />
        {children}
      </body>
    </html>
  );
}
